import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import type { DataSource, QueryRunner } from 'typeorm';
import { getCurrentTenant } from '@belediyesinden/tenancy';
import { BasvuruDurumu, TeminatDurumu } from '@belediyesinden/shared';
import { rawQuery } from '@belediyesinden/db';
import { appendAuditLog } from '@belediyesinden/audit';
import { MinioService } from '../evrak/minio.service';
import type { Basvuru } from '../basvuru/basvuru.entity';
import type { Teminat } from './teminat.entity';

/**
 * Teminat servisi (simülasyon): e-dekont yükle + encümen onayı/bloke + iade.
 * Gerçek banka entegrasyonu için MinioService yerine bir TeminatProvider arayüzü eklenebilir.
 */
@Injectable()
export class TeminatService {
  constructor(
    private readonly minio: MinioService,
    @InjectDataSource() private readonly ds: DataSource,
  ) {}

  private qr(): QueryRunner {
    const tenant = getCurrentTenant();
    if (!tenant) {
      throw new Error('Tenant bağlamı yok');
    }
    return tenant.queryRunner;
  }

  /** Tenant'ın tüm teminatları (başvuru + ilan bağlamı ile, encümen/admin). */
  async list(limit: number, offset: number): Promise<
    Array<{
      id: string;
      basvuru_id: string;
      ilan_id: string;
      ilan_baslik: string;
      tutar: string;
      durum: string;
      dekont_dosya_adi: string | null;
      onaylayan: string | null;
      created_at: Date;
    }>
  > {
    return rawQuery(
      this.qr(),
      `SELECT t.id, t.basvuru_id, b.ilan_id, i.baslik AS ilan_baslik,
              t.tutar, t.durum, t.dekont_dosya_adi, t.onaylayan, t.created_at
       FROM teminat t
       JOIN basvuru b ON b.id = t.basvuru_id
       JOIN ilan i ON i.id = b.ilan_id
       WHERE i.deleted_at IS NULL
       ORDER BY t.created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
  }

  /** E-dekont yükle → teminat kaydı (BEKLEMEDE). Tutar = başvurunun gereken teminatı. */
  async upload(
    basvuruId: string,
    kullaniciId: string,
    file: { originalname: string; buffer: Buffer; mimetype?: string; size?: number },
  ): Promise<Teminat> {
    const tenant = getCurrentTenant();
    if (!tenant) {
      throw new Error('Tenant bağlamı yok');
    }
    const basvuruRows = await rawQuery<Basvuru>(
      this.qr(),
      'SELECT * FROM basvuru WHERE id = $1 AND kullanici_id = $2',
      [basvuruId, kullaniciId],
    );
    const basvuru = basvuruRows[0];
    if (!basvuru) {
      throw new NotFoundException('Başvuru bulunamadı');
    }
    const key = `tenant_${tenant.slug}/teminat/${randomUUID()}_${file.originalname}`;
    await this.minio.putObject(key, file.buffer, file.mimetype);
    const rows = await rawQuery<Teminat>(
      this.qr(),
      `INSERT INTO teminat (basvuru_id, tutar, durum, dekont_minio_key, dekont_dosya_adi)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [basvuruId, basvuru.gereken_teminat ?? 0, TeminatDurumu.Beklemede, key, file.originalname],
    );
    return rows[0];
  }

  /** Dekont indir (encümen/admin — onaylamadan önce gözden geçirmek için). */
  async download(id: string): Promise<{ stream: NodeJS.ReadableStream; teminat: Teminat }> {
    const rows = await rawQuery<Teminat>(this.qr(), 'SELECT * FROM teminat WHERE id = $1', [id]);
    const teminat = rows[0];
    if (!teminat) {
      throw new NotFoundException('Teminat bulunamadı');
    }
    if (!teminat.dekont_minio_key) {
      throw new BadRequestException('Bu teminat için yüklenmiş bir dekont yok');
    }
    const stream = (await this.minio.getObject(teminat.dekont_minio_key)) as NodeJS.ReadableStream;
    return { stream, teminat };
  }

  /** Encümen onayı: BEKLEMEDE → BLOKE_EDILDI; başvuru → ONAYLANDI. */
  async approve(id: string, onaylayan: string): Promise<Teminat> {
    const rows = await rawQuery<Teminat>(
      this.qr(),
      'UPDATE teminat SET durum=$1, onaylayan=$2, onay_tarihi=$3 WHERE id=$4 AND durum=$5 RETURNING *',
      [TeminatDurumu.BlokeEdildi, onaylayan, new Date(), id, TeminatDurumu.Beklemede],
    );
    if (!rows[0]) {
      throw new BadRequestException('Teminat BEKLEMEDE durumunda değil veya bulunamadı');
    }
    await this.qr().query('UPDATE basvuru SET durum=$1 WHERE id=$2', [BasvuruDurumu.Onaylandi, rows[0].basvuru_id]);
    this.audit('TEMINAT_ONAYLA', id, onaylayan, { basvuru_id: rows[0].basvuru_id, tutar: rows[0].tutar });
    return rows[0];
  }

  /** Reddet: BEKLEMEDE → REDDEDILDI; başvuru → REDDEDILDI. */
  async reject(id: string): Promise<Teminat> {
    const rows = await rawQuery<Teminat>(
      this.qr(),
      'UPDATE teminat SET durum=$1 WHERE id=$2 AND durum=$3 RETURNING *',
      [TeminatDurumu.Reddedildi, id, TeminatDurumu.Beklemede],
    );
    if (!rows[0]) {
      throw new BadRequestException('Teminat reddedilebilir durumda değil');
    }
    await this.qr().query('UPDATE basvuru SET durum=$1 WHERE id=$2', [BasvuruDurumu.Reddedildi, rows[0].basvuru_id]);
    this.audit('TEMINAT_REDDET', id, 'system:teminat', { basvuru_id: rows[0].basvuru_id });
    return rows[0];
  }

  /** İade: BLOKE_EDILDI → IADE_EDILDI; başvuru → IADE_EDILDI. */
  async iade(id: string): Promise<Teminat> {
    const rows = await rawQuery<Teminat>(
      this.qr(),
      'UPDATE teminat SET durum=$1, iade_tarihi=$2 WHERE id=$3 AND durum=$4 RETURNING *',
      [TeminatDurumu.IadeEdildi, new Date(), id, TeminatDurumu.BlokeEdildi],
    );
    if (!rows[0]) {
      throw new BadRequestException('Teminat iade edilebilir durumda değil');
    }
    await this.qr().query('UPDATE basvuru SET durum=$1 WHERE id=$2', [BasvuruDurumu.IadeEdildi, rows[0].basvuru_id]);
    this.audit('TEMINAT_IADE', id, 'system:teminat', { basvuru_id: rows[0].basvuru_id, tutar: rows[0].tutar });
    return rows[0];
  }

  /** Audit yardımcı (fire-and-forget, hash-chain). */
  private audit(action: string, entityId: string, actorId: string, payload: Record<string, unknown>): void {
    appendAuditLog(this.ds, {
      tenantId: getCurrentTenant()?.slug ?? null,
      actorId,
      action,
      entityType: 'teminat',
      entityId,
      payload,
    }).catch(() => {});
  }
}

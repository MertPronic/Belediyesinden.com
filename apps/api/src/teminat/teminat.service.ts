import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { QueryRunner } from 'typeorm';
import { getCurrentTenant } from '@belediyesinden/tenancy';
import { BasvuruDurumu, TeminatDurumu } from '@belediyesinden/shared';
import { rawQuery } from '@belediyesinden/db';
import { MinioService } from '../evrak/minio.service';
import type { Basvuru } from '../basvuru/basvuru.entity';
import type { Teminat } from './teminat.entity';

/**
 * Teminat servisi (simülasyon): e-dekont yükle + encümen onayı/bloke + iade.
 * Gerçek banka entegrasyonu için MinioService yerine bir TeminatProvider arayüzü eklenebilir.
 */
@Injectable()
export class TeminatService {
  constructor(private readonly minio: MinioService) {}

  private qr(): QueryRunner {
    const tenant = getCurrentTenant();
    if (!tenant) {
      throw new Error('Tenant bağlamı yok');
    }
    return tenant.queryRunner;
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
    return rows[0];
  }
}

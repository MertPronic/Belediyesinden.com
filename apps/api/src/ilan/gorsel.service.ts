import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { getCurrentTenant } from '@belediyesinden/tenancy';
import { appendAuditLog } from '@belediyesinden/audit';
import { rawQuery } from '@belediyesinden/db';
import { MinioService } from '../evrak/minio.service';

export interface Gorsel {
  id: string;
  ilan_id: string;
  dosya_adi: string;
  content_type: string | null;
  boyut: number | null;
  sira: number;
  created_at: Date;
}

/** İlan görsel servisi: MinIO + tenant DB (ilan_gorseller). */
@Injectable()
export class GorselService {
  constructor(
    private readonly minio: MinioService,
    @InjectDataSource() private readonly ds: DataSource,
  ) {}

  private qr() {
    const t = getCurrentTenant();
    if (!t) throw new Error('Tenant bağlamı yok');
    return t.queryRunner;
  }

  /** Çoklu görsel yükle (TenantAdmin). */
  async upload(
    ilanId: string,
    files: { originalname: string; buffer: Buffer; mimetype?: string; size?: number }[],
  ): Promise<Gorsel[]> {
    const tenant = getCurrentTenant();
    if (!tenant) throw new Error('Tenant bağlamı yok');
    const result: Gorsel[] = [];
    for (const f of files) {
      const key = `tenant_${tenant.slug}/ilan_${ilanId}/gorsel_${randomUUID()}_${f.originalname}`;
      await this.minio.putObject(key, f.buffer, f.mimetype);
      const rows = await rawQuery<Gorsel>(
        tenant.queryRunner,
        `INSERT INTO ilan_gorseller (ilan_id, minio_key, dosya_adi, content_type, boyut)
         VALUES ($1, $2, $3, $4, $5) RETURNING id, ilan_id, dosya_adi, content_type, boyut, sira, created_at`,
        [ilanId, key, f.originalname, f.mimetype ?? null, f.size ?? f.buffer.length],
      );
      result.push(rows[0]);
    }
    appendAuditLog(this.ds, {
      tenantId: tenant.slug,
      actorId: 'system:gorsel',
      action: 'ILAN_GORSEL_YUKLE',
      entityType: 'ilan_gorseller',
      entityId: ilanId,
      payload: { adet: files.length },
    }).catch(() => {});
    return result;
  }

  /** İlan'ın görselleri (minio_key hariç — galeri için id listesi). */
  async listByIlan(ilanId: string): Promise<Gorsel[]> {
    return rawQuery(
      this.qr(),
      `SELECT id, ilan_id, dosya_adi, content_type, boyut, sira, created_at
       FROM ilan_gorseller WHERE ilan_id = $1 ORDER BY sira, created_at`,
      [ilanId],
    );
  }

  /** Görseli MinIO'dan stream et (galeri <img> proxy'si için). */
  async stream(id: string): Promise<{ stream: NodeJS.ReadableStream; gorsel: { content_type: string | null; dosya_adi: string } }> {
    const rows = await rawQuery<{ minio_key: string; content_type: string | null; dosya_adi: string }>(
      this.qr(),
      'SELECT minio_key, content_type, dosya_adi FROM ilan_gorseller WHERE id = $1',
      [id],
    );
    if (!rows[0]) throw new NotFoundException('Görsel bulunamadı');
    const stream = (await this.minio.getObject(rows[0].minio_key)) as NodeJS.ReadableStream;
    return { stream, gorsel: { content_type: rows[0].content_type, dosya_adi: rows[0].dosya_adi } };
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { getCurrentTenant } from '@belediyesinden/tenancy';
import { rawQuery } from '@belediyesinden/db';
import { MinioService } from './minio.service';
import type { Evrak } from './evrak.entity';

/** Tenant-scoped evrak servisi: MinIO + DB kaydı. */
@Injectable()
export class EvrakService {
  constructor(private readonly minio: MinioService) {}

  /** İlan'ın evraklarını listele (minio_key hariç — güvenli özet). */
  async listByIlan(ilanId: string): Promise<
    Array<{
      id: string;
      ilan_id: string;
      dosya_adi: string;
      content_type: string | null;
      boyut: number | null;
      created_at: Date;
    }>
  > {
    const tenant = getCurrentTenant();
    if (!tenant) {
      throw new Error('Tenant bağlamı yok');
    }
    return rawQuery(
      tenant.queryRunner,
      `SELECT id, ilan_id, dosya_adi, content_type, boyut, created_at
       FROM evrak WHERE ilan_id = $1 ORDER BY created_at DESC`,
      [ilanId],
    );
  }

  async upload(
    ilanId: string,
    file: { originalname: string; buffer: Buffer; mimetype?: string; size?: number },
  ): Promise<Evrak> {
    const tenant = getCurrentTenant();
    if (!tenant) {
      throw new Error('Tenant bağlamı yok');
    }
    const key = `tenant_${tenant.slug}/ilan_${ilanId}/${randomUUID()}_${file.originalname}`;
    await this.minio.putObject(key, file.buffer, file.mimetype);
    const rows = await rawQuery<Evrak>(
      tenant.queryRunner,
      `INSERT INTO evrak (ilan_id, dosya_adi, minio_key, content_type, boyut)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [ilanId, file.originalname, key, file.mimetype ?? null, file.size ?? file.buffer.length],
    );
    return rows[0];
  }

  async download(evrakId: string): Promise<{ stream: NodeJS.ReadableStream; evrak: Evrak }> {
    const tenant = getCurrentTenant();
    if (!tenant) {
      throw new Error('Tenant bağlamı yok');
    }
    const rows = await rawQuery<Evrak>(tenant.queryRunner, 'SELECT * FROM evrak WHERE id = $1', [evrakId]);
    const evrak = rows[0];
    if (!evrak) {
      throw new NotFoundException('Evrak bulunamadı');
    }
    const stream = (await this.minio.getObject(evrak.minio_key)) as NodeJS.ReadableStream;
    return { stream, evrak };
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { getCurrentTenant } from '@belediyesinden/tenancy';
import { MinioService } from './minio.service';
import type { Evrak } from './evrak.entity';

/** Tenant-scoped evrak servisi: MinIO + DB kaydı. */
@Injectable()
export class EvrakService {
  constructor(private readonly minio: MinioService) {}

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
    const rows: Evrak[] = await tenant.queryRunner.query(
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
    const rows: Evrak[] = await tenant.queryRunner.query('SELECT * FROM evrak WHERE id = $1', [evrakId]);
    const evrak = rows[0];
    if (!evrak) {
      throw new NotFoundException('Evrak bulunamadı');
    }
    const stream = (await this.minio.getObject(evrak.minio_key)) as NodeJS.ReadableStream;
    return { stream, evrak };
  }
}

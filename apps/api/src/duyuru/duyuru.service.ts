import { Injectable } from '@nestjs/common';
import type { QueryRunner } from 'typeorm';
import { getCurrentTenant } from '@belediyesinden/tenancy';
import { rawQuery } from '@belediyesinden/db';
import { Duyuru } from './duyuru.entity';

/**
 * Tenant-scoped duyuru servisi. Raw sorguları aktif tenant'ın QueryRunner'ında
 * çalıştırır (search_path → tenant_<slug>).
 */
@Injectable()
export class DuyuruService {
  private qr(): QueryRunner {
    const tenant = getCurrentTenant();
    if (!tenant) {
      throw new Error('Tenant bağlamı yok (TenancyInterceptor / TenantGuard çalışmamış olabilir)');
    }
    return tenant.queryRunner;
  }

  list(): Promise<Duyuru[]> {
    return rawQuery<Duyuru>(this.qr(), 'SELECT * FROM duyuru ORDER BY created_at DESC');
  }

  async create(baslik: string, icerik: string | null): Promise<Duyuru> {
    const rows = await rawQuery<Duyuru>(
      this.qr(),
      'INSERT INTO duyuru (baslik, icerik) VALUES ($1, $2) RETURNING *',
      [baslik, icerik],
    );
    return rows[0];
  }
}

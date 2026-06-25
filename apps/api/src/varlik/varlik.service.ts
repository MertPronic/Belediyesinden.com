import { Injectable } from '@nestjs/common';
import type { QueryRunner } from 'typeorm';
import { getCurrentTenant } from '@belediyesinden/tenancy';
import { Varlik } from './varlik.entity';

/** Tenant-scoped varlık servisi (raw sorgu → search_path → tenant_<slug>). */
@Injectable()
export class VarlikService {
  private qr(): QueryRunner {
    const tenant = getCurrentTenant();
    if (!tenant) {
      throw new Error('Tenant bağlamı yok');
    }
    return tenant.queryRunner;
  }

  list(tip?: string): Promise<Varlik[]> {
    return tip
      ? this.qr().query('SELECT * FROM varlik WHERE tip = $1 ORDER BY created_at DESC', [tip])
      : this.qr().query('SELECT * FROM varlik ORDER BY created_at DESC');
  }

  async get(id: string): Promise<Varlik | null> {
    const rows: Varlik[] = await this.qr().query('SELECT * FROM varlik WHERE id = $1', [id]);
    return rows[0] ?? null;
  }

  async create(data: {
    tip: string;
    ad: string;
    aciklama?: string | null;
    detay?: Record<string, unknown>;
  }): Promise<Varlik> {
    const rows: Varlik[] = await this.qr().query(
      'INSERT INTO varlik (tip, ad, aciklama, detay) VALUES ($1, $2, $3, $4) RETURNING *',
      [data.tip, data.ad, data.aciklama ?? null, JSON.stringify(data.detay ?? {})],
    );
    return rows[0];
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource, QueryRunner } from 'typeorm';
import { getCurrentTenant } from '@belediyesinden/tenancy';
import { appendAuditLog } from '@belediyesinden/audit';
import { rawQuery } from '@belediyesinden/db';
import { Varlik } from './varlik.entity';

/** Tenant-scoped varlık servisi (raw sorgu → search_path → tenant_<slug>). */
@Injectable()
export class VarlikService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  private qr(): QueryRunner {
    const tenant = getCurrentTenant();
    if (!tenant) {
      throw new Error('Tenant bağlamı yok');
    }
    return tenant.queryRunner;
  }

  list(limit: number, offset: number, tip?: string): Promise<Varlik[]> {
    return tip
      ? rawQuery<Varlik>(
          this.qr(),
          'SELECT * FROM varlik WHERE tip = $1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT $2 OFFSET $3',
          [tip, limit, offset],
        )
      : rawQuery<Varlik>(
          this.qr(),
          'SELECT * FROM varlik WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT $1 OFFSET $2',
          [limit, offset],
        );
  }

  async get(id: string): Promise<Varlik | null> {
    const rows = await rawQuery<Varlik>(
      this.qr(),
      'SELECT * FROM varlik WHERE id = $1 AND deleted_at IS NULL',
      [id],
    );
    return rows[0] ?? null;
  }

  async create(data: {
    tip: string;
    ad: string;
    aciklama?: string | null;
    detay?: Record<string, unknown>;
  }): Promise<Varlik> {
    const rows = await rawQuery<Varlik>(
      this.qr(),
      'INSERT INTO varlik (tip, ad, aciklama, detay) VALUES ($1, $2, $3, $4) RETURNING *',
      [data.tip, data.ad, data.aciklama ?? null, JSON.stringify(data.detay ?? {})],
    );
    return rows[0];
  }

  /** Varlık güncelle (sadece ad/aciklama/detay; tip değişmez). */
  async update(
    id: string,
    data: { ad?: string; aciklama?: string | null; detay?: Record<string, unknown> },
  ): Promise<Varlik> {
    const mevcut = await this.get(id);
    if (!mevcut) {
      throw new NotFoundException('Varlık bulunamadı');
    }
    const ad = data.ad ?? mevcut.ad;
    const aciklama = data.aciklama !== undefined ? data.aciklama : mevcut.aciklama;
    const detay = data.detay !== undefined ? data.detay : mevcut.detay;
    const rows = await rawQuery<Varlik>(
      this.qr(),
      'UPDATE varlik SET ad = $1, aciklama = $2, detay = $3 WHERE id = $4 RETURNING *',
      [ad, aciklama, JSON.stringify(detay), id],
    );
    this.audit('VARLIK_GUNCELLE', id, { ad, tip: mevcut.tip });
    return rows[0];
  }

  /** Varlık sil (soft delete — hard DELETE yasak, CLAUDE.md). */
  async remove(id: string): Promise<void> {
    const mevcut = await this.get(id);
    if (!mevcut) {
      throw new NotFoundException('Varlık bulunamadı');
    }
    await rawQuery(this.qr(), 'UPDATE varlik SET deleted_at = now() WHERE id = $1', [id]);
    this.audit('VARLIK_SIL', id, { ad: mevcut.ad, tip: mevcut.tip });
  }

  private audit(action: string, entityId: string, payload: Record<string, unknown>): void {
    appendAuditLog(this.ds, {
      tenantId: getCurrentTenant()?.slug ?? null,
      actorId: 'system:varlik',
      action,
      entityType: 'varlik',
      entityId,
      payload,
    }).catch(() => {});
  }
}

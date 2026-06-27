import { Injectable } from '@nestjs/common';
import type { QueryRunner } from 'typeorm';
import { getCurrentTenant } from '@belediyesinden/tenancy';
import { rawQuery } from '@belediyesinden/db';

export interface TenantRaporu {
  ilanlar: Record<string, number>;
  teklifSayisi: number;
  basvurular: Record<string, number>;
  varliklar: Record<string, number>;
}

/** Tenant-scoped raporlama (dashboard aggregasyonları). */
@Injectable()
export class RaporService {
  private qr(): QueryRunner {
    const tenant = getCurrentTenant();
    if (!tenant) {
      throw new Error('Tenant bağlamı yok');
    }
    return tenant.queryRunner;
  }

  private toRecord(
    rows: Array<Record<string, string>>,
    keyField: string,
    valueField: string,
  ): Record<string, number> {
    const result: Record<string, number> = {};
    for (const row of rows) {
      result[row[keyField]] = Number(row[valueField]);
    }
    return result;
  }

  /** Tenant dashboard özeti: ilan/teklif/başvuru/varlık sayıları. */
  async ozet(): Promise<TenantRaporu> {
    const qr = this.qr();

    const [ilanlar, teklifler, basvurular, varliklar] = await Promise.all([
      rawQuery<Record<string, string>>(qr, 'SELECT durum, COUNT(*)::text AS count FROM ilan GROUP BY durum'),
      rawQuery<Record<string, string>>(qr, 'SELECT COUNT(*)::text AS count FROM teklif WHERE kabul_edildi = true'),
      rawQuery<Record<string, string>>(qr, 'SELECT durum, COUNT(*)::text AS count FROM basvuru GROUP BY durum'),
      rawQuery<Record<string, string>>(qr, 'SELECT tip, COUNT(*)::text AS count FROM varlik GROUP BY tip'),
    ]);

    return {
      ilanlar: this.toRecord(ilanlar, 'durum', 'count'),
      teklifSayisi: Number(teklifler[0]?.['count'] ?? 0),
      basvurular: this.toRecord(basvurular, 'durum', 'count'),
      varliklar: this.toRecord(varliklar, 'tip', 'count'),
    };
  }
}

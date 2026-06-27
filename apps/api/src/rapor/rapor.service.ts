import { Injectable } from '@nestjs/common';
import type { QueryRunner } from 'typeorm';
import { getCurrentTenant } from '@belediyesinden/tenancy';
import { rawQuery } from '@belediyesinden/db';

export interface TenantRaporu {
  ilanlar: Record<string, number>;
  teklifSayisi: number;
  basvurular: Record<string, number>;
  varliklar: Record<string, number>;
  katilimciSayisi: number;
  /** SONUCLANDI ilanların kazanan teklif tutarı toplamı. */
  gelir: number;
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

    const [ilanlar, teklifler, basvurular, varliklar, katilimcilar, gelirRows] = await Promise.all([
      rawQuery<Record<string, string>>(qr, 'SELECT durum, COUNT(*)::text AS count FROM ilan GROUP BY durum'),
      rawQuery<Record<string, string>>(qr, 'SELECT COUNT(*)::text AS count FROM teklif WHERE kabul_edildi = true'),
      rawQuery<Record<string, string>>(qr, 'SELECT durum, COUNT(*)::text AS count FROM basvuru GROUP BY durum'),
      rawQuery<Record<string, string>>(qr, 'SELECT tip, COUNT(*)::text AS count FROM varlik GROUP BY tip'),
      rawQuery<Record<string, string>>(
        qr,
        'SELECT COUNT(DISTINCT kullanici_id)::text AS count FROM basvuru',
      ),
      // Gelir: SONUCLANDI ilanların en yüksek teklif toplamı (kazanan tutar).
      rawQuery<Record<string, string>>(
        qr,
        `SELECT COALESCE(SUM(m.tutar), 0)::text AS gelir
         FROM (SELECT ilan_id, MAX(tutar) AS tutar
               FROM teklif WHERE kabul_edildi = true GROUP BY ilan_id) m
         JOIN ilan i ON i.id = m.ilan_id AND i.durum = 'SONUCLANDI'`,
      ),
    ]);

    return {
      ilanlar: this.toRecord(ilanlar, 'durum', 'count'),
      teklifSayisi: Number(teklifler[0]?.['count'] ?? 0),
      basvurular: this.toRecord(basvurular, 'durum', 'count'),
      varliklar: this.toRecord(varliklar, 'tip', 'count'),
      katilimciSayisi: Number(katilimcilar[0]?.['count'] ?? 0),
      gelir: Number(gelirRows[0]?.['gelir'] ?? 0),
    };
  }
}

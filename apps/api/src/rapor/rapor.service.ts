import { Injectable } from '@nestjs/common';
import type { QueryRunner } from 'typeorm';
import { getCurrentTenant } from '@belediyesinden/tenancy';
import { rawQuery } from '@belediyesinden/db';

export interface TenantRaporu {
  ilanlar: Record<string, number>;
  /** İhale kalemi (KK-25) durum dağılımı — asıl ihale/teklif birimi, `ilanlar`dan daha ince taneli. */
  ihaleKalemleri: Record<string, number>;
  teklifSayisi: number;
  basvurular: Record<string, number>;
  varliklar: Record<string, number>;
  katilimciSayisi: number;
  /** SONUCLANDI ihale kalemlerinin kazanan teklif tutarı toplamı. */
  gelir: number;
  /** ONAYLANDI durumundaki teminatların toplam tutarı. */
  teminatToplam: number;
  /** Önümüzdeki 7 gün içinde başlayacak/devam eden ihale kalemi sayısı. */
  yaklasanIhaleSayisi: number;
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

  /** Tenant dashboard özeti: ilan/ihale/teklif/başvuru/varlık/teminat sayıları. */
  async ozet(): Promise<TenantRaporu> {
    const qr = this.qr();

    const [ilanlar, ihaleKalemleri, teklifler, basvurular, varliklar, katilimcilar, gelirRows, teminatRows, yaklasanRows] =
      await Promise.all([
        rawQuery<Record<string, string>>(qr, 'SELECT durum, COUNT(*)::text AS count FROM ilan WHERE deleted_at IS NULL GROUP BY durum'),
        rawQuery<Record<string, string>>(qr, 'SELECT durum, COUNT(*)::text AS count FROM ilan_kalemi WHERE deleted_at IS NULL GROUP BY durum'),
        rawQuery<Record<string, string>>(qr, 'SELECT COUNT(*)::text AS count FROM teklif WHERE kabul_edildi = true'),
        rawQuery<Record<string, string>>(qr, 'SELECT durum, COUNT(*)::text AS count FROM basvuru GROUP BY durum'),
        rawQuery<Record<string, string>>(qr, 'SELECT tip, COUNT(*)::text AS count FROM varlik WHERE deleted_at IS NULL GROUP BY tip'),
        rawQuery<Record<string, string>>(
          qr,
          'SELECT COUNT(DISTINCT kullanici_id)::text AS count FROM basvuru',
        ),
        // Gelir: SONUCLANDI ihale kalemlerinin (KK-25 — asıl ihale birimi) kazanan_tutar toplamı.
        rawQuery<Record<string, string>>(
          qr,
          `SELECT COALESCE(SUM(kazanan_tutar), 0)::text AS gelir
           FROM ilan_kalemi WHERE durum = 'SONUCLANDI' AND kazanan_tutar IS NOT NULL AND deleted_at IS NULL`,
        ),
        rawQuery<Record<string, string>>(
          qr,
          `SELECT COALESCE(SUM(tutar), 0)::text AS toplam FROM teminat WHERE durum = 'ONAYLANDI'`,
        ),
        rawQuery<Record<string, string>>(
          qr,
          `SELECT COUNT(*)::text AS count FROM ilan_kalemi
           WHERE deleted_at IS NULL AND durum IN ('BEKLIYOR', 'CANLI_ARTIRMA')
             AND bitis_tarihi > now() AND bitis_tarihi <= now() + interval '7 days'`,
        ),
      ]);

    return {
      ilanlar: this.toRecord(ilanlar, 'durum', 'count'),
      ihaleKalemleri: this.toRecord(ihaleKalemleri, 'durum', 'count'),
      teklifSayisi: Number(teklifler[0]?.['count'] ?? 0),
      basvurular: this.toRecord(basvurular, 'durum', 'count'),
      varliklar: this.toRecord(varliklar, 'tip', 'count'),
      katilimciSayisi: Number(katilimcilar[0]?.['count'] ?? 0),
      gelir: Number(gelirRows[0]?.['gelir'] ?? 0),
      teminatToplam: Number(teminatRows[0]?.['toplam'] ?? 0),
      yaklasanIhaleSayisi: Number(yaklasanRows[0]?.['count'] ?? 0),
    };
  }
}

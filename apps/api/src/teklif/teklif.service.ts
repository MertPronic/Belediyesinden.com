import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { QueryRunner } from 'typeorm';
import { getCurrentTenant } from '@belediyesinden/tenancy';
import { IhaleTipi, IlanDurumu } from '@belediyesinden/shared';
import { getIlanKurallari } from '@belediyesinden/rule-engine';
import { rawQuery } from '@belediyesinden/db';
import { sureUzat, sureUzatmaGerekirMi, teklifDogrula } from '@belediyesinden/auction-core';
import type { Ilan } from '../ilan/ilan.entity';
import type { Teklif } from './teklif.entity';

/**
 * Teklif servisi — server-authoritative teklif işleme.
 * Akış: ilan doğrula → mevcut en yüksek teklif → kural çek → teklifDogrula →
 * DB'ye yaz → anti-snipping süre uzatma kontrolü.
 */
@Injectable()
export class TeklifService {
  private qr(): QueryRunner {
    const tenant = getCurrentTenant();
    if (!tenant) {
      throw new Error('Tenant bağlamı yok');
    }
    return tenant.queryRunner;
  }

  list(ilanId: string): Promise<Teklif[]> {
    return rawQuery<Teklif>(
      this.qr(),
      'SELECT * FROM teklif WHERE ilan_id = $1 AND kabul_edildi = true ORDER BY tutar DESC',
      [ilanId],
    );
  }

  async submit(ilanId: string, kullaniciId: string, tutar: number): Promise<Teklif> {
    const qr = this.qr();

    const ilanRows = await rawQuery<Ilan>(qr, 'SELECT * FROM ilan WHERE id = $1', [ilanId]);
    const ilan = ilanRows[0];
    if (!ilan) {
      throw new NotFoundException('İlan bulunamadı');
    }
    if (ilan.durum !== IlanDurumu.Yayinda) {
      throw new BadRequestException('İlan yayında değil');
    }

    // Mevcut en yüksek teklif.
    const maxRows = await rawQuery<{ max: string | null }>(
      qr,
      'SELECT MAX(tutar) AS max FROM teklif WHERE ilan_id = $1 AND kabul_edildi = true',
      [ilanId],
    );
    const mevcutEnYuksek = Number(maxRows[0]?.max ?? 0);

    // Kural motoru.
    const kurallar = await getIlanKurallari(qr, ilan.ihale_tipi as IhaleTipi);

    // Teklif doğrulama (server-authoritative).
    const bitis = new Date(ilan.bitis_tarihi ?? Date.now());
    const sonuc = teklifDogrula(tutar, {
      mevcutEnYuksekTeklif: mevcutEnYuksek,
      minArtirmaAdimi: kurallar.minArtirmaAdimi,
      baslangicFiyati: Number(ilan.baslangic_fiyati),
      bitisTarihi: bitis,
      ihaleTipi: ilan.ihale_tipi,
    });
    if (!sonuc.gecerli) {
      throw new BadRequestException(sonuc.hata ?? 'Geçersiz teklif');
    }

    // Teklifi kaydet.
    const rows = await rawQuery<Teklif>(
      qr,
      'INSERT INTO teklif (ilan_id, kullanici_id, tutar, kabul_edildi) VALUES ($1, $2, $3, true) RETURNING *',
      [ilanId, kullaniciId, tutar],
    );

    // Anti-snipping: bitişe yakınsa süreyi uzat.
    if (sureUzatmaGerekirMi(bitis, kurallar.sureUzatmaDakika)) {
      const yeniBitis = sureUzat(bitis, kurallar.sureUzatmaDakika);
      await qr.query('UPDATE ilan SET bitis_tarihi = $1 WHERE id = $2', [yeniBitis, ilanId]);
    }

    return rows[0];
  }
}

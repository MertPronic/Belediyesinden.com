import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, type QueryRunner } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { appendAuditLog } from '@belediyesinden/audit';
import { getCurrentTenant } from '@belediyesinden/tenancy';
import { BasvuruDurumu, IhaleTipi, IlanDurumu } from '@belediyesinden/shared';
import { getIlanKurallari } from '@belediyesinden/rule-engine';
import { rawQuery } from '@belediyesinden/db';
import { sureUzat, sureUzatmaGerekirMi, teklifDogrula } from '@belediyesinden/auction-core';
import { AuctionGateway } from '../auction/auction-gateway';
import type { Ilan } from '../ilan/ilan.entity';
import type { Teklif } from './teklif.entity';

/**
 * Teklif servisi — server-authoritative teklif işleme.
 * Akış: ilan doğrula → mevcut en yüksek teklif → kural çek → teklifDogrula →
 * DB'ye yaz → anti-snipping süre uzatma kontrolü.
 */
@Injectable()
export class TeklifService {
  constructor(
    private readonly gateway: AuctionGateway,
    @InjectDataSource() private readonly ds: DataSource,
  ) {}

  private qr(): QueryRunner {
    const tenant = getCurrentTenant();
    if (!tenant) {
      throw new Error('Tenant bağlamı yok');
    }
    return tenant.queryRunner;
  }

  /**
   * Katılımcı adı yalnızca açık artırmada döner (salon usulü — herkes birbirini görür).
   * Açık/kapalı teklifte anonim kalır (2886 kapalı teklif usulü ile tutarlı).
   */
  list(ilanId: string, limit: number, offset: number): Promise<Teklif[]> {
    return rawQuery<Teklif>(
      this.qr(),
      `SELECT t.id, t.ilan_id, t.kullanici_id, t.tutar, t.kabul_edildi, t.created_at,
              CASE WHEN i.ihale_tipi = $4 THEN t.kullanici_ad ELSE NULL END AS kullanici_ad
       FROM teklif t JOIN ilan i ON i.id = t.ilan_id
       WHERE t.ilan_id = $1 AND t.kabul_edildi = true
       ORDER BY t.tutar DESC LIMIT $2 OFFSET $3`,
      [ilanId, limit, offset, IhaleTipi.AcikArtirma],
    );
  }

  /** Kullanıcının kendi teklifleri (ilan başlığı join'li). */
  async listMy(kullaniciId: string, limit: number, offset: number): Promise<
    Array<{ id: string; ilan_id: string; ilan_baslik: string; tutar: string; kabul_edildi: boolean; created_at: Date }>
  > {
    return rawQuery(
      this.qr(),
      `SELECT t.id, t.ilan_id, i.baslik AS ilan_baslik, t.tutar, t.kabul_edildi, t.created_at
       FROM teklif t JOIN ilan i ON i.id = t.ilan_id
       WHERE t.kullanici_id = $1 AND i.deleted_at IS NULL ORDER BY t.created_at DESC LIMIT $2 OFFSET $3`,
      [kullaniciId, limit, offset],
    );
  }

  async submit(ilanId: string, kullaniciId: string, tutar: number, kullaniciAd: string | null): Promise<Teklif> {
    const qr = this.qr();

    // FOR UPDATE: aynı ilana eşzamanlı gelen teklifleri sıraya sokar (satır kilidi,
    // transaction commit/rollback'te otomatik serbest kalır). Aynı anda çok sayıda
    // teklif gelse de her biri bir öncekinin commit ettiği GÜNCEL en yüksek teklifi
    // görerek doğrulanır — race condition'ı kapatır. Başka ilanları etkilemez.
    const ilanRows = await rawQuery<Ilan>(
      qr,
      'SELECT * FROM ilan WHERE id = $1 AND deleted_at IS NULL FOR UPDATE',
      [ilanId],
    );
    const ilan = ilanRows[0];
    if (!ilan) {
      throw new NotFoundException('İlan bulunamadı');
    }
    if (ilan.durum !== IlanDurumu.CanliArtirma) {
      throw new BadRequestException('İhale henüz başlamadı');
    }

    // Katılım şartı: bu ilana onaylanmış (teminatı bloke edilmiş) başvurusu olmayan teklif veremez.
    const basvuruRows = await rawQuery<{ id: string }>(
      qr,
      'SELECT id FROM basvuru WHERE ilan_id = $1 AND kullanici_id = $2 AND durum = $3 LIMIT 1',
      [ilanId, kullaniciId, BasvuruDurumu.Onaylandi],
    );
    if (!basvuruRows[0]) {
      throw new BadRequestException('Bu ihaleye katılmak için onaylanmış başvurunuz ve teminatınız olmalı');
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
      'INSERT INTO teklif (ilan_id, kullanici_id, kullanici_ad, tutar, kabul_edildi) VALUES ($1, $2, $3, $4, true) RETURNING *',
      [ilanId, kullaniciId, kullaniciAd, tutar],
    );
    const teklif = rows[0];

    // Gerçek zamanlı yayın (ws, tenant izolasyonlu) — isim yalnızca açık artırmada.
    const tenantSlug = getCurrentTenant()?.slug ?? '';
    this.gateway.broadcastTeklif(tenantSlug, ilanId, {
      id: teklif.id,
      kullanici_id: teklif.kullanici_id,
      kullanici_ad: ilan.ihale_tipi === IhaleTipi.AcikArtirma ? kullaniciAd : null,
      tutar: teklif.tutar,
    });

    // Audit (hash-chain) — fire-and-forget.
    appendAuditLog(this.ds, {
      tenantId: getCurrentTenant()?.slug ?? null,
      actorId: kullaniciId,
      action: 'TEKLIF_SUBMIT',
      entityType: 'ilan',
      entityId: ilanId,
      payload: { tutar },
    }).catch(() => {});

    // Anti-snipping: bitişe yakınsa süreyi uzat.
    if (sureUzatmaGerekirMi(bitis, kurallar.sureUzatmaDakika)) {
      const yeniBitis = sureUzat(bitis, kurallar.sureUzatmaDakika);
      await qr.query('UPDATE ilan SET bitis_tarihi = $1 WHERE id = $2', [yeniBitis, ilanId]);
    }

    return teklif;
  }
}

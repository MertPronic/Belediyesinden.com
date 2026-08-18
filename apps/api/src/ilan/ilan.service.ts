import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, type QueryRunner } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { appendAuditLog } from '@belediyesinden/audit';
import { getCurrentTenant } from '@belediyesinden/tenancy';
import { EvrakTipi, IhaleTipi, IlanDurumu, IslemTuru, KatilimSarti } from '@belediyesinden/shared';
import { getIlanKurallari } from '@belediyesinden/rule-engine';
import { ihaleBaslatDogrula, ilanGecisGecerliMi, publishDogrula, yayinOnKosullariGecerliMi } from '@belediyesinden/ilan-core';
import { rawQuery } from '@belediyesinden/db';
import { OpenSearchService } from '../search/opensearch.service';
import { TeminatIadeService } from '../teminat/teminat-iade.service';
import { IlanKalemiService } from './ilan-kalemi.service';
import type { IlanKalemi } from './ilan-kalemi.entity';
import type { Ilan } from './ilan.entity';

const GECERLI_TIP = new Set<string>(Object.values(IhaleTipi));
const GECERLI_ISLEM_TURU = new Set<string>(Object.values(IslemTuru));
const GECERLI_DURUM = new Set<string>(Object.values(IlanDurumu));

/** Tenant-scoped ilan servisi + durum makinesi. */
@Injectable()
export class IlanService {
  constructor(
    private readonly os: OpenSearchService,
    @InjectDataSource() private readonly ds: DataSource,
    private readonly iadeService: TeminatIadeService,
    private readonly kalemler: IlanKalemiService,
  ) {}

  /**
   * Arama indeksini ilanın güncel durumuyla senkronlar (yayınla/iptal/sonuçlandır sonrası).
   * Fire-and-forget dokümante edilmiş yan etki (CLAUDE.md) — hata sessizce yutulur.
   */
  private async syncSearchIndex(ilan: Ilan): Promise<void> {
    const tenant = getCurrentTenant();
    if (!tenant) return;
    try {
      const [tenantRows, gorselRows, kalemler] = await Promise.all([
        rawQuery<{ ad: string }>(this.qr(), 'SELECT ad FROM shared.tenants WHERE slug = $1', [tenant.slug]),
        rawQuery<{ id: string }>(
          this.qr(),
          'SELECT id FROM ilan_gorseller WHERE ilan_id = $1 ORDER BY sira, created_at LIMIT 1',
          [ilan.id],
        ),
        this.kalemler.list(ilan.id),
      ]);
      // Çoklu-varlık ilanlarda tek `baslangic_fiyati` yok — kalemlerin fiyat
      // aralığı (KK-25) arama sonuçlarında "X - Y ₺" gösterebilsin diye indekslenir.
      const kalemFiyatlari = kalemler.map((k) => Number(k.baslangic_fiyati));
      const fiyatMin = kalemFiyatlari.length ? Math.min(...kalemFiyatlari) : null;
      const fiyatMax = kalemFiyatlari.length ? Math.max(...kalemFiyatlari) : null;
      await this.os.indexIlan(tenant.slug, {
        id: ilan.id,
        baslik: ilan.baslik,
        aciklama: ilan.aciklama,
        ihale_tipi: ilan.ihale_tipi,
        baslangic_fiyati: ilan.baslangic_fiyati,
        fiyat_min: fiyatMin,
        fiyat_max: fiyatMax,
        durum: ilan.durum,
        baslangic_tarihi: ilan.baslangic_tarihi,
        bitis_tarihi: ilan.bitis_tarihi,
        il: ilan.il,
        ilce: ilan.ilce,
        tenant_ad: tenantRows[0]?.ad ?? null,
        kapak_gorsel_id: gorselRows[0]?.id ?? null,
      });
    } catch {
      // Arama indeksleme dokümante edilmiş fire-and-forget yan etki — sessizce yutulur.
    }
  }

  /**
   * Tek bir ilanı arama indeksiyle yeniden eşitler — ilan durumu/fiyatı dışındaki
   * bir yan tabloyu değiştiren işlemler (örn. görsel yükleme, kapak fotoğrafını
   * etkiler) sonrası `GorselService`/`IlanController` tarafından tetiklenir.
   */
  async syncSearchIndexFor(ilanId: string): Promise<void> {
    const ilan = await this.get(ilanId);
    if (ilan) await this.syncSearchIndex(ilan);
  }

  /**
   * Bu tenant'ın vatandaşa açık ilanlarını arama indeksiyle yeniden eşitler.
   * OpenSearch mapping değişikliği sonrası mevcut kayıtları geriye dönük
   * senkronlamak için (TENANT_ADMIN tetikler, bkz. ilan.controller.ts).
   */
  async resyncSearchIndex(): Promise<number> {
    const ilanlar = await rawQuery<Ilan>(
      this.qr(),
      'SELECT * FROM ilan WHERE deleted_at IS NULL AND durum IN ($1, $2, $3)',
      [IlanDurumu.Yayinda, IlanDurumu.CanliArtirma, IlanDurumu.Sonuclandi],
    );
    for (const ilan of ilanlar) {
      await this.syncSearchIndex(ilan);
    }
    return ilanlar.length;
  }

  private qr(): QueryRunner {
    const tenant = getCurrentTenant();
    if (!tenant) {
      throw new Error('Tenant bağlamı yok');
    }
    return tenant.queryRunner;
  }

  list(limit: number, offset: number): Promise<Ilan[]> {
    return rawQuery<Ilan>(
      this.qr(),
      'SELECT * FROM ilan WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset],
    );
  }

  async get(id: string): Promise<Ilan | null> {
    const rows = await rawQuery<Ilan>(
      this.qr(),
      'SELECT * FROM ilan WHERE id = $1 AND deleted_at IS NULL',
      [id],
    );
    return rows[0] ?? null;
  }

  async create(data: {
    baslik: string;
    aciklama?: string | null;
    ihaleTipi: string;
    islemTuru: string;
    /** İlan (yayın) tarihi — zorunlu, oluşturma anında `publishDogrula` ile doğrulanır (KK-23). Kolon: baslangic_tarihi. */
    ilanTarihi: string;
    /** İhale tarihi — zorunlu, oluşturma anında `publishDogrula` ile doğrulanır (KK-23). Kolon: bitis_tarihi — kalemler için ORTAK başlangıç (KK-25). */
    ihaleTarihi: string;
    /** Şartname bedeli ücretli mi (ilan başına tek bedel). */
    sartnameUcretli?: boolean;
    /** Ücretliyse tutar (controller `sartnameUcretli:true` ile birlikte zorunlu kılar). */
    sartnameTutari?: number;
    /** İhaleye katılım şartları (yayınlamadan önce en az bir tanesi seçilmeli). */
    katilimSartlari?: KatilimSarti[];
  }): Promise<Ilan> {
    if (!GECERLI_TIP.has(data.ihaleTipi)) {
      throw new BadRequestException('Geçersiz ihale tipi');
    }
    if (!GECERLI_ISLEM_TURU.has(data.islemTuru)) {
      throw new BadRequestException('Geçersiz işlem türü');
    }
    const kurallar = await getIlanKurallari(this.qr(), data.ihaleTipi as IhaleTipi);
    const sonuc = publishDogrula(
      new Date(data.ilanTarihi),
      new Date(data.ihaleTarihi),
      kurallar.minIlanIhaleAraligiGun,
      kurallar.minSimdiIlanAraligiGun,
      new Date(),
    );
    if (!sonuc.gecerli) {
      throw new BadRequestException(sonuc.hata ?? 'İlan/ihale tarihleri kural motoruna uymuyor');
    }
    // Varlık(lar) artık oluşturma anında seçilmiyor — ilan "boş" TASLAK olarak
    // doğar, admin ardından /kalem ile istediği kadar varlık ekler (KK-25).
    const rows = await rawQuery<Ilan>(
      this.qr(),
      `INSERT INTO ilan (baslik, aciklama, ihale_tipi, islem_turu, durum, baslangic_tarihi, bitis_tarihi, sartname_ucretli, sartname_tutari, katilim_sartlari)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        data.baslik,
        data.aciklama ?? null,
        data.ihaleTipi,
        data.islemTuru,
        IlanDurumu.Taslak,
        data.ilanTarihi,
        data.ihaleTarihi,
        data.sartnameUcretli ?? false,
        data.sartnameTutari ?? null,
        JSON.stringify(data.katilimSartlari ?? []),
      ],
    );
    const ilan = rows[0];
    appendAuditLog(this.ds, {
      tenantId: getCurrentTenant()?.slug ?? null,
      actorId: 'system:ilan',
      action: 'ILAN_CREATE',
      entityType: 'ilan',
      entityId: ilan.id,
      payload: { baslik: data.baslik, ihaleTipi: data.ihaleTipi, islemTuru: data.islemTuru },
    }).catch(() => {});
    return ilan;
  }

  /** İlan güncelle — sadece TASLAK durumunda. */
  async update(
    id: string,
    data: {
      baslik?: string;
      aciklama?: string | null;
      baslangicFiyati?: number;
      ilanTarihi?: string;
      ihaleTarihi?: string;
      sartnameUcretli?: boolean;
      sartnameTutari?: number;
      katilimSartlari?: KatilimSarti[];
      lat?: number;
      lng?: number;
    },
  ): Promise<Ilan> {
    const ilan = await this.get(id);
    if (!ilan) throw new NotFoundException('İlan bulunamadı');
    if (ilan.durum !== IlanDurumu.Taslak) {
      throw new BadRequestException('Sadece taslak ilanlar güncellenebilir');
    }
    if (data.ilanTarihi !== undefined || data.ihaleTarihi !== undefined) {
      const nihaiIlanTarihi = data.ilanTarihi !== undefined ? new Date(data.ilanTarihi) : ilan.baslangic_tarihi;
      const nihaiIhaleTarihi = data.ihaleTarihi !== undefined ? new Date(data.ihaleTarihi) : ilan.bitis_tarihi;
      if (!nihaiIlanTarihi || !nihaiIhaleTarihi) {
        throw new BadRequestException('İlan tarihi ve ihale tarihi birlikte dolu olmalı');
      }
      const kurallar = await getIlanKurallari(this.qr(), ilan.ihale_tipi as IhaleTipi);
      const sonuc = publishDogrula(
        nihaiIlanTarihi,
        nihaiIhaleTarihi,
        kurallar.minIlanIhaleAraligiGun,
        kurallar.minSimdiIlanAraligiGun,
        new Date(),
      );
      if (!sonuc.gecerli) {
        throw new BadRequestException(sonuc.hata ?? 'İlan/ihale tarihleri kural motoruna uymuyor');
      }
    }
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    if (data.baslik !== undefined) { sets.push(`baslik = $${i++}`); vals.push(data.baslik); }
    if (data.aciklama !== undefined) { sets.push(`aciklama = $${i++}`); vals.push(data.aciklama); }
    if (data.baslangicFiyati !== undefined) { sets.push(`baslangic_fiyati = $${i++}`); vals.push(data.baslangicFiyati); }
    if (data.ilanTarihi !== undefined) { sets.push(`baslangic_tarihi = $${i++}`); vals.push(data.ilanTarihi); }
    if (data.ihaleTarihi !== undefined) { sets.push(`bitis_tarihi = $${i++}`); vals.push(data.ihaleTarihi); }
    if (data.sartnameUcretli !== undefined) { sets.push(`sartname_ucretli = $${i++}`); vals.push(data.sartnameUcretli); }
    if (data.sartnameTutari !== undefined) { sets.push(`sartname_tutari = $${i++}`); vals.push(data.sartnameTutari); }
    if (data.katilimSartlari !== undefined) { sets.push(`katilim_sartlari = $${i++}`); vals.push(JSON.stringify(data.katilimSartlari)); }
    if (data.lat !== undefined) { sets.push(`lat = $${i++}`); vals.push(data.lat); }
    if (data.lng !== undefined) { sets.push(`lng = $${i++}`); vals.push(data.lng); }
    if (sets.length === 0) return ilan;
    vals.push(id);
    const rows = await rawQuery<Ilan>(
      this.qr(),
      `UPDATE ilan SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
      vals,
    );
    appendAuditLog(this.ds, {
      tenantId: getCurrentTenant()?.slug ?? null,
      actorId: 'system:ilan',
      action: 'ILAN_GUNCELLE',
      entityType: 'ilan',
      entityId: id,
      payload: data,
    }).catch(() => {});
    return rows[0];
  }

  /** İlan sil — sadece TASLAK durumunda (soft delete — hard DELETE yasak, CLAUDE.md). */
  async remove(id: string): Promise<void> {
    const ilan = await this.get(id);
    if (!ilan) throw new NotFoundException('İlan bulunamadı');
    if (ilan.durum !== IlanDurumu.Taslak) {
      throw new BadRequestException('Sadece taslak ilanlar silinebilir');
    }
    await rawQuery(this.qr(), 'UPDATE ilan SET deleted_at = now() WHERE id = $1', [id]);
    appendAuditLog(this.ds, {
      tenantId: getCurrentTenant()?.slug ?? null,
      actorId: 'system:ilan',
      action: 'ILAN_SIL',
      entityType: 'ilan',
      entityId: id,
      payload: { baslik: ilan.baslik },
    }).catch(() => {});
  }

  /**
   * Durum makinesi. Geçiş haritası `ilanGecisGecerliMi`'de (functional core, KK-16).
   *  TASLAK → YAYINDA: personelin girdiği ilan/ihale tarihleri `publishDogrula`'dan geçer,
   *  kural motorundan çekilen kurallar snapshot'lanır.
   *  YAYINDA → CANLI_ARTIRMA: ihale tarihi gelmeden başlatılamaz (`ihaleBaslatDogrula`) —
   *  teklif verme yalnızca CANLI_ARTIRMA'da açık olduğu için (bkz. TeklifService.submit)
   *  bu kapı "ihale tarihine kadar teklif verilemez" kuralını fiilen uygular.
   */
  async changeDurum(id: string, hedef: string): Promise<Ilan> {
    if (!GECERLI_DURUM.has(hedef)) {
      throw new BadRequestException('Geçersiz durum');
    }
    const ilan = await this.get(id);
    if (!ilan) {
      throw new NotFoundException('İlan bulunamadı');
    }

    if (!ilanGecisGecerliMi(ilan.durum as IlanDurumu, hedef as IlanDurumu)) {
      throw new BadRequestException(`Geçersiz durum geçişi: ${ilan.durum} → ${hedef}`);
    }

    if (hedef === IlanDurumu.Yayinda) {
      const ilanTarihi = ilan.baslangic_tarihi;
      const ihaleTarihi = ilan.bitis_tarihi;
      if (!ilanTarihi || !ihaleTarihi) {
        throw new BadRequestException('İlan tarihi ve ihale tarihi girilmeden yayınlanamaz');
      }
      const kurallar = await getIlanKurallari(this.qr(), ilan.ihale_tipi as IhaleTipi);
      const sonuc = publishDogrula(
        ilanTarihi,
        ihaleTarihi,
        kurallar.minIlanIhaleAraligiGun,
        kurallar.minSimdiIlanAraligiGun,
        new Date(),
      );
      if (!sonuc.gecerli) {
        throw new BadRequestException(sonuc.hata ?? 'Yayınlama koşulları sağlanmadı');
      }

      const evrakRows = await rawQuery<{ tip: string }>(
        this.qr(),
        'SELECT DISTINCT tip FROM evrak WHERE ilan_id = $1',
        [id],
      );
      const kalemSayisi = await this.kalemler.count(id);
      const onKosulSonuc = yayinOnKosullariGecerliMi(
        evrakRows.map((r) => r.tip as EvrakTipi),
        ilan.katilim_sartlari ?? [],
        kalemSayisi,
      );
      if (!onKosulSonuc.gecerli) {
        throw new BadRequestException(onKosulSonuc.hata ?? 'Yayınlama ön koşulları sağlanmadı');
      }

      const rows = await rawQuery<Ilan>(
        this.qr(),
        'UPDATE ilan SET durum=$1, kurallar=$2 WHERE id=$3 RETURNING *',
        [IlanDurumu.Yayinda, JSON.stringify(kurallar), id],
      );
      const updated = rows[0];
      if (updated) this.syncSearchIndex(updated).catch(() => {});
      // Audit (hash-chain) — fire-and-forget.
      appendAuditLog(this.ds, {
        tenantId: getCurrentTenant()?.slug ?? null,
        actorId: 'system:ilan',
        action: 'ILAN_YAYINLA',
        entityType: 'ilan',
        entityId: id,
        payload: { ihale_tipi: ilan.ihale_tipi },
      }).catch(() => {});
      return updated;
    }

    if (hedef === IlanDurumu.CanliArtirma) {
      const ihaleTarihi = ilan.bitis_tarihi;
      if (!ihaleTarihi) {
        throw new BadRequestException('İhale tarihi girilmeden ihale başlatılamaz');
      }
      const sonuc = ihaleBaslatDogrula(ihaleTarihi, new Date());
      if (!sonuc.gecerli) {
        throw new BadRequestException(sonuc.hata ?? 'İhale başlatma koşulları sağlanmadı');
      }

      const rows = await rawQuery<Ilan>(
        this.qr(),
        'UPDATE ilan SET durum=$1 WHERE id=$2 RETURNING *',
        [IlanDurumu.CanliArtirma, id],
      );
      const updated = rows[0];
      if (updated) this.syncSearchIndex(updated).catch(() => {});
      // İhale tarihi ortak olduğu için ilandaki tüm kalemler birlikte açılır (KK-25).
      await this.kalemler.activateAllForIlan(id);
      appendAuditLog(this.ds, {
        tenantId: getCurrentTenant()?.slug ?? null,
        actorId: 'system:ilan',
        action: 'ILAN_IHALE_BASLAT',
        entityType: 'ilan',
        entityId: id,
        payload: {},
      }).catch(() => {});
      return updated;
    }

    const rows = await rawQuery<Ilan>(
      this.qr(),
      'UPDATE ilan SET durum=$1 WHERE id=$2 RETURNING *',
      [hedef, id],
    );
    const updated = rows[0];
    if (updated) this.syncSearchIndex(updated).catch(() => {});
    return updated;
  }

  /**
   * Bir kalemi (varlığı) sonuçlandır: en yüksek teklifi bul → o kalemin kazananı.
   * Kalemler birbirinden bağımsız sonuçlanır (KK-25) — ilan.durum yalnızca
   * ilandaki TÜM kalemler terminal (SONUCLANDI/IPTAL) olunca otomatik SONUCLANDI'ya çekilir.
   * @Roller(TenantAdmin, Encumen) tarafından çağrılır.
   */
  async sonuclandirKalem(ilanId: string, kalemId: string, kararNo?: string): Promise<{
    winnerId: string | null;
    kazananTutar: number | null;
    kalem: IlanKalemi;
  }> {
    const sonuc = await this.kalemler.sonuclandir(ilanId, kalemId, kararNo);
    // BullMQ gecikmeli iade planla — sadece bu kalemin başvurularına ait teminatlar (fire-and-forget).
    this.iadeService.planlaIadeForKalem(kalemId).catch(() => {});

    const [toplam, terminal] = await Promise.all([
      this.kalemler.count(ilanId),
      this.kalemler.countTerminal(ilanId),
    ]);
    if (toplam > 0 && toplam === terminal) {
      const rows = await rawQuery<Ilan>(
        this.qr(),
        'UPDATE ilan SET durum = $1 WHERE id = $2 RETURNING *',
        [IlanDurumu.Sonuclandi, ilanId],
      );
      if (rows[0]) this.syncSearchIndex(rows[0]).catch(() => {});
      appendAuditLog(this.ds, {
        tenantId: getCurrentTenant()?.slug ?? null,
        actorId: 'system:ilan',
        action: 'ILAN_SONUCLANDIR',
        entityType: 'ilan',
        entityId: ilanId,
        payload: { tumKalemlerTerminal: true },
      }).catch(() => {});
    }

    return sonuc;
  }

  /** İlan favorisini aç/kapat (toggle). { favori: boolean } döner. */
  async toggleFavori(ilanId: string, kullaniciId: string): Promise<{ favori: boolean }> {
    const mevcut = await rawQuery<{ id: string }>(
      this.qr(),
      'SELECT id FROM ilan_favoriler WHERE ilan_id = $1 AND kullanici_id = $2',
      [ilanId, kullaniciId],
    );
    if (mevcut[0]) {
      await rawQuery(this.qr(), 'DELETE FROM ilan_favoriler WHERE ilan_id = $1 AND kullanici_id = $2', [
        ilanId,
        kullaniciId,
      ]);
      return { favori: false };
    }
    await rawQuery(
      this.qr(),
      'INSERT INTO ilan_favoriler (ilan_id, kullanici_id) VALUES ($1, $2)',
      [ilanId, kullaniciId],
    );
    return { favori: true };
  }

  /**
   * Kullanıcının favori ilanları (ilan detayı join'li). `fiyat_min`/`fiyat_max`
   * çoklu-varlık ilanlarda kalemlerin fiyat aralığını taşır (KK-25) — tek-varlık
   * ilanlarda `i.baslangic_fiyati` zaten dolu olduğu için ikisi de null kalır.
   */
  async listFavoriler(
    kullaniciId: string,
    limit: number,
    offset: number,
  ): Promise<(Ilan & { fiyat_min: string | null; fiyat_max: string | null; kapak_gorsel_id: string | null })[]> {
    return rawQuery<Ilan & { fiyat_min: string | null; fiyat_max: string | null; kapak_gorsel_id: string | null }>(
      this.qr(),
      `SELECT i.*, k.fiyat_min, k.fiyat_max,
              (SELECT g.id FROM ilan_gorseller g WHERE g.ilan_id = i.id ORDER BY g.sira ASC, g.created_at ASC LIMIT 1) AS kapak_gorsel_id
       FROM ilan i
       JOIN ilan_favoriler f ON f.ilan_id = i.id
       LEFT JOIN LATERAL (
         SELECT MIN(baslangic_fiyati) AS fiyat_min, MAX(baslangic_fiyati) AS fiyat_max
         FROM ilan_kalemi
         WHERE ilan_id = i.id AND deleted_at IS NULL
       ) k ON true
       WHERE f.kullanici_id = $1 AND i.deleted_at IS NULL
       ORDER BY f.created_at DESC LIMIT $2 OFFSET $3`,
      [kullaniciId, limit, offset],
    );
  }
}

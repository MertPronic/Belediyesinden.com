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
import { VarlikService } from '../varlik/varlik.service';
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
    private readonly varlikService: VarlikService,
  ) {}

  /** Arama indeksini ilanın güncel durumuyla senkronlar (yayınla/iptal/sonuçlandır sonrası). */
  private syncSearchIndex(ilan: Ilan): void {
    const tenant = getCurrentTenant();
    if (!tenant) return;
    this.os
      .indexIlan(tenant.slug, {
        id: ilan.id,
        baslik: ilan.baslik,
        aciklama: ilan.aciklama,
        ihale_tipi: ilan.ihale_tipi,
        baslangic_fiyati: ilan.baslangic_fiyati,
        durum: ilan.durum,
        baslangic_tarihi: ilan.baslangic_tarihi,
      })
      .catch(() => {});
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
    varlikId: string;
    ihaleTipi: string;
    islemTuru: string;
    baslangicFiyati: number;
    /** İlan (yayın) tarihi — zorunlu, oluşturma anında `publishDogrula` ile doğrulanır (KK-23). Kolon: baslangic_tarihi. */
    ilanTarihi: string;
    /** İhale tarihi — zorunlu, oluşturma anında `publishDogrula` ile doğrulanır (KK-23). Kolon: bitis_tarihi. */
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
    const varlik = await this.varlikService.get(data.varlikId);
    if (!varlik) {
      throw new BadRequestException('Varlık bulunamadı');
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
    // Konum artık ilan seviyesinde girilmez — varlığın detayından tek seferde kopyalanır (KK-24).
    const il = typeof varlik.detay?.['il'] === 'string' ? (varlik.detay['il'] as string) : null;
    const ilce = typeof varlik.detay?.['ilce'] === 'string' ? (varlik.detay['ilce'] as string) : null;
    const rows = await rawQuery<Ilan>(
      this.qr(),
      `INSERT INTO ilan (baslik, aciklama, varlik_id, ihale_tipi, islem_turu, durum, baslangic_fiyati, baslangic_tarihi, bitis_tarihi, sartname_ucretli, sartname_tutari, katilim_sartlari, il, ilce)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
      [
        data.baslik,
        data.aciklama ?? null,
        data.varlikId,
        data.ihaleTipi,
        data.islemTuru,
        IlanDurumu.Taslak,
        data.baslangicFiyati,
        data.ilanTarihi,
        data.ihaleTarihi,
        data.sartnameUcretli ?? false,
        data.sartnameTutari ?? null,
        JSON.stringify(data.katilimSartlari ?? []),
        il,
        ilce,
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
      const onKosulSonuc = yayinOnKosullariGecerliMi(
        evrakRows.map((r) => r.tip as EvrakTipi),
        ilan.katilim_sartlari ?? [],
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
      if (updated) this.syncSearchIndex(updated);
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
      if (updated) this.syncSearchIndex(updated);
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
    if (updated) this.syncSearchIndex(updated);
    return updated;
  }

  /**
   * İhaleyi sonuçlandır: en yüksek teklifi bul → ilan SONUCLANDI.
   * @Roller(TenantAdmin, Encumen) tarafından çağrılır.
   */
  async sonuclandir(id: string, kararNo?: string): Promise<{
    winnerId: string | null;
    kazananTutar: number | null;
    ilan: Ilan;
  }> {
    const ilan = await this.get(id);
    if (!ilan) {
      throw new NotFoundException('İlan bulunamadı');
    }
    if (ilan.durum !== IlanDurumu.CanliArtirma) {
      throw new BadRequestException('Sadece canlı artırmadaki ilanlar sonuçlandırılabilir');
    }
    const maxRows = await rawQuery<{ kullanici_id: string; tutar: string }>(
      this.qr(),
      'SELECT kullanici_id, tutar FROM teklif WHERE ilan_id = $1 AND kabul_edildi = true ORDER BY tutar DESC LIMIT 1',
      [id],
    );
    const winner = maxRows[0];
    const rows = await rawQuery<Ilan>(
      this.qr(),
      'UPDATE ilan SET durum = $1, kazanan_kullanici_id = $2, kazanan_tutar = $3, encumen_karar_no = $4, encumen_karar_tarihi = $5 WHERE id = $6 RETURNING *',
      [IlanDurumu.Sonuclandi, winner?.kullanici_id ?? null, winner?.tutar ?? null, kararNo ?? null, new Date(), id],
    );
    if (rows[0]) this.syncSearchIndex(rows[0]);
    // BullMQ gecikmeli iade planla (fire-and-forget).
    this.iadeService.planlaIadeForIlan(id).catch(() => {});

    appendAuditLog(this.ds, {
      tenantId: getCurrentTenant()?.slug ?? null,
      actorId: 'system:ilan',
      action: 'ILAN_SONUCLANDIR',
      entityType: 'ilan',
      entityId: id,
      payload: {
        kazanan_kullanici_id: winner?.kullanici_id ?? null,
        kazanan_tutar: winner ? Number(winner.tutar) : null,
      },
    }).catch(() => {});

    return {
      winnerId: winner?.kullanici_id ?? null,
      kazananTutar: winner ? Number(winner.tutar) : null,
      ilan: rows[0],
    };
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

  /** Kullanıcının favori ilanları (ilan detayı join'li). */
  async listFavoriler(kullaniciId: string, limit: number, offset: number): Promise<Ilan[]> {
    return rawQuery<Ilan>(
      this.qr(),
      `SELECT i.* FROM ilan i
       JOIN ilan_favoriler f ON f.ilan_id = i.id
       WHERE f.kullanici_id = $1 AND i.deleted_at IS NULL ORDER BY f.created_at DESC LIMIT $2 OFFSET $3`,
      [kullaniciId, limit, offset],
    );
  }
}

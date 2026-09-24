import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource, QueryRunner } from 'typeorm';
import { getCurrentTenant } from '@belediyesinden/tenancy';
import { appendAuditLog } from '@belediyesinden/audit';
import { rawQuery } from '@belediyesinden/db';
import { IlanDurumu } from '@belediyesinden/shared';
import { ilanKalemiEklemeGecerliMi } from '@belediyesinden/ilan-core';
import { VarlikService } from '../varlik/varlik.service';
import type { IlanKalemi, IlanKalemiDetay, IlanKalemiOzet, IlanKalemiYonetimSatiri } from './ilan-kalemi.entity';
import type { Ilan } from './ilan.entity';

/**
 * İlan kalemi servisi — bir ilana varlık ekleme/çıkarma/listeleme, ve bu
 * varlığın kendi ihale birimi olarak yaşam döngüsü (aktifleştirme,
 * sonuçlandırma). Gerçek teklif/başvuru birimi (DECISIONS.md KK-25, Faz 2).
 */
@Injectable()
export class IlanKalemiService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly varlikService: VarlikService,
  ) {}

  private qr(): QueryRunner {
    const tenant = getCurrentTenant();
    if (!tenant) {
      throw new Error('Tenant bağlamı yok');
    }
    return tenant.queryRunner;
  }

  private async getIlan(ilanId: string): Promise<Ilan> {
    const rows = await rawQuery<Ilan>(
      this.qr(),
      'SELECT * FROM ilan WHERE id = $1 AND deleted_at IS NULL',
      [ilanId],
    );
    const ilan = rows[0];
    if (!ilan) {
      throw new NotFoundException('İlan bulunamadı');
    }
    return ilan;
  }

  list(ilanId: string): Promise<IlanKalemiOzet[]> {
    return rawQuery<IlanKalemiOzet>(
      this.qr(),
      `SELECT k.*, v.ad AS varlik_ad, v.tip AS varlik_tip, v.detay AS varlik_detay, v.aciklama AS varlik_aciklama
       FROM ilan_kalemi k JOIN varlik v ON v.id = k.varlik_id
       WHERE k.ilan_id = $1 AND k.deleted_at IS NULL
       ORDER BY k.created_at`,
      [ilanId],
    );
  }

  /**
   * Yönetim > İhaleler — tenant genelinde TÜM ihale kalemleri (ilan bağlamıyla).
   * `zaman`: 'gelecek' → BEKLIYOR/CANLI_ARTIRMA (ihale tarihine göre artan),
   * 'gecmis' → SONUCLANDI/IPTAL (ihale tarihine göre azalan), yoksa hepsi.
   */
  async listTenantGenel(
    zaman: 'gelecek' | 'gecmis' | undefined,
    limit: number,
    offset: number,
  ): Promise<{ data: IlanKalemiYonetimSatiri[]; total: number }> {
    const durumFiltre =
      zaman === 'gecmis'
        ? `k.durum IN ('SONUCLANDI', 'IPTAL')`
        : zaman === 'gelecek'
          ? `k.durum IN ('BEKLIYOR', 'CANLI_ARTIRMA')`
          : 'TRUE';
    const siraYonu = zaman === 'gecmis' ? 'DESC' : 'ASC';
    const [data, totalRows] = await Promise.all([
      rawQuery<IlanKalemiYonetimSatiri>(
        this.qr(),
        `SELECT k.*, v.ad AS varlik_ad, v.tip AS varlik_tip, i.baslik AS ilan_baslik
         FROM ilan_kalemi k
         JOIN varlik v ON v.id = k.varlik_id
         JOIN ilan i ON i.id = k.ilan_id
         WHERE k.deleted_at IS NULL AND i.deleted_at IS NULL AND ${durumFiltre}
         ORDER BY k.bitis_tarihi ${siraYonu} NULLS LAST
         LIMIT $1 OFFSET $2`,
        [limit, offset],
      ),
      rawQuery<{ adet: string }>(
        this.qr(),
        `SELECT COUNT(*) AS adet FROM ilan_kalemi k JOIN ilan i ON i.id = k.ilan_id
         WHERE k.deleted_at IS NULL AND i.deleted_at IS NULL AND ${durumFiltre}`,
      ),
    ]);
    return { data, total: Number(totalRows[0]?.adet ?? 0) };
  }

  /** Yayınlama ön koşulu (≥1 kalem) için hafif sayım — bkz. IlanService.changeDurum. */
  async count(ilanId: string): Promise<number> {
    const rows = await rawQuery<{ adet: string }>(
      this.qr(),
      'SELECT COUNT(*) AS adet FROM ilan_kalemi WHERE ilan_id = $1 AND deleted_at IS NULL',
      [ilanId],
    );
    return Number(rows[0]?.adet ?? 0);
  }

  /** Terminal durumdaki (SONUCLANDI/IPTAL) kalem sayısı — tüm kalemler bitince ilan otomatik SONUCLANDI olur. */
  async countTerminal(ilanId: string): Promise<number> {
    const rows = await rawQuery<{ adet: string }>(
      this.qr(),
      `SELECT COUNT(*) AS adet FROM ilan_kalemi
       WHERE ilan_id = $1 AND deleted_at IS NULL AND durum IN ('SONUCLANDI', 'IPTAL')`,
      [ilanId],
    );
    return Number(rows[0]?.adet ?? 0);
  }

  /** Tek kalem + varlık + üst ilan bağlamı — vatandaş varlık detay sayfasının veri kaynağı. */
  async getWithContext(kalemId: string): Promise<IlanKalemiDetay> {
    const rows = await rawQuery<IlanKalemiDetay>(
      this.qr(),
      `SELECT k.*, v.ad AS varlik_ad, v.tip AS varlik_tip, v.detay AS varlik_detay, v.aciklama AS varlik_aciklama,
              i.baslik AS ilan_baslik, i.ihale_tipi, i.katilim_sartlari,
              i.sartname_ucretli, i.sartname_tutari, i.kurallar,
              i.durum AS ilan_durum, i.baslangic_tarihi AS ilan_baslangic_tarihi
       FROM ilan_kalemi k
       JOIN varlik v ON v.id = k.varlik_id
       JOIN ilan i ON i.id = k.ilan_id
       WHERE k.id = $1 AND k.deleted_at IS NULL AND i.deleted_at IS NULL`,
      [kalemId],
    );
    const kalem = rows[0];
    if (!kalem) {
      throw new NotFoundException('Varlık bulunamadı');
    }
    return kalem;
  }

  /**
   * İhale tarihi geldiğinde (ilan CANLI_ARTIRMA'ya geçince) ilandaki tüm
   * kalemler birlikte açılır — ihale tarihi ortak olduğu için (KK-25).
   */
  async activateAllForIlan(ilanId: string): Promise<void> {
    await rawQuery(
      this.qr(),
      `UPDATE ilan_kalemi SET durum = 'CANLI_ARTIRMA' WHERE ilan_id = $1 AND durum = 'BEKLIYOR' AND deleted_at IS NULL`,
      [ilanId],
    );
  }

  /** Kalemi sonuçlandır: en yüksek teklifi kazanan ilan eder. Kalemler birbirinden bağımsız sonuçlanır (KK-25). */
  async sonuclandir(
    ilanId: string,
    kalemId: string,
    kararNo?: string,
  ): Promise<{ kalem: IlanKalemi; winnerId: string | null; kazananTutar: number | null }> {
    const rows = await rawQuery<IlanKalemi>(
      this.qr(),
      'SELECT * FROM ilan_kalemi WHERE id = $1 AND ilan_id = $2 AND deleted_at IS NULL FOR UPDATE',
      [kalemId, ilanId],
    );
    const kalem = rows[0];
    if (!kalem) {
      throw new NotFoundException('Kalem bulunamadı');
    }
    if (kalem.durum !== 'CANLI_ARTIRMA') {
      throw new BadRequestException('Sadece canlı artırmadaki bir varlık sonuçlandırılabilir');
    }
    const maxRows = await rawQuery<{ kullanici_id: string; tutar: string }>(
      this.qr(),
      'SELECT kullanici_id, tutar FROM teklif WHERE ilan_kalemi_id = $1 AND kabul_edildi = true ORDER BY tutar DESC LIMIT 1',
      [kalemId],
    );
    const winner = maxRows[0];
    const updated = await rawQuery<IlanKalemi>(
      this.qr(),
      `UPDATE ilan_kalemi
       SET durum = 'SONUCLANDI', kazanan_kullanici_id = $1, kazanan_tutar = $2,
           encumen_karar_no = $3, encumen_karar_tarihi = now()
       WHERE id = $4 RETURNING *`,
      [winner?.kullanici_id ?? null, winner?.tutar ?? null, kararNo ?? null, kalemId],
    );
    appendAuditLog(this.ds, {
      tenantId: getCurrentTenant()?.slug ?? null,
      actorId: 'system:ilan-kalemi',
      action: 'ILAN_KALEMI_SONUCLANDIR',
      entityType: 'ilan_kalemi',
      entityId: kalemId,
      payload: {
        kazanan_kullanici_id: winner?.kullanici_id ?? null,
        kazanan_tutar: winner ? Number(winner.tutar) : null,
      },
    }).catch(() => {});
    return {
      kalem: updated[0],
      winnerId: winner?.kullanici_id ?? null,
      kazananTutar: winner ? Number(winner.tutar) : null,
    };
  }

  async add(ilanId: string, varlikId: string, baslangicFiyati: number): Promise<IlanKalemi> {
    const ilan = await this.getIlan(ilanId);
    const varlik = await this.varlikService.get(varlikId);
    if (!varlik) {
      throw new BadRequestException('Varlık bulunamadı');
    }
    const mevcutKalemler = await this.list(ilanId);
    const sonuc = ilanKalemiEklemeGecerliMi(
      ilan.durum as IlanDurumu,
      mevcutKalemler.map((k) => k.varlik_id),
      varlikId,
    );
    if (!sonuc.gecerli) {
      throw new BadRequestException(sonuc.hata ?? 'Kalem eklenemedi');
    }
    const rows = await rawQuery<IlanKalemi>(
      this.qr(),
      `INSERT INTO ilan_kalemi (ilan_id, varlik_id, baslangic_fiyati, bitis_tarihi)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [ilanId, varlikId, baslangicFiyati, ilan.bitis_tarihi],
    );
    const kalem = rows[0];
    appendAuditLog(this.ds, {
      tenantId: getCurrentTenant()?.slug ?? null,
      actorId: 'system:ilan-kalemi',
      action: 'ILAN_KALEMI_EKLE',
      entityType: 'ilan_kalemi',
      entityId: kalem.id,
      payload: { ilanId, varlikId, baslangicFiyati },
    }).catch(() => {});
    return kalem;
  }

  async remove(ilanId: string, kalemId: string): Promise<void> {
    const rows = await rawQuery<IlanKalemi>(
      this.qr(),
      'SELECT * FROM ilan_kalemi WHERE id = $1 AND ilan_id = $2 AND deleted_at IS NULL',
      [kalemId, ilanId],
    );
    const kalem = rows[0];
    if (!kalem) {
      throw new NotFoundException('Kalem bulunamadı');
    }
    if (kalem.durum !== 'BEKLIYOR') {
      throw new BadRequestException('İhalesi başlamış bir kalem ilandan çıkarılamaz');
    }
    await rawQuery(this.qr(), 'UPDATE ilan_kalemi SET deleted_at = now() WHERE id = $1', [kalemId]);
    appendAuditLog(this.ds, {
      tenantId: getCurrentTenant()?.slug ?? null,
      actorId: 'system:ilan-kalemi',
      action: 'ILAN_KALEMI_CIKAR',
      entityType: 'ilan_kalemi',
      entityId: kalemId,
      payload: { ilanId },
    }).catch(() => {});
  }
}

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource, QueryRunner } from 'typeorm';
import { getCurrentTenant } from '@belediyesinden/tenancy';
import { BasvuruDurumu, BildirimTipi, IhaleTipi, IlanDurumu } from '@belediyesinden/shared';
import { appendAuditLog } from '@belediyesinden/audit';
import { getIlanKurallari } from '@belediyesinden/rule-engine';
import { rawQuery } from '@belediyesinden/db';
import { BildirimService, TENANT_OPS_HEDEF_ROL } from '../bildirim/bildirim.service';
import type { IlanKalemi } from '../ilan/ilan-kalemi.entity';
import type { Basvuru } from './basvuru.entity';

/**
 * Tenant-scoped başvuru servisi: KVKK onayı + gereken teminat hesabı.
 * KK-25: birim `ilan` değil `ilan_kalemi` — bir ilandaki her varlığa ayrı başvurulur.
 */
@Injectable()
export class BasvuruService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly bildirim: BildirimService,
  ) {}

  private qr(): QueryRunner {
    const tenant = getCurrentTenant();
    if (!tenant) {
      throw new Error('Tenant bağlamı yok');
    }
    return tenant.queryRunner;
  }

  /** Kullanıcının bu varlığa daha önce yaptığı başvuru (varsa) — varlık detay sayfasında "Başvur" CTA durumu için. */
  async findMyForKalem(kalemId: string, kullaniciId: string): Promise<Basvuru | null> {
    const rows = await rawQuery<Basvuru>(
      this.qr(),
      'SELECT * FROM basvuru WHERE ilan_kalemi_id = $1 AND kullanici_id = $2 LIMIT 1',
      [kalemId, kullaniciId],
    );
    return rows[0] ?? null;
  }

  list(kalemId: string, limit: number, offset: number): Promise<Basvuru[]> {
    return rawQuery<Basvuru>(
      this.qr(),
      'SELECT * FROM basvuru WHERE ilan_kalemi_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [kalemId, limit, offset],
    );
  }

  /** Kullanıcının katılabileceği ihaleler: onaylı başvuruları + varlığın (kalemin) güncel durumu + görsel/kazanan bilgisi. */
  async ihalelerim(kullaniciId: string): Promise<
    Array<{
      ilan_kalemi_id: string;
      ilan_id: string;
      ilan_baslik: string;
      varlik_ad: string;
      kalem_durum: string;
      ihale_tipi: string;
      baslangic_fiyati: string;
      baslangic_tarihi: Date | null;
      bitis_tarihi: Date | null;
      kazanan_kullanici_id: string | null;
      gorsel_id: string | null;
    }>
  > {
    return rawQuery(
      this.qr(),
      `SELECT k.id AS ilan_kalemi_id, i.id AS ilan_id, i.baslik AS ilan_baslik, v.ad AS varlik_ad,
              k.durum AS kalem_durum, i.ihale_tipi, k.baslangic_fiyati, i.baslangic_tarihi,
              k.bitis_tarihi, k.kazanan_kullanici_id,
              (SELECT g.id FROM ilan_gorseller g WHERE g.ilan_id = i.id ORDER BY g.sira ASC LIMIT 1) AS gorsel_id
       FROM basvuru b
       JOIN ilan_kalemi k ON k.id = b.ilan_kalemi_id
       JOIN ilan i ON i.id = k.ilan_id
       JOIN varlik v ON v.id = k.varlik_id
       WHERE b.kullanici_id = $1 AND b.durum = $2 AND i.deleted_at IS NULL AND k.deleted_at IS NULL
       ORDER BY CASE k.durum WHEN 'CANLI_ARTIRMA' THEN 0 WHEN 'BEKLIYOR' THEN 1 ELSE 2 END,
                k.bitis_tarihi ASC NULLS LAST`,
      [kullaniciId, BasvuruDurumu.Onaylandi],
    );
  }

  /** Kullanıcının kendi başvuruları (ilan başlığı + varlık adı join'li). */
  async listMy(kullaniciId: string, limit: number, offset: number): Promise<
    Array<{
      id: string;
      ilan_id: string;
      ilan_kalemi_id: string;
      ilan_baslik: string;
      varlik_ad: string;
      durum: string;
      gereken_teminat: string | null;
      created_at: Date;
    }>
  > {
    return rawQuery(
      this.qr(),
      `SELECT b.id, b.ilan_id, b.ilan_kalemi_id, i.baslik AS ilan_baslik, v.ad AS varlik_ad,
              b.durum, b.gereken_teminat, b.created_at
       FROM basvuru b
       JOIN ilan_kalemi k ON k.id = b.ilan_kalemi_id
       JOIN ilan i ON i.id = b.ilan_id
       JOIN varlik v ON v.id = k.varlik_id
       WHERE b.kullanici_id = $1 AND i.deleted_at IS NULL ORDER BY b.created_at DESC LIMIT $2 OFFSET $3`,
      [kullaniciId, limit, offset],
    );
  }

  /**
   * Bir varlığa (kaleme) başvuru oluştur. KVKK aydınlatma + açık rıza onayı zorunlu.
   * Gereken teminat = kalemin başlangıç fiyatı × kural.teminatOrani (ilan tipine göre).
   * Sadece yayındaki ilanların varlıklarına başvurulabilir (ihale tarihi ortak
   * olduğu için kalem BEKLIYOR/CANLI_ARTIRMA ayrımı gerekmez — KK-25).
   */
  async create(
    kalemId: string,
    kullaniciId: string,
    kvkkOnay: boolean,
    acikRiza: boolean,
  ): Promise<Basvuru> {
    if (!kvkkOnay) {
      throw new BadRequestException('KVKK aydınlatma metni onayı zorunludur');
    }
    const kalemRows = await rawQuery<
      IlanKalemi & { ihale_tipi: string; ilan_durum: string; varlik_ad: string; ilan_baslik: string }
    >(
      this.qr(),
      `SELECT k.*, i.ihale_tipi, i.durum AS ilan_durum, v.ad AS varlik_ad, i.baslik AS ilan_baslik
       FROM ilan_kalemi k
       JOIN ilan i ON i.id = k.ilan_id
       JOIN varlik v ON v.id = k.varlik_id
       WHERE k.id = $1 AND k.deleted_at IS NULL AND i.deleted_at IS NULL`,
      [kalemId],
    );
    const kalem = kalemRows[0];
    if (!kalem) {
      throw new NotFoundException('Varlık bulunamadı');
    }
    if (kalem.ilan_durum !== IlanDurumu.Yayinda) {
      throw new BadRequestException('Yalnızca yayındaki ilanların varlıklarına başvurulabilir');
    }

    const kurallar = await getIlanKurallari(this.qr(), kalem.ihale_tipi as IhaleTipi);
    const gereken = Number(kalem.baslangic_fiyati) * kurallar.teminatOrani;

    try {
      const rows = await rawQuery<Basvuru>(
        this.qr(),
        `INSERT INTO basvuru (ilan_id, ilan_kalemi_id, kullanici_id, durum, kvkk_onay, acik_riza, gereken_teminat)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [kalem.ilan_id, kalemId, kullaniciId, BasvuruDurumu.TeminatBekleniyor, kvkkOnay, acikRiza, gereken],
      );
      appendAuditLog(this.ds, {
        tenantId: getCurrentTenant()?.slug ?? null,
        actorId: kullaniciId,
        action: 'BASVURU_OLUSTUR',
        entityType: 'basvuru',
        entityId: rows[0].id,
        payload: { ilan_kalemi_id: kalemId, kvkk_onay: kvkkOnay, acik_riza: acikRiza, gereken_teminat: gereken },
      }).catch(() => {});
      this.bildirim
        .olustur({
          hedefRol: TENANT_OPS_HEDEF_ROL,
          tip: BildirimTipi.YeniBasvuru,
          baslik: 'Yeni başvuru',
          mesaj: `${kalem.ilan_baslik} — ${kalem.varlik_ad} için yeni başvuru geldi.`,
          link: '/admin/basvurular',
        })
        .catch(() => {});
      return rows[0];
    } catch {
      throw new BadRequestException('Bu varlığa zaten başvurdunuz');
    }
  }

  /** Başvuruyu geri çek (vatandaş). Sadece onaylanMAMış + sahibi. */
  async withdraw(basvuruId: string, kullaniciId: string): Promise<Basvuru> {
    const rows = await rawQuery<Basvuru>(this.qr(), 'SELECT * FROM basvuru WHERE id = $1', [basvuruId]);
    const b = rows[0];
    if (!b) throw new NotFoundException('Başvuru bulunamadı');
    if (b.kullanici_id !== kullaniciId) {
      throw new BadRequestException('Bu başvuruyu geri çekme yetkiniz yok');
    }
    if (b.durum === BasvuruDurumu.Onaylandi) {
      throw new BadRequestException('Onaylanmış başvuru geri çekilemez');
    }
    const updated = await rawQuery<Basvuru>(
      this.qr(),
      'UPDATE basvuru SET durum = $1 WHERE id = $2 RETURNING *',
      [BasvuruDurumu.IptalEdildi, basvuruId],
    );
    appendAuditLog(this.ds, {
      tenantId: getCurrentTenant()?.slug ?? null,
      actorId: kullaniciId,
      action: 'BASVURU_GERI_CEK',
      entityType: 'basvuru',
      entityId: basvuruId,
      payload: { ilan_id: b.ilan_id, onceki_durum: b.durum },
    }).catch(() => {});
    return updated[0];
  }

  /** KVKK: açık rızayı geri çek (vatandaş, kendi başvurusu). */
  async rizaCek(basvuruId: string, kullaniciId: string): Promise<Basvuru> {
    const rows = await rawQuery<Basvuru>(this.qr(), 'SELECT * FROM basvuru WHERE id = $1', [basvuruId]);
    const b = rows[0];
    if (!b) throw new NotFoundException('Başvuru bulunamadı');
    if (b.kullanici_id !== kullaniciId) {
      throw new BadRequestException('Bu işlem için yetkiniz yok');
    }
    const updated = await rawQuery<Basvuru>(
      this.qr(),
      'UPDATE basvuru SET acik_riza = false WHERE id = $1 RETURNING *',
      [basvuruId],
    );
    appendAuditLog(this.ds, {
      tenantId: getCurrentTenant()?.slug ?? null,
      actorId: kullaniciId,
      action: 'KVKK_RIZA_CEK',
      entityType: 'basvuru',
      entityId: basvuruId,
      payload: { ilan_id: b.ilan_id },
    }).catch(() => {});
    return updated[0];
  }
}

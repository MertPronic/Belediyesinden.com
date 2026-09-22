import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DataSource } from 'typeorm';
import { createDataSource } from '@belediyesinden/db';
import { provisionTenant, tenantContext, tenantSchema } from '@belediyesinden/tenancy';
import { EvrakTipi, IhaleTipi, IlanDurumu, IslemTuru, KatilimSarti, VarlikTipi } from '@belediyesinden/shared';
import { IlanService } from './ilan.service';
import { IlanKalemiService } from './ilan-kalemi.service';
import { VarlikService } from '../varlik/varlik.service';
import { BasvuruService } from '../basvuru/basvuru.service';
import { TeklifService } from '../teklif/teklif.service';
import { TeminatService } from '../teminat/teminat.service';
import { BildirimService } from '../bildirim/bildirim.service';
import type { OpenSearchService } from '../search/opensearch.service';
import type { TeminatIadeService } from '../teminat/teminat-iade.service';
import type { AuctionGateway } from '../auction/auction-gateway';
import type { MinioService } from '../evrak/minio.service';

/**
 * Servis-seviyesi entegrasyon testi — gerçek yerel Postgres'e karşı (HTTP/Keycloak yok).
 * Adım 5 "bitiş kapısı": TASLAK→YAYINDA akışı + cross-tenant izolasyon + geçersiz
 * geçiş/tarih senaryoları, gerçek şema-başına-tenant izolasyonuyla kanıtlanır.
 * KK-25 sonrası: ilan artık "boş" doğar, yayınlanabilmesi için en az bir
 * `ilan_kalemi` (varlık) eklenmiş olması gerekir; teklif/teminat/başvuru artık
 * kalem (varlık) bazlı — Faz 2.
 *
 * Çalıştırma: `pnpm test:integration` (yerel Postgres gerektirir, `libs/db`'nin
 * varsayılan bağlantı bilgileriyle: localhost:5432, db/user/pass=belediyesinden*).
 * OpenSearch/BullMQ/MinIO/WS bağımlılıkları bu testin kapsamı dışında — no-op stub'lanır.
 */

const GUN_MS = 86_400_000;

const fakeOpenSearch = { indexIlan: async () => undefined } as unknown as OpenSearchService;
const fakeIadeService = { planlaIadeForKalem: async () => 0 } as unknown as TeminatIadeService;
const fakeGateway = { broadcastTeklif: () => undefined } as unknown as AuctionGateway;
const fakeMinio = {} as unknown as MinioService;

/** `TenancyInterceptor`'ın yaptığının aynısı: QueryRunner aç, search_path ayarla, ALS'e koy, commit/rollback. */
async function runAsTenant<T>(rootDs: DataSource, slug: string, fn: () => Promise<T>): Promise<T> {
  const schema = tenantSchema(slug);
  const qr = rootDs.createQueryRunner();
  await qr.connect();
  await qr.startTransaction();
  await qr.query(`SET LOCAL search_path TO ${schema}, shared`);
  try {
    const result = await tenantContext.run({ slug, schema, queryRunner: qr }, fn);
    await qr.commitTransaction();
    return result;
  } catch (err) {
    await qr.rollbackTransaction();
    throw err;
  } finally {
    await qr.release();
  }
}

function services(rootDs: DataSource) {
  const varlik = new VarlikService(rootDs);
  const kalem = new IlanKalemiService(rootDs, varlik);
  const bildirim = new BildirimService();
  return {
    ilan: new IlanService(fakeOpenSearch, rootDs, fakeIadeService, kalem),
    varlik,
    kalem,
    basvuru: new BasvuruService(rootDs, bildirim),
    teklif: new TeklifService(fakeGateway, rootDs),
    teminat: new TeminatService(fakeMinio, bildirim, rootDs),
  };
}

/** Zorunlu evrak kategorilerinin üçünü de yükler (yayınlama ön koşulu). `runAsTenant` içinden çağrılır. */
async function zorunluEvraklariYukle(ilanId: string): Promise<void> {
  const qr = tenantContext.getStore()!.queryRunner;
  for (const tip of [EvrakTipi.IdariSartname, EvrakTipi.TeknikSartname, EvrakTipi.IhaleDosyasi]) {
    await qr.query(
      `INSERT INTO evrak (ilan_id, dosya_adi, minio_key, tip) VALUES ($1, $2, $3, $4)`,
      [ilanId, `${tip}.pdf`, `test/${ilanId}/${tip}.pdf`, tip],
    );
  }
}

describe('IlanService — entegrasyon (gerçek Postgres, iki tenant)', () => {
  let rootDs: DataSource;
  const slugA = `tint${Date.now()}a`;
  const slugB = `tint${Date.now()}b`;

  beforeAll(async () => {
    rootDs = createDataSource();
    await rootDs.initialize();
    await provisionTenant(slugA, 'Entegrasyon Test A', rootDs);
    await provisionTenant(slugB, 'Entegrasyon Test B', rootDs);
  });

  afterAll(async () => {
    for (const slug of [slugA, slugB]) {
      await rootDs.query(`DROP SCHEMA IF EXISTS ${tenantSchema(slug)} CASCADE`);
      await rootDs.query('DELETE FROM shared.tenants WHERE slug = $1', [slug]);
    }
    await rootDs.destroy();
  });

  it('TENANT_ADMIN akışı: taslak ilan → varlık ekle (kalem) → yayınla → YAYINDA döner', async () => {
    await runAsTenant(rootDs, slugA, async () => {
      const { ilan, varlik, kalem } = services(rootDs);
      const v = await varlik.create({ tip: VarlikTipi.Tasinmaz, ad: 'Test Arsa' });
      // min şimdi-ilan (10 gün) kuralını rahatça karşılayan taban tarih.
      const now = Date.now() + 15 * GUN_MS;
      const created = await ilan.create({
        baslik: 'Test İlan',
        ihaleTipi: IhaleTipi.AcikArtirma,
        islemTuru: IslemTuru.Kiralama,
        ilanTarihi: new Date(now).toISOString(),
        ihaleTarihi: new Date(now + 15 * GUN_MS).toISOString(),
        katilimSartlari: [KatilimSarti.GeciciTeminatYatirma],
      });
      expect(created.durum).toBe(IlanDurumu.Taslak);
      expect(created.islem_turu).toBe(IslemTuru.Kiralama);
      await kalem.add(created.id, v.id, 1000);
      await zorunluEvraklariYukle(created.id);

      const yayinda = await ilan.changeDurum(created.id, IlanDurumu.Yayinda);
      expect(yayinda.durum).toBe(IlanDurumu.Yayinda);

      const fetched = await ilan.get(created.id);
      expect(fetched?.durum).toBe(IlanDurumu.Yayinda);
    });
  });

  it("cross-tenant: B tenant'ı A'nın ilanını göremez", async () => {
    const ilanId = await runAsTenant(rootDs, slugA, async () => {
      const { ilan } = services(rootDs);
      const now = Date.now() + 15 * GUN_MS;
      const created = await ilan.create({
        baslik: 'Cross',
        ihaleTipi: IhaleTipi.AcikTeklif,
        islemTuru: IslemTuru.Satis,
        ilanTarihi: new Date(now).toISOString(),
        ihaleTarihi: new Date(now + 15 * GUN_MS).toISOString(),
      });
      return created.id;
    });

    const gorulen = await runAsTenant(rootDs, slugB, async () => {
      const { ilan } = services(rootDs);
      return ilan.get(ilanId);
    });
    expect(gorulen).toBeNull();
  });

  it('geçersiz geçiş: TASLAK → SONUCLANDI reddedilir', async () => {
    await runAsTenant(rootDs, slugA, async () => {
      const { ilan } = services(rootDs);
      const now = Date.now() + 15 * GUN_MS;
      const created = await ilan.create({
        baslik: 'Gecis',
        ihaleTipi: IhaleTipi.AcikTeklif,
        islemTuru: IslemTuru.Satis,
        ilanTarihi: new Date(now).toISOString(),
        ihaleTarihi: new Date(now + 15 * GUN_MS).toISOString(),
      });
      await expect(ilan.changeDurum(created.id, IlanDurumu.Sonuclandi)).rejects.toThrow();
    });
  });

  it('zaten YAYINDA olan ilan tekrar yayınlanamaz', async () => {
    await runAsTenant(rootDs, slugA, async () => {
      const { ilan, varlik, kalem } = services(rootDs);
      const v = await varlik.create({ tip: VarlikTipi.Tasinir, ad: 'Tekrar Yayin' });
      // min şimdi-ilan (10 gün) kuralını rahatça karşılayan taban tarih.
      const now = Date.now() + 15 * GUN_MS;
      const created = await ilan.create({
        baslik: 'Tekrar',
        ihaleTipi: IhaleTipi.AcikTeklif,
        islemTuru: IslemTuru.Satis,
        ilanTarihi: new Date(now).toISOString(),
        ihaleTarihi: new Date(now + 15 * GUN_MS).toISOString(),
        katilimSartlari: [KatilimSarti.GeciciTeminatYatirma],
      });
      await kalem.add(created.id, v.id, 100);
      await zorunluEvraklariYukle(created.id);
      await ilan.changeDurum(created.id, IlanDurumu.Yayinda);
      await expect(ilan.changeDurum(created.id, IlanDurumu.Yayinda)).rejects.toThrow();
    });
  });

  it('yetersiz ilan-ihale aralığı → oluşturma reddedilir (KK-23: artık create anında doğrulanıyor)', async () => {
    await runAsTenant(rootDs, slugA, async () => {
      const { ilan } = services(rootDs);
      // min şimdi-ilan (10 gün) kuralını rahatça karşılayan taban tarih.
      const now = Date.now() + 15 * GUN_MS;
      await expect(
        ilan.create({
          baslik: 'Kısa',
          ihaleTipi: IhaleTipi.AcikTeklif,
          islemTuru: IslemTuru.Satis,
          ilanTarihi: new Date(now).toISOString(),
          ihaleTarihi: new Date(now + 2 * GUN_MS).toISOString(), // minIlanIhaleAraligiGun=10'un altında
        }),
      ).rejects.toThrow(/gün/);
    });
  });

  it('ilan tarihi bugüne çok yakınsa oluşturma reddedilir (KK-21/KK-23)', async () => {
    await runAsTenant(rootDs, slugA, async () => {
      const { ilan } = services(rootDs);
      const now = Date.now() + 1 * GUN_MS; // minSimdiIlanAraligiGun=10'un altında
      await expect(
        ilan.create({
          baslik: 'Yakın',
          ihaleTipi: IhaleTipi.AcikTeklif,
          islemTuru: IslemTuru.Satis,
          ilanTarihi: new Date(now).toISOString(),
          ihaleTarihi: new Date(now + 15 * GUN_MS).toISOString(),
        }),
      ).rejects.toThrow(/tarih/);
    });
  });

  it('taslakta tarihleri güncellemek: geçerli değer kabul edilir, kısa aralık reddedilir', async () => {
    await runAsTenant(rootDs, slugA, async () => {
      const { ilan } = services(rootDs);
      const now = Date.now() + 15 * GUN_MS;
      const created = await ilan.create({
        baslik: 'Tarih Guncelle',
        ihaleTipi: IhaleTipi.AcikTeklif,
        islemTuru: IslemTuru.Satis,
        ilanTarihi: new Date(now).toISOString(),
        ihaleTarihi: new Date(now + 15 * GUN_MS).toISOString(),
      });

      const guncellendi = await ilan.update(created.id, {
        ihaleTarihi: new Date(now + 20 * GUN_MS).toISOString(),
      });
      expect(guncellendi.bitis_tarihi).not.toBeNull();

      await expect(
        ilan.update(created.id, { ihaleTarihi: new Date(now + 2 * GUN_MS).toISOString() }),
      ).rejects.toThrow(/gün/);
    });
  });

  it('zorunlu evrak eksikse (İdari Şartname yok) publish reddedilir', async () => {
    await runAsTenant(rootDs, slugA, async () => {
      const { ilan, varlik, kalem } = services(rootDs);
      const v = await varlik.create({ tip: VarlikTipi.Tasinir, ad: 'Evraksiz' });
      // min şimdi-ilan (10 gün) kuralını rahatça karşılayan taban tarih.
      const now = Date.now() + 15 * GUN_MS;
      const created = await ilan.create({
        baslik: 'Evraksiz',
        ihaleTipi: IhaleTipi.AcikTeklif,
        islemTuru: IslemTuru.Satis,
        ilanTarihi: new Date(now).toISOString(),
        ihaleTarihi: new Date(now + 15 * GUN_MS).toISOString(),
        katilimSartlari: [KatilimSarti.GeciciTeminatYatirma],
      });
      await kalem.add(created.id, v.id, 100);
      // Kasıtlı: sadece ikisini yükle, İdari Şartname eksik kalsın.
      const qr = tenantContext.getStore()!.queryRunner;
      for (const tip of [EvrakTipi.TeknikSartname, EvrakTipi.IhaleDosyasi]) {
        await qr.query(`INSERT INTO evrak (ilan_id, dosya_adi, minio_key, tip) VALUES ($1, $2, $3, $4)`, [
          created.id,
          `${tip}.pdf`,
          `test/${created.id}/${tip}.pdf`,
          tip,
        ]);
      }
      await expect(ilan.changeDurum(created.id, IlanDurumu.Yayinda)).rejects.toThrow(/İdari Şartname/);
    });
  });

  it('katılım şartı seçilmemişse publish reddedilir', async () => {
    await runAsTenant(rootDs, slugA, async () => {
      const { ilan, varlik, kalem } = services(rootDs);
      const v = await varlik.create({ tip: VarlikTipi.Tasinir, ad: 'Sartsiz' });
      // min şimdi-ilan (10 gün) kuralını rahatça karşılayan taban tarih.
      const now = Date.now() + 15 * GUN_MS;
      const created = await ilan.create({
        baslik: 'Sartsiz',
        ihaleTipi: IhaleTipi.AcikTeklif,
        islemTuru: IslemTuru.Satis,
        ilanTarihi: new Date(now).toISOString(),
        ihaleTarihi: new Date(now + 15 * GUN_MS).toISOString(),
        // katilimSartlari kasıtlı boş bırakıldı.
      });
      await kalem.add(created.id, v.id, 100);
      await zorunluEvraklariYukle(created.id);
      await expect(ilan.changeDurum(created.id, IlanDurumu.Yayinda)).rejects.toThrow(/katılım şartı/);
    });
  });

  it('hiç varlık (kalem) eklenmemiş ilan publish reddedilir (KK-25)', async () => {
    await runAsTenant(rootDs, slugA, async () => {
      const { ilan } = services(rootDs);
      const now = Date.now() + 15 * GUN_MS;
      const created = await ilan.create({
        baslik: 'Kalemsiz',
        ihaleTipi: IhaleTipi.AcikTeklif,
        islemTuru: IslemTuru.Satis,
        ilanTarihi: new Date(now).toISOString(),
        ihaleTarihi: new Date(now + 15 * GUN_MS).toISOString(),
        katilimSartlari: [KatilimSarti.GeciciTeminatYatirma],
      });
      await zorunluEvraklariYukle(created.id);
      await expect(ilan.changeDurum(created.id, IlanDurumu.Yayinda)).rejects.toThrow(/varlık/);
    });
  });

  it('soft delete: silinen ilan/varlık list+get\'te görünmez ama satır fiziksel olarak durur (hard DELETE yok)', async () => {
    await runAsTenant(rootDs, slugA, async () => {
      const { ilan, varlik } = services(rootDs);
      const v = await varlik.create({ tip: VarlikTipi.Tasinir, ad: 'Silinecek Varlik' });
      const now = Date.now() + 15 * GUN_MS;
      const created = await ilan.create({
        baslik: 'Silinecek Ilan',
        ihaleTipi: IhaleTipi.AcikTeklif,
        islemTuru: IslemTuru.Satis,
        ilanTarihi: new Date(now).toISOString(),
        ihaleTarihi: new Date(now + 15 * GUN_MS).toISOString(),
      });

      await ilan.remove(created.id);
      await varlik.remove(v.id);

      expect(await ilan.get(created.id)).toBeNull();
      expect(await varlik.get(v.id)).toBeNull();

      const qr = tenantContext.getStore()!.queryRunner;
      const ilanRow = await qr.query('SELECT deleted_at FROM ilan WHERE id = $1', [created.id]);
      const varlikRow = await qr.query('SELECT deleted_at FROM varlik WHERE id = $1', [v.id]);
      expect(ilanRow[0]?.deleted_at).not.toBeNull();
      expect(varlikRow[0]?.deleted_at).not.toBeNull();
    });
  });

  it('geçersiz işlem türü reddedilir', async () => {
    await runAsTenant(rootDs, slugA, async () => {
      const { ilan } = services(rootDs);
      const now = Date.now() + 15 * GUN_MS;
      await expect(
        ilan.create({
          baslik: 'Gecersiz',
          ihaleTipi: IhaleTipi.AcikTeklif,
          islemTuru: 'GECERSIZ' as IslemTuru,
          ilanTarihi: new Date(now).toISOString(),
          ihaleTarihi: new Date(now + 15 * GUN_MS).toISOString(),
        }),
      ).rejects.toThrow(/işlem türü/);
    });
  });
});

describe('IlanKalemiService — entegrasyon (KK-25: bir ilan N varlık içerebilir)', () => {
  let rootDs: DataSource;
  const slug = `tintk${Date.now()}`;

  beforeAll(async () => {
    rootDs = createDataSource();
    await rootDs.initialize();
    await provisionTenant(slug, 'Entegrasyon Test Kalem', rootDs);
  });

  afterAll(async () => {
    await rootDs.query(`DROP SCHEMA IF EXISTS ${tenantSchema(slug)} CASCADE`);
    await rootDs.query('DELETE FROM shared.tenants WHERE slug = $1', [slug]);
    await rootDs.destroy();
  });

  async function taslakIlanOlustur(ilan: IlanService) {
    const now = Date.now() + 15 * GUN_MS;
    return ilan.create({
      baslik: 'Çoklu Varlık İlanı',
      ihaleTipi: IhaleTipi.AcikArtirma,
      islemTuru: IslemTuru.Satis,
      ilanTarihi: new Date(now).toISOString(),
      ihaleTarihi: new Date(now + 15 * GUN_MS).toISOString(),
    });
  }

  it('bir ilana birden fazla varlık (kalem) eklenebilir, farklı fiyatlarla listelenir', async () => {
    await runAsTenant(rootDs, slug, async () => {
      const { ilan, varlik, kalem } = services(rootDs);
      const created = await taslakIlanOlustur(ilan);
      const v1 = await varlik.create({ tip: VarlikTipi.Tasinmaz, ad: 'Arsa 1' });
      const v2 = await varlik.create({ tip: VarlikTipi.Tasinmaz, ad: 'Arsa 2' });

      await kalem.add(created.id, v1.id, 1000);
      await kalem.add(created.id, v2.id, 2500);

      const liste = await kalem.list(created.id);
      expect(liste).toHaveLength(2);
      expect(liste.map((k) => Number(k.baslangic_fiyati)).sort()).toEqual([1000, 2500]);
      expect(liste.every((k) => k.durum === 'BEKLIYOR')).toBe(true);
    });
  });

  it('aynı varlık aynı ilana iki kez eklenemez', async () => {
    await runAsTenant(rootDs, slug, async () => {
      const { ilan, varlik, kalem } = services(rootDs);
      const created = await taslakIlanOlustur(ilan);
      const v = await varlik.create({ tip: VarlikTipi.Tasinir, ad: 'Tekrar Eklenen' });
      await kalem.add(created.id, v.id, 100);
      await expect(kalem.add(created.id, v.id, 200)).rejects.toThrow(/zaten eklenmiş/);
    });
  });

  it('kalem (henüz BEKLIYOR) ilandan çıkarılabilir, soft delete sonrası listede görünmez', async () => {
    await runAsTenant(rootDs, slug, async () => {
      const { ilan, varlik, kalem } = services(rootDs);
      const created = await taslakIlanOlustur(ilan);
      const v = await varlik.create({ tip: VarlikTipi.Tasinir, ad: 'Çıkarılacak' });
      const eklenen = await kalem.add(created.id, v.id, 100);

      await kalem.remove(created.id, eklenen.id);

      expect(await kalem.list(created.id)).toHaveLength(0);
    });
  });
});

describe('Faz 2 — kalem bazlı başvuru/teklif/teminat/sonuçlandırma (KK-25)', () => {
  let rootDs: DataSource;
  const slug = `tintf2${Date.now()}`;

  beforeAll(async () => {
    rootDs = createDataSource();
    await rootDs.initialize();
    await provisionTenant(slug, 'Entegrasyon Test Faz2', rootDs);
  });

  afterAll(async () => {
    await rootDs.query(`DROP SCHEMA IF EXISTS ${tenantSchema(slug)} CASCADE`);
    await rootDs.query('DELETE FROM shared.tenants WHERE slug = $1', [slug]);
    await rootDs.destroy();
  });

  it('iki varlıklı ilanda her varlık bağımsız başvuru/teklif/sonuçlanma akışına sahiptir', async () => {
    await runAsTenant(rootDs, slug, async () => {
      const svc = services(rootDs);
      const now = Date.now() + 15 * GUN_MS;
      const created = await svc.ilan.create({
        baslik: 'İki Varlıklı İhale',
        ihaleTipi: IhaleTipi.AcikArtirma,
        islemTuru: IslemTuru.Satis,
        ilanTarihi: new Date(now).toISOString(),
        ihaleTarihi: new Date(now + 15 * GUN_MS).toISOString(),
        katilimSartlari: [KatilimSarti.GeciciTeminatYatirma],
      });
      const v1 = await svc.varlik.create({ tip: VarlikTipi.Tasinmaz, ad: 'Kalem A' });
      const v2 = await svc.varlik.create({ tip: VarlikTipi.Tasinmaz, ad: 'Kalem B' });
      const k1 = (await svc.kalem.add(created.id, v1.id, 1000)).id;
      const k2 = (await svc.kalem.add(created.id, v2.id, 2000)).id;
      await zorunluEvraklariYukle(created.id);
      await svc.ilan.changeDurum(created.id, IlanDurumu.Yayinda);

      // Başvuru + teminat, ilan hâlâ YAYINDA iken (ihale henüz başlamadan) yapılır.
      const basvuruA = await svc.basvuru.create(k1, 'kullanici-a', true, false);
      expect(basvuruA.ilan_kalemi_id).toBe(k1);
      const qr = tenantContext.getStore()!.queryRunner;
      const teminatRows = await qr.query(
        `INSERT INTO teminat (basvuru_id, tutar, durum) VALUES ($1, $2, 'BEKLEMEDE') RETURNING id`,
        [basvuruA.id, basvuruA.gereken_teminat],
      );
      await svc.teminat.approve(teminatRows[0].id, 'encumen-1');

      // İhale tarihini geçmişe çek (gerçek akışta 10 gün sonra olurdu) → İhaleyi Başlat çalışsın.
      await qr.query(`UPDATE ilan SET bitis_tarihi = now() - interval '1 minute' WHERE id = $1`, [created.id]);
      await svc.ilan.changeDurum(created.id, IlanDurumu.CanliArtirma);

      // Kalem A: onaylı başvurusu olan kullanıcı teklif verebilir.
      const teklifA = await svc.teklif.submit(k1, 'kullanici-a', 1500, 'Kullanıcı A');
      expect(teklifA.ilan_kalemi_id).toBe(k1);
      expect(teklifA.ilan_id).toBe(created.id);

      // Kalem B de artık CANLI_ARTIRMA (ihale tarihi ortak) ama kimsenin onaylı başvurusu yok.
      await expect(svc.teklif.submit(k2, 'kullanici-a', 2500, 'Kullanıcı A')).rejects.toThrow(/onaylanmış başvurunuz/);

      // Kalem A'yı sonuçlandır — kalem B hâlâ açık olduğu için ilan CANLI_ARTIRMA'da kalmalı.
      const sonucA = await svc.ilan.sonuclandirKalem(created.id, k1, 'KARAR-1');
      expect(sonucA.winnerId).toBe('kullanici-a');
      expect(sonucA.kazananTutar).toBe(1500);

      let ilanRow = await svc.ilan.get(created.id);
      expect(ilanRow?.durum).toBe(IlanDurumu.CanliArtirma);

      const kalemler = await svc.kalem.list(created.id);
      expect(kalemler.find((k) => k.id === k1)?.durum).toBe('SONUCLANDI');
      expect(kalemler.find((k) => k.id === k2)?.durum).toBe('CANLI_ARTIRMA');

      // Kalem B'ye hiç teklif verilmeden sonuçlandırılır (kazanansız kalem).
      const sonucB = await svc.ilan.sonuclandirKalem(created.id, k2, 'KARAR-2');
      expect(sonucB.winnerId).toBeNull();

      // Artık ilandaki TÜM kalemler terminal — ilan otomatik SONUCLANDI olmalı.
      ilanRow = await svc.ilan.get(created.id);
      expect(ilanRow?.durum).toBe(IlanDurumu.Sonuclandi);
    });
  });

  it('aynı ilandaki iki farklı varlığa aynı kullanıcı ayrı ayrı başvurabilir (eski ilan-bazlı kısıt kalktı)', async () => {
    await runAsTenant(rootDs, slug, async () => {
      const svc = services(rootDs);
      const now = Date.now() + 15 * GUN_MS;
      const created = await svc.ilan.create({
        baslik: 'Çoklu Başvuru Testi',
        ihaleTipi: IhaleTipi.AcikArtirma,
        islemTuru: IslemTuru.Satis,
        ilanTarihi: new Date(now).toISOString(),
        ihaleTarihi: new Date(now + 15 * GUN_MS).toISOString(),
        katilimSartlari: [KatilimSarti.GeciciTeminatYatirma],
      });
      const v1 = await svc.varlik.create({ tip: VarlikTipi.Tasinmaz, ad: 'Kalem C' });
      const v2 = await svc.varlik.create({ tip: VarlikTipi.Tasinmaz, ad: 'Kalem D' });
      const k1 = (await svc.kalem.add(created.id, v1.id, 500)).id;
      const k2 = (await svc.kalem.add(created.id, v2.id, 700)).id;
      await zorunluEvraklariYukle(created.id);
      await svc.ilan.changeDurum(created.id, IlanDurumu.Yayinda);

      await expect(svc.basvuru.create(k1, 'kullanici-x', true, false)).resolves.toBeTruthy();
      await expect(svc.basvuru.create(k2, 'kullanici-x', true, false)).resolves.toBeTruthy();
      // Aynı varlığa ikinci kez başvuru hâlâ engellenir.
      await expect(svc.basvuru.create(k1, 'kullanici-x', true, false)).rejects.toThrow(/zaten başvurdunuz/);
    });
  });
});

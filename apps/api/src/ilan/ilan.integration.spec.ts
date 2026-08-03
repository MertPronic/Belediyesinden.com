import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DataSource } from 'typeorm';
import { createDataSource } from '@belediyesinden/db';
import { provisionTenant, tenantContext, tenantSchema } from '@belediyesinden/tenancy';
import { EvrakTipi, IhaleTipi, IlanDurumu, KatilimSarti, VarlikTipi } from '@belediyesinden/shared';
import { IlanService } from './ilan.service';
import { VarlikService } from '../varlik/varlik.service';
import type { OpenSearchService } from '../search/opensearch.service';
import type { TeminatIadeService } from '../teminat/teminat-iade.service';

/**
 * Servis-seviyesi entegrasyon testi — gerçek yerel Postgres'e karşı (HTTP/Keycloak yok).
 * Adım 5 "bitiş kapısı": TASLAK→YAYINDA akışı + cross-tenant izolasyon + geçersiz
 * geçiş/tarih senaryoları, gerçek şema-başına-tenant izolasyonuyla kanıtlanır.
 *
 * Çalıştırma: `pnpm test:integration` (yerel Postgres gerektirir, `libs/db`'nin
 * varsayılan bağlantı bilgileriyle: localhost:5432, db/user/pass=belediyesinden*).
 * OpenSearch/BullMQ bağımlılıkları bu testin kapsamı dışında — no-op stub'lanır.
 */

const GUN_MS = 86_400_000;

const fakeOpenSearch = { indexIlan: async () => undefined } as unknown as OpenSearchService;
const fakeIadeService = { planlaIadeForIlan: async () => 0 } as unknown as TeminatIadeService;

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
  return {
    ilan: new IlanService(fakeOpenSearch, rootDs, fakeIadeService),
    varlik: new VarlikService(rootDs),
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

  it('TENANT_ADMIN akışı: varlık → taslak ilan → yayınla → YAYINDA döner', async () => {
    await runAsTenant(rootDs, slugA, async () => {
      const { ilan, varlik } = services(rootDs);
      const v = await varlik.create({ tip: VarlikTipi.Tasinmaz, ad: 'Test Arsa' });
      // min şimdi-ilan (10 gün) kuralını rahatça karşılayan taban tarih.
      const now = Date.now() + 15 * GUN_MS;
      const created = await ilan.create({
        baslik: 'Test İlan',
        varlikId: v.id,
        ihaleTipi: IhaleTipi.AcikArtirma,
        baslangicFiyati: 1000,
        ilanTarihi: new Date(now).toISOString(),
        ihaleTarihi: new Date(now + 15 * GUN_MS).toISOString(),
        katilimSartlari: [KatilimSarti.GeciciTeminatYatirma],
      });
      expect(created.durum).toBe(IlanDurumu.Taslak);
      await zorunluEvraklariYukle(created.id);

      const yayinda = await ilan.changeDurum(created.id, IlanDurumu.Yayinda);
      expect(yayinda.durum).toBe(IlanDurumu.Yayinda);

      const fetched = await ilan.get(created.id);
      expect(fetched?.durum).toBe(IlanDurumu.Yayinda);
    });
  });

  it("cross-tenant: B tenant'ı A'nın ilanını göremez", async () => {
    const ilanId = await runAsTenant(rootDs, slugA, async () => {
      const { ilan, varlik } = services(rootDs);
      const v = await varlik.create({ tip: VarlikTipi.Tasinir, ad: 'Cross Test' });
      const created = await ilan.create({
        baslik: 'Cross',
        varlikId: v.id,
        ihaleTipi: IhaleTipi.AcikTeklif,
        baslangicFiyati: 500,
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
      const { ilan, varlik } = services(rootDs);
      const v = await varlik.create({ tip: VarlikTipi.Tasinir, ad: 'Gecis Test' });
      const created = await ilan.create({
        baslik: 'Gecis',
        varlikId: v.id,
        ihaleTipi: IhaleTipi.AcikTeklif,
        baslangicFiyati: 100,
      });
      await expect(ilan.changeDurum(created.id, IlanDurumu.Sonuclandi)).rejects.toThrow();
    });
  });

  it('zaten YAYINDA olan ilan tekrar yayınlanamaz', async () => {
    await runAsTenant(rootDs, slugA, async () => {
      const { ilan, varlik } = services(rootDs);
      const v = await varlik.create({ tip: VarlikTipi.Tasinir, ad: 'Tekrar Yayin' });
      // min şimdi-ilan (10 gün) kuralını rahatça karşılayan taban tarih.
      const now = Date.now() + 15 * GUN_MS;
      const created = await ilan.create({
        baslik: 'Tekrar',
        varlikId: v.id,
        ihaleTipi: IhaleTipi.AcikTeklif,
        baslangicFiyati: 100,
        ilanTarihi: new Date(now).toISOString(),
        ihaleTarihi: new Date(now + 15 * GUN_MS).toISOString(),
        katilimSartlari: [KatilimSarti.GeciciTeminatYatirma],
      });
      await zorunluEvraklariYukle(created.id);
      await ilan.changeDurum(created.id, IlanDurumu.Yayinda);
      await expect(ilan.changeDurum(created.id, IlanDurumu.Yayinda)).rejects.toThrow();
    });
  });

  it('yetersiz ilan-ihale aralığı → publish reddedilir', async () => {
    await runAsTenant(rootDs, slugA, async () => {
      const { ilan, varlik } = services(rootDs);
      const v = await varlik.create({ tip: VarlikTipi.Tasinir, ad: 'Kisa Aralik' });
      // min şimdi-ilan (10 gün) kuralını rahatça karşılayan taban tarih.
      const now = Date.now() + 15 * GUN_MS;
      const created = await ilan.create({
        baslik: 'Kısa',
        varlikId: v.id,
        ihaleTipi: IhaleTipi.AcikTeklif,
        baslangicFiyati: 100,
        ilanTarihi: new Date(now).toISOString(),
        ihaleTarihi: new Date(now + 2 * GUN_MS).toISOString(), // minIlanIhaleAraligiGun=10'un altında
      });
      await expect(ilan.changeDurum(created.id, IlanDurumu.Yayinda)).rejects.toThrow(/gün/);
    });
  });

  it('tarih girilmeden yayınlanamaz', async () => {
    await runAsTenant(rootDs, slugA, async () => {
      const { ilan, varlik } = services(rootDs);
      const v = await varlik.create({ tip: VarlikTipi.Tasinir, ad: 'Tarihsiz' });
      const created = await ilan.create({
        baslik: 'Tarihsiz',
        varlikId: v.id,
        ihaleTipi: IhaleTipi.AcikTeklif,
        baslangicFiyati: 100,
      });
      await expect(ilan.changeDurum(created.id, IlanDurumu.Yayinda)).rejects.toThrow(/tarih/);
    });
  });

  it('zorunlu evrak eksikse (İdari Şartname yok) publish reddedilir', async () => {
    await runAsTenant(rootDs, slugA, async () => {
      const { ilan, varlik } = services(rootDs);
      const v = await varlik.create({ tip: VarlikTipi.Tasinir, ad: 'Evraksiz' });
      // min şimdi-ilan (10 gün) kuralını rahatça karşılayan taban tarih.
      const now = Date.now() + 15 * GUN_MS;
      const created = await ilan.create({
        baslik: 'Evraksiz',
        varlikId: v.id,
        ihaleTipi: IhaleTipi.AcikTeklif,
        baslangicFiyati: 100,
        ilanTarihi: new Date(now).toISOString(),
        ihaleTarihi: new Date(now + 15 * GUN_MS).toISOString(),
        katilimSartlari: [KatilimSarti.GeciciTeminatYatirma],
      });
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
      const { ilan, varlik } = services(rootDs);
      const v = await varlik.create({ tip: VarlikTipi.Tasinir, ad: 'Sartsiz' });
      // min şimdi-ilan (10 gün) kuralını rahatça karşılayan taban tarih.
      const now = Date.now() + 15 * GUN_MS;
      const created = await ilan.create({
        baslik: 'Sartsiz',
        varlikId: v.id,
        ihaleTipi: IhaleTipi.AcikTeklif,
        baslangicFiyati: 100,
        ilanTarihi: new Date(now).toISOString(),
        ihaleTarihi: new Date(now + 15 * GUN_MS).toISOString(),
        // katilimSartlari kasıtlı boş bırakıldı.
      });
      await zorunluEvraklariYukle(created.id);
      await expect(ilan.changeDurum(created.id, IlanDurumu.Yayinda)).rejects.toThrow(/katılım şartı/);
    });
  });

  it('soft delete: silinen ilan/varlık list+get\'te görünmez ama satır fiziksel olarak durur (hard DELETE yok)', async () => {
    await runAsTenant(rootDs, slugA, async () => {
      const { ilan, varlik } = services(rootDs);
      const v = await varlik.create({ tip: VarlikTipi.Tasinir, ad: 'Silinecek Varlik' });
      const created = await ilan.create({
        baslik: 'Silinecek Ilan',
        varlikId: v.id,
        ihaleTipi: IhaleTipi.AcikTeklif,
        baslangicFiyati: 100,
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
});

/**
 * seed-demo CLI — test sunucusu için demo verisi (varlık + ilan + kalem + evrak).
 *
 * Kullanım (sunucuda, repo kökünden): ./scripts/seed-demo.sh [slug]   (varsayılan: melikgazi)
 *
 * Veri, API'nin KENDİ servisleriyle oluşturulur (VarlikService, IlanService,
 * IlanKalemiService, EvrakService) — doğrulamalar, audit, MinIO ve arama indeksi
 * gerçek akıştaki gibi çalışır; tenant bağlamı `runInTenant` ile kurulur.
 *
 * Tek sapma: tarihler. Kurallar (yayın ≥10 gün sonra, ihale ≥10 gün daha sonra)
 * bugün oluşturulan bir ilanı 20 gün test edilemez kılar; bu yüzden ilanlar geçerli
 * tarihlerle oluşturulup yayınlandıktan SONRA tarihleri geriye çekilir.
 *
 * İdempotent: aynı başlıklı ilan varsa o ilan atlanır.
 * Bağımsız çalışır (@swc-node/register — Nest DI için decorator metadata gerekir).
 */
import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule, getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { rawQuery, sharedDataSourceOptions } from '@belediyesinden/db';
import { getCurrentTenant, runInTenant } from '@belediyesinden/tenancy';
import {
  EvrakTipi,
  IhaleTipi,
  IlanDurumu,
  IslemTuru,
  KatilimSarti,
  VarlikTipi,
} from '@belediyesinden/shared';
import { SearchModule } from '../apps/api/src/search/search.module';
import { IlanModule } from '../apps/api/src/ilan/ilan.module';
import { IlanService } from '../apps/api/src/ilan/ilan.service';
import { IlanKalemiService } from '../apps/api/src/ilan/ilan-kalemi.service';
import { VarlikService } from '../apps/api/src/varlik/varlik.service';
import { EvrakService } from '../apps/api/src/evrak/evrak.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({ ...sharedDataSourceOptions }),
    SearchModule,
    IlanModule,
  ],
})
class SeedModule {}

const GUN = 86_400_000;
const SAAT = 3_600_000;

interface VarlikTanim {
  tip: VarlikTipi;
  ad: string;
  aciklama: string;
  detay: Record<string, unknown>;
  baslangicFiyati: number;
}

/** Hedef durum + seed sonrası tarihler (şimdiye göre ms). */
interface IlanTanim {
  baslik: string;
  aciklama: string;
  ihaleTipi: IhaleTipi;
  islemTuru: IslemTuru;
  katilimSartlari: KatilimSarti[];
  varliklar: VarlikTanim[];
  hedef: 'TASLAK' | 'YAYINDA' | 'CANLI_ARTIRMA';
  /** Yayına alındıktan sonra ilan tarihi (geçmişte → vatandaşa görünür). */
  ilanTarihi?: number;
  /** Yayına alındıktan sonra ihale tarihi. */
  ihaleTarihi?: number;
}

const ORTAK_SARTLAR = [
  KatilimSarti.VergiBorcuOlmama,
  KatilimSarti.SgkBorcuOlmama,
  KatilimSarti.GeciciTeminatYatirma,
  KatilimSarti.IhaleyeKatilimYasagiOlmama,
];
const KONUM = { il: 'Kayseri', ilce: 'Melikgazi' };

const ILANLAR: IlanTanim[] = [
  {
    baslik: 'Gesi Fatih Mahallesi Konut İmarlı Arsalar Satışı',
    aciklama:
      'Belediyemize ait Gesi Fatih Mahallesi\'nde bulunan, konut imarlı iki adet arsa 2886 sayılı Devlet İhale Kanunu\'nun 45. maddesi uyarınca açık artırma usulüyle satılacaktır.',
    ihaleTipi: IhaleTipi.AcikArtirma,
    islemTuru: IslemTuru.Satis,
    katilimSartlari: ORTAK_SARTLAR,
    hedef: 'TASLAK',
    varliklar: [
      {
        tip: VarlikTipi.Tasinmaz,
        ad: 'Gesi Fatih Mh. 1245 Ada 7 Parsel',
        aciklama: 'Konut imarlı, köşe başı, altyapısı tamamlanmış arsa.',
        detay: { cinsi: 'ARSA_ARAZI', ...KONUM, mahalle: 'Gesi Fatih', paftaNo: 'K35-C-14', adaNo: '1245', parselNo: '7', yuzolcumu: 612, imarDurumu: 'Konut (TAKS 0,30 / KAKS 1,20)' },
        baslangicFiyati: 4_250_000,
      },
      {
        tip: VarlikTipi.Tasinmaz,
        ad: 'Gesi Fatih Mh. 1245 Ada 8 Parsel',
        aciklama: 'Konut imarlı, 7 parselin bitişiğinde arsa.',
        detay: { cinsi: 'ARSA_ARAZI', ...KONUM, mahalle: 'Gesi Fatih', paftaNo: 'K35-C-14', adaNo: '1245', parselNo: '8', yuzolcumu: 548, imarDurumu: 'Konut (TAKS 0,30 / KAKS 1,20)' },
        baslangicFiyati: 3_800_000,
      },
    ],
  },
  {
    baslik: 'Cumhuriyet Meydanı Altgeçit Çarşısı 14 No\'lu Dükkan Kiralaması',
    aciklama:
      'Cumhuriyet Meydanı altgeçit çarşısında bulunan 14 numaralı dükkan 3 (üç) yıl süreyle kiraya verilecektir. Aylık kira bedeli üzerinden açık artırma yapılacaktır.',
    ihaleTipi: IhaleTipi.AcikArtirma,
    islemTuru: IslemTuru.Kiralama,
    katilimSartlari: [...ORTAK_SARTLAR, KatilimSarti.TicaretSicilKaydi],
    hedef: 'YAYINDA',
    ilanTarihi: -3 * GUN,
    ihaleTarihi: 3 * GUN,
    varliklar: [
      {
        tip: VarlikTipi.Tasinmaz,
        ad: 'Altgeçit Çarşısı 14 No\'lu Dükkan',
        aciklama: 'Zemin kat, 38 m² kapalı alan, elektrik ve su aboneliği mevcut.',
        detay: { cinsi: 'BAGIMSIZ_BOLUM', ...KONUM, mahalle: 'Cumhuriyet', adaNo: '210', parselNo: '3', kapaliAlan: 38, blokNo: 'A', kat: 'Zemin', bagimsizBolumNo: '14', nitelik: 'ISYERI' },
        baslangicFiyati: 18_500,
      },
    ],
  },
  {
    baslik: 'Kent Parkı Kafeterya İşletme Hakkı Devri',
    aciklama:
      'Kent Parkı içinde yer alan kafeteryanın 5 (beş) yıl süreyle işletme hakkı devredilecektir. Yıllık bedel üzerinden açık artırma yapılacaktır.',
    ihaleTipi: IhaleTipi.AcikArtirma,
    islemTuru: IslemTuru.IsletmeHakkiDevri,
    katilimSartlari: [...ORTAK_SARTLAR, KatilimSarti.TicaretSicilKaydi, KatilimSarti.ImzaSirkuleriVekaletname],
    hedef: 'YAYINDA',
    ilanTarihi: -12 * GUN,
    // İhale zamanlayıcısı (60 sn'de bir) bu saatte ilanı kendiliğinden canlı artırmaya alır.
    ihaleTarihi: 1 * SAAT,
    varliklar: [
      {
        tip: VarlikTipi.IsletmeHakki,
        ad: 'Kent Parkı Kafeteryası',
        aciklama: '120 m² kapalı, 200 m² açık oturma alanı; mutfak ekipmanı belediyeye aittir.',
        detay: { ...KONUM, faaliyetKonusu: 'DIGER', alan: 320 },
        baslangicFiyati: 240_000,
      },
    ],
  },
  {
    baslik: 'Hizmet Dışı Belediye Araçları Satışı',
    aciklama:
      'Belediyemiz hizmetinden çıkarılan araçlar bulunduğu yerde ve hâliyle açık artırma usulüyle satılacaktır. Araçlar ihaleden önce Erciyesevler Şantiyesi\'nde görülebilir.',
    ihaleTipi: IhaleTipi.AcikArtirma,
    islemTuru: IslemTuru.Satis,
    katilimSartlari: ORTAK_SARTLAR,
    hedef: 'CANLI_ARTIRMA',
    ilanTarihi: -15 * GUN,
    ihaleTarihi: -1 * SAAT,
    varliklar: [
      {
        tip: VarlikTipi.Tasinir,
        ad: '2016 Model Ford Transit Panelvan',
        aciklama: '312.000 km, bakımlı, muayenesi 2027\'ye kadar geçerli.',
        detay: { cinsi: 'ARAC', ...KONUM, plakaNo: '38 ABC 016', markaModel: 'Ford Transit 350 L', renk: 'Beyaz', saseNo: 'WF0XXXTTGXGA12345', durumu: 'Çalışır' },
        baslangicFiyati: 385_000,
      },
      {
        tip: VarlikTipi.Tasinir,
        ad: '2013 Model Fiat Doblo',
        aciklama: '268.000 km, kaporta hasarlı, motor çalışır.',
        detay: { cinsi: 'ARAC', ...KONUM, plakaNo: '38 DEF 013', markaModel: 'Fiat Doblo Combi 1.3', renk: 'Beyaz', saseNo: 'ZFA22300005678901', durumu: 'Çalışır, kaporta hasarlı' },
        baslangicFiyati: 210_000,
      },
    ],
  },
  {
    baslik: 'Talas Bulvarı Billboard Reklam Alanları Kiralaması',
    aciklama:
      'Talas Bulvarı üzerindeki iki adet billboard reklam alanı 2 (iki) yıl süreyle kiraya verilecektir.',
    ihaleTipi: IhaleTipi.AcikArtirma,
    islemTuru: IslemTuru.Kiralama,
    katilimSartlari: ORTAK_SARTLAR,
    hedef: 'YAYINDA',
    ilanTarihi: -1 * GUN,
    ihaleTarihi: 10 * GUN,
    varliklar: [
      {
        tip: VarlikTipi.ReklamAlani,
        ad: 'Talas Bulvarı Billboard B-1',
        aciklama: 'Şehir merkezi yönü, aydınlatmalı.',
        detay: { ...KONUM, panoTipi: 'BILLBOARD', olcu: '3x8 m' },
        baslangicFiyati: 9_000,
      },
      {
        tip: VarlikTipi.ReklamAlani,
        ad: 'Talas Bulvarı Billboard B-2',
        aciklama: 'Talas yönü, aydınlatmalı.',
        detay: { ...KONUM, panoTipi: 'BILLBOARD', olcu: '3x8 m' },
        baslangicFiyati: 8_000,
      },
    ],
  },
];

const EVRAKLAR: { tip: EvrakTipi; dosya: string }[] = [
  { tip: EvrakTipi.IdariSartname, dosya: 'idari-sartname-ornek.pdf' },
  { tip: EvrakTipi.TeknikSartname, dosya: 'teknik-sartname-ornek.pdf' },
  { tip: EvrakTipi.IhaleDosyasi, dosya: 'ihale-dosyasi-ornek.pdf' },
];

function iso(ms: number): string {
  return new Date(Date.now() + ms).toISOString();
}

async function main(): Promise<void> {
  const slug = process.argv[2] ?? 'melikgazi';
  const app = await NestFactory.createApplicationContext(SeedModule, { logger: ['error', 'warn'] });
  const ds = app.get<DataSource>(getDataSourceToken());
  const varliklar = app.get(VarlikService, { strict: false });
  const ilanlar = app.get(IlanService, { strict: false });
  const kalemler = app.get(IlanKalemiService, { strict: false });
  const evraklar = app.get(EvrakService, { strict: false });

  try {
    for (const t of ILANLAR) {
      const ilanId = await runInTenant(ds, slug, async () => {
        const qr = getCurrentTenant()!.queryRunner;
        const mevcut = await rawQuery<{ id: string }>(qr, 'SELECT id FROM ilan WHERE baslik = $1 AND deleted_at IS NULL', [t.baslik]);
        if (mevcut[0]) {
          console.log(`  atlandı (zaten var): ${t.baslik}`);
          return null;
        }

        // Kurallara uyan tarihlerle oluştur (yayın 11 gün, ihale 22 gün sonra).
        const ilan = await ilanlar.create({
          baslik: t.baslik,
          aciklama: t.aciklama,
          ihaleTipi: t.ihaleTipi,
          islemTuru: t.islemTuru,
          ilanTarihi: iso(11 * GUN),
          ihaleTarihi: iso(22 * GUN),
          katilimSartlari: t.katilimSartlari,
        });
        for (const v of t.varliklar) {
          const varlik = await varliklar.create({ tip: v.tip, ad: v.ad, aciklama: v.aciklama, detay: v.detay });
          await kalemler.add(ilan.id, varlik.id, v.baslangicFiyati);
        }
        for (const e of EVRAKLAR) {
          const buffer = readFileSync(join(process.cwd(), 'ornek-evrak', e.dosya));
          await evraklar.upload(ilan.id, e.tip, { originalname: e.dosya, buffer, mimetype: 'application/pdf', size: buffer.length });
        }
        if (t.hedef === 'TASLAK') return ilan.id;

        await ilanlar.changeDurum(ilan.id, IlanDurumu.Yayinda);

        // Demo sapması: tarihleri geriye çek (bkz. dosya başı).
        await rawQuery(qr, 'UPDATE ilan SET baslangic_tarihi = $1, bitis_tarihi = $2 WHERE id = $3', [
          iso(t.ilanTarihi!),
          iso(t.ihaleTarihi!),
          ilan.id,
        ]);
        await rawQuery(qr, 'UPDATE ilan_kalemi SET bitis_tarihi = $1 WHERE ilan_id = $2', [
          iso(t.ihaleTarihi!),
          ilan.id,
        ]);

        if (t.hedef === 'CANLI_ARTIRMA') {
          await ilanlar.changeDurum(ilan.id, IlanDurumu.CanliArtirma);
        }
        return ilan.id;
      });

      if (ilanId) {
        console.log(`  ✓ ${t.hedef.padEnd(13)} ${t.baslik} (${t.varliklar.length} kalem)`);
      }
    }

    // Arama indeksini EN SONDA yeniden kur: changeDurum indeksi arka planda (fire-and-forget)
    // eski tarihlerle günceller; ilan başına tazeleme bu yarışı kaybedebiliyor.
    const adet = await runInTenant(ds, slug, () => ilanlar.resyncSearchIndex());
    console.log(`  arama indeksi yenilendi (${adet} ilan)`);
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error('seed-demo HATA:', e instanceof Error ? e.message : e);
  process.exit(1);
});

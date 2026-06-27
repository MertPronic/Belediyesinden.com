/**
 * test-auction-core — auction-core pure function unit testleri.
 * teklifDogrula + sureUzatmaGerekirMi + sureUzat.
 */
import { teklifDogrula, sureUzatmaGerekirMi, sureUzat, type TeklifKontekst } from '@belediyesinden/auction-core';

let passed = 0;
let failed = 0;

function assert(cond: boolean, msg: string): void {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.error(`  ✗ ${msg}`);
  }
}

function testTeklifDogrula(): void {
  const ctx: TeklifKontekst = {
    mevcutEnYuksekTeklif: 50000,
    minArtirmaAdimi: 100,
    baslangicFiyati: 50000,
    bitisTarihi: new Date(Date.now() + 86_400_000),
    ihaleTipi: 'ACIK_ARTIRMA',
  };

  assert(teklifDogrula(51000, ctx).gecerli === true, '51000 > 50000+100 → geçerli');
  assert(teklifDogrula(50100, ctx).gecerli === true, '50100 = 50000+100 → geçerli (eşik)');
  assert(teklifDogrula(50099, ctx).gecerli === false, '50099 < 50100 → geçersiz');
  assert(teklifDogrula(50000, ctx).gecerli === false, '50000 = mevcut → geçersiz (adım yok)');
  assert(teklifDogrula(51000, { ...ctx, bitisTarihi: new Date(0) }).gecerli === false, 'süresi dolmuş → geçersiz');

  // Teklif usulü (min adım yok, başlangıç fiyatı yeter).
  const ctx2 = { ...ctx, ihaleTipi: 'ACIK_TEKLIF', minArtirmaAdimi: 0 };
  assert(teklifDogrula(50000, ctx2).gecerli === true, 'açık teklif: 50000 = başlangıç → geçerli');
  assert(teklifDogrula(49999, ctx2).gecerli === false, 'açık teklif: 49999 < başlangıç → geçersiz');
}

function testSureUzatma(): void {
  const bitis = new Date(Date.now() + 5000); // 5 saniye sonra
  const uzatma = 10; // 10 dakika

  assert(sureUzatmaGerekirMi(bitis, uzatma) === true, '5s kala, 10dk pencere → uzat gerekir');
  assert(sureUzatmaGerekirMi(new Date(Date.now() + 999_999), uzatma) === false, 'uzak bitiş → uzat gerekmez');
  assert(sureUzatmaGerekirMi(bitis, 0) === false, '0 dakika (kapalı) → uzat gerekmez');
  assert(sureUzatmaGerekirMi(new Date(0), uzatma) === false, 'geçmiş bitiş → uzat gerekmez');

  const yeniBitis = sureUzat(bitis, uzatma);
  assert(yeniBitis.getTime() === bitis.getTime() + 10 * 60_000, 'süre uzatma 10dk doğru');
}

testTeklifDogrula();
testSureUzatma();

console.log(`\nSONUC: ${passed} passed, ${failed} failed ${failed === 0 ? '✓ ALL GREEN' : '✗'}`);
if (failed > 0) {
  process.exit(1);
}

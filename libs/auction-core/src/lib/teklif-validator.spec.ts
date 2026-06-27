import { describe, it, expect } from 'vitest';
import { teklifDogrula, type TeklifKontekst } from './teklif-validator';

function ctx(over: Partial<TeklifKontekst> = {}): TeklifKontekst {
  return {
    mevcutEnYuksekTeklif: 1000,
    minArtirmaAdimi: 100,
    baslangicFiyati: 500,
    bitisTarihi: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 hafta sonra
    ihaleTipi: 'ACIK_ARTIRMA',
    ...over,
  };
}

describe('teklifDogrula', () => {
  it('açık artırma: geçerli teklif (min artırma karşılanmış)', () => {
    const sonuc = teklifDogrula(1100, ctx());
    expect(sonuc.gecerli).toBe(true);
    expect(sonuc.yeniEnYuksek).toBe(1100);
  });

  it('açık artırma: min artırmadan az reddedilir', () => {
    const sonuc = teklifDogrula(1050, ctx({ mevcutEnYuksekTeklif: 1000, minArtirmaAdimi: 100 }));
    expect(sonuc.gecerli).toBe(false);
    expect(sonuc.hata).toBeDefined();
  });

  it('açık artırma: başlangıç fiyatı > mevcut ise eşik başlangıç', () => {
    const sonuc = teklifDogrula(550, ctx({ mevcutEnYuksekTeklif: 0, baslangicFiyati: 500, minArtirmaAdimi: 50 }));
    expect(sonuc.gecerli).toBe(true); // 550 >= max(0,500)+50 = 550
  });

  it('açık/kapalı teklif: başlangıç fiyatından az reddedilir', () => {
    const sonuc = teklifDogrula(400, ctx({ ihaleTipi: 'ACAIK_TEKLIF', baslangicFiyati: 500 }));
    expect(sonuc.gecerli).toBe(false);
  });

  it('süre dolduysa reddedilir', () => {
    const sonuc = teklifDogrula(9999, ctx({ bitisTarihi: new Date(Date.now() - 60000) }));
    expect(sonuc.gecerli).toBe(false);
    expect(sonuc.hata).toContain('süre');
  });

  it('tam min artırma border geçerli', () => {
    const sonuc = teklifDogrula(1100, ctx({ mevcutEnYuksekTeklif: 1000, minArtirmaAdimi: 100 }));
    expect(sonuc.gecerli).toBe(true);
  });
});

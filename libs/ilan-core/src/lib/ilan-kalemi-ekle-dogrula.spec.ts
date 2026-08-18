import { describe, it, expect } from 'vitest';
import { IlanDurumu } from '@belediyesinden/shared';
import { ilanKalemiEklemeGecerliMi } from './ilan-kalemi-ekle-dogrula';

describe('ilanKalemiEklemeGecerliMi', () => {
  it('taslak ilana yeni varlık → geçerli', () => {
    const sonuc = ilanKalemiEklemeGecerliMi(IlanDurumu.Taslak, [], 'varlik-1');
    expect(sonuc.gecerli).toBe(true);
  });

  it('yayında ilana yeni varlık → geçerli', () => {
    const sonuc = ilanKalemiEklemeGecerliMi(IlanDurumu.Yayinda, ['varlik-1'], 'varlik-2');
    expect(sonuc.gecerli).toBe(true);
  });

  it('canlı artırmadaki ilana varlık eklenemez', () => {
    const sonuc = ilanKalemiEklemeGecerliMi(IlanDurumu.CanliArtirma, [], 'varlik-1');
    expect(sonuc.gecerli).toBe(false);
    expect(sonuc.hata).toContain('taslak veya yayında');
  });

  it('sonuçlanmış ilana varlık eklenemez', () => {
    const sonuc = ilanKalemiEklemeGecerliMi(IlanDurumu.Sonuclandi, [], 'varlik-1');
    expect(sonuc.gecerli).toBe(false);
  });

  it('aynı varlık ilana ikinci kez eklenemez', () => {
    const sonuc = ilanKalemiEklemeGecerliMi(IlanDurumu.Taslak, ['varlik-1', 'varlik-2'], 'varlik-1');
    expect(sonuc.gecerli).toBe(false);
    expect(sonuc.hata).toContain('zaten eklenmiş');
  });
});

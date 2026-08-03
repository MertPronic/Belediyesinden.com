import { describe, it, expect } from 'vitest';
import { ilanKurallariGuncellemeGecerliMi } from './ilan-kurallari';

describe('ilanKurallariGuncellemeGecerliMi', () => {
  it('floor üzerinde gün değeri → geçerli', () => {
    expect(ilanKurallariGuncellemeGecerliMi({ minIlanIhaleAraligiGun: 15, minSimdiIlanAraligiGun: 12 }).gecerli).toBe(true);
  });

  it('minIlanIhaleAraligiGun floor altında → geçersiz', () => {
    const sonuc = ilanKurallariGuncellemeGecerliMi({ minIlanIhaleAraligiGun: 5 });
    expect(sonuc.gecerli).toBe(false);
    expect(sonuc.hata).toContain('kanuni asgari');
  });

  it('minSimdiIlanAraligiGun floor altında → geçersiz', () => {
    const sonuc = ilanKurallariGuncellemeGecerliMi({ minSimdiIlanAraligiGun: 3 });
    expect(sonuc.gecerli).toBe(false);
  });

  it('geçersiz teminatOrani (>1) → geçersiz', () => {
    expect(ilanKurallariGuncellemeGecerliMi({ teminatOrani: 1.5 }).gecerli).toBe(false);
  });

  it('negatif minArtirmaAdimi → geçersiz', () => {
    expect(ilanKurallariGuncellemeGecerliMi({ minArtirmaAdimi: -10 }).gecerli).toBe(false);
  });

  it('boş güncelleme (hiçbir alan değişmiyor) → geçerli', () => {
    expect(ilanKurallariGuncellemeGecerliMi({}).gecerli).toBe(true);
  });
});

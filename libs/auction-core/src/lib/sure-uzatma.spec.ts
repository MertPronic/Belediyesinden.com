import { describe, it, expect } from 'vitest';
import { sureUzatmaGerekirMi, sureUzat } from './sure-uzatma';

describe('sureUzatmaGerekirMi (anti-snipping)', () => {
  it('bitişe yakın teklif → süre uzatma gerekir', () => {
    const bitis = new Date(Date.now() + 3 * 60 * 1000); // 3 dk sonra
    expect(sureUzatmaGerekirMi(bitis, 10)).toBe(true); // 10 dk pencere içinde
  });

  it('bitişe uzak teklif → süre uzatma gerekmez', () => {
    const bitis = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 saat sonra
    expect(sureUzatmaGerekirMi(bitis, 10)).toBe(false);
  });

  it('süreUzatmaDakika 0 → hiçbir zaman uzatma gerekmez', () => {
    const bitis = new Date(Date.now() + 1000); // 1 sn sonra
    expect(sureUzatmaGerekirMi(bitis, 0)).toBe(false);
  });

  it('geçmiş bitiş → uzatma gerekmez (zaten bitti)', () => {
    const bitis = new Date(Date.now() - 60000); // 1 dk önce
    expect(sureUzatmaGerekirMi(bitis, 10)).toBe(false);
  });
});

describe('sureUzat', () => {
  it('bitiş tarihine belirtilen dakika ekler', () => {
    const bitis = new Date('2026-07-01T12:00:00Z');
    const yeni = sureUzat(bitis, 10);
    expect(yeni.getTime()).toBe(bitis.getTime() + 10 * 60 * 1000);
  });

  it('0 dakika → aynı tarih', () => {
    const bitis = new Date('2026-07-01T12:00:00Z');
    const yeni = sureUzat(bitis, 0);
    expect(yeni.getTime()).toBe(bitis.getTime());
  });
});

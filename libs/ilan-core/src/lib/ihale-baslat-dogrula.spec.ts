import { describe, it, expect } from 'vitest';
import { ihaleBaslatDogrula } from './ihale-baslat-dogrula';

const GUN_MS = 86_400_000;
const NOW = new Date('2026-07-30T00:00:00.000Z');

describe('ihaleBaslatDogrula', () => {
  it('ihale tarihi geçmişte → başlatılabilir', () => {
    const ihaleTarihi = new Date(NOW.getTime() - GUN_MS);
    expect(ihaleBaslatDogrula(ihaleTarihi, NOW).gecerli).toBe(true);
  });

  it('ihale tarihi tam şimdi → başlatılabilir', () => {
    expect(ihaleBaslatDogrula(NOW, NOW).gecerli).toBe(true);
  });

  it('ihale tarihi gelecekte → başlatılamaz', () => {
    const ihaleTarihi = new Date(NOW.getTime() + GUN_MS);
    const sonuc = ihaleBaslatDogrula(ihaleTarihi, NOW);
    expect(sonuc.gecerli).toBe(false);
    expect(sonuc.hata).toBeTruthy();
  });
});

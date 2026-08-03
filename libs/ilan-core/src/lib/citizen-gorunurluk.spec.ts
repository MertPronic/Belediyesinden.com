import { describe, it, expect } from 'vitest';
import { ilanCitizenGorunurMu } from './citizen-gorunurluk';

const NOW = new Date('2026-07-28T00:00:00.000Z');
const GUN_MS = 86_400_000;

describe('ilanCitizenGorunurMu', () => {
  it('YAYINDA + ilan tarihi geçmişte → görünür', () => {
    const ilanTarihi = new Date(NOW.getTime() - GUN_MS);
    expect(ilanCitizenGorunurMu('YAYINDA', ilanTarihi, NOW)).toBe(true);
  });

  it('YAYINDA + ilan tarihi tam şimdi → görünür', () => {
    expect(ilanCitizenGorunurMu('YAYINDA', NOW, NOW)).toBe(true);
  });

  it('YAYINDA + ilan tarihi gelecekte → gizli', () => {
    const ilanTarihi = new Date(NOW.getTime() + GUN_MS);
    expect(ilanCitizenGorunurMu('YAYINDA', ilanTarihi, NOW)).toBe(false);
  });

  it('YAYINDA + ilan tarihi yok (null) → görünür', () => {
    expect(ilanCitizenGorunurMu('YAYINDA', null, NOW)).toBe(true);
  });

  it('TASLAK → her zaman gizli, tarih fark etmez', () => {
    const ilanTarihi = new Date(NOW.getTime() - GUN_MS);
    expect(ilanCitizenGorunurMu('TASLAK', ilanTarihi, NOW)).toBe(false);
  });

  it('IPTAL → her zaman gizli', () => {
    const ilanTarihi = new Date(NOW.getTime() - GUN_MS);
    expect(ilanCitizenGorunurMu('IPTAL', ilanTarihi, NOW)).toBe(false);
  });

  it('SONUCLANDI + ilan tarihi geçmişte → görünür', () => {
    const ilanTarihi = new Date(NOW.getTime() - GUN_MS);
    expect(ilanCitizenGorunurMu('SONUCLANDI', ilanTarihi, NOW)).toBe(true);
  });
});

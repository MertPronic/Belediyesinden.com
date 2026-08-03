import { describe, it, expect } from 'vitest';
import { publishDogrula } from './publish-dogrula';

const GUN_MS = 86_400_000;
const NOW = new Date('2026-07-22T00:00:00.000Z');
const MIN_ARALIK = 10;
const MIN_SIMDI_ILAN = 10;

/** Yeni rule'u (min şimdi-ilan) her zaman karşılayan taban ilan tarihi. */
const GECERLI_ILAN_TARIHI = new Date(NOW.getTime() + MIN_SIMDI_ILAN * GUN_MS);

describe('publishDogrula', () => {
  it('ilan-ihale tam minimum aralık (ve ilan tarihi min şimdi-ilan sınırında) → geçerli', () => {
    const ihaleTarihi = new Date(GECERLI_ILAN_TARIHI.getTime() + MIN_ARALIK * GUN_MS);
    const sonuc = publishDogrula(GECERLI_ILAN_TARIHI, ihaleTarihi, MIN_ARALIK, MIN_SIMDI_ILAN, NOW);
    expect(sonuc.gecerli).toBe(true);
  });

  it('ilan-ihale minimum aralıktan 1 gün az → geçersiz', () => {
    const ihaleTarihi = new Date(GECERLI_ILAN_TARIHI.getTime() + (MIN_ARALIK - 1) * GUN_MS);
    const sonuc = publishDogrula(GECERLI_ILAN_TARIHI, ihaleTarihi, MIN_ARALIK, MIN_SIMDI_ILAN, NOW);
    expect(sonuc.gecerli).toBe(false);
    expect(sonuc.hata).toContain(`${MIN_ARALIK} gün`);
  });

  it('ters sıra (ihale tarihi ilan tarihinden önce) → geçersiz', () => {
    const ilanTarihi = new Date(NOW.getTime() + 20 * GUN_MS);
    const ihaleTarihi = new Date(NOW.getTime() + 15 * GUN_MS);
    const sonuc = publishDogrula(ilanTarihi, ihaleTarihi, MIN_ARALIK, MIN_SIMDI_ILAN, NOW);
    expect(sonuc.gecerli).toBe(false);
    expect(sonuc.hata).toContain('sonra olmalı');
  });

  it('ilan tarihi = ihale tarihi (eşit, sıfır aralık) → geçersiz', () => {
    const tarih = new Date(NOW.getTime() + 15 * GUN_MS);
    const sonuc = publishDogrula(tarih, tarih, MIN_ARALIK, MIN_SIMDI_ILAN, NOW);
    expect(sonuc.gecerli).toBe(false);
  });

  it('maksimum ilan-ihale aralığı sınırı yok — çok uzak ihale tarihi geçerli', () => {
    const ihaleTarihi = new Date(GECERLI_ILAN_TARIHI.getTime() + 3650 * GUN_MS);
    const sonuc = publishDogrula(GECERLI_ILAN_TARIHI, ihaleTarihi, MIN_ARALIK, MIN_SIMDI_ILAN, NOW);
    expect(sonuc.gecerli).toBe(true);
  });

  // --- Min şimdi-ilan aralığı (yasal asgari duyuru süresi) ---

  it('min şimdi-ilan tam sınırında (bugün + 10 gün) → geçerli', () => {
    const ilanTarihi = new Date(NOW.getTime() + MIN_SIMDI_ILAN * GUN_MS);
    const ihaleTarihi = new Date(ilanTarihi.getTime() + MIN_ARALIK * GUN_MS);
    const sonuc = publishDogrula(ilanTarihi, ihaleTarihi, MIN_ARALIK, MIN_SIMDI_ILAN, NOW);
    expect(sonuc.gecerli).toBe(true);
  });

  it('min şimdi-ilan sınırından 1 gün az (bugün + 9 gün) → geçersiz', () => {
    const ilanTarihi = new Date(NOW.getTime() + (MIN_SIMDI_ILAN - 1) * GUN_MS);
    const ihaleTarihi = new Date(ilanTarihi.getTime() + MIN_ARALIK * GUN_MS);
    const sonuc = publishDogrula(ilanTarihi, ihaleTarihi, MIN_ARALIK, MIN_SIMDI_ILAN, NOW);
    expect(sonuc.gecerli).toBe(false);
    expect(sonuc.hata).toContain(`${MIN_SIMDI_ILAN} gün sonra`);
  });

  it('ilan tarihi olarak yarın (çok yakın) → geçersiz', () => {
    const ilanTarihi = new Date(NOW.getTime() + 1 * GUN_MS);
    const ihaleTarihi = new Date(ilanTarihi.getTime() + MIN_ARALIK * GUN_MS);
    const sonuc = publishDogrula(ilanTarihi, ihaleTarihi, MIN_ARALIK, MIN_SIMDI_ILAN, NOW);
    expect(sonuc.gecerli).toBe(false);
    expect(sonuc.hata).toContain('bugünden en az');
  });

  it('ilan tarihi = bugün (0 gün) → geçersiz', () => {
    const ihaleTarihi = new Date(NOW.getTime() + (MIN_ARALIK + MIN_SIMDI_ILAN) * GUN_MS);
    const sonuc = publishDogrula(NOW, ihaleTarihi, MIN_ARALIK, MIN_SIMDI_ILAN, NOW);
    expect(sonuc.gecerli).toBe(false);
  });

  it('geçmiş ilan tarihi → geçersiz (artık meşru değil — asgari duyuru süresi ihlali)', () => {
    const ilanTarihi = new Date(NOW.getTime() - 30 * GUN_MS);
    const ihaleTarihi = new Date(NOW.getTime() + 5 * GUN_MS);
    const sonuc = publishDogrula(ilanTarihi, ihaleTarihi, MIN_ARALIK, MIN_SIMDI_ILAN, NOW);
    expect(sonuc.gecerli).toBe(false);
    expect(sonuc.hata).toContain('bugünden en az');
  });

  it('min şimdi-ilan kuralı 0 olsa bile ilan tarihi geçmişte olamaz', () => {
    const ilanTarihi = new Date(NOW.getTime() - 1 * GUN_MS);
    const ihaleTarihi = new Date(NOW.getTime() + MIN_ARALIK * GUN_MS);
    const sonuc = publishDogrula(ilanTarihi, ihaleTarihi, MIN_ARALIK, 0, NOW);
    expect(sonuc.gecerli).toBe(false);
  });
});

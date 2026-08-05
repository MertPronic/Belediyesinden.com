import { describe, it, expect } from 'vitest';
import { TasinirCinsi, TasinmazCinsi, VarlikTipi } from '@belediyesinden/shared';
import { varlikDetayDogrula } from './varlik-detay-dogrula';

describe('varlikDetayDogrula — Taşınmaz', () => {
  it('detay hiç yok → cinsi zorunlu olduğundan geçersiz', () => {
    const sonuc = varlikDetayDogrula(VarlikTipi.Tasinmaz, undefined);
    expect(sonuc.gecerli).toBe(false);
    expect(sonuc.hata).toBeTruthy();
  });

  it('cinsi boş string → geçersiz (dolu sayılmaz)', () => {
    const sonuc = varlikDetayDogrula(VarlikTipi.Tasinmaz, { cinsi: '' });
    expect(sonuc.gecerli).toBe(false);
  });

  it('sadece cinsi girilmiş, diğer alanlar boş → geçerli (diğerleri opsiyonel)', () => {
    const sonuc = varlikDetayDogrula(VarlikTipi.Tasinmaz, { cinsi: TasinmazCinsi.ArsaArazi });
    expect(sonuc.gecerli).toBe(true);
    expect(sonuc.hata).toBeUndefined();
  });

  it('cinsi + ek alanlar dolu → geçerli', () => {
    const sonuc = varlikDetayDogrula(VarlikTipi.Tasinmaz, {
      cinsi: TasinmazCinsi.BagimsizBolum,
      adaNo: '123',
      blokNo: 'A',
    });
    expect(sonuc.gecerli).toBe(true);
  });
});

describe('varlikDetayDogrula — Taşınır', () => {
  it('detay hiç yok → cinsi zorunlu olduğundan geçersiz', () => {
    expect(varlikDetayDogrula(VarlikTipi.Tasinir, undefined).gecerli).toBe(false);
  });

  it('cinsi = Araç → geçerli', () => {
    expect(varlikDetayDogrula(VarlikTipi.Tasinir, { cinsi: TasinirCinsi.Arac }).gecerli).toBe(true);
  });

  it('cinsi = Diğer → geçerli', () => {
    expect(varlikDetayDogrula(VarlikTipi.Tasinir, { cinsi: TasinirCinsi.Diger }).gecerli).toBe(true);
  });
});

describe('varlikDetayDogrula — İşletme Hakkı ve Reklam Alanı (zorunlu alan yok)', () => {
  it('İşletme Hakkı — detay hiç yok → yine de geçerli', () => {
    expect(varlikDetayDogrula(VarlikTipi.IsletmeHakki, undefined).gecerli).toBe(true);
  });

  it('İşletme Hakkı — boş obje → geçerli', () => {
    expect(varlikDetayDogrula(VarlikTipi.IsletmeHakki, {}).gecerli).toBe(true);
  });

  it('Reklam Alanı — detay hiç yok → geçerli', () => {
    expect(varlikDetayDogrula(VarlikTipi.ReklamAlani, undefined).gecerli).toBe(true);
  });
});

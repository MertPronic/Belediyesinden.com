import { describe, it, expect } from 'vitest';
import { TasinirCinsi, TasinmazCinsi, VarlikTipi } from '@belediyesinden/shared';
import { varlikDetayAlanlari } from './varlik-detay-alanlari';

function keys(tip: VarlikTipi, cinsi?: string): string[] {
  return varlikDetayAlanlari(tip, cinsi).map((a) => a.key);
}

describe('varlikDetayAlanlari — Taşınmaz', () => {
  it('cinsi seçilmemiş → sadece cinsi seçici döner', () => {
    const alanlar = varlikDetayAlanlari(VarlikTipi.Tasinmaz);
    expect(alanlar).toHaveLength(1);
    expect(alanlar[0].key).toBe('cinsi');
    expect(alanlar[0].zorunlu).toBe(true);
    expect(alanlar[0].secenekler?.map((s) => s.deger)).toEqual([
      TasinmazCinsi.ArsaArazi,
      TasinmazCinsi.MustakilEvBina,
      TasinmazCinsi.BagimsizBolum,
    ]);
  });

  it('Arsa/Arazi → arazi bilgileri, yapı/bağımsız bölüm alanları yok', () => {
    const k = keys(VarlikTipi.Tasinmaz, TasinmazCinsi.ArsaArazi);
    expect(k).toEqual([
      'cinsi',
      'ilce',
      'mahalle',
      'paftaNo',
      'adaNo',
      'parselNo',
      'yuzolcumu',
      'imarDurumu',
    ]);
    expect(k).not.toContain('blokNo');
    expect(k).not.toContain('kapaliAlan');
  });

  it('Müstakil Ev/Bina → arazi bilgileri + yapı bilgisi, bağımsız bölüm alanları yok', () => {
    const k = keys(VarlikTipi.Tasinmaz, TasinmazCinsi.MustakilEvBina);
    expect(k).toEqual(
      expect.arrayContaining(['cinsi', 'adaNo', 'parselNo', 'kapaliAlan', 'odaSayisi']),
    );
    expect(k).not.toContain('blokNo');
    expect(k).not.toContain('bagimsizBolumNo');
  });

  it('Bağımsız Bölüm → arazi + yapı + blok/kat/bağımsız bölüm no + niteliği', () => {
    const alanlar = varlikDetayAlanlari(VarlikTipi.Tasinmaz, TasinmazCinsi.BagimsizBolum);
    const k = alanlar.map((a) => a.key);
    expect(k).toEqual(
      expect.arrayContaining([
        'cinsi',
        'adaNo',
        'parselNo',
        'kapaliAlan',
        'blokNo',
        'kat',
        'bagimsizBolumNo',
        'nitelik',
      ]),
    );
    const nitelik = alanlar.find((a) => a.key === 'nitelik');
    expect(nitelik?.tip).toBe('select');
    expect(nitelik?.secenekler?.map((s) => s.deger)).toEqual(['MESKEN', 'ISYERI']);
  });

  it('geçersiz cinsi → sadece temel (cinsi seçici) alanlar döner, çökmez', () => {
    const k = keys(VarlikTipi.Tasinmaz, 'BILINMEYEN_DEGER');
    expect(k).toEqual(['cinsi']);
  });
});

describe('varlikDetayAlanlari — Taşınır', () => {
  it('cinsi seçilmemiş → cinsi seçici + ortak konum alanı döner', () => {
    const alanlar = varlikDetayAlanlari(VarlikTipi.Tasinir);
    expect(alanlar.map((a) => a.key)).toEqual(['cinsi', 'konum']);
    expect(alanlar[0].secenekler?.map((s) => s.deger)).toEqual([TasinirCinsi.Arac, TasinirCinsi.Diger]);
  });

  it('Araç → plaka/marka-model/renk/şase/durum alanları eklenir', () => {
    const k = keys(VarlikTipi.Tasinir, TasinirCinsi.Arac);
    expect(k).toEqual(['cinsi', 'konum', 'plakaNo', 'markaModel', 'renk', 'saseNo', 'durumu']);
  });

  it('Diğer → miktar/özel durum alanları eklenir, araç alanları yok', () => {
    const k = keys(VarlikTipi.Tasinir, TasinirCinsi.Diger);
    expect(k).toEqual(['cinsi', 'konum', 'miktar', 'ozelDurum']);
  });
});

describe('varlikDetayAlanlari — İşletme Hakkı ve Reklam Alanı (cinsi yok, sabit liste)', () => {
  it('İşletme Hakkı → konum, faaliyet konusu, alan', () => {
    const k = keys(VarlikTipi.IsletmeHakki);
    expect(k).toEqual(['konum', 'faaliyetKonusu', 'alan']);
  });

  it('Reklam Alanı → konum, pano tipi, ölçü', () => {
    const k = keys(VarlikTipi.ReklamAlani);
    expect(k).toEqual(['konum', 'panoTipi', 'olcu']);
  });

  it('İşletme Hakkı — cinsi parametresi verilse de yok sayılır', () => {
    expect(keys(VarlikTipi.IsletmeHakki, 'HERHANGI_BIR_DEGER')).toEqual(keys(VarlikTipi.IsletmeHakki));
  });
});

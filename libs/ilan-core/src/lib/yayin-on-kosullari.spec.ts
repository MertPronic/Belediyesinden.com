import { describe, it, expect } from 'vitest';
import { EvrakTipi } from '@belediyesinden/shared';
import { yayinOnKosullariGecerliMi } from './yayin-on-kosullari';

const TAM_EVRAK = [EvrakTipi.IdariSartname, EvrakTipi.TeknikSartname, EvrakTipi.IhaleDosyasi];
const BIR_SART = ['VERGI_BORCU_OLMAMA'];

describe('yayinOnKosullariGecerliMi', () => {
  it('tüm zorunlu evraklar + en az bir katılım şartı → geçerli', () => {
    const sonuc = yayinOnKosullariGecerliMi(TAM_EVRAK, BIR_SART);
    expect(sonuc.gecerli).toBe(true);
  });

  it('tek bir zorunlu evrak eksik → geçersiz, eksik olan hatada geçer', () => {
    const eksikTeknik = [EvrakTipi.IdariSartname, EvrakTipi.IhaleDosyasi];
    const sonuc = yayinOnKosullariGecerliMi(eksikTeknik, BIR_SART);
    expect(sonuc.gecerli).toBe(false);
    expect(sonuc.hata).toContain('Teknik Şartname');
  });

  it('hiç evrak yok → geçersiz, üçü de hatada listelenir', () => {
    const sonuc = yayinOnKosullariGecerliMi([], BIR_SART);
    expect(sonuc.gecerli).toBe(false);
    expect(sonuc.hata).toContain('İdari Şartname');
    expect(sonuc.hata).toContain('Teknik Şartname');
    expect(sonuc.hata).toContain('İhale Dosyası');
  });

  it('sadece DIGER tipi evrak var (zorunlular eksik) → geçersiz', () => {
    const sonuc = yayinOnKosullariGecerliMi([EvrakTipi.Diger], BIR_SART);
    expect(sonuc.gecerli).toBe(false);
  });

  it('zorunlu evraklar tam + fazladan DIGER de var → geçerli (ekstra sorun değil)', () => {
    const sonuc = yayinOnKosullariGecerliMi([...TAM_EVRAK, EvrakTipi.Diger], BIR_SART);
    expect(sonuc.gecerli).toBe(true);
  });

  it('aynı zorunlu tip tekrar yüklenmiş (örn. iki İdari Şartname) → yine geçerli', () => {
    const sonuc = yayinOnKosullariGecerliMi([...TAM_EVRAK, EvrakTipi.IdariSartname], BIR_SART);
    expect(sonuc.gecerli).toBe(true);
  });

  it('evraklar tam ama katılım şartı seçilmemiş → geçersiz', () => {
    const sonuc = yayinOnKosullariGecerliMi(TAM_EVRAK, []);
    expect(sonuc.gecerli).toBe(false);
    expect(sonuc.hata).toContain('katılım şartı');
  });

  it('hem evrak hem katılım şartı eksik → evrak hatası önce döner', () => {
    const sonuc = yayinOnKosullariGecerliMi([], []);
    expect(sonuc.gecerli).toBe(false);
    expect(sonuc.hata).toContain('Eksik zorunlu evrak');
  });

  it('kalemSayisi verilmezse varsayılan 1 → diğer koşullar tamsa geçerli (geriye dönük uyumluluk)', () => {
    const sonuc = yayinOnKosullariGecerliMi(TAM_EVRAK, BIR_SART);
    expect(sonuc.gecerli).toBe(true);
  });

  it('hiç kalem (varlık) eklenmemiş → geçersiz', () => {
    const sonuc = yayinOnKosullariGecerliMi(TAM_EVRAK, BIR_SART, 0);
    expect(sonuc.gecerli).toBe(false);
    expect(sonuc.hata).toContain('varlık');
  });

  it('birden fazla kalem eklenmiş → geçerli', () => {
    const sonuc = yayinOnKosullariGecerliMi(TAM_EVRAK, BIR_SART, 5);
    expect(sonuc.gecerli).toBe(true);
  });
});

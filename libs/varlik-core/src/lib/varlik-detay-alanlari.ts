import { TasinirCinsi, TasinmazCinsi, TURKIYE_ILLERI, VarlikTipi } from '@belediyesinden/shared';

export type VarlikDetayAlanTipi = 'text' | 'number' | 'select';

export interface VarlikDetaySecenek {
  deger: string;
  etiket: string;
}

export interface VarlikDetayAlanTanimi {
  key: string;
  etiket: string;
  tip: VarlikDetayAlanTipi;
  zorunlu: boolean;
  secenekler?: VarlikDetaySecenek[];
}

/**
 * Tüm varlık tiplerinde tutarlı, yapılandırılmış konum çifti — ilan oluşturulurken
 * buradan otomatik kopyalanır (bkz. `IlanService.create`, KK-24). Serbest metin
 * "Konum" alanının yerini alır; admin artık aynı bilgiyi ilan aşamasında tekrar
 * girmez.
 */
const ORTAK_IL_ILCE_ALANLARI: VarlikDetayAlanTanimi[] = [
  {
    key: 'il',
    etiket: 'İl',
    tip: 'select',
    zorunlu: false,
    // Serbest metin değil sabit liste — "kayseri" / "Kayseri" gibi büyük/küçük harf
    // tutarsızlığı arama filtresine (portal) sızmasın diye kaynağında engellenir.
    secenekler: TURKIYE_ILLERI.map((il) => ({ deger: il, etiket: il })),
  },
  { key: 'ilce', etiket: 'İlçe', tip: 'text', zorunlu: false },
];

const TASINMAZ_CINSI_ALANI: VarlikDetayAlanTanimi = {
  key: 'cinsi',
  etiket: 'Cinsi',
  tip: 'select',
  zorunlu: true,
  secenekler: [
    { deger: TasinmazCinsi.ArsaArazi, etiket: 'Arsa / Arazi' },
    { deger: TasinmazCinsi.MustakilEvBina, etiket: 'Müstakil Ev / Bina' },
    { deger: TasinmazCinsi.BagimsizBolum, etiket: 'Bağımsız Bölüm (Daire/İşyeri)' },
  ],
};

const TASINMAZ_ARAZI_ALANLARI: VarlikDetayAlanTanimi[] = [
  { key: 'mahalle', etiket: 'Mahalle', tip: 'text', zorunlu: false },
  { key: 'paftaNo', etiket: 'Pafta No', tip: 'text', zorunlu: false },
  { key: 'adaNo', etiket: 'Ada No', tip: 'text', zorunlu: false },
  { key: 'parselNo', etiket: 'Parsel No', tip: 'text', zorunlu: false },
  { key: 'yuzolcumu', etiket: 'Yüzölçümü (m²)', tip: 'number', zorunlu: false },
  { key: 'imarDurumu', etiket: 'İmar Durumu', tip: 'text', zorunlu: false },
];

const TASINMAZ_YAPI_ALANLARI: VarlikDetayAlanTanimi[] = [
  { key: 'kapaliAlan', etiket: 'Kapalı Alan (m²)', tip: 'number', zorunlu: false },
  { key: 'odaSayisi', etiket: 'Oda Sayısı', tip: 'text', zorunlu: false },
];

const TASINMAZ_BAGIMSIZ_BOLUM_ALANLARI: VarlikDetayAlanTanimi[] = [
  { key: 'blokNo', etiket: 'Blok No', tip: 'text', zorunlu: false },
  { key: 'kat', etiket: 'Kat', tip: 'text', zorunlu: false },
  { key: 'bagimsizBolumNo', etiket: 'Bağımsız Bölüm No', tip: 'text', zorunlu: false },
  {
    key: 'nitelik',
    etiket: 'Niteliği',
    tip: 'select',
    zorunlu: false,
    secenekler: [
      { deger: 'MESKEN', etiket: 'Mesken' },
      { deger: 'ISYERI', etiket: 'İşyeri' },
    ],
  },
];

/** Cinsi'ye göre arazi/yapı/bağımsız-bölüm alanları kademeli eklenir — bkz. DECISIONS. */
function tasinmazAlanlari(cinsi?: string): VarlikDetayAlanTanimi[] {
  const temel = [TASINMAZ_CINSI_ALANI, ...ORTAK_IL_ILCE_ALANLARI];
  switch (cinsi) {
    case TasinmazCinsi.ArsaArazi:
      return [...temel, ...TASINMAZ_ARAZI_ALANLARI];
    case TasinmazCinsi.MustakilEvBina:
      return [...temel, ...TASINMAZ_ARAZI_ALANLARI, ...TASINMAZ_YAPI_ALANLARI];
    case TasinmazCinsi.BagimsizBolum:
      return [...temel, ...TASINMAZ_ARAZI_ALANLARI, ...TASINMAZ_YAPI_ALANLARI, ...TASINMAZ_BAGIMSIZ_BOLUM_ALANLARI];
    default:
      return temel;
  }
}

const TASINIR_CINSI_ALANI: VarlikDetayAlanTanimi = {
  key: 'cinsi',
  etiket: 'Cinsi',
  tip: 'select',
  zorunlu: true,
  secenekler: [
    { deger: TasinirCinsi.Arac, etiket: 'Araç' },
    { deger: TasinirCinsi.Diger, etiket: 'Diğer' },
  ],
};

const TASINIR_ARAC_ALANLARI: VarlikDetayAlanTanimi[] = [
  { key: 'plakaNo', etiket: 'Plaka No', tip: 'text', zorunlu: false },
  { key: 'markaModel', etiket: 'Marka / Model', tip: 'text', zorunlu: false },
  { key: 'renk', etiket: 'Rengi', tip: 'text', zorunlu: false },
  { key: 'saseNo', etiket: 'Şase No', tip: 'text', zorunlu: false },
  { key: 'durumu', etiket: 'Durumu', tip: 'text', zorunlu: false },
];

const TASINIR_DIGER_ALANLARI: VarlikDetayAlanTanimi[] = [
  { key: 'miktar', etiket: 'Miktar / Adet', tip: 'text', zorunlu: false },
  { key: 'ozelDurum', etiket: 'Özel Durum', tip: 'text', zorunlu: false },
];

function tasinirAlanlari(cinsi?: string): VarlikDetayAlanTanimi[] {
  const temel = [TASINIR_CINSI_ALANI, ...ORTAK_IL_ILCE_ALANLARI];
  switch (cinsi) {
    case TasinirCinsi.Arac:
      return [...temel, ...TASINIR_ARAC_ALANLARI];
    case TasinirCinsi.Diger:
      return [...temel, ...TASINIR_DIGER_ALANLARI];
    default:
      return temel;
  }
}

const ISLETME_HAKKI_ALANLARI: VarlikDetayAlanTanimi[] = [
  ...ORTAK_IL_ILCE_ALANLARI,
  {
    key: 'faaliyetKonusu',
    etiket: 'Faaliyet Konusu',
    tip: 'select',
    zorunlu: false,
    secenekler: [
      { deger: 'KANTIN', etiket: 'Kantin' },
      { deger: 'BUFE', etiket: 'Büfe' },
      { deger: 'OTOPARK', etiket: 'Otopark' },
      { deger: 'CAY_OCAGI', etiket: 'Çay Ocağı' },
      { deger: 'DIGER', etiket: 'Diğer' },
    ],
  },
  { key: 'alan', etiket: 'Alan (m²)', tip: 'number', zorunlu: false },
];

const REKLAM_ALANI_ALANLARI: VarlikDetayAlanTanimi[] = [
  ...ORTAK_IL_ILCE_ALANLARI,
  {
    key: 'panoTipi',
    etiket: 'Pano Tipi',
    tip: 'select',
    zorunlu: false,
    secenekler: [
      { deger: 'BILLBOARD', etiket: 'Billboard' },
      { deger: 'MEGALIGHT', etiket: 'Megalight' },
      { deger: 'TOTEM', etiket: 'Totem' },
      { deger: 'RAKET', etiket: 'Raket' },
      { deger: 'CLP', etiket: 'CLP' },
    ],
  },
  { key: 'olcu', etiket: 'Ölçü (örn. 2x5 m)', tip: 'text', zorunlu: false },
];

/**
 * Varlık tipi (+ Taşınmaz/Taşınır için seçilen cinsi) için gösterilecek
 * `detay` alan tanımlarını döner. Admin formu hangi alanları render edeceğini,
 * `varlikDetayDogrula` hangi alanların zorunlu olduğunu bu tek kaynaktan okur.
 */
export function varlikDetayAlanlari(tip: VarlikTipi, cinsi?: string): VarlikDetayAlanTanimi[] {
  switch (tip) {
    case VarlikTipi.Tasinmaz:
      return tasinmazAlanlari(cinsi);
    case VarlikTipi.Tasinir:
      return tasinirAlanlari(cinsi);
    case VarlikTipi.IsletmeHakki:
      return ISLETME_HAKKI_ALANLARI;
    case VarlikTipi.ReklamAlani:
      return REKLAM_ALANI_ALANLARI;
  }
}

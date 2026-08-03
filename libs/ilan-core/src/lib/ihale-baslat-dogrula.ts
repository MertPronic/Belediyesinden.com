export interface IhaleBaslatSonuc {
  gecerli: boolean;
  hata?: string;
}

/**
 * YAYINDA → CANLI_ARTIRMA geçişinin sunucu-otoriter zaman kapısı.
 * İhale tarihi (ilan.bitis_tarihi) gelmeden ihale başlatılamaz — teklif verme
 * yalnızca CANLI_ARTIRMA'da açık olduğu için (bkz. TeklifService.submit) bu
 * kural, "ihale tarihine kadar teklif verilemez" iş kuralını fiilen uygular.
 */
export function ihaleBaslatDogrula(ihaleTarihi: Date, now: Date): IhaleBaslatSonuc {
  if (now.getTime() < ihaleTarihi.getTime()) {
    return { gecerli: false, hata: 'İhale tarihi henüz gelmedi — ihale başlatılamaz' };
  }
  return { gecerli: true };
}

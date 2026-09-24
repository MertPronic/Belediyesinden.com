/**
 * İlan kalemi — bir ilan içindeki tek bir varlığın ihale birimi (DECISIONS.md
 * KK-25). Raw sorguyla erişilir; alanlar DB kolon adlarıyla (snake_case) tanımlı.
 */
export interface IlanKalemi {
  id: string;
  ilan_id: string;
  varlik_id: string;
  baslangic_fiyati: string; // NUMERIC → pg string döner
  bitis_tarihi: Date | null;
  durum: string;
  kazanan_kullanici_id: string | null;
  kazanan_tutar: string | null;
  encumen_karar_no: string | null;
  encumen_karar_tarihi: Date | null;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

/** Kalem + görüntüleme için gereken varlık özet alanları (liste/detay yanıtı). */
export interface IlanKalemiOzet extends IlanKalemi {
  varlik_ad: string;
  varlik_tip: string;
  varlik_aciklama: string | null;
  varlik_detay: Record<string, unknown>;
}

/** Kalem + varlık + üst ilan bağlamı — vatandaş varlık detay sayfasının veri kaynağı. */
export interface IlanKalemiDetay extends IlanKalemiOzet {
  ilan_baslik: string;
  ihale_tipi: string;
  katilim_sartlari: string[];
  sartname_ucretli: boolean;
  sartname_tutari: string | null;
  kurallar: Record<string, unknown>;
  /** Üst ilanın durumu/ilan tarihi — vatandaş görünürlük kapısı için (bkz. `ilanCitizenGorunurMu`). */
  ilan_durum: string;
  ilan_baslangic_tarihi: Date | null;
}

/** Yönetim > İhaleler listesi satırı — tenant genelinde, ilan bağlamıyla birlikte (Harun/PO, 2026-09-24). */
export interface IlanKalemiYonetimSatiri extends IlanKalemi {
  varlik_ad: string;
  varlik_tip: string;
  ilan_baslik: string;
}

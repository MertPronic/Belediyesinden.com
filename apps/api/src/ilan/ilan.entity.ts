/**
 * İlan — tenant şeması (`tenant_<slug>.ilan`). Raw sorguyla erişilir; alanlar
 * DB kolon adlarıyla (snake_case) tanımlı (raw satır ↔ tip birebir).
 */
export interface Ilan {
  id: string;
  baslik: string;
  aciklama: string | null;
  varlik_id: string;
  ihale_tipi: string;
  durum: string;
  baslangic_fiyati: string; // NUMERIC → pg string döner
  baslangic_tarihi: Date | null;
  bitis_tarihi: Date | null;
  kurallar: Record<string, unknown>;
  /** Sonuçlandırma: kazanan teklif sahibi (null = kazanan yok). */
  kazanan_kullanici_id: string | null;
  /** Sonuçlandırma: kazanan teklif tutarı (NUMERIC → pg string). */
  kazanan_tutar: string | null;
  /** Konum (opsiyonel — harita için). */
  lat: number | null;
  lng: number | null;
  il: string | null;
  ilce: string | null;
  mahalle: string | null;
  /** 2886: encümen karar numarası (sonuçlandırmada). */
  encumen_karar_no: string | null;
  encumen_karar_tarihi: Date | null;
  created_at: Date;
  updated_at: Date;
}

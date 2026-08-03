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
  /** İlan (yayın) tarihi — personel girdisi (KK-20). Geçmiş olabilir. */
  baslangic_tarihi: Date | null;
  /** İhale tarihi — personel girdisi (KK-20). `publishDogrula` bu iki alanı doğrular. */
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
  /** Şartname bedeli ücretli mi (ilan başına tek bedel — Harun ile konuşulan süreç). */
  sartname_ucretli: boolean;
  /** Ücretliyse tutar (NUMERIC → pg string); ücretsizse null. */
  sartname_tutari: string | null;
  /** İhaleye katılım şartları (KatilimSarti değerleri, jsonb dizi). */
  katilim_sartlari: string[];
  /** Soft delete — dolu ise silinmiş sayılır, sorgulardan filtrelenir. Hard DELETE yasak (CLAUDE.md). */
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

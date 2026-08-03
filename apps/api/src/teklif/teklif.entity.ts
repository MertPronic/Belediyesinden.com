/** Teklif — tenant şeması. Raw sorgu; alanlar snake_case. */
export interface Teklif {
  id: string;
  ilan_id: string;
  kullanici_id: string;
  /** Yalnızca açık artırma ilanlarında dolu döner (bkz. TeklifService.list). */
  kullanici_ad?: string | null;
  tutar: string;
  kabul_edildi: boolean;
  created_at: Date;
}

/** Başvuru — tenant şeması. Raw sorgu; alanlar DB kolon adlarıyla (snake_case). */
export interface Basvuru {
  id: string;
  ilan_id: string;
  kullanici_id: string;
  durum: string;
  kvkk_onay: boolean;
  acik_riza: boolean;
  gereken_teminat: string | null; // NUMERIC → pg string
  created_at: Date;
  updated_at: Date;
}

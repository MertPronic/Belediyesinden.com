/** Evrak — tenant şeması. Raw sorgu; alanlar DB kolon adlarıyla (snake_case). */
export interface Evrak {
  id: string;
  ilan_id: string;
  dosya_adi: string;
  minio_key: string;
  content_type: string | null;
  boyut: string; // BIGINT → pg string
  imza_durumu: string;
  created_at: Date;
}

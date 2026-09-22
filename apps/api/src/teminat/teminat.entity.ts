/** Teminat — tenant şeması. Raw sorgu; alanlar DB kolon adlarıyla (snake_case). */
export interface Teminat {
  id: string;
  basvuru_id: string;
  tutar: string; // NUMERIC → pg string
  durum: string;
  dekont_minio_key: string | null;
  dekont_dosya_adi: string | null;
  onaylayan: string | null;
  onay_tarihi: Date | null;
  iade_tarihi: Date | null;
  red_gerekcesi: string | null;
  created_at: Date;
  updated_at: Date;
}

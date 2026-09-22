/** Uygulama-içi bildirim — raw sorguyla erişilir, alanlar DB kolon adlarıyla (snake_case). */
export interface Bildirim {
  id: string;
  /** Belirli bir kullanıcıya özel bildirim (NULL ise `hedef_rol`'e bakılır). */
  kullanici_id: string | null;
  /** Rol-bazlı yayın (örn. 'TENANT_OPS' — tenant'ın tüm TENANT_ADMIN/ENCUMEN personeli). */
  hedef_rol: string | null;
  tip: string;
  baslik: string;
  mesaj: string | null;
  link: string | null;
  okundu: boolean;
  created_at: Date;
}

/**
 * Belediyesinden · Domain enumları
 * Tüm tenant'ları aşan ortak sabitler.
 */

/** İlan yaşam döngüsü durumları (ilan yönetimi durum makinesi). */
export enum IlanDurumu {
  Taslak = 'TASLAK',
  Yayinda = 'YAYINDA',
  CanliArtirma = 'CANLI_ARTIRMA',
  Sonuclandi = 'SONUCLANDI',
  Iptal = 'IPTAL',
}

/** İhale/usul tipleri (2886 sayılı Kanun'a atıfla). */
export enum IhaleTipi {
  AcikArtirma = 'ACIK_ARTIRMA',
  AcikTeklif = 'ACIK_TEKLIF',
  KapaliTeklif = 'KAPALI_TEKLIF',
}

/** Belediye (tenant) kayıt durumu. */
export enum TenantDurumu {
  Provisioning = 'PROVISIONING',
  Aktif = 'AKTIF',
  Pasif = 'PASIF',
  Suspended = 'SUSPENDED',
}

/** Gelir getirici varlık tipleri. */
export enum VarlikTipi {
  Tasinir = 'TASINIR',
  Tasinmaz = 'TASINMAZ',
  IsletmeHakki = 'ISLETME_HAKKI',
  ReklamAlani = 'REKLAM_ALANI',
}

/** Kullanıcı rolleri (Keycloak realm rolleriyle eşleşir). */
export enum KullaniciRolu {
  Superadmin = 'SUPERADMIN',
  TenantAdmin = 'TENANT_ADMIN',
  Encumen = 'ENCUMEN',
  Vatandas = 'VATANDAS',
  Yatirimci = 'YATIRIMCI',
}

/** Teminat yaşam döngüsü durumları. */
export enum TeminatDurumu {
  Beklemede = 'BEKLEMEDE',
  BlokeEdildi = 'BLOKE_EDILDI',
  KabulEdildi = 'KABUL_EDILDI',
  IadeEdildi = 'IADE_EDILDI',
  Reddedildi = 'REDDEDILDI',
}

/** Başvuru yaşam döngüsü durumları (ilan'a katılım). */
export enum BasvuruDurumu {
  Basladi = 'BASLADI',
  TeminatBekleniyor = 'TEMINAT_BEKLENIYOR',
  Onaylandi = 'ONAYLANDI',
  Reddedildi = 'REDDEDILDI',
  IadeEdildi = 'IADE_EDILDI',
  IptalEdildi = 'IPTAL_EDILDI',
}

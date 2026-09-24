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

/**
 * İlan kalemi (bir ilan içindeki tek varlığın ihale birimi) yaşam döngüsü —
 * `IlanDurumu`'ndan bağımsız: kalemler kendi teklif/kazanan/sonuçlanma
 * akışında ilerler (bkz. DECISIONS.md KK-25).
 */
export enum IlanKalemiDurumu {
  Bekliyor = 'BEKLIYOR',
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

/** İşlem türü — ilanın satış mı, kiralama mı, işletme hakkı devri mi olduğu. `ihaleTipi`den bağımsız (o, ihale usulünü tutar). */
export enum IslemTuru {
  Satis = 'SATIS',
  Kiralama = 'KIRALAMA',
  IsletmeHakkiDevri = 'ISLETME_HAKKI_DEVRI',
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

/** Taşınmaz varlığın alt-cinsi (varlık.detay.cinsi) — hangi ek alanların gösterileceğini belirler. */
export enum TasinmazCinsi {
  ArsaArazi = 'ARSA_ARAZI',
  MustakilEvBina = 'MUSTAKIL_EV_BINA',
  BagimsizBolum = 'BAGIMSIZ_BOLUM',
}

/** Taşınır varlığın alt-cinsi (varlık.detay.cinsi). */
export enum TasinirCinsi {
  Arac = 'ARAC',
  Diger = 'DIGER',
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

/** İlan evrakı kategorisi (ihale dosyası kalemleri). */
export enum EvrakTipi {
  IdariSartname = 'IDARI_SARTNAME',
  TeknikSartname = 'TEKNIK_SARTNAME',
  IhaleDosyasi = 'IHALE_DOSYASI',
  Diger = 'DIGER',
}

/** Uygulama-içi bildirim türü. */
export enum BildirimTipi {
  YeniBasvuru = 'YENI_BASVURU',
  TeminatOnaylandi = 'TEMINAT_ONAYLANDI',
  TeminatReddedildi = 'TEMINAT_REDDEDILDI',
  IhaleHatirlatma = 'IHALE_HATIRLATMA',
  IhaleBasladi = 'IHALE_BASLADI',
}

/**
 * İhaleye katılım şartları (2886-usulü yaygın kalemler) — TASLAK liste,
 * Harun (PO) ile teyit edilecek. jsonb'de saklandığı için yeni değer
 * eklemek migration istemez.
 */
export enum KatilimSarti {
  VergiBorcuOlmama = 'VERGI_BORCU_OLMAMA',
  SgkBorcuOlmama = 'SGK_BORCU_OLMAMA',
  GeciciTeminatYatirma = 'GECICI_TEMINAT_YATIRMA',
  IhaleyeKatilimYasagiOlmama = 'IHALEYE_KATILIM_YASAGI_OLMAMA',
  TicaretSicilKaydi = 'TICARET_SICIL_KAYDI',
  ImzaSirkuleriVekaletname = 'IMZA_SIRKULERI_VEKALETNAME',
}

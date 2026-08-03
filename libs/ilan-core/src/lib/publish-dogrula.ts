const GUN_MS = 86_400_000;

/**
 * TASLAK → YAYINDA doğrulaması — sunucu-otoriter.
 * İlan tarihi bugünden en az `minSimdiIlanAraligiGun` gün sonra olmalı (yasal
 * asgari duyuru süresi — personel "yarın" gibi çok yakın bir tarih girip
 * duyuru süresini fiilen kısaltamaz). İhale tarihinin gelecekte olması ve
 * ilan ile ihale arasında kural motorunun dayattığı minimum aralığın
 * bulunması ayrıca zorunlu. Üst sınır yok — ilan uzun süre yayında kalabilir.
 */
export interface PublishSonuc {
  gecerli: boolean;
  hata?: string;
}

export function publishDogrula(
  ilanTarihi: Date,
  ihaleTarihi: Date,
  minIlanIhaleAraligiGun: number,
  minSimdiIlanAraligiGun: number,
  now: Date,
): PublishSonuc {
  const simdiIlanGunMs = ilanTarihi.getTime() - now.getTime();
  const minSimdiIlanMs = minSimdiIlanAraligiGun * GUN_MS;
  if (simdiIlanGunMs < minSimdiIlanMs) {
    return {
      gecerli: false,
      hata: `İlan tarihi bugünden en az ${minSimdiIlanAraligiGun} gün sonra olmalı`,
    };
  }
  if (ihaleTarihi <= ilanTarihi) {
    return { gecerli: false, hata: 'İhale tarihi ilan tarihinden sonra olmalı' };
  }
  // Not: "ihaleTarihi geçmişte olamaz" ayrı bir kural değil — yukarıdaki iki
  // kural (ilanTarihi >= now + minSimdiIlanAraligiGun, ihaleTarihi > ilanTarihi)
  // birlikte ihaleTarihi > now'ı zaten matematiksel olarak garanti eder.
  const araGunMs = ihaleTarihi.getTime() - ilanTarihi.getTime();
  const minGunMs = minIlanIhaleAraligiGun * GUN_MS;
  if (araGunMs < minGunMs) {
    return {
      gecerli: false,
      hata: `İlan ile ihale arasında en az ${minIlanIhaleAraligiGun} gün olmalı`,
    };
  }
  return { gecerli: true };
}

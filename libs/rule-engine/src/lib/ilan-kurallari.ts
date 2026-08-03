import type { QueryRunner } from 'typeorm';
import { IhaleTipi } from '@belediyesinden/shared';
import { rawQuery } from '@belediyesinden/db';

/**
 * Bir ilan tipi için geçerli kurallar (tenant bazında özelleştirilebilir).
 * 2886 usullerine göre temel parametreler; açık artırmada min artış + anti-snipping,
 * teklif usullerinde daha sade.
 */
export interface IlanKurallari {
  /** Minimum teklif artırma adımı (TL). Açık artırmada anlamlı. */
  minArtirmaAdimi: number;
  /** Teminat oranı (ilan başlangıç fiyatına göre kesir, örn. 0.10 = %10). */
  teminatOrani: number;
  /** İhale süresi (gün). Not: publish akışında artık kullanılmıyor (KK-20) — tarihler personel girdisi. */
  ihaleSuresiGun: number;
  /** Anti-snipping: bitiş anında teklif gelirse uzatma (dakika). 0 = kapalı. */
  sureUzatmaDakika: number;
  /** Minimum ilan-ihale aralığı (gün): ihale_tarihi - ilan_tarihi bu değerden az olamaz. Üst sınır yok (KK-20). */
  minIlanIhaleAraligiGun: number;
  /** Minimum şimdi-ilan aralığı (gün): asgari yasal duyuru süresi — ilan_tarihi bugünden bu değerden az sonra olamaz. */
  minSimdiIlanAraligiGun: number;
}

/** Her ihale tipi için varsayılan kurallar (provisioning'te seed edilir). */
export const defaultIlanKurallari: Record<IhaleTipi, IlanKurallari> = {
  [IhaleTipi.AcikArtirma]: { minArtirmaAdimi: 100, teminatOrani: 0.1, ihaleSuresiGun: 7, sureUzatmaDakika: 10, minIlanIhaleAraligiGun: 10, minSimdiIlanAraligiGun: 10 },
  [IhaleTipi.AcikTeklif]: { minArtirmaAdimi: 0, teminatOrani: 0.1, ihaleSuresiGun: 7, sureUzatmaDakika: 0, minIlanIhaleAraligiGun: 10, minSimdiIlanAraligiGun: 10 },
  [IhaleTipi.KapaliTeklif]: { minArtirmaAdimi: 0, teminatOrani: 0.1, ihaleSuresiGun: 7, sureUzatmaDakika: 0, minIlanIhaleAraligiGun: 10, minSimdiIlanAraligiGun: 10 },
};

/**
 * Kanuni asgari değerler (2886 sayılı Kanun) — tenant bu değerlerin altına inemez.
 * Üst sınır yok; belediye isterse süreyi uzatabilir.
 */
export const ILAN_KURALLARI_ASGARI: Pick<IlanKurallari, 'minIlanIhaleAraligiGun' | 'minSimdiIlanAraligiGun'> = {
  minIlanIhaleAraligiGun: 10,
  minSimdiIlanAraligiGun: 10,
};

export interface IlanKurallariGuncellemeSonucu {
  gecerli: boolean;
  hata?: string;
}

/**
 * Tenant'ın kurallar güncelleme isteğini doğrular (floor + mantıklı sınırlar).
 * Kısmi güncellemeyi (sadece değişen alanları) kabul eder.
 */
export function ilanKurallariGuncellemeGecerliMi(yeni: Partial<IlanKurallari>): IlanKurallariGuncellemeSonucu {
  if (yeni.minIlanIhaleAraligiGun !== undefined && yeni.minIlanIhaleAraligiGun < ILAN_KURALLARI_ASGARI.minIlanIhaleAraligiGun) {
    return { gecerli: false, hata: `İlan-ihale aralığı en az ${ILAN_KURALLARI_ASGARI.minIlanIhaleAraligiGun} gün olmalı (kanuni asgari süre)` };
  }
  if (yeni.minSimdiIlanAraligiGun !== undefined && yeni.minSimdiIlanAraligiGun < ILAN_KURALLARI_ASGARI.minSimdiIlanAraligiGun) {
    return { gecerli: false, hata: `Şimdi-ilan aralığı en az ${ILAN_KURALLARI_ASGARI.minSimdiIlanAraligiGun} gün olmalı (kanuni asgari süre)` };
  }
  if (yeni.teminatOrani !== undefined && (yeni.teminatOrani <= 0 || yeni.teminatOrani > 1)) {
    return { gecerli: false, hata: 'Teminat oranı 0 ile 1 arasında olmalı' };
  }
  if (yeni.minArtirmaAdimi !== undefined && yeni.minArtirmaAdimi < 0) {
    return { gecerli: false, hata: 'Minimum artırma adımı negatif olamaz' };
  }
  if (yeni.sureUzatmaDakika !== undefined && yeni.sureUzatmaDakika < 0) {
    return { gecerli: false, hata: 'Süre uzatma dakikası negatif olamaz' };
  }
  return { gecerli: true };
}

/**
 * Aktif tenant'ın `ilan_kurallari` tablosundan belirli bir tipin kurallarını çeker.
 * Yoksa/eksikse varsayılanla birleştirir.
 */
export async function getIlanKurallari(qr: QueryRunner, tip: IhaleTipi): Promise<IlanKurallari> {
  const rows = await rawQuery<{ kurallar?: object }>(qr, 'SELECT kurallar FROM ilan_kurallari WHERE ihale_tipi = $1', [tip]);
  const stored = rows[0]?.kurallar;
  return { ...defaultIlanKurallari[tip], ...(stored ?? {}) } as IlanKurallari;
}

/**
 * Mevcut kurallarla birleştirip `ilan_kurallari` satırını UPSERT eder.
 * Çağıran taraf `ilanKurallariGuncellemeGecerliMi` ile önceden doğrulamalı.
 */
export async function updateIlanKurallari(qr: QueryRunner, tip: IhaleTipi, yeni: Partial<IlanKurallari>): Promise<IlanKurallari> {
  const mevcut = await getIlanKurallari(qr, tip);
  const birlesik: IlanKurallari = { ...mevcut, ...yeni };
  await rawQuery(
    qr,
    `INSERT INTO ilan_kurallari (ihale_tipi, kurallar, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (ihale_tipi) DO UPDATE SET kurallar = $2, updated_at = now()`,
    [tip, JSON.stringify(birlesik)],
  );
  return birlesik;
}

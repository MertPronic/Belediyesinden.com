import type { QueryRunner } from 'typeorm';
import { IhaleTipi } from '@belediyesinden/shared';

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
  /** İhale süresi (gün). */
  ihaleSuresiGun: number;
  /** Anti-snipping: bitiş anında teklif gelirse uzatma (dakika). 0 = kapalı. */
  sureUzatmaDakika: number;
}

/** Her ihale tipi için varsayılan kurallar (provisioning'te seed edilir). */
export const defaultIlanKurallari: Record<IhaleTipi, IlanKurallari> = {
  [IhaleTipi.AcikArtirma]: { minArtirmaAdimi: 100, teminatOrani: 0.1, ihaleSuresiGun: 7, sureUzatmaDakika: 10 },
  [IhaleTipi.AcikTeklif]: { minArtirmaAdimi: 0, teminatOrani: 0.1, ihaleSuresiGun: 7, sureUzatmaDakika: 0 },
  [IhaleTipi.KapaliTeklif]: { minArtirmaAdimi: 0, teminatOrani: 0.1, ihaleSuresiGun: 7, sureUzatmaDakika: 0 },
};

/**
 * Aktif tenant'ın `ilan_kurallari` tablosundan (queryRunner search_path'i içinde)
 * belirli bir tipin kurallarını çeker. Yoksa/eksikse varsayılanla birleştirir.
 *
 * @param qr  Aktif tenant'ın QueryRunner'ı (getCurrentTenant().queryRunner).
 * @param tip İhale tipi.
 */
export async function getIlanKurallari(qr: QueryRunner, tip: IhaleTipi): Promise<IlanKurallari> {
  const rows = (await qr.query('SELECT kurallar FROM ilan_kurallari WHERE ihale_tipi = $1', [tip])) as Array<{
    kurallar?: object;
  }>;
  const stored = rows[0]?.kurallar;
  return { ...defaultIlanKurallari[tip], ...(stored ?? {}) } as IlanKurallari;
}

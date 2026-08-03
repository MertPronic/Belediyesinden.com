import { IlanDurumu } from '@belediyesinden/shared';

/**
 * İlan durum makinesi — izinli geçişler.
 * SONUCLANDI ve IPTAL uç (terminal) durumlardır, buradan hiçbir yere geçilemez.
 */
const GECIS_HARITASI: Record<IlanDurumu, IlanDurumu[]> = {
  [IlanDurumu.Taslak]: [IlanDurumu.Yayinda, IlanDurumu.Iptal],
  [IlanDurumu.Yayinda]: [IlanDurumu.CanliArtirma, IlanDurumu.Iptal],
  [IlanDurumu.CanliArtirma]: [IlanDurumu.Sonuclandi, IlanDurumu.Iptal],
  [IlanDurumu.Sonuclandi]: [],
  [IlanDurumu.Iptal]: [],
};

export function ilanGecisGecerliMi(mevcut: IlanDurumu, hedef: IlanDurumu): boolean {
  return GECIS_HARITASI[mevcut]?.includes(hedef) ?? false;
}

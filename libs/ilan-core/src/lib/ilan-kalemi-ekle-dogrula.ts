import { IlanDurumu } from '@belediyesinden/shared';

/**
 * İlana varlık (kalem) ekleme doğrulaması (DECISIONS.md KK-25).
 * Kalem sadece TASLAK/YAYINDA'daki bir ilana eklenebilir (CANLI_ARTIRMA'ya
 * geçtikten sonra ihale tarihi tüm kalemler için ortak sabitlenmiş sayılır —
 * yarışa yeni bir varlık sokmak adil olmaz). Aynı varlık aynı ilana iki kez
 * eklenemez (DB'de `ux_ilan_kalemi_ilan_varlik` ile de korunuyor; bu fonksiyon
 * kullanıcıya erken/temiz bir hata mesajı vermek için).
 */
export interface IlanKalemiEkleSonuc {
  gecerli: boolean;
  hata?: string;
}

export function ilanKalemiEklemeGecerliMi(
  ilanDurumu: IlanDurumu,
  mevcutVarlikIdleri: string[],
  yeniVarlikId: string,
): IlanKalemiEkleSonuc {
  if (ilanDurumu !== IlanDurumu.Taslak && ilanDurumu !== IlanDurumu.Yayinda) {
    return { gecerli: false, hata: 'Varlık yalnızca taslak veya yayında bir ilana eklenebilir' };
  }
  if (mevcutVarlikIdleri.includes(yeniVarlikId)) {
    return { gecerli: false, hata: 'Bu varlık ilana zaten eklenmiş' };
  }
  return { gecerli: true };
}

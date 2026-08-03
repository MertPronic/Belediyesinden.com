/**
 * Sayfalama — CLAUDE.md kırmızı çizgisi: sınırsız `SELECT *` yasak, her liste
 * endpoint'i `limit`/`offset` alır. Bu yardımcı, controller'dan gelen ham
 * (string) `page`/`pageSize` query parametrelerini güvenli LIMIT/OFFSET'e çevirir.
 */
const VARSAYILAN_SAYFA_BOYUTU = 20;
const MAKS_SAYFA_BOYUTU = 100;

export interface SayfalamaGirdisi {
  page?: string;
  pageSize?: string;
}

export interface SayfalamaSonucu {
  limit: number;
  offset: number;
}

export function sayfalamaCoz({ page, pageSize }: SayfalamaGirdisi): SayfalamaSonucu {
  const boyut = Math.min(Math.max(Number(pageSize) || VARSAYILAN_SAYFA_BOYUTU, 1), MAKS_SAYFA_BOYUTU);
  const sayfaNo = Math.max(Number(page) || 1, 1);
  return { limit: boyut, offset: (sayfaNo - 1) * boyut };
}

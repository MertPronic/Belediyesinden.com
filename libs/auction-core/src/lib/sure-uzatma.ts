/**
 * Anti-snipping (dinamik süre uzatma) algoritması.
 * Bitiş anına yakın geçerli bir teklif gelirse süreyi uzatır →
 * son saniye "sniping" adaletsizliğini engeller.
 *
 * Kural motorundan sureUzatmaDakika: 0 = kapalı (uzatma yok).
 */
const DAKIKA_MS = 60_000;

/** Bitişe sureUzatmaDakika'dan az kaldıysa true (süre uzatma tetiklenir). */
export function sureUzatmaGerekirMi(bitisTarihi: Date, sureUzatmaDakika: number): boolean {
  if (sureUzatmaDakika <= 0) {
    return false;
  }
  const kalanMs = bitisTarihi.getTime() - Date.now();
  return kalanMs > 0 && kalanMs < sureUzatmaDakika * DAKIKA_MS;
}

/** Bitiş tarihini sureUzatmaDakika kadar uzatır. */
export function sureUzat(bitisTarihi: Date, sureUzatmaDakika: number): Date {
  return new Date(bitisTarihi.getTime() + sureUzatmaDakika * DAKIKA_MS);
}

/**
 * İlan görsel yardımcıları — client değil (server component'ten çağrılabilir).
 * Backend ilan görselleri bağlanana kadar dummy üretir.
 */

/** İlan ID'sinden tutarlı dummy görsel URL'leri üretir (picsum.photos). */
export function dummyGorseller(seed: string, count = 15): string[] {
  const n = Math.max(1, Math.min(count, 15));
  return Array.from({ length: n }, (_, i) => `https://picsum.photos/seed/${seed}-${i}/900/560`);
}

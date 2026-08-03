/** Vatandaşa açık durumlar — taslak/iptal asla görünmez. */
export const CITIZEN_GORUNUR_DURUMLAR = ['YAYINDA', 'CANLI_ARTIRMA', 'SONUCLANDI'];

/**
 * Bir ilanın vatandaşa (kimliksiz veya personel-olmayan) görünür olup
 * olmadığını belirler — sunucu-otoriter.
 *
 * "İlan Tarihi" yalnızca yayınlama anında ileri-tarihli olmasını zorunlu kılan
 * bir kural değil, aynı zamanda o tarih gelene kadar ilanın vatandaştan
 * gizlenmesini de sağlar (2886 sayılı Kanun'un ilan/duyuru mantığı) — personel
 * ilanı erken yayınlasa bile ilan tarihi gelmeden vatandaş göremez.
 */
export function ilanCitizenGorunurMu(
  durum: string,
  ilanTarihi: Date | string | null,
  now: Date,
): boolean {
  if (!CITIZEN_GORUNUR_DURUMLAR.includes(durum)) {
    return false;
  }
  if (!ilanTarihi) {
    return true;
  }
  return new Date(ilanTarihi).getTime() <= now.getTime();
}

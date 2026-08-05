import type { VarlikTipi } from '@belediyesinden/shared';
import { varlikDetayAlanlari } from './varlik-detay-alanlari';

export interface VarlikDetayDogrulamaSonuc {
  gecerli: boolean;
  hata?: string;
}

/**
 * `detay`'daki zorunlu alanlar (örn. Taşınmaz/Taşınır'da cinsi seçimi) eksikse
 * ilk hatayı Türkçe döner. Alan listesini `varlikDetayAlanlari` ile aynı
 * kaynaktan okur — form ve backend zorunluluk tanımından sapamaz.
 */
export function varlikDetayDogrula(
  tip: VarlikTipi,
  detay: Record<string, unknown> | undefined,
): VarlikDetayDogrulamaSonuc {
  const cinsi = typeof detay?.['cinsi'] === 'string' ? (detay['cinsi'] as string) : undefined;
  const alanlar = varlikDetayAlanlari(tip, cinsi);
  for (const alan of alanlar) {
    if (!alan.zorunlu) continue;
    const deger = detay?.[alan.key];
    if (deger === undefined || deger === null || deger === '') {
      return { gecerli: false, hata: `${alan.etiket} zorunludur` };
    }
  }
  return { gecerli: true };
}

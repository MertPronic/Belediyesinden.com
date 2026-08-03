import { EvrakTipi } from '@belediyesinden/shared';

/**
 * Yayın (publish) ön koşulu — Harun (PO) ile konuşulan gerçek süreç:
 * ihale dosyası (idari + teknik şartname + ihale dosyası) yüklenmeden ve
 * katılım şartları seçilmeden ilan yayınlanamaz. `publishDogrula` (tarih
 * kuralları) ile ayrı sorumluluk — `IlanService.changeDurum` ikisini de çağırır.
 */
const ZORUNLU_EVRAK_TIPLERI: EvrakTipi[] = [
  EvrakTipi.IdariSartname,
  EvrakTipi.TeknikSartname,
  EvrakTipi.IhaleDosyasi,
];

const EVRAK_TIPI_ETIKET: Record<EvrakTipi, string> = {
  [EvrakTipi.IdariSartname]: 'İdari Şartname',
  [EvrakTipi.TeknikSartname]: 'Teknik Şartname',
  [EvrakTipi.IhaleDosyasi]: 'İhale Dosyası',
  [EvrakTipi.Diger]: 'Diğer',
};

export interface YayinOnKosulSonuc {
  gecerli: boolean;
  hata?: string;
}

export function yayinOnKosullariGecerliMi(
  yuklenenEvrakTipleri: EvrakTipi[],
  katilimSartlari: string[],
): YayinOnKosulSonuc {
  const eksik = ZORUNLU_EVRAK_TIPLERI.filter((tip) => !yuklenenEvrakTipleri.includes(tip));
  if (eksik.length > 0) {
    return {
      gecerli: false,
      hata: `Eksik zorunlu evrak: ${eksik.map((tip) => EVRAK_TIPI_ETIKET[tip]).join(', ')}`,
    };
  }
  if (katilimSartlari.length === 0) {
    return { gecerli: false, hata: 'En az bir katılım şartı seçilmeli' };
  }
  return { gecerli: true };
}

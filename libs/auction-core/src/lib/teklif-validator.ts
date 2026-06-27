/**
 * Teklif doğrulama — sunucu-otoriter (server-authoritative).
 * Açık artırmada: teklif > mevcut en yüksek + min artırma adımı.
 * Açık/kapalı teklif usulünde: teklif >= başlangıç fiyatı.
 * İhale süresi dolduysa reddeder.
 */
export interface TeklifKontekst {
  mevcutEnYuksekTeklif: number;
  minArtirmaAdimi: number;
  baslangicFiyati: number;
  bitisTarihi: Date;
  ihaleTipi: string;
}

export interface TeklifSonuc {
  gecerli: boolean;
  hata?: string;
  yeniEnYuksek: number;
}

export function teklifDogrula(teklifTutari: number, ctx: TeklifKontekst): TeklifSonuc {
  if (new Date() > ctx.bitisTarihi) {
    return { gecerli: false, hata: 'İhale süresi doldu', yeniEnYuksek: ctx.mevcutEnYuksekTeklif };
  }
  const esik = Math.max(ctx.mevcutEnYuksekTeklif, ctx.baslangicFiyati);

  if (ctx.ihaleTipi === 'ACIK_ARTIRMA') {
    const minTeklif = esik + ctx.minArtirmaAdimi;
    if (teklifTutari < minTeklif) {
      return {
        gecerli: false,
        hata: `Minimum teklif: ${minTeklif} (mevcut + artırma adımı ${ctx.minArtirmaAdimi})`,
        yeniEnYuksek: ctx.mevcutEnYuksekTeklif,
      };
    }
  } else {
    if (teklifTutari < ctx.baslangicFiyati) {
      return {
        gecerli: false,
        hata: `Minimum: başlangıç fiyatı ${ctx.baslangicFiyati}`,
        yeniEnYuksek: ctx.mevcutEnYuksekTeklif,
      };
    }
  }
  return { gecerli: true, yeniEnYuksek: teklifTutari };
}

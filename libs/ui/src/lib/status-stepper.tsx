import type { ReactNode } from 'react';
import { Check, Minus, X } from 'lucide-react';

export interface StatusStepperAdim {
  label: string;
}

/**
 * Adım adım ilerleme göstergesi + dolan bar (Harun bey/PO geri bildirimi, 2026-08-24:
 * "adım adım gibi bir görsel ve dolan bir status bilgisi barı"). Süreç hâlâ devam eden
 * (happy-path) durumlar için asıl kullanım şekli; `durakIndex` verilirse süreç o adımda
 * durmuş demektir (reddedildi/iptal) — o adım kırmızı/gri bir işaretle biter, sonrası gri kalır.
 */
export function StatusStepper({
  adimlar,
  aktifIndex,
  aktifTamamlandi = false,
  durakIndex,
  durakRenk = 'red',
  aciklama,
  action,
}: {
  adimlar: StatusStepperAdim[];
  /** Şu an hangi adımdayız (0-indeksli). */
  aktifIndex: number;
  /** aktifIndex'teki adım da tamamlandı mı (bar tümüyle dolu) yoksa hâlâ sürüyor mu (dolmakta, nabız). */
  aktifTamamlandi?: boolean;
  /** Süreç bu adımda durduysa (0-indeksli) — o adım X/tire işareti alır, sonraki adımlar gri kalır (hiç ulaşılmamış). */
  durakIndex?: number;
  /** Durağın rengi — red: reddedildi gibi bir hata; gray: kullanıcının kendi iptali gibi nötr bir duruş. */
  durakRenk?: 'red' | 'gray';
  aciklama?: ReactNode;
  action?: ReactNode;
}) {
  const tamamlananIndex = durakIndex != null ? durakIndex - 1 : aktifTamamlandi ? aktifIndex : aktifIndex - 1;
  const araSayisi = adimlar.length - 1;
  const doluYuzde = araSayisi <= 0 ? 100 : Math.max(0, Math.min(100, (tamamlananIndex / araSayisi) * 100));

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="relative flex items-center justify-between">
        <div className="absolute left-3.5 right-3.5 top-1/2 h-1 -translate-y-1/2 rounded-full bg-gray-200" />
        <div
          className="absolute left-3.5 top-1/2 h-1 -translate-y-1/2 rounded-full bg-emerald-500 transition-all duration-500"
          style={{ width: doluYuzde <= 0 ? 0 : `calc((100% - 1.75rem) * ${doluYuzde / 100})` }}
        />
        {adimlar.map((adim, i) => {
          const durak = durakIndex === i;
          const tamam = !durak && i <= tamamlananIndex;
          const aktif = !durak && i === aktifIndex && !aktifTamamlandi;
          return (
            <div
              key={adim.label}
              className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white transition-colors ${
                durak
                  ? durakRenk === 'red'
                    ? 'bg-red-600'
                    : 'bg-gray-500'
                  : tamam
                    ? 'bg-emerald-500'
                    : aktif
                      ? 'bg-amber-500'
                      : 'bg-gray-200'
              }`}
            >
              {durak ? (
                durakRenk === 'red' ? (
                  <X className="h-4 w-4" />
                ) : (
                  <Minus className="h-4 w-4" />
                )
              ) : tamam ? (
                <Check className="h-4 w-4" />
              ) : (
                <span className={`h-2.5 w-2.5 rounded-full ${aktif ? 'animate-pulse bg-white' : 'bg-gray-400'}`} />
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between">
        {adimlar.map((adim, i) => (
          <p
            key={adim.label}
            className={`max-w-[90px] text-center text-[11px] font-medium leading-tight ${
              i === durakIndex
                ? durakRenk === 'red'
                  ? 'text-red-600'
                  : 'text-gray-700'
                : i <= tamamlananIndex || i === aktifIndex
                  ? 'text-gray-900'
                  : 'text-gray-400'
            }`}
          >
            {adim.label}
          </p>
        ))}
      </div>
      {aciklama && <p className="mt-3 text-sm text-gray-600">{aciklama}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

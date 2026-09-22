import type { ReactNode } from 'react';

export type StatusBannerRenk = 'amber' | 'emerald' | 'red' | 'gray';

/** Açık zemin + kenarlık + koyu vurgu (Harun bey/PO geri bildirimi, 2026-08-27: dolgun renk "alarm" gibi durdu — daha sakin/tasarlanmış bir ton istendi). */
const RENK_SINIFI: Record<StatusBannerRenk, { bg: string; border: string; vurgu: string }> = {
  amber: { bg: 'bg-amber-50', border: 'border-amber-200', vurgu: 'text-amber-700' },
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', vurgu: 'text-emerald-700' },
  red: { bg: 'bg-red-50', border: 'border-red-200', vurgu: 'text-red-700' },
  gray: { bg: 'bg-gray-50', border: 'border-gray-200', vurgu: 'text-gray-700' },
};

/** Belirgin durum banner'ı — başvuru/teminat gibi süreç durumlarını soluk Alert yerine göze çarpan, ama "alarm çalmayan" bir tonda gösterir. */
export function StatusBanner({
  renk,
  icon,
  baslik,
  aciklama,
  action,
}: {
  renk: StatusBannerRenk;
  icon: ReactNode;
  baslik: string;
  aciklama: ReactNode;
  action?: ReactNode;
}) {
  const { bg, border, vurgu } = RENK_SINIFI[renk];
  return (
    <div className={`flex items-start gap-3 rounded-lg border p-4 ${bg} ${border}`}>
      <span className={`shrink-0 ${vurgu} [&>svg]:h-6 [&>svg]:w-6`}>{icon}</span>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-bold uppercase tracking-wide ${vurgu}`}>{baslik}</p>
        <p className="mt-0.5 text-sm text-gray-700">{aciklama}</p>
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  );
}

import Link from 'next/link';
import { CalendarClock, FileText, Gavel, Lock } from 'lucide-react';
import { Card, CardContent, CardFooter } from './card';
import { DurumBadge } from './badge';

/** İlan kartı tarafından kullanılan ortak alan seti. */
export interface IlanKartiData {
  id: string;
  baslik: string;
  ihale_tipi: string;
  durum: string;
  baslangic_fiyati: string | number;
  bitis_tarihi?: string | null;
  islem_turu?: string | null;
}

const ISLEM_TURU_ETIKET: Record<string, string> = {
  SATIS: 'Satış',
  KIRALAMA: 'Kiralama',
  ISLETME_HAKKI_DEVRI: 'İşletme Hakkı Devri',
};

const TIP_ICON: Record<string, { icon: typeof Gavel; label: string }> = {
  ACAIK_ARTIRMA: { icon: Gavel, label: 'Açık Artırma' },
  ACIK_ARTIRMA: { icon: Gavel, label: 'Açık Artırma' },
  ACIK_TEKLIF: { icon: FileText, label: 'Açık Teklif' },
  KAPALI_TEKLIF: { icon: Lock, label: 'Kapalı Teklif' },
};

function fmt(tl: string | number): string {
  return Number(tl).toLocaleString('tr-TR');
}

/**
 * Kurumsal ilan kartı — ihale tipi ikonu + durum dot + fiyat hiyerarşisi + bitiş footer.
 * `href` tenant-web/portal farkını kapsar. `extra` sağ üstte ek badge (örn. tenant slug).
 */
export function IlanKarti({
  ilan,
  href,
  extra,
}: {
  ilan: IlanKartiData;
  href: string;
  extra?: React.ReactNode;
}) {
  const tip = TIP_ICON[ilan.ihale_tipi] ?? { icon: FileText, label: ilan.ihale_tipi };
  const TipIcon = tip.icon;
  const bitis = ilan.bitis_tarihi ? new Date(ilan.bitis_tarihi) : null;
  const bitisGecmis = bitis ? bitis.getTime() < Date.now() : false;

  return (
    <Link href={href} className="block">
      <Card interactive className="h-full">
        <CardContent className="space-y-3 p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1.5 rounded-md accent-soft-bg px-2 py-1 text-xs font-medium text-gray-700">
                <TipIcon className="h-3.5 w-3.5" style={{ color: 'var(--renk)' }} />
                {tip.label}
              </span>
              {ilan.islem_turu && (
                <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                  {ISLEM_TURU_ETIKET[ilan.islem_turu] ?? ilan.islem_turu}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {extra}
              <DurumBadge durum={ilan.durum} />
            </div>
          </div>

          <h3 className="line-clamp-2 font-semibold leading-snug text-gray-900">
            {ilan.baslik}
          </h3>

          <div>
            <p className="text-xl font-bold tracking-tight text-gray-900">{fmt(ilan.baslangic_fiyati)} ₺</p>
            <p className="text-xs text-gray-400">Başlangıç fiyatı</p>
          </div>
        </CardContent>

        {bitis && (
          <CardFooter className="p-5 py-3">
            <span
              className={`inline-flex items-center gap-1.5 text-xs ${
                bitisGecmis ? 'text-gray-400' : 'text-gray-500'
              }`}
            >
              <CalendarClock className="h-3.5 w-3.5" />
              {bitisGecmis ? 'Sona erdi: ' : 'Bitiş: '}
              {bitis.toLocaleDateString('tr-TR')}
            </span>
          </CardFooter>
        )}
      </Card>
    </Link>
  );
}

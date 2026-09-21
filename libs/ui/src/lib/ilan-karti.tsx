import Link from 'next/link';
import { Boxes, CalendarClock, FileText, Gavel, Lock, MapPin } from 'lucide-react';
import { Card, CardContent, CardFooter } from './card';
import { Badge, DurumBadge } from './badge';
import { dummyGorseller } from './gorseller';

/** İlan kartı tarafından kullanılan ortak alan seti. */
export interface IlanKartiData {
  id: string;
  baslik: string;
  ihale_tipi: string;
  durum: string;
  /** Tek-varlık dönemden kalma (KK-25 öncesi) — çoklu varlıklı ilanlarda null, bkz. `fiyat_min`/`fiyat_max`. */
  baslangic_fiyati: string | number | null;
  /** Çoklu-varlık ilanlarda kalemlerin en düşük/en yüksek fiyatı (KK-25). */
  fiyat_min?: string | number | null;
  fiyat_max?: string | number | null;
  /** İlan (yayın) tarihi. */
  baslangic_tarihi?: string | null;
  /** İhale tarihi. */
  bitis_tarihi?: string | null;
  islem_turu?: string | null;
  il?: string | null;
  ilce?: string | null;
  /** Kapak görseli URL'i — verilmezse ilan id'sinden tutarlı bir placeholder üretilir. */
  kapak_gorsel_url?: string | null;
  /** İlanın içerdiği varlık (kalem) sayısı — YAYINDA durumunda badge yerine gösterilir. */
  kalem_sayisi?: string | number | null;
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
  const ilanTarihi = ilan.baslangic_tarihi ? new Date(ilan.baslangic_tarihi) : null;
  const ihaleTarihi = ilan.bitis_tarihi ? new Date(ilan.bitis_tarihi) : null;
  const ihaleGecmis = ihaleTarihi ? ihaleTarihi.getTime() < Date.now() : false;
  const konum = [ilan.ilce, ilan.il].filter(Boolean).join(', ');

  // Tek-varlık ilanlarda tek fiyat; çoklu-varlık ilanlarda kalemlerin aralığı (KK-25).
  const fiyatMin = ilan.fiyat_min != null ? Number(ilan.fiyat_min) : null;
  const fiyatMax = ilan.fiyat_max != null ? Number(ilan.fiyat_max) : null;
  const aralikli = ilan.baslangic_fiyati == null && fiyatMin != null && fiyatMax != null && fiyatMin !== fiyatMax;
  const fiyatEtiketi = aralikli ? 'Başlangıç fiyat aralığı' : 'Başlangıç fiyatı';
  const fiyatGosterim =
    ilan.baslangic_fiyati != null
      ? `${fmt(ilan.baslangic_fiyati)} ₺`
      : fiyatMin != null && fiyatMax != null
        ? aralikli
          ? `${fmt(fiyatMin)} - ${fmt(fiyatMax)} ₺`
          : `${fmt(fiyatMin)} ₺`
        : null;

  const kapak = ilan.kapak_gorsel_url ?? dummyGorseller(ilan.id, 1)[0];
  const kalemSayisi = ilan.kalem_sayisi != null ? Number(ilan.kalem_sayisi) : null;

  return (
    <Link href={href} className="block">
      <Card interactive className="group h-full overflow-hidden">
        <div className="aspect-[16/10] w-full overflow-hidden bg-gray-100">
          {/* eslint-disable-next-line @next/next/no-img-element -- harici/proxy görsel, tenant başına değişken host */}
          <img
            src={kapak}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>
        <CardContent className="space-y-3 p-5">
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            <Badge variant="accent" icon={<TipIcon style={{ color: 'var(--renk)' }} />}>
              {tip.label}
            </Badge>
            {ilan.islem_turu && (
              <Badge variant="default">{ISLEM_TURU_ETIKET[ilan.islem_turu] ?? ilan.islem_turu}</Badge>
            )}
            {extra}
            {ilan.durum === 'YAYINDA' && kalemSayisi != null ? (
              <Badge variant="default" icon={<Boxes className="h-3 w-3" />}>
                {kalemSayisi} Varlık
              </Badge>
            ) : (
              <DurumBadge durum={ilan.durum} />
            )}
          </div>

          <div>
            <h3 className="line-clamp-2 font-semibold leading-snug text-gray-900">
              {ilan.baslik}
            </h3>
            {konum && (
              <p className="mt-1 flex items-center gap-1 text-xs text-gray-400">
                <MapPin className="h-3.5 w-3.5" />
                {konum}
              </p>
            )}
          </div>

          {fiyatGosterim && (
            <div>
              <p className="text-xl font-bold tracking-tight text-gray-900">{fiyatGosterim}</p>
              <p className="text-xs text-gray-400">{fiyatEtiketi}</p>
            </div>
          )}
        </CardContent>

        {(ilanTarihi || ihaleTarihi) && (
          <CardFooter className="flex flex-wrap gap-x-4 gap-y-1 p-5 py-3">
            {ilanTarihi && (
              <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                <CalendarClock className="h-3.5 w-3.5" />
                İlan: {ilanTarihi.toLocaleDateString('tr-TR')}
              </span>
            )}
            {ihaleTarihi && (
              <span
                className={`inline-flex items-center gap-1.5 text-xs ${
                  ihaleGecmis ? 'text-gray-400' : 'text-gray-500'
                }`}
              >
                <Gavel className="h-3.5 w-3.5" />
                {ihaleGecmis ? 'İhale (sona erdi): ' : 'İhale: '}
                {ihaleTarihi.toLocaleDateString('tr-TR')}
              </span>
            )}
          </CardFooter>
        )}
      </Card>
    </Link>
  );
}

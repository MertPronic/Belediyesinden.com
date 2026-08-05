import { headers } from 'next/headers';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowRight,
  CalendarClock,
  CalendarDays,
  ChevronRight,
  Download,
  Eye,
  FileText,
  Gavel,
  Hash,
  Home,
  Info,
  Layers,
  Lock,
  MapPin,
  Minus,
  Share2,
  ShieldCheck,
  Tag,
  TrendingUp,
} from 'lucide-react';
import { isPersonelViewer, serverApiFetch } from '../../../lib/api';
import { FavoriButton } from '../../../components/favori-button';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DurumBadge,
  EmptyState,
  FotoGaleri,
  dummyGorseller,
  Tabs,
} from '@belediyesinden/ui';

interface Ilan {
  id: string;
  baslik: string;
  aciklama: string | null;
  ihale_tipi: string;
  islem_turu: string | null;
  durum: string;
  baslangic_fiyati: string;
  baslangic_tarihi: string | null;
  bitis_tarihi: string | null;
  kurallar: { minArtirmaAdimi?: number } | null;
  lat: number | null;
  lng: number | null;
  il: string | null;
  ilce: string | null;
  mahalle: string | null;
  katilim_sartlari: string[] | null;
}
interface Evrak {
  id: string;
  dosya_adi: string;
  content_type: string | null;
  boyut: number | null;
}

const PUBLIC_DURUMLAR = ['YAYINDA', 'CANLI_ARTIRMA', 'SONUCLANDI'];
const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3000/api';

const TIP: Record<string, { label: string; icon: typeof Gavel }> = {
  ACAIK_ARTIRMA: { label: 'Açık Artırma', icon: Gavel },
  ACIK_ARTIRMA: { label: 'Açık Artırma', icon: Gavel },
  ACIK_TEKLIF: { label: 'Açık Teklif', icon: FileText },
  KAPALI_TEKLIF: { label: 'Kapalı Teklif', icon: Lock },
};

const ISLEM_TURU_LABEL: Record<string, string> = {
  SATIS: 'Satış',
  KIRALAMA: 'Kiralama',
  ISLETME_HAKKI_DEVRI: 'İşletme Hakkı Devri',
};

const KATILIM_SARTI_LABEL: Record<string, string> = {
  VERGI_BORCU_OLMAMA: 'Vergi borcu olmama',
  SGK_BORCU_OLMAMA: 'SGK borcu olmama',
  GECICI_TEMINAT_YATIRMA: 'Geçici teminat yatırma',
  IHALEYE_KATILIM_YASAGI_OLMAMA: 'İhaleye katılım yasağı bulunmama',
  TICARET_SICIL_KAYDI: 'Ticaret sicil kaydı',
  IMZA_SIRKULERI_VEKALETNAME: 'İmza sirküleri / vekaletname',
};

async function getTenantSlug(): Promise<string> {
  const h = await headers();
  const xSlug = h.get('x-tenant-slug');
  if (xSlug) return xSlug;
  const host = h.get('host') ?? '';
  const first = host.split(':')[0].split('.')[0]?.toLowerCase();
  return first && !['localhost', 'www', 'belediyesinden'].includes(first) ? first : '';
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof Hash; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-gray-100 py-3 last:border-0">
      <span className="flex items-center gap-2 text-sm text-gray-500">
        <Icon className="h-4 w-4 text-gray-400" />
        {label}
      </span>
      <span className="text-right text-sm font-medium text-gray-900">{value}</span>
    </div>
  );
}

/** Dinamik SEO metadata (title/description/OG) — ilan verisinden. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const slug = await getTenantSlug();
  if (!slug) return {};
  try {
    const ilan = await serverApiFetch<Ilan>(`/ilan/${id}`, slug);
    if (!ilan) return {};
    const desc = ilan.aciklama ?? `${ilan.baslik} — belediye ihale ilanı`;
    return {
      title: ilan.baslik,
      description: desc,
      openGraph: { title: ilan.baslik, description: desc, type: 'website' },
    };
  } catch {
    return {};
  }
}

export default async function IlanDetayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const slug = await getTenantSlug();
  if (!slug) notFound();

  let ilan: Ilan | null = null;
  let evraklar: Evrak[] = [];
  try {
    ilan = await serverApiFetch<Ilan>(`/ilan/${id}`, slug);
  } catch {
    notFound();
  }
  if (!ilan || !PUBLIC_DURUMLAR.includes(ilan.durum)) notFound();
  const personelOnizleme = await isPersonelViewer(slug);
  try {
    evraklar = await serverApiFetch<Evrak[]>(`/evrak/ilan/${id}`, slug);
  } catch {
    evraklar = [];
  }

  const tip = TIP[ilan.ihale_tipi] ?? { label: ilan.ihale_tipi, icon: FileText };
  const TipIcon = tip.icon;
  const islemTuruLabel = ilan.islem_turu ? (ISLEM_TURU_LABEL[ilan.islem_turu] ?? ilan.islem_turu) : null;
  const canBid = ilan.durum === 'CANLI_ARTIRMA';
  const baslangic = ilan.baslangic_tarihi ? new Date(ilan.baslangic_tarihi) : null;
  const bitis = ilan.bitis_tarihi ? new Date(ilan.bitis_tarihi) : null;
  const minAdim = Number(ilan.kurallar?.minArtirmaAdimi ?? 0) || 0;
  const fiyat = Number(ilan.baslangic_fiyati);
  const katilimSartlari = ilan.katilim_sartlari ?? [];

  // Gerçek ilan görselleri (MinIO proxy); yoksa dummy placeholder.
  let gorseller: string[] = dummyGorseller(id, 15);
  try {
    const gorselRows = await serverApiFetch<{ id: string }[]>(`/ilan/${id}/gorsel`, slug);
    if (gorselRows.length > 0) {
      gorseller = gorselRows.map((g) => `${API_URL}/ilan/gorsel/${g.id}?tenant=${slug}`);
    }
  } catch {
    /* dummy fallback */
  }

  // Konum: yalnızca gerçekten girilmiş veri gösterilir — sahte varsayılan yok.
  const konumMetni = [ilan.il, ilan.ilce, ilan.mahalle].filter(Boolean).join(', ') || 'Konum belirtilmedi';
  const haritaVar = ilan.lat != null && ilan.lng != null;
  const lat = ilan.lat ?? 0;
  const lng = ilan.lng ?? 0;

  const tabs = [
    {
      value: 'bilgi',
      label: 'İlan Bilgileri',
      content: (
        <Card>
          <CardContent className="grid gap-x-10 sm:grid-cols-2">
            <InfoRow icon={Hash} label="İlan No" value={<span className="font-mono text-xs">{ilan.id.slice(0, 8)}</span>} />
            <InfoRow icon={TipIcon} label="İhale Tipi" value={tip.label} />
            {islemTuruLabel && <InfoRow icon={Tag} label="İşlem Türü" value={islemTuruLabel} />}
            <InfoRow icon={Info} label="Durum" value={<DurumBadge durum={ilan.durum} dot={false} />} />
            <InfoRow icon={TrendingUp} label="Min. Artırma" value={`${minAdim.toLocaleString('tr-TR')} ₺`} />
            {baslangic && (
              <InfoRow icon={CalendarDays} label="Başlangıç" value={baslangic.toLocaleDateString('tr-TR')} />
            )}
            {bitis && (
              <InfoRow icon={CalendarClock} label="Bitiş" value={bitis.toLocaleDateString('tr-TR')} />
            )}
          </CardContent>
        </Card>
      ),
    },
    {
      value: 'aciklama',
      label: 'Açıklama',
      content: (
        <Card>
          <CardContent>
            {ilan.aciklama ? (
              <p className="whitespace-pre-wrap leading-relaxed text-gray-700">{ilan.aciklama}</p>
            ) : (
              <p className="text-sm text-gray-400">Bu ilan için açıklama girilmemiş.</p>
            )}
          </CardContent>
        </Card>
      ),
    },
    {
      value: 'evrak',
      label: `Şartname (${evraklar.length})`,
      content:
        evraklar.length > 0 ? (
          <Card>
            <CardContent className="divide-y divide-gray-100 p-0">
              {evraklar.map((ev) => {
                const boyut = ev.boyut ? `${(ev.boyut / 1024).toFixed(0)} KB` : null;
                return (
                  <div key={ev.id} className="flex items-center justify-between gap-3 px-6 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100">
                        <FileText className="h-4 w-4 text-gray-500" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-900">{ev.dosya_adi}</p>
                        {boyut && <p className="text-xs text-gray-400">{boyut}</p>}
                      </div>
                    </div>
                    <a
                      href={`${API_URL}/evrak/${ev.id}?tenant=${slug}`}
                      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
                    >
                      <Download className="h-3.5 w-3.5" />
                      İndir
                    </a>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <EmptyState icon={<FileText />} title="Şartname yok" description="Bu ilana ait evrak bulunmuyor." />
          </Card>
        ),
    },
    {
      value: 'konum',
      label: 'Konum',
      content: (
        <Card>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <span className="flex items-center gap-1 text-gray-400"><MapPin className="h-4 w-4" /> Konum:</span>
              <span className="font-medium text-gray-900">{konumMetni}</span>
            </div>
            {haritaVar ? (
              <>
                {/* OpenStreetMap embed */}
                <div className="overflow-hidden rounded-lg border border-gray-200">
                  <iframe
                    title="İlan konumu"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.01}%2C${lat - 0.01}%2C${lng + 0.01}%2C${lat + 0.01}&layer=mapnik&marker=${lat}%2C${lng}`}
                    className="h-72 w-full"
                    loading="lazy"
                  />
                </div>
                <a
                  href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=15/${lat}/${lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
                  style={{ color: 'var(--renk)' }}
                >
                  <MapPin className="h-4 w-4" />
                  Haritada aç (OpenStreetMap)
                </a>
              </>
            ) : (
              <p className="text-sm text-gray-400">Bu ilan için harita konumu girilmemiş.</p>
            )}
          </CardContent>
        </Card>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* JSON-LD: Product/Offer (SEO structured data) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: ilan.baslik,
            description: ilan.aciklama ?? ilan.baslik,
            offers: {
              '@type': 'Offer',
              price: fiyat,
              priceCurrency: 'TRY',
              availability:
                ilan.durum === 'YAYINDA' || ilan.durum === 'CANLI_ARTIRMA'
                  ? 'https://schema.org/InStock'
                  : 'https://schema.org/OutOfStock',
            },
          }),
        }}
      />

      {/* Breadcrumb */}
      <nav className="flex flex-wrap items-center gap-1 text-sm text-gray-400">
        <Link href="/" className="inline-flex items-center gap-1 hover:text-gray-700">
          <Home className="h-3.5 w-3.5" />
          Ana Sayfa
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href="/ilanlar" className="hover:text-gray-700">İlanlar</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="truncate text-gray-600">{ilan.baslik}</span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Sol */}
        <div className="min-w-0 space-y-5">
          {/* Foto galeri */}
          <FotoGaleri images={gorseller} alt={ilan.baslik} />

          {/* Başlık bloğu */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="info" icon={<TipIcon className="h-3 w-3" />}>{tip.label}</Badge>
              {islemTuruLabel && (
                <Badge variant="default" icon={<Tag className="h-3 w-3" />}>{islemTuruLabel}</Badge>
              )}
              <DurumBadge durum={ilan.durum} />
              <span className="flex items-center gap-1 text-sm text-gray-500">
                <ShieldCheck className="h-3.5 w-3.5" style={{ color: 'var(--renk)' }} />
                Resmî İlan
              </span>
            </div>
            <h1 className="text-2xl font-bold leading-tight tracking-tight text-gray-900 sm:text-3xl">{ilan.baslik}</h1>
            <p className="flex items-center gap-1 text-sm text-gray-500">
              <MapPin className="h-4 w-4 text-gray-400" />
              {konumMetni}
            </p>
          </div>

          {/* Tabs */}
          <Tabs items={tabs} />
        </div>

        {/* Sağ sticky panel */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card variant="elevated" className="overflow-hidden">
            <div className="accent-soft-bg px-5 py-4">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Başlangıç Fiyatı</p>
              <p className="mt-0.5 text-3xl font-bold tracking-tight text-gray-900">
                {fiyat.toLocaleString('tr-TR')} <span className="text-xl">₺</span>
              </p>
            </div>
            <CardContent className="space-y-4 p-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-gray-500">
                    <Minus className="h-3.5 w-3.5" /> Min. artırma adımı
                  </span>
                  <span className="font-medium text-gray-900">{minAdim.toLocaleString('tr-TR')} ₺</span>
                </div>
                {bitis && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-gray-500">
                      <CalendarClock className="h-3.5 w-3.5" /> İhale bitişi
                    </span>
                    <span className="font-medium text-gray-900">{bitis.toLocaleDateString('tr-TR')}</span>
                  </div>
                )}
              </div>

              {personelOnizleme ? (
                <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4">
                  <p className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                    <Eye className="h-4 w-4" />
                    Personel önizleme modu
                  </p>
                  <p className="mt-1.5 text-xs text-gray-500">
                    {baslangic && baslangic.getTime() > Date.now()
                      ? `Bu ilan ${baslangic.toLocaleDateString('tr-TR')} tarihinde yayınlanacak.`
                      : 'Belediye personeli olarak vatandaş görünümünü inceliyorsunuz.'}
                  </p>
                  <Link
                    href={`/admin/ilanlar/${ilan.id}`}
                    className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
                    style={{ color: 'var(--renk)' }}
                  >
                    İlanı yönet
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              ) : canBid ? (
                <Alert variant="info" icon={<Gavel />}>
                  Bu ihale şu anda canlı. Katılım hakkınız varsa{' '}
                  <Link href="/ihalelerim" className="font-semibold underline">
                    İhalelerim
                  </Link>{' '}
                  sayfasından teklif verebilirsiniz.
                </Alert>
              ) : ilan.durum === 'YAYINDA' ? (
                <Alert variant="info" icon={<Info />}>
                  {bitis
                    ? `Bu ihale ${bitis.toLocaleDateString('tr-TR')} tarihinde başlayacak.`
                    : 'Bu ihale henüz başlamadı.'}
                </Alert>
              ) : (
                <Alert variant="info" icon={<Info />}>
                  Bu ihale sonuçlandırılmıştır.
                </Alert>
              )}

              {!personelOnizleme && (
                <div className="flex gap-2">
                  <FavoriButton ilanId={id} />
                  <Button variant="outline" className="flex-1" leftIcon={<Share2 />}>Paylaş</Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Layers className="h-4 w-4 text-gray-400" />
                Katılım Koşulları
              </CardTitle>
            </CardHeader>
            <CardContent>
              {katilimSartlari.length > 0 ? (
                <ul className="space-y-2.5 text-sm text-gray-600">
                  {katilimSartlari.map((s) => (
                    <li key={s} className="flex gap-2">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gray-400" />
                      {KATILIM_SARTI_LABEL[s] ?? s}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-400">Bu ilan için özel bir katılım şartı belirtilmemiş.</p>
              )}
              <p className="mt-3 text-xs text-gray-400">
                Başvuru için giriş yapmanız ve teminatınızı yatırmanız gerekir.
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

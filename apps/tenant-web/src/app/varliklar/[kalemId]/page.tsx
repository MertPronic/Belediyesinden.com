import { headers } from 'next/headers';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowRight,
  CalendarClock,
  ChevronRight,
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
} from 'lucide-react';
import { varlikDetayAlanlari, type VarlikDetayAlanTanimi } from '@belediyesinden/varlik-core';
import { VarlikTipi } from '@belediyesinden/shared';
import { isPersonelViewer, serverApiFetch } from '../../../lib/api';
import { BasvuruDurumu } from '../../../components/basvuru-durumu';
import {
  Alert,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DurumBadge,
  FotoGaleri,
  dummyGorseller,
  Tabs,
} from '@belediyesinden/ui';

// Tenant her istekte header/host'tan çözülür — statik önbelleğe alınırsa container
// her başladığında ilk isteğin tenant verisi tüm ziyaretçilere donmuş kalır.
export const dynamic = 'force-dynamic';

/** Kalem (varlık) + üst ilan bağlamı — `IlanKalemiDetay` (backend) ile birebir. */
interface KalemDetay {
  id: string;
  ilan_id: string;
  varlik_id: string;
  baslangic_fiyati: string;
  bitis_tarihi: string | null;
  durum: string;
  kazanan_kullanici_id: string | null;
  kazanan_tutar: string | null;
  varlik_ad: string;
  varlik_tip: string;
  varlik_aciklama: string | null;
  varlik_detay: Record<string, unknown>;
  ilan_baslik: string;
  ihale_tipi: string;
  katilim_sartlari: string[];
  sartname_ucretli: boolean;
  sartname_tutari: string | null;
  kurallar: { minArtirmaAdimi?: number } | null;
}

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3000/api';

const TIP: Record<string, { label: string; icon: typeof Gavel }> = {
  ACAIK_ARTIRMA: { label: 'Açık Artırma', icon: Gavel },
  ACIK_ARTIRMA: { label: 'Açık Artırma', icon: Gavel },
  ACIK_TEKLIF: { label: 'Açık Teklif', icon: FileText },
  KAPALI_TEKLIF: { label: 'Kapalı Teklif', icon: Lock },
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

/** Select alanlarda kod yerine okunabilir etiket gösterir (örn. "ARSA_ARAZI" → "Arsa / Arazi"). */
function alanGorunumDegeri(alan: VarlikDetayAlanTanimi, ham: unknown): string | null {
  if (ham == null || ham === '') return null;
  if (alan.tip === 'select') {
    return alan.secenekler?.find((s) => s.deger === ham)?.etiket ?? String(ham);
  }
  if (alan.tip === 'number') {
    return Number(ham).toLocaleString('tr-TR');
  }
  return String(ham);
}

/** Dinamik SEO metadata — varlık + üst ilan verisinden. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ kalemId: string }>;
}): Promise<Metadata> {
  const { kalemId } = await params;
  const slug = await getTenantSlug();
  if (!slug) return {};
  try {
    const kalem = await serverApiFetch<KalemDetay>(`/ilan/kalem/${kalemId}`, slug);
    if (!kalem) return {};
    const desc = kalem.varlik_aciklama ?? `${kalem.varlik_ad} — ${kalem.ilan_baslik}`;
    return {
      title: `${kalem.varlik_ad} — ${kalem.ilan_baslik}`,
      description: desc,
      openGraph: { title: kalem.varlik_ad, description: desc, type: 'website' },
    };
  } catch {
    return {};
  }
}

export default async function VarlikDetayPage({ params }: { params: Promise<{ kalemId: string }> }) {
  const { kalemId } = await params;
  const slug = await getTenantSlug();
  if (!slug) notFound();

  let kalem: KalemDetay | null = null;
  try {
    kalem = await serverApiFetch<KalemDetay>(`/ilan/kalem/${kalemId}`, slug);
  } catch {
    notFound();
  }
  if (!kalem) notFound();
  const personelOnizleme = await isPersonelViewer(slug);

  const tip = TIP[kalem.ihale_tipi] ?? { label: kalem.ihale_tipi, icon: FileText };
  const TipIcon = tip.icon;
  const canBid = kalem.durum === 'CANLI_ARTIRMA';
  const bitis = kalem.bitis_tarihi ? new Date(kalem.bitis_tarihi) : null;
  const minAdim = Number(kalem.kurallar?.minArtirmaAdimi ?? 0) || 0;
  const fiyat = Number(kalem.baslangic_fiyati);
  const katilimSartlari = kalem.katilim_sartlari ?? [];

  const alanTanimlari = varlikDetayAlanlari(
    kalem.varlik_tip as VarlikTipi,
    kalem.varlik_detay?.['cinsi'] as string | undefined,
  );
  const konumMetni =
    [kalem.varlik_detay?.['ilce'], kalem.varlik_detay?.['il']].filter(Boolean).join(', ') || 'Konum belirtilmedi';

  // Gerçek varlık görselleri (MinIO proxy); yoksa dummy placeholder.
  let gorseller: string[] = dummyGorseller(kalemId, 15);
  try {
    const gorselRows = await serverApiFetch<{ id: string }[]>(`/varlik/${kalem.varlik_id}/gorsel`, slug);
    if (gorselRows.length > 0) {
      gorseller = gorselRows.map((g) => `${API_URL}/varlik/gorsel/${g.id}?tenant=${slug}`);
    }
  } catch {
    /* dummy fallback */
  }

  const tabs = [
    {
      value: 'bilgi',
      label: 'Bilgiler',
      content: (
        <Card>
          <CardContent className="grid gap-x-10 sm:grid-cols-2">
            <InfoRow icon={Hash} label="Varlık No" value={<span className="font-mono text-xs">{kalem.id.slice(0, 8)}</span>} />
            {alanTanimlari.map((alan) => {
              const deger = alanGorunumDegeri(alan, kalem!.varlik_detay?.[alan.key]);
              if (!deger) return null;
              return <InfoRow key={alan.key} icon={MapPin} label={alan.etiket} value={deger} />;
            })}
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
            {kalem.varlik_aciklama ? (
              <p className="whitespace-pre-wrap leading-relaxed text-gray-700">{kalem.varlik_aciklama}</p>
            ) : (
              <p className="text-sm text-gray-400">Bu varlık için açıklama girilmemiş.</p>
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
            name: kalem.varlik_ad,
            description: kalem.varlik_aciklama ?? kalem.varlik_ad,
            offers: {
              '@type': 'Offer',
              price: fiyat,
              priceCurrency: 'TRY',
              availability:
                kalem.durum === 'BEKLIYOR' || kalem.durum === 'CANLI_ARTIRMA'
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
        <Link href={`/ilanlar/${kalem.ilan_id}`} className="hover:text-gray-700">{kalem.ilan_baslik}</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="truncate text-gray-600">{kalem.varlik_ad}</span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Sol */}
        <div className="min-w-0 space-y-5">
          {/* Foto galeri */}
          <FotoGaleri images={gorseller} alt={kalem.varlik_ad} />

          {/* Başlık bloğu */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="info" icon={<TipIcon className="h-3 w-3" />}>{tip.label}</Badge>
              <DurumBadge durum={kalem.durum} />
              <span className="flex items-center gap-1 text-sm text-gray-500">
                <ShieldCheck className="h-3.5 w-3.5" style={{ color: 'var(--renk)' }} />
                Resmî İlan
              </span>
            </div>
            <h1 className="text-2xl font-bold leading-tight tracking-tight text-gray-900 sm:text-3xl">{kalem.varlik_ad}</h1>
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
                    <Info className="h-4 w-4" />
                    Personel önizleme modu
                  </p>
                  <p className="mt-1.5 text-xs text-gray-500">Belediye personeli olarak vatandaş görünümünü inceliyorsunuz.</p>
                  <Link
                    href={`/admin/ilanlar/${kalem.ilan_id}`}
                    className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
                    style={{ color: 'var(--renk)' }}
                  >
                    İlanı yönet
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              ) : canBid ? (
                <>
                  <Alert variant="info" icon={<Gavel />}>
                    Bu varlığın ihalesi şu anda canlı.
                  </Alert>
                  <Link
                    href={`/teklif/${kalem.id}`}
                    className="flex h-12 items-center justify-center gap-2 rounded-lg text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
                    style={{ background: 'var(--renk)' }}
                  >
                    <Gavel className="h-4 w-4" />
                    Teklif Ver
                  </Link>
                </>
              ) : kalem.durum === 'BEKLIYOR' ? (
                <>
                  <Alert variant="info" icon={<Info />}>
                    Bu varlığın ihalesi henüz başlamadı.
                  </Alert>
                  <BasvuruDurumu kalemId={kalem.id} />
                </>
              ) : (
                <Alert variant="info" icon={<Info />}>
                  Bu varlığın ihalesi sonuçlandırılmıştır.
                </Alert>
              )}

              <Link
                href={`/ilanlar/${kalem.ilan_id}`}
                className="flex h-10 items-center justify-center gap-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                İlana geri dön
              </Link>

              {!personelOnizleme && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    <Share2 className="h-4 w-4" />
                    Paylaş
                  </button>
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
              {kalem.sartname_ucretli && (
                <p className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                  <Tag className="h-3.5 w-3.5" />
                  Şartname bedeli: {Number(kalem.sartname_tutari ?? 0).toLocaleString('tr-TR')} ₺
                </p>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

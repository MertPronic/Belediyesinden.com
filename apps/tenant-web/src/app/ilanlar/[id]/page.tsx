import { headers } from 'next/headers';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowRight,
  Boxes,
  Building2,
  CalendarClock,
  CalendarDays,
  ChevronRight,
  Download,
  Eye,
  FileText,
  Gavel,
  Handshake,
  Hash,
  Home,
  Info,
  Layers,
  Lock,
  MapPin,
  Megaphone,
  Minus,
  Package,
  Share2,
  ShieldCheck,
  Tag,
  TrendingUp,
} from 'lucide-react';
import { isPersonelViewer, serverApiFetch } from '../../../lib/api';
import { FavoriButton } from '../../../components/favori-button';
import { SonGezilenKaydet } from '../../../components/son-gezilen-kaydet';
import { SonGezilenlerSeridi } from '../../../components/son-gezilenler-seridi';
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
  type IlanKartiData,
  dummyGorseller,
  Tabs,
} from '@belediyesinden/ui';

// Tenant her istekte header/host'tan çözülür — statik önbelleğe alınırsa container
// her başladığında ilk isteğin tenant verisi tüm ziyaretçilere donmuş kalır.
export const dynamic = 'force-dynamic';

interface Ilan {
  id: string;
  baslik: string;
  aciklama: string | null;
  ihale_tipi: string;
  islem_turu: string | null;
  durum: string;
  /** Tek-varlık dönemden kalma (KK-25 öncesi) — çoklu kalemli ilanlarda null, fiyat kalem bazlı. */
  baslangic_fiyati: string | null;
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

/** İlana eklenmiş bir varlık (kalem) — bkz. DECISIONS.md KK-25. */
interface Kalem {
  id: string;
  varlik_id: string;
  baslangic_fiyati: string;
  durum: string;
  varlik_ad: string;
  varlik_tip: string;
  varlik_detay: { il?: string; ilce?: string };
}

const VARLIK_TIP_BILGI: Record<string, { label: string; icon: typeof Package; renk: string; bg: string }> = {
  TASINIR: { label: 'Taşınır', icon: Package, renk: 'text-blue-600', bg: 'bg-blue-50' },
  TASINMAZ: { label: 'Taşınmaz', icon: Building2, renk: 'text-emerald-600', bg: 'bg-emerald-50' },
  ISLETME_HAKKI: { label: 'İşletme Hakkı', icon: Handshake, renk: 'text-amber-600', bg: 'bg-amber-50' },
  REKLAM_ALANI: { label: 'Reklam Alanı', icon: Megaphone, renk: 'text-purple-600', bg: 'bg-purple-50' },
};

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
  let kalemler: Kalem[] = [];
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
  try {
    kalemler = await serverApiFetch<Kalem[]>(`/ilan/${id}/kalem`, slug);
  } catch {
    kalemler = [];
  }

  const tip = TIP[ilan.ihale_tipi] ?? { label: ilan.ihale_tipi, icon: FileText };
  const TipIcon = tip.icon;
  const islemTuruLabel = ilan.islem_turu ? (ISLEM_TURU_LABEL[ilan.islem_turu] ?? ilan.islem_turu) : null;
  const baslangic = ilan.baslangic_tarihi ? new Date(ilan.baslangic_tarihi) : null;
  const bitis = ilan.bitis_tarihi ? new Date(ilan.bitis_tarihi) : null;
  const minAdim = Number(ilan.kurallar?.minArtirmaAdimi ?? 0) || 0;
  const kalemFiyatlari = kalemler.map((k) => Number(k.baslangic_fiyati));
  // Tek-varlık dönemden kalma ilanlarda tek fiyat vardır; çoklu-varlık ilanlarda
  // "X ₺'den başlayan" temsili değer olarak en düşük kalem fiyatı kullanılır (KK-25).
  const fiyat =
    ilan.baslangic_fiyati != null ? Number(ilan.baslangic_fiyati) : (kalemFiyatlari.length ? Math.min(...kalemFiyatlari) : 0);
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

  // Her kalemin kendi varlık fotoğrafı var (ilan galerisinden bağımsız, KK-25) — yoksa
  // varlık id'sinden tutarlı bir placeholder üretilir (dummyGorseller ile aynı desen).
  const kalemKapakUrl = new Map<string, string>();
  await Promise.all(
    kalemler.map(async (k) => {
      try {
        const rows = await serverApiFetch<{ id: string }[]>(`/varlik/${k.varlik_id}/gorsel`, slug);
        if (rows.length > 0) {
          kalemKapakUrl.set(k.id, `${API_URL}/varlik/gorsel/${rows[0].id}?tenant=${slug}`);
        }
      } catch {
        /* dummy fallback */
      }
    }),
  );

  // "Son Gezdiklerin" için ilan kartı verisi — localStorage'a bu haliyle kaydedilir.
  const ilanKartVerisi: IlanKartiData = {
    id: ilan.id,
    baslik: ilan.baslik,
    ihale_tipi: ilan.ihale_tipi,
    durum: ilan.durum,
    baslangic_fiyati: ilan.baslangic_fiyati,
    fiyat_min: kalemFiyatlari.length ? Math.min(...kalemFiyatlari) : null,
    fiyat_max: kalemFiyatlari.length ? Math.max(...kalemFiyatlari) : null,
    baslangic_tarihi: ilan.baslangic_tarihi,
    bitis_tarihi: ilan.bitis_tarihi,
    islem_turu: ilan.islem_turu,
    il: ilan.il,
    ilce: ilan.ilce,
    kapak_gorsel_url: gorseller[0] ?? null,
    kalem_sayisi: kalemler.length || null,
  };

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
      <SonGezilenKaydet tenantSlug={slug} ilan={ilanKartVerisi} />

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

          {/* Varlıklar — bir ilan birden fazla varlık içerebilir (KK-25) */}
          {kalemler.length > 0 && (
            <div className="space-y-3">
              <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
                <Boxes className="h-4 w-4 text-gray-400" />
                Bu İlandaki Varlıklar ({kalemler.length})
              </h2>
              <p className="text-xs text-gray-400">
                Katılmak (başvuru/teminat/teklif) için aşağıdaki varlıklardan birine tıklayın —
                her varlığın kendi ihalesi vardır.
              </p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {kalemler.map((k) => {
                  const kalemKonum = [k.varlik_detay?.ilce, k.varlik_detay?.il].filter(Boolean).join(', ');
                  const tipBilgi = VARLIK_TIP_BILGI[k.varlik_tip] ?? {
                    label: k.varlik_tip,
                    icon: Package,
                    renk: 'text-gray-500',
                    bg: 'bg-gray-100',
                  };
                  const TipIcon = tipBilgi.icon;
                  const kapak = kalemKapakUrl.get(k.id) ?? dummyGorseller(k.id, 1)[0];
                  return (
                    <Link key={k.id} href={`/varliklar/${k.id}`} className="block">
                      <Card interactive className="group h-full overflow-hidden">
                        <div className="relative aspect-[4/3] w-full overflow-hidden bg-gray-100">
                          {/* eslint-disable-next-line @next/next/no-img-element -- harici/proxy görsel, tenant başına değişken host */}
                          <img
                            src={kapak}
                            alt=""
                            loading="lazy"
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                          <span className="absolute right-2 top-2">
                            <DurumBadge durum={k.durum} />
                          </span>
                        </div>
                        <CardContent className="space-y-1.5 p-4">
                          <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${tipBilgi.renk} ${tipBilgi.bg}`}>
                            <TipIcon className="h-3 w-3" />
                            {tipBilgi.label}
                          </span>
                          <p className="truncate font-medium text-gray-900">{k.varlik_ad}</p>
                          {kalemKonum && (
                            <p className="flex items-center gap-1 text-xs text-gray-500">
                              <MapPin className="h-3.5 w-3.5 shrink-0" />
                              {kalemKonum}
                            </p>
                          )}
                          <p className="pt-0.5 text-lg font-bold tracking-tight text-gray-900">
                            {Number(k.baslangic_fiyati).toLocaleString('tr-TR')} ₺
                          </p>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tabs */}
          <Tabs items={tabs} />
        </div>

        {/* Sağ sticky panel */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card variant="elevated" className="overflow-hidden">
            <div className="accent-soft-bg px-5 py-4">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                {ilan.baslangic_fiyati != null ? 'Başlangıç Fiyatı' : `${kalemler.length} Varlık — Başlayan Fiyat`}
              </p>
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
              ) : ilan.durum === 'CANLI_ARTIRMA' ? (
                <Alert variant="info" icon={<Gavel />}>
                  Bu ihale şu anda canlı. Katılmak için "Bu İlandaki Varlıklar" bölümünden birine
                  tıklayın — onaylı başvurunuz varsa doğrudan teklif verebilirsiniz.
                </Alert>
              ) : ilan.durum === 'YAYINDA' ? (
                <Alert variant="info" icon={<Info />}>
                  {bitis
                    ? `Bu ihale ${bitis.toLocaleDateString('tr-TR')} tarihinde başlayacak. Başvurmak için "Bu İlandaki Varlıklar" bölümünden birine tıklayın.`
                    : 'Bu ihale henüz başlamadı. Başvurmak için "Bu İlandaki Varlıklar" bölümünden birine tıklayın.'}
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

      <SonGezilenlerSeridi haricTutulacakId={id} />
    </div>
  );
}

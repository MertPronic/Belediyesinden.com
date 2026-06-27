import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  CalendarClock,
  CalendarDays,
  Download,
  FileText,
  Gavel,
  Info,
  Wallet,
} from 'lucide-react';
import { serverApiFetch } from '../../../lib/api';
import {
  Alert,
  Badge,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  DurumBadge,
} from '@belediyesinden/ui';

interface Ilan {
  id: string;
  baslik: string;
  aciklama: string | null;
  ihale_tipi: string;
  durum: string;
  baslangic_fiyati: string;
  baslangic_tarihi: string | null;
  bitis_tarihi: string | null;
}

interface Evrak {
  id: string;
  dosya_adi: string;
  content_type: string | null;
  boyut: number | null;
}

const PUBLIC_DURUMLAR = ['YAYINDA', 'CANLI_ARTIRMA', 'SONUCLANDI'];
const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3000/api';

const TIP_LABEL: Record<string, string> = {
  ACIK_ARTIRMA: 'Açık Artırma',
  ACIK_TEKLIF: 'Açık Teklif',
  KAPALI_TEKLIF: 'Kapalı Teklif',
};

async function getTenantSlug(): Promise<string> {
  const h = await headers();
  const xSlug = h.get('x-tenant-slug');
  if (xSlug) return xSlug;
  const host = h.get('host') ?? '';
  const first = host.split(':')[0].split('.')[0]?.toLowerCase();
  return first && !['localhost', 'www', 'belediyesinden'].includes(first) ? first : '';
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

  try {
    evraklar = await serverApiFetch<Evrak[]>(`/evrak/ilan/${id}`, slug);
  } catch {
    evraklar = [];
  }

  const canBid = ilan.durum === 'YAYINDA' || ilan.durum === 'CANLI_ARTIRMA';
  const baslangic = ilan.baslangic_tarihi ? new Date(ilan.baslangic_tarihi) : null;
  const bitis = ilan.bitis_tarihi ? new Date(ilan.bitis_tarihi) : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/ilanlar"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        İlanlara dön
      </Link>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <Badge variant="info" icon={<Gavel />}>{TIP_LABEL[ilan.ihale_tipi] ?? ilan.ihale_tipi}</Badge>
              <CardTitle className="text-3xl">{ilan.baslik}</CardTitle>
            </div>
            <DurumBadge durum={ilan.durum} />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {ilan.aciklama && (
            <p className="whitespace-pre-wrap leading-relaxed text-gray-700">{ilan.aciklama}</p>
          )}

          {/* Bilgi ızgarası */}
          <div className="grid gap-3 rounded-xl bg-gray-50 p-4 sm:grid-cols-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white shadow-xs">
                <Wallet className="h-4 w-4 text-gray-500" />
              </span>
              <div>
                <p className="text-lg font-bold leading-tight text-gray-900">
                  {Number(ilan.baslangic_fiyati).toLocaleString('tr-TR')} ₺
                </p>
                <p className="text-xs text-gray-500">Başlangıç</p>
              </div>
            </div>
            {baslangic && (
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white shadow-xs">
                  <CalendarDays className="h-4 w-4 text-gray-500" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{baslangic.toLocaleDateString('tr-TR')}</p>
                  <p className="text-xs text-gray-500">Başlangıç</p>
                </div>
              </div>
            )}
            {bitis && (
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white shadow-xs">
                  <CalendarClock className="h-4 w-4 text-gray-500" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{bitis.toLocaleDateString('tr-TR')}</p>
                  <p className="text-xs text-gray-500">Bitiş</p>
                </div>
              </div>
            )}
          </div>

          {canBid ? (
            <Link
              href={`/teklif/${ilan.id}`}
              className="inline-flex h-12 items-center gap-2 rounded-lg px-6 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
              style={{ background: 'var(--renk)' }}
            >
              <Gavel className="h-4 w-4" />
              Teklif Ver
            </Link>
          ) : (
            <Alert variant="info" icon={<Info />}>
              Bu ihale sonuçlandırılmıştır. Teklif kabul edilmemektedir.
            </Alert>
          )}
        </CardContent>
      </Card>

      {evraklar.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Şartname / Ekler</CardTitle>
            <p className="text-sm text-gray-500">{evraklar.length} dosya</p>
          </CardHeader>
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
                    href={`${API_URL}/evrak/${ev.id}`}
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
      )}
    </div>
  );
}

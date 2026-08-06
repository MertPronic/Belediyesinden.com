import { headers } from 'next/headers';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, FileText, Gavel, ShieldCheck, TrendingUp } from 'lucide-react';
import { serverApiFetch } from '../lib/api';
import { Card, CardContent, EmptyState, IlanKarti, type IlanKartiData } from '@belediyesinden/ui';

// Tenant her istekte header/host'tan çözülür — statik önbelleğe alınırsa container
// her başladığında ilk isteğin tenant verisi tüm ziyaretçilere donmuş kalır.
export const dynamic = 'force-dynamic';

interface Ilan extends IlanKartiData {}

async function getTenantSlug(): Promise<string> {
  const h = await headers();
  const xSlug = h.get('x-tenant-slug');
  if (xSlug) return xSlug;
  const host = h.get('host') ?? '';
  const first = host.split(':')[0].split('.')[0]?.toLowerCase();
  return first && !['localhost', 'www', 'belediyesinden'].includes(first) ? first : '';
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof FileText;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg accent-soft-bg">
          <Icon className="h-5 w-5" style={{ color: 'var(--renk)' }} />
        </span>
        <div>
          <p className="text-xl font-bold leading-tight text-gray-900">{value}</p>
          <p className="text-xs text-gray-500">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default async function HomePage() {
  const slug = await getTenantSlug();
  let ilanlar: Ilan[] = [];

  if (slug) {
    try {
      ilanlar = await serverApiFetch<Ilan[]>('/search/ilan', slug);
    } catch {
      ilanlar = [];
    }
  }

  const yayinda = ilanlar.filter((i) => i.durum === 'YAYINDA' || i.durum === 'CANLI_ARTIRMA');
  const canliArtirma = ilanlar.filter((i) => i.durum === 'CANLI_ARTIRMA').length;
  const sonuclandi = ilanlar.filter((i) => i.durum === 'SONUCLANDI').length;
  const onizleme = yayinda.slice(0, 6);

  return (
    <div className="space-y-10">
      {/* Hero */}
      <section className="hero-accent overflow-hidden rounded-2xl border border-gray-100">
        <div className="px-6 py-12 sm:px-10 sm:py-16">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white/70 px-3 py-1 text-xs font-medium text-gray-600 backdrop-blur">
            <ShieldCheck className="h-3.5 w-3.5" style={{ color: 'var(--renk)' }} />
            Resmî İlan Portalı
          </span>
          <h1 className="mt-4 max-w-2xl text-4xl font-extrabold leading-tight tracking-tight text-gray-900 sm:text-5xl">
            Belediye İlan ve Açık Artırma Portalı
          </h1>
          <p className="mt-3 max-w-xl text-base text-gray-600 sm:text-lg">
            Belediyemizin satış, kiralama ve işletme hakkı devri ilanlarını görüntüleyin;
            elektronik açık artırmalara güvenle katılın.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/ilanlar"
              className="inline-flex h-11 items-center gap-2 rounded-lg px-5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
              style={{ background: 'var(--renk)' }}
            >
              İlanları Görüntüle
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/ilanlar"
              className="inline-flex h-11 items-center rounded-lg border border-gray-300 bg-white px-5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
            >
              Nasıl Katılırım?
            </Link>
          </div>
        </div>
      </section>

      {/* İstatistik şeridi */}
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={FileText} label="Toplam İlan" value={ilanlar.length} />
        <StatCard icon={TrendingUp} label="Yayında" value={yayinda.length} />
        <StatCard icon={Gavel} label="Canlı Artırma" value={canliArtirma} />
        <StatCard icon={CheckCircle2} label="Sonuçlanan" value={sonuclandi} />
      </section>

      {/* Yayındaki ilanlar */}
      <section>
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-gray-900">Yayındaki İlanlar</h2>
            <p className="mt-0.5 text-sm text-gray-500">Güncel ihale ve satış ilanları</p>
          </div>
          <Link
            href="/ilanlar"
            className="inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            Tümü <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {onizleme.length === 0 ? (
          <Card>
            <EmptyState
              icon={<FileText />}
              title="Yayında ilan bulunmuyor"
              description={
                slug
                  ? 'Şu anda aktif ihale ilanı yok. Daha sonra tekrar kontrol edin.'
                  : 'Tenant bulunamadı.'
              }
            />
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {onizleme.map((ilan) => (
              <IlanKarti key={ilan.id} ilan={ilan} href={`/ilanlar/${ilan.id}`} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

import { headers } from 'next/headers';
import Link from 'next/link';
import { serverApiFetch } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle, DurumBadge } from '@belediyesinden/ui';

interface Ilan {
  id: string;
  baslik: string;
  ihale_tipi: string;
  durum: string;
  baslangic_fiyati: string;
  bitis_tarihi: string | null;
}

async function getTenantSlug(): Promise<string> {
  const h = await headers();
  const xSlug = h.get('x-tenant-slug');
  if (xSlug) return xSlug;
  const host = h.get('host') ?? '';
  const first = host.split(':')[0].split('.')[0]?.toLowerCase();
  return first && !['localhost', 'www', 'belediyesinden'].includes(first) ? first : '';
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

  const yayinda = ilanlar.filter((i) => i.durum === 'YAYINDA' || i.durum === 'CANLI_ARTIRMA').slice(0, 6);

  return (
    <div className="space-y-8">
      <section className="rounded-2xl p-8 text-white" style={{ background: 'var(--renk)' }}>
        <h1 className="text-3xl font-bold">Belediye İlan ve Açık Artırma Portalı</h1>
        <p className="mt-2 max-w-2xl text-white/90">
          Belediyemizin satış, kiralama ve işletme hakkı devri ilanlarını görüntüleyin, elektronik
          açık artırmalara katılın.
        </p>
        <Link
          href="/ilanlar"
          className="mt-4 inline-block rounded-lg bg-white px-5 py-2.5 text-sm font-semibold"
          style={{ color: 'var(--renk)' }}
        >
          İlanları Görüntüle →
        </Link>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Yayındaki İlanlar</h2>
          <Link href="/ilanlar" className="text-sm text-gray-600 hover:text-gray-900">
            Tümü →
          </Link>
        </div>

        {yayinda.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              {slug ? 'Şu anda yayında ilan bulunmuyor.' : 'Tenant bulunamadı.'}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {yayinda.map((ilan) => (
              <Link key={ilan.id} href={`/ilanlar/${ilan.id}`}>
                <Card className="h-full transition-shadow hover:shadow-md">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{ilan.baslik}</CardTitle>
                      <DurumBadge durum={ilan.durum} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600">{ilan.ihale_tipi}</p>
                    <p className="mt-2 text-lg font-bold" style={{ color: 'var(--renk)' }}>
                      {Number(ilan.baslangic_fiyati).toLocaleString('tr-TR')} ₺
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

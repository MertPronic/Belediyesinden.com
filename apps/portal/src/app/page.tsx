import Link from 'next/link';
import { portalFetch } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle, Badge } from '@belediyesinden/ui';

interface PortalIlan {
  id: string;
  tenant_slug: string;
  baslik: string;
  ihale_tipi: string;
  baslangic_fiyati: string;
  bitis_tarihi: string | null;
}

const TIP_LABEL: Record<string, string> = {
  ACAIK_ARTIRMA: 'Açık Artırma',
  ACIK_ARTIRMA: 'Açık Artırma',
  ACIK_TEKLIF: 'Açık Teklif',
  KAPALI_TEKLIF: 'Kapalı Teklif',
};

async function fetchTumIlanlar(query?: string, tip?: string): Promise<PortalIlan[]> {
  try {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (tip) params.set('tip', tip);
    const qs = params.toString();
    // tenantSlug yok → 'central' modu (tüm tenant'lar)
    return await portalFetch<PortalIlan[]>(qs ? `/search/ilan?${qs}` : '/search/ilan');
  } catch {
    return [];
  }
}

const TIPLER = [
  { value: '', label: 'Tüm Tipler' },
  { value: 'ACIK_ARTIRMA', label: 'Açık Artırma' },
  { value: 'ACIK_TEKLIF', label: 'Açık Teklif' },
  { value: 'KAPALI_TEKLIF', label: 'Kapalı Teklif' },
];

export default async function PortalHomePage({
  searchParams,
}: {
  searchParams: { q?: string; tip?: string };
}) {
  const ilanlar = await fetchTumIlanlar(searchParams['q'], searchParams['tip']);

  return (
    <div className="space-y-8">
      <section className="rounded-2xl p-8 text-white" style={{ background: 'var(--renk)' }}>
        <h1 className="text-3xl font-bold">Belediye İlanları Tek Çatı Altında</h1>
        <p className="mt-2 max-w-2xl text-white/90">
          Tüm belediyelerin satış, kiralama ve açık artırma ilanlarını arayın, katılın.
        </p>
      </section>

      <form className="flex flex-wrap gap-2">
        <input
          type="text"
          name="q"
          placeholder="İlan ara..."
          defaultValue={searchParams['q'] ?? ''}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <select
          name="tip"
          defaultValue={searchParams['tip'] ?? ''}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          {TIPLER.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-lg px-5 py-2 text-sm text-white"
          style={{ background: 'var(--renk)' }}
        >
          Ara
        </button>
      </form>

      {ilanlar.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            {searchParams['q'] || searchParams['tip']
              ? 'Arama kriterlerine uygun ilan bulunamadı.'
              : 'Henüz yayında ilan yok.'}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ilanlar.map((ilan) => (
            <Link key={`${ilan.tenant_slug}:${ilan.id}`} href={`/${ilan.tenant_slug}/${ilan.id}`}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{ilan.baslik}</CardTitle>
                    <Badge variant="info">{ilan.tenant_slug}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600">{TIP_LABEL[ilan.ihale_tipi] ?? ilan.ihale_tipi}</p>
                  <p className="mt-2 text-lg font-bold" style={{ color: 'var(--renk)' }}>
                    {Number(ilan.baslangic_fiyati).toLocaleString('tr-TR')} ₺
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

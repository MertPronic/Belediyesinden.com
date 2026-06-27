import { headers } from 'next/headers';
import { serverApiFetch } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle, DurumBadge } from '@belediyesinden/ui';

interface Teklif {
  tutar: string;
  kullanici_id: string;
}

interface Ilan {
  id: string;
  baslik: string;
  ihale_tipi: string;
  durum: string;
  baslangic_fiyati: string;
  baslangic_tarihi: string | null;
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

async function fetchIlanlar(slug: string, query?: string, tip?: string): Promise<Ilan[]> {
  if (!slug) return [];
  try {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (tip) params.set('tip', tip);
    const qs = params.toString();
    return await serverApiFetch<Ilan[]>(qs ? `/search/ilan?${qs}` : '/search/ilan', slug);
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

export default async function IlanlarPage({
  searchParams,
}: {
  searchParams: { q?: string; tip?: string };
}) {
  const slug = await getTenantSlug();
  const ilanlar = await fetchIlanlar(slug, searchParams['q'], searchParams['tip']);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">İlanlar</h1>
        <form className="flex flex-wrap gap-2">
          <input
            type="text"
            name="q"
            placeholder="Ara..."
            defaultValue={searchParams['q'] ?? ''}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
          />
          <select
            name="tip"
            defaultValue={searchParams['tip'] ?? ''}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
          >
            {TIPLER.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-lg px-4 py-1.5 text-sm text-white"
            style={{ background: 'var(--renk)' }}
          >
            Ara
          </button>
        </form>
      </div>

      {ilanlar.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            {slug ? 'Yayında ilan bulunamadı.' : 'Tenant bulunamadı. x-tenant-slug header veya subdomain gerekli.'}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {ilanlar.map((ilan) => (
            <a key={ilan.id} href={`/ilanlar/${ilan.id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{ilan.baslik}</CardTitle>
                    <DurumBadge durum={ilan.durum} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-6 text-sm text-gray-600">
                    <span>Tip: <strong>{TIPLER.find((t) => t.value === ilan.ihale_tipi)?.label ?? ilan.ihale_tipi}</strong></span>
                    <span>Başlangıç: <strong>{Number(ilan.baslangic_fiyati).toLocaleString('tr-TR')} ₺</strong></span>
                    {ilan.bitis_tarihi && (
                      <span>Bitiş: <strong>{new Date(ilan.bitis_tarihi).toLocaleDateString('tr-TR')}</strong></span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

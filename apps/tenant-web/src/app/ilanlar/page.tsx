import { headers } from 'next/headers';
import { ilanGorselUrl, serverApiFetch } from '../../lib/api';
import { type IlanKartiData } from '@belediyesinden/ui';
import { SonGezilenlerSeridi } from '../../components/son-gezilenler-seridi';
import { IlanListesi } from './ilan-listesi';

// Tenant her istekte header/host'tan çözülür — statik önbelleğe alınırsa container
// her başladığında ilk isteğin tenant verisi tüm ziyaretçilere donmuş kalır.
export const dynamic = 'force-dynamic';

interface Ilan extends IlanKartiData {
  /** Arama indeksinden gelir — `kapak_gorsel_url`'e dönüştürülmeden `IlanKarti` görseli çözemez. */
  kapak_gorsel_id?: string | null;
}

interface AramaSonucu {
  data: Ilan[];
  total: number;
}

async function getTenantSlug(): Promise<string> {
  const h = await headers();
  const xSlug = h.get('x-tenant-slug');
  if (xSlug) return xSlug;
  const host = h.get('host') ?? '';
  const first = host.split(':')[0].split('.')[0]?.toLowerCase();
  return first && !['localhost', 'www', 'belediyesinden'].includes(first) ? first : '';
}

async function fetchIlanlar(
  slug: string,
  query?: string,
  varlikTipi?: string,
  sonuclananlar?: string,
): Promise<Ilan[]> {
  if (!slug) return [];
  try {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (varlikTipi) params.set('varlikTipi', varlikTipi);
    if (sonuclananlar) params.set('sonuclananlar', sonuclananlar);
    const qs = params.toString();
    const sonuc = await serverApiFetch<AramaSonucu>(
      qs ? `/search/ilan?${qs}` : '/search/ilan',
      slug,
    );
    return sonuc.data.map((i) => ({
      ...i,
      kapak_gorsel_url: i.kapak_gorsel_id ? ilanGorselUrl(slug, i.kapak_gorsel_id) : null,
    }));
  } catch {
    return [];
  }
}

export default async function IlanlarPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; varlikTipi?: string; sonuclananlar?: string }>;
}) {
  const sp = await searchParams;
  const slug = await getTenantSlug();
  const ilanlar = await fetchIlanlar(slug, sp['q'], sp['varlikTipi'], sp['sonuclananlar']);
  const ilkFiltre = {
    q: sp['q'] ?? '',
    varlikTipi: sp['varlikTipi'] ?? '',
    sonuclananlar: sp['sonuclananlar'] === '1',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">İlanlar</h1>
        <p className="mt-1 text-sm text-gray-500">Belediyemizin tüm ihale ve satış ilanları</p>
      </div>

      <IlanListesi ilkFiltre={ilkFiltre} ilkSonuc={ilanlar} />

      <SonGezilenlerSeridi />
    </div>
  );
}

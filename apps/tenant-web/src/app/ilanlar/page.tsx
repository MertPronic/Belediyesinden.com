import { headers } from 'next/headers';
import Link from 'next/link';
import { Inbox, Search } from 'lucide-react';
import { ilanGorselUrl, serverApiFetch } from '../../lib/api';
import {
  Button,
  Card,
  CardContent,
  EmptyState,
  Field,
  Input,
  Select,
  IlanKarti,
  type IlanKartiData,
} from '@belediyesinden/ui';

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

const TIPLER = [
  { value: '', label: 'Tüm Tipler' },
  { value: 'ACIK_ARTIRMA', label: 'Açık Artırma' },
  { value: 'ACIK_TEKLIF', label: 'Açık Teklif' },
  { value: 'KAPALI_TEKLIF', label: 'Kapalı Teklif' },
];

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
  searchParams: Promise<{ q?: string; tip?: string }>;
}) {
  const sp = await searchParams;
  const slug = await getTenantSlug();
  const ilanlar = await fetchIlanlar(slug, sp['q'], sp['tip']);
  const aktifFiltre = !!(sp['q'] || sp['tip']);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">İlanlar</h1>
        <p className="mt-1 text-sm text-gray-500">Belediyemizin tüm ihale ve satış ilanları</p>
      </div>

      {/* Filtre */}
      <Card>
        <CardContent className="p-4">
          <form className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field className="mb-0 flex-1">
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">
                Ara
              </label>
              <Input
                type="text"
                name="q"
                placeholder="İlan başlığı veya açıklama..."
                defaultValue={sp['q'] ?? ''}
                icon={<Search />}
              />
            </Field>
            <Field className="mb-0 sm:w-56">
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">
                İhale Tipi
              </label>
              <Select name="tip" defaultValue={sp['tip'] ?? ''}>
                {TIPLER.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Button type="submit" leftIcon={<Search />} className="sm:h-10">
              Ara
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Sonuçlar */}
      {ilanlar.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Inbox />}
            title={aktifFiltre ? 'İlan bulunamadı' : 'Yayında ilan yok'}
            description={
              aktifFiltre
                ? 'Arama kriterlerinize uygun ilan bulunamadı. Filtreleri değiştirmeyi deneyin.'
                : 'Şu anda yayında ilan bulunmuyor.'
            }
            action={
              aktifFiltre ? (
                <Link href="/ilanlar" className="text-sm font-medium" style={{ color: 'var(--renk)' }}>
                  Filtreleri temizle
                </Link>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ilanlar.map((ilan) => (
            <IlanKarti key={ilan.id} ilan={ilan} href={`/ilanlar/${ilan.id}`} />
          ))}
        </div>
      )}
    </div>
  );
}

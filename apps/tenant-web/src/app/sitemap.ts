import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { serverApiFetch } from '../lib/api';

const BASE = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'http://localhost:4200';

// Tenant her istekte header/host'tan çözülür — statik önbelleğe alınırsa container
// her başladığında ilk isteğin tenant'ı tüm isteklere donmuş kalır.
export const dynamic = 'force-dynamic';

async function getTenantSlug(): Promise<string> {
  const h = await headers();
  const xSlug = h.get('x-tenant-slug');
  if (xSlug) return xSlug;
  const host = h.get('host') ?? '';
  const first = host.split(':')[0].split('.')[0]?.toLowerCase();
  return first && !['localhost', 'www', 'belediyesinden'].includes(first) ? first : '';
}

/** Sitemap — statik sayfalar + yayındaki ilanlar (tenant bazlı). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const slug = await getTenantSlug();
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${BASE}/ilanlar`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
  ];

  let ilanPages: MetadataRoute.Sitemap = [];
  if (slug) {
    try {
      const ilanlar = await serverApiFetch<Array<{ id: string; updated_at?: string }>>('/ilan', slug);
      ilanPages = ilanlar.map((ilan) => ({
        url: `${BASE}/ilanlar/${ilan.id}`,
        lastModified: ilan.updated_at ? new Date(ilan.updated_at) : now,
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      }));
    } catch {
      /* sitemap statik sayfalarla yetin */
    }
  }

  return [...staticPages, ...ilanPages];
}

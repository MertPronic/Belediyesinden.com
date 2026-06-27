import type { MetadataRoute } from 'next';

const BASE = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'http://localhost:4200';

/** robots.txt — public ilanlar indexlenir, özel alanlar engellenir. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/profil', '/favoriler', '/login', '/basvuru', '/teminat', '/teklif'],
    },
    sitemap: `${BASE}/sitemap.xml`,
  };
}

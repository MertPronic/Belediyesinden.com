import './global.css';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { serverApiFetch } from '../lib/api';

export const metadata: Metadata = {
  title: 'Belediyesinden',
  description: 'Belediye İlan ve Açık Artırma Portalı',
};

interface TenantTheme {
  slug: string;
  ad: string;
  tema: { renk?: string; siteName?: string } | null;
}

async function getTheme(): Promise<TenantTheme> {
  const h = await headers();
  const xSlug = h.get('x-tenant-slug');
  let slug = xSlug ?? '';
  if (!slug) {
    const host = h.get('host') ?? '';
    const first = host.split(':')[0].split('.')[0]?.toLowerCase();
    if (first && !['localhost', 'www', 'belediyesinden'].includes(first)) {
      slug = first;
    }
  }
  if (!slug) return { slug: '', ad: 'Belediyesinden', tema: { renk: '#2563eb', siteName: 'Belediyesinden' } };
  try {
    return await serverApiFetch<TenantTheme>('/tenants/current', slug);
  } catch {
    return { slug, ad: slug, tema: { renk: '#64748b', siteName: slug } };
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = await getTheme();
  const renk = theme.tema?.renk ?? '#2563eb';
  const siteName = theme.tema?.siteName ?? theme.ad;

  return (
    <html lang="tr">
      <body
        style={
          {
            '--renk': renk,
          } as React.CSSProperties
        }
      >
        <header className="border-b border-gray-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <div
                className="h-8 w-8 rounded-lg"
                style={{ background: renk }}
              />
              <span className="text-lg font-bold text-gray-900">{siteName}</span>
            </div>
            <nav className="flex items-center gap-4 text-sm">
              <a href="/" className="text-gray-600 hover:text-gray-900">Ana Sayfa</a>
              <a href="/ilanlar" className="text-gray-600 hover:text-gray-900">İlanlar</a>
              <a href="/login" className="rounded-lg px-3 py-1.5 text-white" style={{ background: renk }}>
                Giriş
              </a>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}

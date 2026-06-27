import './global.css';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { Landmark } from 'lucide-react';
import { serverApiFetch } from '../lib/api';
import { Footer } from '@belediyesinden/ui';
import { UserMenu } from '../components/user-menu';

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
        <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/85 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5">
            <a href="/" className="flex items-center gap-2.5">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-lg shadow-sm"
                style={{ background: renk }}
              >
                <Landmark className="h-5 w-5 text-white" />
              </span>
              <span className="text-base font-bold tracking-tight text-gray-900">{siteName}</span>
            </a>
            <nav className="flex items-center gap-1 text-sm font-medium sm:gap-2">
              <a
                href="/"
                className="rounded-md px-3 py-1.5 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
              >
                Ana Sayfa
              </a>
              <a
                href="/ilanlar"
                className="rounded-md px-3 py-1.5 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
              >
                İlanlar
              </a>
              <UserMenu />
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        <Footer brand={siteName} />
      </body>
    </html>
  );
}

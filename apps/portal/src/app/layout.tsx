import './global.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Building2 } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Belediyesinden.com — Belediye İlan Portalı',
  description: 'Tüm belediyelerin ilan ve açık artırmaları tek çatı altında',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="tr">
      <body>
        <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/85 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5">
            <a href="/" className="flex items-center gap-2.5">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-lg shadow-sm"
                style={{ background: 'var(--renk)' }}
              >
                <Building2 className="h-5 w-5 text-white" />
              </span>
              <span className="text-base font-bold tracking-tight text-gray-900">Belediyesinden.com</span>
            </a>
            <nav className="flex items-center gap-1 text-sm font-medium">
              <a
                href="/"
                className="rounded-md px-3 py-1.5 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
              >
                Tüm İlanlar
              </a>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}

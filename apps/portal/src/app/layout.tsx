import './global.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Belediyesinden.com — Belediye İlan Portalı',
  description: 'Tüm belediyelerin ilan ve açık artırmaları tek çatı altında',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="tr">
      <body>
        <header className="border-b border-gray-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg" style={{ background: 'var(--renk)' }} />
              <span className="text-lg font-bold text-gray-900">Belediyesinden.com</span>
            </div>
            <nav className="flex items-center gap-4 text-sm">
              <a href="/" className="text-gray-600 hover:text-gray-900">Tüm İlanlar</a>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}

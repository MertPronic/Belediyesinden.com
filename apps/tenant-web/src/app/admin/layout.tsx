'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { RequireAdmin } from '../../components/require-admin';

const MENU = [
  { href: '/admin', label: 'Genel Bakış' },
  { href: '/admin/varliklar', label: 'Varlıklar' },
  { href: '/admin/ilanlar', label: 'İlanlar' },
  { href: '/admin/basvurular', label: 'Başvurular & Teminat' },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <RequireAdmin>
      <div className="grid gap-6 md:grid-cols-[200px_1fr]">
        <aside className="md:border-r md:border-gray-200 md:pr-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Yönetim
          </h2>
          <nav className="flex flex-row flex-wrap gap-1 md:flex-col">
            {MENU.map((m) => {
              const active = pathname === m.href;
              return (
                <Link
                  key={m.href}
                  href={m.href}
                  className={`rounded-lg px-3 py-2 text-sm ${
                    active ? 'font-semibold text-white' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                  style={active ? { background: 'var(--renk)' } : undefined}
                >
                  {m.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <div>{children}</div>
      </div>
    </RequireAdmin>
  );
}

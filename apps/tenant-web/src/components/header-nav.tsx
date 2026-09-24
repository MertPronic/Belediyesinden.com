'use client';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { useAuth, kullaniciAdminMi } from '../lib/use-auth';
import { getTenantSlug } from '../lib/api';
import { UserMenu } from './user-menu';

/** Header navigasyonu — masaüstünde inline, mobilde hamburger menü (a11y: aria). */
export function HeaderNav() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const isAdmin = kullaniciAdminMi(user, getTenantSlug());

  // Admin/encümen personeline vatandaş "İlanlar" listesi gösterilmiyor — aynı liste
  // zaten Yönetim > İlanlar altında var (Harun/PO, 2026-09-24).
  const links = [
    { href: '/', label: 'Ana Sayfa' },
    ...(isAdmin ? [] : [{ href: '/ilanlar', label: 'İlanlar' }]),
  ];

  return (
    <>
      {/* Masaüstü */}
      <nav className="hidden items-center gap-1 text-sm font-medium sm:flex" aria-label="Ana navigasyon">
        {links.map((l) => (
          <a
            key={l.href}
            href={l.href}
            className="rounded-md px-3 py-1.5 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
          >
            {l.label}
          </a>
        ))}
        <UserMenu />
      </nav>

      {/* Mobil hamburger */}
      <div className="flex items-center gap-1 sm:hidden">
        <UserMenu />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100"
          aria-label={open ? 'Menüyü kapat' : 'Menüyü aç'}
          aria-expanded={open}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobil dropdown */}
      {open && (
        <nav
          className="absolute inset-x-0 top-full border-b border-gray-200 bg-white px-4 py-2 shadow-sm sm:hidden"
          aria-label="Mobil navigasyon"
        >
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block rounded-md px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              {l.label}
            </a>
          ))}
        </nav>
      )}
    </>
  );
}

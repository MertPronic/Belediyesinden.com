import Link from 'next/link';
import { Building2 } from 'lucide-react';

export interface FooterLink {
  label: string;
  href: string;
}
export interface FooterColumn {
  title: string;
  links: FooterLink[];
}

const DEFAULT_COLUMNS: FooterColumn[] = [
  {
    title: 'Kurumsal',
    links: [
      { label: 'Hakkımızda', href: '/kurumsal/hakkimizda' },
      { label: 'Vizyon & Misyon', href: '/kurumsal/vizyon' },
      { label: 'Basın & Duyurular', href: '/ilanlar' },
      { label: 'İletişim', href: '/kurumsal/iletisim' },
    ],
  },
  {
    title: 'Hizmetler',
    links: [
      { label: 'İhale Katılımı', href: '/ilanlar' },
      { label: 'Teminat İşlemleri', href: '/ilanlar' },
      { label: 'e-İmza & e-Devlet', href: '/ilanlar' },
      { label: 'Mobil Uygulama', href: '/ilanlar' },
    ],
  },
  {
    title: 'Yardım',
    links: [
      { label: 'Sıkça Sorulan Sorular', href: '/yardim/sss' },
      { label: 'Nasıl Katılırım?', href: '/ilanlar' },
      { label: 'Şikayet & Öneri', href: '/yardim/sikayet' },
      { label: 'Canlı Destek', href: '/yardim/destek' },
    ],
  },
  {
    title: 'Yasal',
    links: [
      { label: 'Kullanım Koşulları', href: '/yasal/kullanim' },
      { label: 'KVKK Aydınlatma', href: '/yasal/kvkk' },
      { label: 'Gizlilik Politikası', href: '/yasal/gizlilik' },
      { label: 'Çerez Politikası', href: '/yasal/cerez' },
    ],
  },
];

/** Sahibinden tarzı kurumsal footer — sütunlu link bloğu + telif. */
export function Footer({
  brand,
  columns = DEFAULT_COLUMNS,
}: {
  brand: string;
  columns?: FooterColumn[];
}) {
  return (
    <footer className="mt-12 border-t border-gray-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4 lg:grid-cols-5">
          {/* Marka */}
          <div className="col-span-2 md:col-span-4 lg:col-span-1">
            <div className="flex items-center gap-2">
              <span
                className="flex h-8 w-8 items-center justify-center rounded-lg shadow-sm"
                style={{ background: 'var(--renk)' }}
              >
                <Building2 className="h-4 w-4 text-white" />
              </span>
              <span className="font-bold tracking-tight text-gray-900">{brand}</span>
            </div>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-gray-500">
              Belediyelerin satış, kiralama ve açık artırma ilanlarını elektronik ortamda yöneten
              resmî ihale portalı.
            </p>
          </div>

          {/* Link sütunları */}
          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="text-sm font-semibold text-gray-900">{col.title}</h3>
              <ul className="mt-3 space-y-2">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-sm text-gray-500 transition-colors hover:text-gray-900"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-gray-100 pt-6 sm:flex-row">
          <p className="text-xs text-gray-400">
            © {new Date().getFullYear()} {brand}. Tüm hakları saklıdır.
          </p>
          <p className="text-xs text-gray-400">
            2886 sayılı Devlet İhale Kanunu kapsamında elektronik ihale platformu.
          </p>
        </div>
      </div>
    </footer>
  );
}

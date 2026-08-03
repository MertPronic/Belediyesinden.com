'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Box, ClipboardCheck, FileText, LayoutDashboard, Landmark, Settings, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { RequireAdmin } from '../../components/require-admin';
import { useAuth } from '../../lib/use-auth';

const MENU: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/admin', label: 'Genel Bakış', icon: LayoutDashboard },
  { href: '/admin/varliklar', label: 'Varlıklar', icon: Box },
  { href: '/admin/ilanlar', label: 'İlanlar', icon: FileText },
  { href: '/admin/basvurular', label: 'Başvurular', icon: ClipboardCheck },
];
const TENANT_ADMIN_MENU = { href: '/admin/kurallar', label: 'İhale Kuralları', icon: Settings };
const SUPERADMIN_MENU = { href: '/admin/tenantlar', label: 'Belediyeler', icon: Landmark };
const TENANT_OPS_ROLLER = ['TENANT_ADMIN', 'ENCUMEN'];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const hasTenantOpsRole = user?.roller?.some((r) => TENANT_OPS_ROLLER.includes(r));
  const isTenantAdmin = user?.roller?.includes('TENANT_ADMIN');
  const isSuperadmin = user?.roller?.includes('SUPERADMIN');
  const menu = [
    ...(hasTenantOpsRole ? MENU : []),
    ...(isTenantAdmin ? [TENANT_ADMIN_MENU] : []),
    ...(isSuperadmin ? [SUPERADMIN_MENU] : []),
  ];
  return (
    <RequireAdmin>
      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        <aside>
          <h2 className="mb-3 px-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
            Yönetim
          </h2>
          <nav className="flex flex-row flex-wrap gap-1 md:flex-col">
            {menu.map((m) => {
              const active = pathname === m.href;
              const Icon = m.icon;
              return (
                <Link
                  key={m.href}
                  href={m.href}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                    active
                      ? 'font-semibold text-white shadow-sm'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                  style={active ? { background: 'var(--renk)' } : undefined}
                >
                  <Icon className="h-4 w-4" />
                  {m.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </RequireAdmin>
  );
}

'use client';
import Link from 'next/link';
import { LogOut, Shield, User } from 'lucide-react';
import { useAuth, login, logout } from '../lib/use-auth';
import { Avatar, Button } from '@belediyesinden/ui';

const ADMIN_ROLLER = ['tenant_admin', 'encumen', 'superadmin'];

/** Header'daki auth-aware menü: login durumu + rol bazlı admin linki + çıkış. */
export function UserMenu() {
  const { ready, authenticated, user } = useAuth();

  if (!ready) {
    return <span className="h-7 w-12 animate-pulse rounded bg-gray-100" />;
  }

  if (!authenticated) {
    return <Button size="sm" onClick={login}>Giriş</Button>;
  }

  const isAdmin = user?.roller?.some((r) => ADMIN_ROLLER.includes(r));

  return (
    <div className="flex items-center gap-3">
      <Link
        href="/profil"
        className="hidden items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 sm:inline-flex"
      >
        <User className="h-4 w-4" />
        Hesabım
      </Link>
      {isAdmin && (
        <Link
          href="/admin"
          className="hidden items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 sm:inline-flex"
        >
          <Shield className="h-4 w-4" style={{ color: 'var(--renk)' }} />
          Yönetim
        </Link>
      )}
      <div className="flex items-center gap-2">
        <Avatar fallback={user?.ad ?? 'K'} size="sm" />
        <Button size="sm" variant="ghost" leftIcon={<LogOut />} onClick={() => logout()}>
          <span className="hidden sm:inline">Çıkış</span>
        </Button>
      </div>
    </div>
  );
}

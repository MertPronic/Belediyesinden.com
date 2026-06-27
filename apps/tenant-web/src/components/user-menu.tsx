'use client';
import Link from 'next/link';
import { useAuth, login, logout } from '../lib/use-auth';

const ADMIN_ROLLER = ['tenant_admin', 'encumen', 'superadmin'];

/** Header'daki auth-aware menü: login durumu + rol bazlı admin linkleri + çıkış. */
export function UserMenu() {
  const { ready, authenticated, user } = useAuth();

  if (!ready) {
    return <span className="text-sm text-gray-400">…</span>;
  }

  if (!authenticated) {
    return (
      <button
        type="button"
        onClick={login}
        className="rounded-lg px-3 py-1.5 text-white"
        style={{ background: 'var(--renk)' }}
      >
        Giriş
      </button>
    );
  }

  const isAdmin = user?.roller?.some((r) => ADMIN_ROLLER.includes(r));

  return (
    <div className="flex items-center gap-4 text-sm">
      {isAdmin && (
        <Link href="/admin" className="text-gray-600 hover:text-gray-900">
          Yönetim
        </Link>
      )}
      <div className="flex items-center gap-2">
        <span className="hidden text-gray-600 sm:inline">{user?.ad}</span>
        <button
          type="button"
          onClick={() => logout()}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-gray-700 hover:bg-gray-50"
        >
          Çıkış
        </button>
      </div>
    </div>
  );
}

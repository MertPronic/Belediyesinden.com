'use client';
import type { ReactNode } from 'react';
import { useAuth, login } from '../lib/use-auth';

/**
 * Alt ağacı auth'a bağlar: Keycloak init bekler, kimliği doğrulanmamışsa
 * login'e yönlendirir. Korunan sayfaları bununla sarın.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { ready, authenticated } = useAuth();

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[var(--renk)]" />
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h2 className="text-xl font-semibold text-gray-900">Giriş yapmanız gerekiyor</h2>
        <p className="mt-2 text-sm text-gray-600">Bu sayfayı görüntülemek için giriş yapın.</p>
        <button
          type="button"
          onClick={login}
          className="mt-4 rounded-lg px-5 py-2.5 text-white"
          style={{ background: 'var(--renk)' }}
        >
          Giriş Yap
        </button>
      </div>
    );
  }

  return <>{children}</>;
}

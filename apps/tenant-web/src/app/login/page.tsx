'use client';
import { useEffect, useState } from 'react';
import { LogIn } from 'lucide-react';
import { Alert } from '@belediyesinden/ui';
import { ensureAuth, getKeycloak } from '../../lib/keycloak';

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ensureAuth()
      .then(() => {
        window.location.href = '/';
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Giriş başarısız');
      });
  }, []);

  return (
    <div className="mx-auto flex min-h-[55vh] max-w-md flex-col items-center justify-center gap-5">
      <div className="text-center">
        <span
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl shadow-sm"
          style={{ background: 'var(--renk)' }}
        >
          <LogIn className="h-6 w-6 text-white" />
        </span>
        <h1 className="mt-4 text-xl font-bold text-gray-900">Giriş yapılıyor</h1>
        <p className="mt-1 text-sm text-gray-500">Keycloak güvenli kimlik doğrulamasına yönlendiriliyorsunuz.</p>
      </div>

      <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-gray-200 border-t-[var(--renk)]" />

      {error && (
        <Alert variant="error" title="Giriş Hatası">
          {error}
        </Alert>
      )}
      {error && (
        <button
          type="button"
          onClick={() => getKeycloak().login()}
          className="rounded-lg px-5 py-2 text-sm font-semibold text-white"
          style={{ background: 'var(--renk)' }}
        >
          Tekrar Dene
        </button>
      )}
    </div>
  );
}

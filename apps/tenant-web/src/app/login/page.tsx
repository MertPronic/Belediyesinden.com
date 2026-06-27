'use client';
import { useEffect, useState } from 'react';
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
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
          <p className="font-semibold text-red-700">Giriş Hatası</p>
          <p className="mt-1 text-sm text-red-600">{error}</p>
          <button
            type="button"
            onClick={() => getKeycloak().login()}
            className="mt-3 rounded-lg px-4 py-2 text-white"
            style={{ background: 'var(--renk)' }}
          >
            Tekrar Dene
          </button>
        </div>
      ) : (
        <>
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[var(--renk)]" />
          <p className="text-gray-600">Keycloak'a yönlendiriliyor...</p>
        </>
      )}
    </div>
  );
}

'use client';
import { useEffect, useState } from 'react';
import { FileCheck2, Gavel, LogIn, ShieldCheck } from 'lucide-react';
import { Alert, Button } from '@belediyesinden/ui';
import { ensureAuth, getKeycloak } from '../../lib/keycloak';

const OZELLIKLER = [
  {
    icon: ShieldCheck,
    baslik: 'Güvenli kimlik doğrulama',
    aciklama: 'Keycloak altyapısıyla korunan, tek merkezden yönetilen oturum açma.',
  },
  {
    icon: Gavel,
    baslik: 'Canlı açık artırmalara katılım',
    aciklama: 'Teklif verme, teminat takibi ve başvuru süreçleri tek hesapta.',
  },
  {
    icon: FileCheck2,
    baslik: 'Şeffaf ve denetlenebilir',
    aciklama: 'Her işlem kayıt altında; başvuru durumunuzu her an izleyin.',
  },
] as const;

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
    <div className="hero-accent relative overflow-hidden rounded-2xl border border-gray-100 px-6 py-14 sm:px-10 sm:py-20">
      {/* Dekoratif accent lekeler — tenant rengine tonlanır, abartısız. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-20 -top-24 h-72 w-72 rounded-full blur-3xl"
        style={{ background: 'color-mix(in srgb, var(--renk) 20%, transparent)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-28 -right-16 h-80 w-80 rounded-full blur-3xl"
        style={{ background: 'color-mix(in srgb, var(--renk) 14%, transparent)' }}
      />

      <div className="relative mx-auto grid max-w-4xl gap-12 lg:grid-cols-[1.1fr_1fr] lg:items-center">
        {/* Sol: marka & güven unsurları */}
        <div className="animate-fade-in-up hidden lg:block">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white/70 px-3 py-1 text-xs font-medium text-gray-600 backdrop-blur">
            <ShieldCheck className="h-3.5 w-3.5" style={{ color: 'var(--renk)' }} />
            Resmî İlan Portalı
          </span>
          <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight text-gray-900 sm:text-4xl">
            Hesabınızla devam edin
          </h1>
          <p className="mt-3 max-w-md text-base text-gray-600">
            Belediye ilanlarına başvurmak, teminat yatırmak ve açık artırmalara katılmak için
            güvenli kimlik doğrulama ekranına yönlendiriliyorsunuz.
          </p>
          <ul className="mt-8 space-y-5">
            {OZELLIKLER.map(({ icon: Icon, baslik, aciklama }) => (
              <li key={baslik} className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg accent-soft-bg">
                  <Icon className="h-5 w-5" style={{ color: 'var(--renk)' }} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{baslik}</p>
                  <p className="text-sm text-gray-500">{aciklama}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Sağ: durum kartı */}
        <div className="animate-fade-in-up mx-auto w-full max-w-sm rounded-2xl border border-gray-100 bg-white/90 p-8 text-center shadow-lg backdrop-blur">
          <span
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl shadow-sm"
            style={{ background: 'var(--renk)' }}
          >
            <LogIn className="h-7 w-7 text-white" />
          </span>
          <h2 className="mt-5 text-xl font-bold text-gray-900">Giriş yapılıyor</h2>
          <p className="mt-1.5 text-sm text-gray-500">
            Güvenli kimlik doğrulama ekranına yönlendiriliyorsunuz…
          </p>

          {!error && (
            <div className="mt-7 flex items-center justify-center">
              <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-gray-200 border-t-[var(--renk)]" />
            </div>
          )}

          {error && (
            <div className="mt-6 space-y-4 text-left">
              <Alert variant="error" title="Giriş Hatası">
                {error}
              </Alert>
              <Button
                type="button"
                onClick={() => getKeycloak().login({ prompt: 'login' })}
                className="w-full"
                leftIcon={<LogIn />}
              >
                Tekrar Dene
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

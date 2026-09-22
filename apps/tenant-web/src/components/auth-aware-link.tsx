'use client';
import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { useAuth, loginTo } from '../lib/use-auth';

/**
 * Korumalı bir sayfaya (Başvur/Teklif Ver) giden CTA. Kullanıcı giriş yapmamışsa
 * tıklama önce hedef sayfaya gidip orada "giriş yapmanız gerekiyor" göstermek
 * yerine doğrudan Keycloak login'i açar — login sonrası aynı hedefe döner
 * (Harun bey/PO geri bildirimi, 2026-08-21).
 */
export function AuthAwareLink({
  href,
  className,
  style,
  children,
}: {
  href: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const { ready, authenticated } = useAuth();

  if (!ready) {
    return <div className={className} style={style} aria-hidden="true" />;
  }

  if (!authenticated) {
    return (
      // `<button>` içerik genişliğine daralır (`<a>`'nın aksine `display:flex`
      // verilse bile form-control boyutlandırma kuralı geçerli) — `w-full` bunu düzeltir.
      <button
        type="button"
        onClick={() => loginTo(`${window.location.origin}${href}`)}
        className={`${className ?? ''} w-full`}
        style={style}
      >
        {children}
      </button>
    );
  }

  return (
    <Link href={href} className={className} style={style}>
      {children}
    </Link>
  );
}

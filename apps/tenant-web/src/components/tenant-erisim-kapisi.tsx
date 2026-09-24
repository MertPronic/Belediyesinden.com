'use client';
import { ShieldAlert } from 'lucide-react';
import { Alert, Button, Card, CardContent } from '@belediyesinden/ui';
import { useAuth, digerTenantPersoneliMi } from '../lib/use-auth';

const PORTAL_URL = process.env['NEXT_PUBLIC_PORTAL_URL'] ?? 'https://belediyesinden.com';

/**
 * Başka bir belediyenin personeli bu siteye girerse vatandaş sayfalarını da hiç
 * göremesin — net bir uyarıyla reddedilip merkezi portala (kendi belediyesine
 * OTOMATİK giriş yaptırmadan) yönlendirilir (Harun/PO, 2026-09-24 — ACIK-SORULAR
 * S14 kapandı; "kendi belediyene dön" yerine merkezi portal — çıkış akışıyla
 * tutarlı, bkz. keycloak.ts logout).
 *
 * `useAuth()`'ın canlı durumuna göre karar verir (`UserMenu` ile aynı kaynak) —
 * sunucu tarafında `kc_token` cookie'sinden okuyan ilk sürüm, istemci tarafı
 * navigasyonlarda (Next.js router cache/zamanlama) tutarsız davranıyordu.
 */
export function TenantErisimKapisi({
  tenantSlug,
  siteName,
  children,
}: {
  tenantSlug: string;
  siteName: string;
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const kendiTenantSlug = tenantSlug ? digerTenantPersoneliMi(user, tenantSlug) : null;

  if (!kendiTenantSlug) {
    return <>{children}</>;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-4">
      <Card className="w-full">
        <CardContent className="space-y-4 p-6 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
            <ShieldAlert className="h-6 w-6 text-red-500" />
          </span>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Bu belediyeye erişiminiz yok</h1>
            <p className="mt-1.5 text-sm text-gray-500">
              {siteName} personeli değilsiniz — başka bir belediyenin personel hesabıyla giriş
              yapmışsınız. Bu sayfaya erişemezsiniz.
            </p>
          </div>
          <Alert variant="warning">Yanlış belediyeye giriş yapmaya çalışıyorsunuz.</Alert>
          <a href={PORTAL_URL} className="block">
            <Button className="w-full">Ana Sayfaya Dön</Button>
          </a>
        </CardContent>
      </Card>
    </main>
  );
}

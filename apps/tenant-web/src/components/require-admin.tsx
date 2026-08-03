'use client';
import type { ReactNode } from 'react';
import { useAuth, logout } from '../lib/use-auth';
import { getTenantSlug } from '../lib/api';
import { Button } from '@belediyesinden/ui';
import { RequireAuth } from './require-auth';

const ADMIN_ROLLER = ['TENANT_ADMIN', 'ENCUMEN', 'SUPERADMIN'];

/**
 * RequireAuth + rol kontrolü. Sadece tenant_admin/encumen/superadmin alt ağacı
 * görür; yetkisiz kullanıcıya uyarı gösterilir.
 *
 * Ayrıca tenant uyumsuzluğunu da burada keser: Keycloak SSO farklı bir
 * belediyenin subdomain'inde aynı kullanıcıyla sessizce oturum açabiliyor
 * (tarayıcı oturumu paylaşılıyor); backend TenantGuard bunu API isteğinde
 * 403 ile engelliyor ama frontend eskiden hiç kontrol etmiyordu — kullanıcı
 * formu doldurup gönderene kadar hiçbir uyarı görmüyordu. SUPERADMIN
 * tenant'sız olduğu için (tenantId null) bu kontrolden muaf.
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const isAdmin = user?.roller?.some((r) => ADMIN_ROLLER.includes(r));
  const isSuperadmin = user?.roller?.includes('SUPERADMIN');
  const tenantMismatch = !isSuperadmin && !!user?.tenantId && user.tenantId !== getTenantSlug();

  return (
    <RequireAuth>
      {tenantMismatch ? (
        <div className="mx-auto max-w-md py-16 text-center">
          <h2 className="text-xl font-semibold text-gray-900">Yanlış belediye</h2>
          <p className="mt-2 text-sm text-gray-600">
            Bu hesap <strong>{user?.tenantId}</strong> belediyesine ait — bu sayfayı görüntülemek için
            önce çıkış yapıp doğru belediyenin adresinden tekrar giriş yapmanız gerekir.
          </p>
          <Button className="mt-4" onClick={() => logout()}>
            Çıkış Yap
          </Button>
        </div>
      ) : isAdmin ? (
        children
      ) : (
        <div className="mx-auto max-w-md py-16 text-center">
          <h2 className="text-xl font-semibold text-gray-900">Yetkisiz erişim</h2>
          <p className="mt-2 text-sm text-gray-600">
            Bu alan yalnızca belediye yöneticileri (TenantAdmin/Encümen) içindir.
          </p>
        </div>
      )}
    </RequireAuth>
  );
}

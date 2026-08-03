'use client';
import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/use-auth';
import { RequireAuth } from './require-auth';

const TENANT_OPS_ROLLER = ['TENANT_ADMIN', 'ENCUMEN'];

/**
 * RequireAuth + TenantAdmin/Encümen rol kontrolü. Tek bir belediyenin işletme
 * verisine (varlık/ilan/başvuru) dair sayfalar bununla sarılır — SUPERADMIN
 * platform yönetimiyle sınırlı olduğu için buraya giremez (bkz. Belediyeler sayfası).
 *
 * `superadminRedirect` verilirse ve kullanıcı yalnızca SUPERADMIN ise (tenant
 * ops rolü yoksa) "yetkisiz" göstermek yerine o adrese yönlendirir — giriş
 * sonrası SUPERADMIN'in doğrudan platform ekranına düşmesi için (bkz. /admin).
 */
export function RequireTenantAdmin({
  children,
  superadminRedirect,
}: {
  children: ReactNode;
  superadminRedirect?: string;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const hasTenantOpsRole = user?.roller?.some((r) => TENANT_OPS_ROLLER.includes(r));
  const isSuperadminOnly = !hasTenantOpsRole && user?.roller?.includes('SUPERADMIN');

  useEffect(() => {
    if (isSuperadminOnly && superadminRedirect) {
      router.replace(superadminRedirect);
    }
  }, [isSuperadminOnly, superadminRedirect, router]);

  return (
    <RequireAuth>
      {hasTenantOpsRole ? (
        children
      ) : isSuperadminOnly && superadminRedirect ? null : (
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

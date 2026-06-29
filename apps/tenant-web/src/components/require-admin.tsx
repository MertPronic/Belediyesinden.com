'use client';
import type { ReactNode } from 'react';
import { useAuth } from '../lib/use-auth';
import { RequireAuth } from './require-auth';

const ADMIN_ROLLER = ['TENANT_ADMIN', 'ENCUMEN', 'SUPERADMIN'];

/**
 * RequireAuth + rol kontrolü. Sadece tenant_admin/encumen/superadmin alt ağacı
 * görür; yetkisiz kullanıcıya uyarı gösterilir.
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const isAdmin = user?.roller?.some((r) => ADMIN_ROLLER.includes(r));

  return (
    <RequireAuth>
      {isAdmin ? (
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

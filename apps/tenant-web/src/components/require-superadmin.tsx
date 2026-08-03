'use client';
import type { ReactNode } from 'react';
import { useAuth } from '../lib/use-auth';
import { RequireAuth } from './require-auth';

/** RequireAuth + SUPERADMIN rol kontrolü — tenant yönetimi TenantAdmin/Encümen'e kapalı. */
export function RequireSuperadmin({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const isSuperadmin = user?.roller?.includes('SUPERADMIN');

  return (
    <RequireAuth>
      {isSuperadmin ? (
        children
      ) : (
        <div className="mx-auto max-w-md py-16 text-center">
          <h2 className="text-xl font-semibold text-gray-900">Yetkisiz erişim</h2>
          <p className="mt-2 text-sm text-gray-600">Bu alan yalnızca platform süper yöneticileri içindir.</p>
        </div>
      )}
    </RequireAuth>
  );
}

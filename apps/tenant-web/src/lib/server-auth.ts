import { cookies } from 'next/headers';

const SERVER_API_URL = process.env['API_INTERNAL_URL'] ?? process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3000/api';

/**
 * SERVER-ONLY: httpOnly cookie'den Keycloak token'ı okur (SSR auth).
 * Cookie bridge (/api/auth/token) tarafından client tarafından set edilir.
 */
export async function getServerToken(): Promise<string | undefined> {
  const c = await cookies();
  return c.get('kc_token')?.value;
}

/**
 * SERVER-ONLY: authenticated API fetch (SSR — admin dashboard vb.).
 * Cookie'den token okur → Bearer header. Tenant slug zorunlu.
 */
export async function serverAuthFetch<T>(
  path: string,
  tenantSlug: string,
): Promise<T> {
  const token = await getServerToken();
  const res = await fetch(`${SERVER_API_URL}${path}`, {
    headers: {
      'x-tenant-slug': tenantSlug,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`SSR API ${path}: ${res.status}`);
  return res.json() as Promise<T>;
}

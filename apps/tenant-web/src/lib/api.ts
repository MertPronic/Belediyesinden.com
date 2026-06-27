import { getToken } from './keycloak';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3000/api';

/** Tenant slug (subdomain'den veya env). */
function getTenantSlug(): string {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    const first = host.split('.')[0]?.toLowerCase();
    if (first && !['localhost', 'www', 'belediyesinden'].includes(first)) {
      return first;
    }
  }
  return process.env['NEXT_PUBLIC_TENANT_SLUG'] ?? 'talas';
}

/** Authenticated API fetch (Bearer + x-tenant-slug). Token gerekirse yenilenir. */
export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    'x-tenant-slug': getTenantSlug(),
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string>),
  };
  // FormData (multipart) için content-type'ı tarayıcı setsin (boundary için).
  if (!(options.body instanceof FormData)) {
    headers['content-type'] = 'application/json';
  }
  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    throw new Error(`API ${path}: ${res.status}${msg ? ` — ${msg}` : ''}`);
  }
  const ct = res.headers.get('content-type') ?? '';
  return (ct.includes('application/json') ? res.json() : null) as Promise<T>;
}

/** Server-side API fetch (no auth — public endpoints only). */
export async function serverApiFetch<T>(
  path: string,
  tenantSlug: string,
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'x-tenant-slug': tenantSlug },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Server API ${path}: ${res.status}`);
  return res.json() as Promise<T>;
}

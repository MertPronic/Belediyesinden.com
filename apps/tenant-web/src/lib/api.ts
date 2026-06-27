import { getToken } from './keycloak';

// Client-side (browser): NEXT_PUBLIC_API_URL (host erişimi, build-time inline).
const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3000/api';
// Server-side (SSR, container içi): API_INTERNAL_URL (compose service adı, runtime).
// Tanımsızsa client URL'ine fallback (tek-host dev).
const SERVER_API_URL = process.env['API_INTERNAL_URL'] ?? API_URL;

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

/** Authenticated dosya indirme (blob → tarayıcı indirisi). */
export async function downloadFile(path: string, filename: string): Promise<void> {
  const token = await getToken();
  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      'x-tenant-slug': getTenantSlug(),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`İndirme başarısız: ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Server-side API fetch (no auth — public endpoints only). */
export async function serverApiFetch<T>(
  path: string,
  tenantSlug: string,
): Promise<T> {
  const res = await fetch(`${SERVER_API_URL}${path}`, {
    headers: { 'x-tenant-slug': tenantSlug },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Server API ${path}: ${res.status}`);
  return res.json() as Promise<T>;
}

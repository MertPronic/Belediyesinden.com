// Portal server-side fetch'leri container içinden -> compose service adı (runtime).
// Tanımsızsa client URL'ine fallback.
const SERVER_API_URL = process.env['API_INTERNAL_URL'] ?? process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3000/api';

/** Portal: belirli bir tenant bağlamında public API çağrısı (auth'suz, server-side). */
export async function portalFetch<T>(
  path: string,
  tenantSlug?: string,
): Promise<T> {
  const headers: Record<string, string> = {};
  if (tenantSlug) headers['x-tenant-slug'] = tenantSlug;
  const res = await fetch(`${SERVER_API_URL}${path}`, { headers, cache: 'no-store' });
  if (!res.ok) throw new Error(`API ${path}: ${res.status}`);
  return res.json() as Promise<T>;
}

/** Tenant alt-alan URL'i (ilan detayında başvuru/teklif için yönlendirme). */
export function tenantUrl(tenantSlug: string, path: string): string {
  const base = process.env['NEXT_PUBLIC_TENANT_BASE_DOMAIN'] ?? 'belediyesinden.com';
  return `https://${tenantSlug}.${base}${path}`;
}

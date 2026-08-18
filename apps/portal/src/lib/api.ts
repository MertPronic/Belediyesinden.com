// Portal server-side fetch'leri container içinden -> compose service adı (runtime).
// Tanımsızsa client URL'ine fallback.
const SERVER_API_URL = process.env['API_INTERNAL_URL'] ?? process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3000/api';

/** Tarayıcıdan (client component) doğrudan erişilebilen public API taban URL'i. */
export const PORTAL_PUBLIC_API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3000/api';

/**
 * API hata gövdesini ({statusCode, error, message, ...} — bkz. AllExceptionsFilter)
 * kullanıcıya gösterilecek tek satır temiz mesaja indirger.
 */
async function apiHataMesaji(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: unknown };
    if (Array.isArray(body.message) && body.message.length > 0) {
      return body.message.join(', ');
    }
    if (typeof body.message === 'string' && body.message) {
      return body.message;
    }
  } catch {
    // Gövde JSON değilse aşağıdaki fallback kullanılır.
  }
  return `İstek başarısız (HTTP ${res.status})`;
}

/** Portal: belirli bir tenant bağlamında public API çağrısı (auth'suz, server-side). */
export async function portalFetch<T>(
  path: string,
  tenantSlug?: string,
): Promise<T> {
  const headers: Record<string, string> = {};
  if (tenantSlug) headers['x-tenant-slug'] = tenantSlug;
  const res = await fetch(`${SERVER_API_URL}${path}`, { headers, cache: 'no-store' });
  if (!res.ok) throw new Error(await apiHataMesaji(res));
  return res.json() as Promise<T>;
}

/** Tenant alt-alan URL'i (ilan detayında başvuru/teklif için yönlendirme). */
export function tenantUrl(tenantSlug: string, path: string): string {
  const base = process.env['NEXT_PUBLIC_TENANT_BASE_DOMAIN'] ?? 'belediyesinden.com';
  // Lokal geliştirmede base 'localhost:<port>' olur — TLS yok, http kullanılmalı.
  const protocol = base.startsWith('localhost') ? 'http' : 'https';
  return `${protocol}://${tenantSlug}.${base}${path}`;
}

/**
 * İlan kapak görseli URL'i — tarayıcı `<img>` isteği, `x-tenant-slug` header'ı
 * taşıyamadığı için `?tenant=` query fallback kullanır (bkz. WS bağlantısındaki
 * aynı desen, ILERLEME.md Adım 6). Bu yüzden `NEXT_PUBLIC_API_URL` (tarayıcıdan
 * erişilebilir), `portalFetch`'in server-only `API_INTERNAL_URL`'i DEĞİL.
 */
export function portalGorselUrl(tenantSlug: string, gorselId: string): string {
  return `${PORTAL_PUBLIC_API_URL}/ilan/gorsel/${gorselId}?tenant=${tenantSlug}`;
}

/**
 * Belediyesinden · Tenant (belediye) çözümleme yardımcıları
 *
 * Subdomain'den tenant slug çıkarır ve güvenli PostgreSQL schema adı üretir.
 * Schema adı SQL'e doğrudan interpolate edildiği için slug validasyonu KRİTİKTİR
 * (SQL injection koruması) — sadece [a-z0-9], tire YOK (tırnaksız PG identifier kuralı).
 */

const BASE_DOMAIN = process.env['TENANT_BASE_DOMAIN'] ?? 'belediyesinden.com';

/** Slug validasyonu: 3-40 karakter, sadece küçük harf + rakam. */
const SLUG_RE = /^[a-z0-9]{3,40}$/;

export function isValidSlug(slug: string): boolean {
  return SLUG_RE.test(slug);
}

/**
 * Host bilgisinden tenant slug'ını çıkarır.
 *   `talas.belediyesinden.com` → `talas`
 *   `localhost` / `belediyesinden.com` / `www.belediyesinden.com` → null (merkezi portal)
 *
 * @param host  İstek Host header'ı (port'suz).
 */
export function extractTenantSlug(host: string, baseDomain = BASE_DOMAIN): string | null {
  const hostname = host.split(':')[0].toLowerCase();
  if (hostname === 'localhost' || hostname === baseDomain || hostname === `www.${baseDomain}`) {
    return null;
  }
  if (hostname.endsWith(`.${baseDomain}`)) {
    const slug = hostname.slice(0, -(baseDomain.length + 1));
    return isValidSlug(slug) ? slug : null;
  }
  return null;
}

/**
 * İstek header'larından tenant slug çözer.
 * Önce `x-tenant-slug` (dev/test/proxy kolaylığı — yük dengeleyici tenant'ı header'da geçirebilir),
 * sonra Host subdomain'i denenir.
 */
export function resolveTenantSlugFromHeaders(
  headers: Record<string, string | string[] | undefined>,
): string | null {
  const xSlug = headers['x-tenant-slug'];
  if (typeof xSlug === 'string' && isValidSlug(xSlug)) {
    return xSlug;
  }
  const hostHeader = headers['host'];
  const host = (Array.isArray(hostHeader) ? (hostHeader[0] ?? '') : hostHeader) ?? '';
  return extractTenantSlug(host);
}

/**
 * Tenant slug'ından güvenli PostgreSQL schema adı üretir.
 * Örn. `talas` → `tenant_talas`. Valid slug garantili (tırnaksız identifier olarak geçerli).
 */
export function tenantSchema(slug: string): string {
  if (!isValidSlug(slug)) {
    throw new Error(`Geçersiz tenant slug: "${slug}" (sadece a-z 0-9, 3-40 karakter)`);
  }
  return `tenant_${slug}`;
}

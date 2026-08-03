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
 * İstek header'larından (ve gerekirse query'den) tenant slug çözer.
 * Sırasıyla: `x-tenant-slug` header (dev/test/proxy kolaylığı — yük dengeleyici
 * tenant'ı header'da geçirebilir) → Host subdomain'i → `?tenant=` query param'ı.
 *
 * Query fallback'i özellikle `<img src>` / `<a href>` gibi özel header
 * taşıyamayan doğrudan tarayıcı isteklerini kapsar (örn. ilan görseli/evrak
 * indirme linkleri sabit `NEXT_PUBLIC_API_URL` host'una gider, subdomain taşımaz).
 */
export function resolveTenantSlugFromHeaders(
  headers: Record<string, string | string[] | undefined>,
  query?: Record<string, string | string[] | undefined>,
): string | null {
  const xSlug = headers['x-tenant-slug'];
  if (typeof xSlug === 'string' && isValidSlug(xSlug)) {
    return xSlug;
  }
  const hostHeader = headers['host'];
  const host = (Array.isArray(hostHeader) ? (hostHeader[0] ?? '') : hostHeader) ?? '';
  const fromHost = extractTenantSlug(host);
  if (fromHost) {
    return fromHost;
  }
  const qSlug = query?.['tenant'];
  const qVal = Array.isArray(qSlug) ? qSlug[0] : qSlug;
  return typeof qVal === 'string' && isValidSlug(qVal) ? qVal : null;
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

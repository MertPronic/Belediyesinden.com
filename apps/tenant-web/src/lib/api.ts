import { getToken } from './keycloak';

// Client-side (browser): NEXT_PUBLIC_API_URL (host erişimi, build-time inline).
export const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3000/api';
// Server-side (SSR, container içi): API_INTERNAL_URL (compose service adı, runtime).
// Tanımsızsa client URL'ine fallback (tek-host dev).
const SERVER_API_URL = process.env['API_INTERNAL_URL'] ?? API_URL;

/**
 * API hata gövdesini ({statusCode, error, message, ...} — bkz. AllExceptionsFilter)
 * kullanıcıya gösterilecek tek satır temiz mesaja indirger. `message` class-validator
 * doğrulama hatalarında dizi olabilir (alan başına bir mesaj).
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
    // Gövde JSON değilse (örn. proxy/ham HTML hata sayfası) aşağıdaki fallback kullanılır.
  }
  return `İstek başarısız (HTTP ${res.status})`;
}

/** Tenant slug (subdomain'den veya env). */
export function getTenantSlug(): string {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    const first = host.split('.')[0]?.toLowerCase();
    if (first && !['localhost', 'www', 'belediyesinden'].includes(first)) {
      return first;
    }
  }
  return process.env['NEXT_PUBLIC_TENANT_SLUG'] ?? 'talas';
}

/**
 * İlan kapak/galeri görseli URL'i — tarayıcı `<img>` isteği `x-tenant-slug` header'ı
 * taşıyamadığı için `?tenant=` query fallback kullanır (portal'daki `portalGorselUrl`
 * ile aynı desen). Server component'lerde `getTenantSlug()` çalışmadığından
 * (window yok) slug parametre olarak verilir.
 */
export function ilanGorselUrl(tenantSlug: string, gorselId: string): string {
  return `${API_URL}/ilan/gorsel/${gorselId}?tenant=${tenantSlug}`;
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
    throw new Error(await apiHataMesaji(res));
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
  if (!res.ok) throw new Error(await apiHataMesaji(res));
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const PERSONEL_ROLLERI = ['TENANT_ADMIN', 'ENCUMEN', 'SUPERADMIN'];

/** JWT payload'ını imza doğrulamadan çözer — yalnızca token'ı forward edip etmeme kararı için (backend zaten gerçek doğrulamayı yapar). */
function decodeJwtPayload(token: string): { realm_access?: { roles?: string[] }; tenant_groups?: string[] } | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const json = Buffer.from(payload, 'base64url').toString('utf-8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Tarayıcıda bu tenant için geçerli bir personel oturumu varsa (`kc_token`
 * httpOnly cookie, TAM OLARAK bu tenant'a ait ya da SUPERADMIN) token'ı döner;
 * aksi halde `null` (vatandaş/kimliksiz — sessizce, cross-tenant 403 riski yok).
 */
async function getPersonelToken(tenantSlug: string): Promise<string | null> {
  try {
    const { cookies } = await import('next/headers');
    const token = (await cookies()).get('kc_token')?.value;
    if (!token) return null;
    const payload = decodeJwtPayload(token);
    const roller = payload?.realm_access?.roles ?? [];
    const isPersonel = roller.some((r) => PERSONEL_ROLLERI.includes(r));
    const isSuperadmin = roller.includes('SUPERADMIN');
    const tenantGroup = (payload?.tenant_groups ?? []).find((g) => g.startsWith('tenant_'));
    const tokenTenant = tenantGroup ? tenantGroup.slice('tenant_'.length) : null;
    return isPersonel && (isSuperadmin || tokenTenant === tenantSlug) ? token : null;
  } catch {
    return null;
  }
}

/**
 * Bu isteği yapan, bu tenant'ın personeli mi (TenantAdmin/Encümen/Superadmin)?
 * Vatandaş sayfalarında "personel önizleme modu" gösterip göstermeyeceğine
 * karar vermek için — örn. Teklif Ver/Favori gibi vatandaş eylemlerini gizlemek
 * (belediye kendi ilanına teklif vermez).
 */
export async function isPersonelViewer(tenantSlug: string): Promise<boolean> {
  return (await getPersonelToken(tenantSlug)) !== null;
}

/**
 * Server-side API fetch — vatandaş sayfaları için (public, çoğunlukla auth'suz).
 * Personel oturumu varsa token'ı forward eder — personel vatandaş sayfasında
 * ilan tarihi gelmemiş ilanları da önizleyebilir.
 */
export async function serverApiFetch<T>(
  path: string,
  tenantSlug: string,
): Promise<T> {
  const headers: Record<string, string> = { 'x-tenant-slug': tenantSlug };
  const token = await getPersonelToken(tenantSlug);
  if (token) {
    headers['authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${SERVER_API_URL}${path}`, { headers, cache: 'no-store' });
  if (!res.ok) throw new Error(await apiHataMesaji(res));
  return res.json() as Promise<T>;
}


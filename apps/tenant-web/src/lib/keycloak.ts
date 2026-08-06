'use client';
import Keycloak from 'keycloak-js';

const REALM = process.env['NEXT_PUBLIC_KEYCLOAK_REALM'] ?? 'belediyesinden';
const CLIENT_ID = process.env['NEXT_PUBLIC_KEYCLOAK_CLIENT_ID'] ?? 'tenant-web';
const URL = process.env['NEXT_PUBLIC_KEYCLOAK_URL'] ?? 'http://localhost:8080';

let kc: Keycloak | null = null;
let initPromise: Promise<Keycloak> | null = null;

/** Singleton Keycloak instance (client-side PKCE flow). */
export function getKeycloak(): Keycloak {
  if (!kc) {
    kc = new Keycloak({ url: URL, realm: REALM, clientId: CLIENT_ID });
  }
  return kc;
}

/**
 * Keycloak adapter'ı tek seferde başlat (check-sso). Aynı promise paylaşılır
 * (React StrictMode çift-mount ve birden çok component güvenli).
 */
export function initKeycloak(): Promise<Keycloak> {
  if (!initPromise) {
    initPromise = getKeycloak().init({
      onLoad: 'check-sso',
      pkceMethod: 'S256',
      checkLoginIframe: false,
    }).then(() => getKeycloak());
  }
  return initPromise;
}

/** Kimliği doğrulanmamışsa login'e yönlendir. */
export async function ensureAuth(): Promise<Keycloak> {
  const k = await initKeycloak();
  if (!k.authenticated) {
    // prompt:'login' — tarayıcıda başka bir kullanıcının SSO oturumu kalmış olsa bile
    // sessizce ona bağlanmasın, her zaman gerçek bir kimlik doğrulama ekranı göstersin.
    await k.login({ redirectUri: window.location.href, prompt: 'login' });
  }
  return k;
}

/** Token gerekirse yenile (5dk eşiği ile). */
export async function getToken(): Promise<string | undefined> {
  const k = await initKeycloak();
  if (k.authenticated) {
    await k.updateToken(30);
    return k.token;
  }
  return undefined;
}

/** Çıkış. */
export async function logout(): Promise<void> {
  const k = getKeycloak();
  await k.logout({ redirectUri: window.location.origin });
}

/**
 * JWT'den çözülen kullanıcı bilgisi (sub, roller, tenantId).
 * tenantId `tenant_<slug>` grup üyeliğinden türetilir (bkz. backend `extractUser`,
 * libs/auth/token-extractor.ts) — ham `tenant_id` claim'i Keycloak'ta hiç set edilmiyor.
 */
export function getUserInfo() {
  const k = getKeycloak();
  const t = k.tokenParsed;
  if (!t) return null;
  const groups = ((t['tenant_groups'] as string[]) ?? (t['groups'] as string[]) ?? []) as string[];
  const tenantGroup = groups.find((g) => g.startsWith('tenant_'));
  return {
    sub: t['sub'] as string,
    ad: (t['preferred_username'] as string) ?? (t['name'] as string) ?? t['sub'],
    roller: ((t['realm_access']?.roles as string[]) ?? []) as string[],
    tenantId: tenantGroup ? tenantGroup.slice('tenant_'.length) : ((t['tenant_id'] as string) ?? null),
  };
}

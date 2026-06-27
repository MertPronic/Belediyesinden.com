'use client';
import Keycloak from 'keycloak-js';

const REALM = process.env['NEXT_PUBLIC_KEYCLOAK_REALM'] ?? 'belediyesinden';
const CLIENT_ID = process.env['NEXT_PUBLIC_KEYCLOAK_CLIENT_ID'] ?? 'tenant-web';
const URL = process.env['NEXT_PUBLIC_KEYCLOAK_URL'] ?? 'http://localhost:8080';

let kc: Keycloak | null = null;

/** Singleton Keycloak instance (client-side PKCE flow). */
export function getKeycloak(): Keycloak {
  if (!kc) {
    kc = new Keycloak({ url: URL, realm: REALM, clientId: CLIENT_ID });
  }
  return kc;
}

/** Auth state hook (client component). */
export async function ensureAuth(): Promise<Keycloak> {
  const k = getKeycloak();
  await k.init({ onLoad: 'check-sso', pkceMethod: 'S256', checkLoginIframe: false });
  if (!k.authenticated) {
    await k.login();
  }
  return k;
}

/** Token (Bearer) for API calls. */
export function getToken(): string | undefined {
  const k = getKeycloak();
  return k.token;
}

/** Logout. */
export async function logout(): Promise<void> {
  const k = getKeycloak();
  await k.logout({ redirectUri: window.location.origin });
}

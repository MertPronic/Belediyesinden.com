'use client';
import { useEffect, useState } from 'react';
import { initKeycloak, getKeycloak, logout as kcLogout, getUserInfo } from './keycloak';

export interface AuthState {
  ready: boolean;
  authenticated: boolean;
  user: ReturnType<typeof getUserInfo>;
}

/** Token'ı httpOnly cookie'ya yaz (server component SSR auth için). */
async function syncServerCookie(): Promise<void> {
  try {
    const token = await getKeycloak().updateToken(30).then(() => getKeycloak().token);
    if (token) {
      await fetch('/api/auth/token', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token }),
      });
    }
  } catch {
    /* cookie bridge hatası — client auth yine çalışır */
  }
}

/** Keycloak auth durumunu izleyen hook (init + durum + SSR cookie sync). */
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    ready: false,
    authenticated: false,
    user: null,
  });

  useEffect(() => {
    let active = true;
    let cookieInterval: ReturnType<typeof setInterval> | null = null;
    initKeycloak()
      .then(async (k) => {
        if (!active) return;
        setState({ ready: true, authenticated: !!k.authenticated, user: getUserInfo() });
        if (k.authenticated) {
          await syncServerCookie();
          cookieInterval = setInterval(() => syncServerCookie(), 5 * 60 * 1000);
        }
      })
      .catch(() => {
        if (active) setState({ ready: true, authenticated: false, user: null });
      });
    return () => {
      active = false;
      if (cookieInterval) clearInterval(cookieInterval);
    };
  }, []);

  return state;
}

/** Kullanıcıyı giriş yapmaya yönlendir (check-sso sonrası). */
export function login() {
  getKeycloak().login({ redirectUri: window.location.href });
}

/** Çıkış yap (cookie temizle + Keycloak logout). */
export async function logout(): Promise<void> {
  await fetch('/api/auth/token', { method: 'DELETE' }).catch(() => {});
  return kcLogout();
}


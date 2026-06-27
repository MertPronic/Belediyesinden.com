'use client';
import { useEffect, useState } from 'react';
import { initKeycloak, getKeycloak, logout as kcLogout, getUserInfo } from './keycloak';

export interface AuthState {
  ready: boolean;
  authenticated: boolean;
  user: ReturnType<typeof getUserInfo>;
}

/** Keycloak auth durumunu izleyen hook (init + durum). */
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    ready: false,
    authenticated: false,
    user: null,
  });

  useEffect(() => {
    let active = true;
    initKeycloak()
      .then((k) => {
        if (!active) return;
        setState({ ready: true, authenticated: !!k.authenticated, user: getUserInfo() });
      })
      .catch(() => {
        if (active) setState({ ready: true, authenticated: false, user: null });
      });
    return () => {
      active = false;
    };
  }, []);

  return state;
}

/** Kullanıcıyı giriş yapmaya yönlendir (check-sso sonrası). */
export function login() {
  getKeycloak().login({ redirectUri: window.location.href });
}

/** Çıkış yap. */
export function logout() {
  return kcLogout();
}

'use client';
import { useEffect, useState } from 'react';
import { initKeycloak, getUserInfo } from '@belediyesinden/auth-client';

export interface PortalAuthState {
  ready: boolean;
  authenticated: boolean;
  user: ReturnType<typeof getUserInfo>;
}

/**
 * Portal'ın kendi Keycloak auth hook'u — tenant-web'deki `useAuth`'un sadeleştirilmiş
 * hali. Portal'ın SSR korumalı bir sayfası yok (tamamen public), o yüzden tenant-web'in
 * httpOnly cookie senkronu (`syncServerCookie`) burada gerekmiyor — sadece client-side
 * durum (giriş butonu ↔ kullanıcı adı) için.
 */
export function useAuth(): PortalAuthState {
  const [state, setState] = useState<PortalAuthState>({ ready: false, authenticated: false, user: null });

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

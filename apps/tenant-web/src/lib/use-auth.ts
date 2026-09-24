'use client';
import { useEffect, useState } from 'react';
import { initKeycloak, getKeycloak, loginPopup, logout as kcLogout, getUserInfo } from './keycloak';

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
  loginTo(window.location.href);
}

/**
 * Belirli bir hedefe dönecek şekilde giriş yapmaya yönlendir. Korumalı bir CTA'ya
 * (Başvur/Teklif Ver) tıklandığında önce ara "giriş yapmanız gerekiyor" ekranına
 * uğramadan doğrudan login açılsın, sonrasında kullanıcı doğrudan hedef sayfaya
 * dönsün diye (Harun bey/PO geri bildirimi, 2026-08-21 — gereksiz ara adımı ve
 * tarayıcı geçmişindeki ekstra hop'u kaldırır). Giriş ekranı ayrı bir sayfaya
 * geçmeden, pop-up pencerede açılır (Harun/PO, 2026-09-22).
 */
export function loginTo(redirectUri: string) {
  loginPopup(redirectUri);
}

/** Çıkış yap (cookie temizle + Keycloak logout). */
export async function logout(): Promise<void> {
  await fetch('/api/auth/token', { method: 'DELETE' }).catch(() => {});
  return kcLogout();
}

const ADMIN_ROLLER = ['TENANT_ADMIN', 'ENCUMEN', 'SUPERADMIN'];

/**
 * Kullanıcı bu tenant'ın (bulunduğu belediyenin) admin/encümen personeli mi?
 * Başka bir belediyenin admini bu sitede gezinirken sıradan vatandaş gibi
 * görünsün diye tenant uyuşmazlığı da kontrol edilir (KK-24 civarı davranış).
 */
export function kullaniciAdminMi(user: AuthState['user'], tenantSlug: string): boolean {
  if (!user) return false;
  const isSuperadmin = user.roller?.includes('SUPERADMIN');
  const tenantMismatch = !isSuperadmin && !!user.tenantId && user.tenantId !== tenantSlug;
  return !!user.roller?.some((r) => ADMIN_ROLLER.includes(r)) && !tenantMismatch;
}

/**
 * Kullanıcı personel ama BAŞKA bir belediyeye ait mi? Öyleyse kendi belediyesinin
 * slug'ını döner (yoksa `null`) — SUPERADMIN her zaman muaf. `useAuth()`'ın canlı
 * durumundan türetilir (Harun/PO, 2026-09-24) — sunucu tarafında cookie'den okuyan
 * ilk sürüm sayfa geçişlerinde tutarsız davranıyordu (Next.js router cache/zamanlama).
 */
export function digerTenantPersoneliMi(user: AuthState['user'], tenantSlug: string): string | null {
  if (!user) return null;
  if (user.roller?.includes('SUPERADMIN')) return null;
  const isPersonel = user.roller?.some((r) => ADMIN_ROLLER.includes(r));
  if (!isPersonel || !user.tenantId || user.tenantId === tenantSlug) return null;
  return user.tenantId;
}


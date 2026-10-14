'use client';
import { useEffect } from 'react';
import { LogIn, LogOut } from 'lucide-react';
import { loginPopup, logout as kcLogout, getUserInfo } from '@belediyesinden/auth-client';
import { useAuth } from '../lib/use-auth';
import { tenantUrl, tenantWebUrl } from '../lib/api';

const TENANT_OPS_ROLLER = ['TENANT_ADMIN', 'ENCUMEN'];
/** Pop-up'tan dönüşte URL'e eklenen işaret — sadece BU akıştan gelen girişte yönlendir. */
const GIRIS_TAMAMLANDI_PARAM = 'girisTamam';

type KullaniciBilgisi = NonNullable<ReturnType<typeof getUserInfo>>;

/**
 * Rol bazlı giriş-sonrası hedef:
 * - SÜPER ADMIN → tenant-web'in nötr (hiçbir belediye teması olmayan) admin paneli.
 * - TENANT_ADMIN/ENCÜMEN → kendi belediyesinin admin paneli.
 * - Vatandaş/yatırımcı → null (portalda kalır — Harun/PO, 2026-09-26).
 */
function girisSonrasiHedef(user: KullaniciBilgisi): string | null {
  if (user.roller.includes('SUPERADMIN')) return tenantWebUrl('/admin');
  if (user.roller.some((r) => TENANT_OPS_ROLLER.includes(r)) && user.tenantId) {
    return tenantUrl(user.tenantId, '/admin');
  }
  return null;
}

/** Portal header'ındaki giriş/çıkış durumu — "Tüm İlanlar" linkinin yerini alır. */
export function GirisDurumu() {
  const { ready, authenticated, user } = useAuth();

  useEffect(() => {
    if (!ready || !authenticated || !user) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get(GIRIS_TAMAMLANDI_PARAM) !== '1') return;
    url.searchParams.delete(GIRIS_TAMAMLANDI_PARAM);
    window.history.replaceState({}, '', url.toString());
    const hedef = girisSonrasiHedef(user);
    if (hedef) window.location.assign(hedef);
  }, [ready, authenticated, user]);

  function girisYap() {
    const url = new URL(window.location.href);
    url.searchParams.set(GIRIS_TAMAMLANDI_PARAM, '1');
    loginPopup(url.pathname + url.search);
  }

  if (!ready) {
    return <span className="inline-block h-8 w-16" />;
  }

  if (authenticated && user) {
    return (
      <div className="flex items-center gap-1.5 text-sm">
        <span className="hidden font-medium text-gray-700 sm:inline">{user.ad}</span>
        <button
          type="button"
          onClick={() => kcLogout()}
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
        >
          <LogOut className="h-4 w-4" />
          Çıkış
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={girisYap}
      className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
    >
      <LogIn className="h-4 w-4" />
      Giriş
    </button>
  );
}

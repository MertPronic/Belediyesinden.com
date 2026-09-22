'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Check } from 'lucide-react';
import { apiFetch } from '../lib/api';

export interface BildirimItem {
  id: string;
  tip: string;
  baslik: string;
  mesaj: string | null;
  link: string | null;
  okundu: boolean;
  created_at: string;
}

const POLL_MS = 30_000;

/**
 * Header'daki bildirim zili — hem vatandaş hem personel için ortak (kök layout
 * her rotayı sarmaladığından /admin/* dahil her yerde görünür, bkz. plan notu).
 * Sadece `authenticated` dalında (UserMenu içinde) render edilir.
 */
export function BildirimZili() {
  const router = useRouter();
  const [sayac, setSayac] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<BildirimItem[] | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    function sayaciGetir() {
      apiFetch<{ adet: number }>('/bildirim/sayac')
        .then((r) => {
          if (active) setSayac(r.adet);
        })
        .catch(() => {});
    }
    sayaciGetir();
    const interval = setInterval(sayaciGetir, POLL_MS);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    function disariTiklama(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', disariTiklama);
    return () => document.removeEventListener('mousedown', disariTiklama);
  }, []);

  function ac() {
    const yeniAcik = !open;
    setOpen(yeniAcik);
    if (yeniAcik && items === null) {
      setYukleniyor(true);
      apiFetch<BildirimItem[]>('/bildirim?pageSize=20')
        .then(setItems)
        .catch(() => setItems([]))
        .finally(() => setYukleniyor(false));
    }
  }

  function tikla(item: BildirimItem) {
    if (!item.okundu) {
      apiFetch(`/bildirim/${item.id}/okundu`, { method: 'POST' }).catch(() => {});
      setItems((prev) => prev?.map((b) => (b.id === item.id ? { ...b, okundu: true } : b)) ?? prev);
      setSayac((n) => Math.max(0, n - 1));
    }
    setOpen(false);
    if (item.link) router.push(item.link);
  }

  function hepsiniOkunduIsaretle() {
    apiFetch('/bildirim/okundu-hepsi', { method: 'POST' }).catch(() => {});
    setItems((prev) => prev?.map((b) => ({ ...b, okundu: true })) ?? prev);
    setSayac(0);
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={ac}
        aria-label="Bildirimler"
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
      >
        <Bell className="h-5 w-5" />
        {sayac > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white">
            {sayac > 9 ? '9+' : sayac}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
            <span className="text-sm font-semibold text-gray-900">Bildirimler</span>
            {items && items.some((b) => !b.okundu) && (
              <button
                type="button"
                onClick={hepsiniOkunduIsaretle}
                className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-900"
              >
                <Check className="h-3.5 w-3.5" />
                Tümünü okundu işaretle
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {yukleniyor ? (
              <div className="space-y-2 p-4">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-14 animate-pulse rounded-lg bg-gray-100" />
                ))}
              </div>
            ) : !items || items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gray-400">Henüz bildiriminiz yok.</p>
            ) : (
              items.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => tikla(b)}
                  className={`flex w-full items-start gap-2 border-b border-gray-50 px-4 py-3 text-left text-sm transition-colors last:border-0 hover:bg-gray-50 ${
                    b.okundu ? '' : 'bg-blue-50/40'
                  }`}
                >
                  <span
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: b.okundu ? 'transparent' : 'var(--renk)' }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-gray-900">{b.baslik}</span>
                    {b.mesaj && <span className="mt-0.5 block text-xs text-gray-500">{b.mesaj}</span>}
                    <span className="mt-1 block text-[11px] text-gray-400">
                      {new Date(b.created_at).toLocaleString('tr-TR')}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

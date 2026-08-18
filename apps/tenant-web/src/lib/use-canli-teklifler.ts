'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch, getTenantSlug } from './api';
import { getToken } from './keycloak';

const WS_URL = process.env['NEXT_PUBLIC_WS_URL'] ?? 'ws://localhost:3000/ws';

export interface Teklif {
  id: string;
  kullanici_id: string;
  kullanici_ad?: string | null;
  tutar: string;
}

/**
 * Bir varlığın (kalemin) canlı teklif akışına abone olur (ilk yükleme + WS).
 * Hem vatandaşın teklif verme ekranı hem de adminin canlı izleme paneli aynı
 * hook'u kullanır — WS bağlantısı ve sıralama mantığı tek yerde. KK-25: birim
 * ilan değil varlık — bir ilandaki her varlığın kendi bağımsız ihalesi vardır.
 */
export function useCanliTeklifler(kalemId: string, aktif = true) {
  const [teklifler, setTeklifler] = useState<Teklif[]>([]);
  const [yeniTeklifIds, setYeniTeklifIds] = useState<Set<string>>(new Set());
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const markTeklifYeni = useCallback((id: string) => {
    setYeniTeklifIds((prev) => new Set(prev).add(id));
    setTimeout(() => {
      setYeniTeklifIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 900);
  }, []);

  useEffect(() => {
    if (!aktif) return;
    apiFetch<Teklif[]>(`/teklif/kalem/${kalemId}`).then(setTeklifler).catch(() => {});
  }, [kalemId, aktif]);

  useEffect(() => {
    if (!aktif) return;
    let closed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    const connect = async () => {
      const token = await getToken().catch(() => undefined);
      const params = new URLSearchParams({ tenant: getTenantSlug() });
      if (token) params.set('token', token);
      const ws = new WebSocket(`${WS_URL}?${params.toString()}`);
      wsRef.current = ws;
      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        if (!closed) reconnectTimer = setTimeout(connect, 2000);
      };
      ws.onerror = () => ws.close();
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data as string);
          if (msg.event === 'teklif' && msg.kalemId === kalemId) {
            const t: Teklif = msg.teklif;
            setTeklifler((prev) => {
              if (prev.some((p) => p.id === t.id)) return prev;
              markTeklifYeni(t.id);
              return [...prev, t].sort((a, b) => Number(b.tutar) - Number(a.tutar));
            });
          }
        } catch {
          /* yoksay */
        }
      };
    };
    connect();
    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [kalemId, markTeklifYeni, aktif]);

  return { teklifler, yeniTeklifIds, connected };
}

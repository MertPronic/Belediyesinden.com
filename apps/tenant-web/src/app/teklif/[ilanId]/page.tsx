'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { RequireAuth } from '../../../components/require-auth';
import { apiFetch } from '../../../lib/api';
import { Card, CardContent, CardHeader, CardTitle, DurumBadge } from '@belediyesinden/ui';

const WS_URL = process.env['NEXT_PUBLIC_WS_URL'] ?? 'ws://localhost:3000/ws';

interface Ilan {
  id: string;
  baslik: string;
  ihale_tipi: string;
  durum: string;
  baslangic_fiyati: string;
  bitis_tarihi: string | null;
  kurallar: { minArtirmaAdimi?: number } | null;
}

interface Teklif {
  id: string;
  kullanici_id: string;
  tutar: string;
}

function fmt(tl: number): string {
  return tl.toLocaleString('tr-TR');
}

function useCountdown(bitis: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!bitis) return null;
  const ms = new Date(bitis).getTime() - now;
  if (ms <= 0) return 'Sona erdi';
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${d > 0 ? d + 'g ' : ''}${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function TeklifEkrani({ ilanId }: { ilanId: string }) {
  const [ilan, setIlan] = useState<Ilan | null>(null);
  const [teklifler, setTeklifler] = useState<Teklif[]>([]);
  const [connected, setConnected] = useState(false);
  const [bid, setBid] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const minAdim = Number(ilan?.kurallar?.minArtirmaAdimi ?? 0) || 0;

  // İlan + ilk teklifler.
  useEffect(() => {
    apiFetch<Ilan>(`/ilan/${ilanId}`).then(setIlan).catch(() => setError('İlan yüklenemedi.'));
    apiFetch<Teklif[]>(`/teklif/ilan/${ilanId}`).then(setTeklifler).catch(() => {});
  }, [ilanId]);

  // WebSocket: canlı teklif akışı (yeniden bağlanma ile).
  useEffect(() => {
    let closed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      const ws = new WebSocket(WS_URL);
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
          if (msg.event === 'teklif' && msg.ilanId === ilanId) {
            const t: Teklif = msg.teklif;
            setTeklifler((prev) => {
              if (prev.some((p) => p.id === t.id)) return prev;
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
  }, [ilanId]);

  const enYuksek = useMemo(
    () => (teklifler.length ? Number(teklifler[0].tutar) : Number(ilan?.baslangic_fiyati ?? 0)),
    [teklifler, ilan],
  );
  const minTeklif = enYuksek + minAdim;
  const canBid = ilan?.durum === 'YAYINDA' || ilan?.durum === 'CANLI_ARTIRMA';
  const kalanSure = useCountdown(ilan?.bitis_tarihi ?? null);

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const tutar = Number(bid);
      if (!Number.isFinite(tutar) || tutar <= 0) {
        setError('Geçerli bir tutar girin.');
        return;
      }
      if (tutar < minTeklif) {
        setError(`Minimum teklif ${fmt(minTeklif)} ₺ olmalıdır.`);
        return;
      }
      setSubmitting(true);
      setError(null);
      try {
        await apiFetch(`/teklif/ilan/${ilanId}`, {
          method: 'POST',
          body: JSON.stringify({ tutar }),
        });
        setBid('');
        setFlash('Teklifiniz alındı!');
        if (flashTimer.current) clearTimeout(flashTimer.current);
        flashTimer.current = setTimeout(() => setFlash(null), 3000);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Teklif başarısız.');
      } finally {
        setSubmitting(false);
      }
    },
    [bid, minTeklif, ilanId],
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href={`/ilanlar/${ilanId}`} className="text-sm text-gray-500 hover:text-gray-800">
        ← İlana dön
      </Link>

      {ilan && (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-2xl">{ilan.baslik}</CardTitle>
                <p className="mt-1 text-sm text-gray-500">{ilan.ihale_tipi}</p>
              </div>
              <DurumBadge durum={ilan.durum} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-500">En Yüksek Teklif</p>
                <p className="text-xl font-bold" style={{ color: 'var(--renk)' }}>
                  {fmt(enYuksek)} ₺
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-500">Min. Artırma</p>
                <p className="text-xl font-bold">{fmt(minAdim)} ₺</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-500">Kalan Süre</p>
                <p className="text-xl font-bold">{kalanSure ?? '—'}</p>
              </div>
            </div>

            <p className="mt-3 flex items-center gap-2 text-xs text-gray-500">
              <span
                className={`inline-block h-2 w-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-400'}`}
              />
              {connected ? 'Canlı bağlantı aktif' : 'Bağlanıyor...'}
            </p>
          </CardContent>
        </Card>
      )}

      {canBid ? (
        <Card>
          <CardHeader>
            <CardTitle>Teklif Ver</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-sm text-gray-600">
                  Teklifiniz (min {fmt(minTeklif)} ₺)
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={bid}
                  onChange={(e) => setBid(e.target.value)}
                  placeholder={String(minTeklif)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>
              <button
                type="button"
                onClick={() => setBid(String(minTeklif))}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                Min. teklif
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg px-6 py-2 text-white disabled:opacity-50"
                style={{ background: 'var(--renk)' }}
              >
                {submitting ? 'Gönderiliyor...' : 'Teklif Ver'}
              </button>
            </form>
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
            {flash && <p className="mt-3 text-sm text-green-600">{flash}</p>}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-6 text-center text-gray-600">
            Bu ihale şu anda teklif almıyor ({ilan?.durum}).
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Teklif Geçmişi ({teklifler.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {teklifler.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">Henüz teklif yok.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="py-2">Sıra</th>
                  <th>Tutar</th>
                </tr>
              </thead>
              <tbody>
                {teklifler.map((t, i) => (
                  <tr key={t.id} className="border-b">
                    <td className="py-2">{i + 1}</td>
                    <td className={i === 0 ? 'font-bold' : ''} style={i === 0 ? { color: 'var(--renk)' } : undefined}>
                      {fmt(Number(t.tutar))} ₺
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function TeklifPage() {
  const params = useParams<{ ilanId: string }>();
  return (
    <RequireAuth>
      <TeklifEkrani ilanId={params.ilanId} />
    </RequireAuth>
  );
}

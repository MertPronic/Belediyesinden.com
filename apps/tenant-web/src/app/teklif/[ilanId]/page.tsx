'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Clock, Gavel, Minus, TrendingUp, Trophy } from 'lucide-react';
import { RequireAuth } from '../../../components/require-auth';
import { apiFetch } from '../../../lib/api';
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DurumBadge,
  EmptyState,
  Input,
} from '@belediyesinden/ui';

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

function StatCell({
  icon: Icon,
  label,
  value,
  highlight,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-xl bg-gray-50 p-3 text-center">
      <Icon className="mx-auto mb-1 h-4 w-4 text-gray-400" />
      <p className="text-xs text-gray-500">{label}</p>
      <p
        className={`mt-0.5 text-lg font-bold ${highlight ? '' : 'text-gray-900'}`}
        style={highlight ? { color: 'var(--renk)' } : undefined}
      >
        {value}
      </p>
    </div>
  );
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

  useEffect(() => {
    apiFetch<Ilan>(`/ilan/${ilanId}`).then(setIlan).catch(() => setError('İlan yüklenemedi.'));
    apiFetch<Teklif[]>(`/teklif/ilan/${ilanId}`).then(setTeklifler).catch(() => {});
  }, [ilanId]);

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
      <Link
        href={`/ilanlar/${ilanId}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        İlana dön
      </Link>

      {ilan && (
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-2xl">{ilan.baslik}</CardTitle>
                <p className="mt-1 text-sm text-gray-500">{ilan.ihale_tipi}</p>
              </div>
              <DurumBadge durum={ilan.durum} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <StatCell icon={TrendingUp} label="En Yüksek Teklif" value={`${fmt(enYuksek)} ₺`} highlight />
              <StatCell icon={Minus} label="Min. Artırma" value={`${fmt(minAdim)} ₺`} />
              <StatCell icon={Clock} label="Kalan Süre" value={kalanSure ?? '—'} />
            </div>

            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span
                className={`inline-block h-2 w-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-400'}`}
              />
              {connected ? 'Canlı bağlantı aktif' : 'Bağlanıyor...'}
            </div>
          </CardContent>
        </Card>
      )}

      {canBid ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Gavel className="h-4 w-4" style={{ color: 'var(--renk)' }} />
              Teklif Ver
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">
                  Teklifiniz (min {fmt(minTeklif)} ₺)
                </label>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={bid}
                  onChange={(e) => setBid(e.target.value)}
                  placeholder={String(minTeklif)}
                />
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setBid(String(minTeklif))}>
                  Min. teklif
                </Button>
                <Button type="submit" loading={submitting} leftIcon={<Gavel />} className="flex-1">
                  Teklif Ver
                </Button>
              </div>
              {error && <Alert variant="error">{error}</Alert>}
              {flash && <Alert variant="success">{flash}</Alert>}
            </form>
          </CardContent>
        </Card>
      ) : (
        <Alert variant="info">Bu ihale şu anda teklif almıyor ({ilan?.durum}).</Alert>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-4 w-4 text-gray-400" />
            Teklif Geçmişi ({teklifler.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {teklifler.length === 0 ? (
            <EmptyState icon={<Gavel />} title="Henüz teklif yok" description="İlk teklifi veren siz olun." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <th className="h-11 px-4">Sıra</th>
                    <th className="px-4">Tutar</th>
                  </tr>
                </thead>
                <tbody>
                  {teklifler.map((t, i) => (
                    <tr key={t.id} className="border-b border-gray-100 hover:bg-gray-50/60">
                      <td className="h-12 px-4 text-gray-500">{i + 1}</td>
                      <td className="px-4 font-semibold" style={i === 0 ? { color: 'var(--renk)' } : undefined}>
                        {fmt(Number(t.tutar))} ₺ {i === 0 && <span className="ml-1 text-xs text-gray-400">(önde)</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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

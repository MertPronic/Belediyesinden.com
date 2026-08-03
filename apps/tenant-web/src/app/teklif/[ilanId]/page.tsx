'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Clock, Crown, Gavel, Minus, TrendingUp, Trophy } from 'lucide-react';
import { RequireAuth } from '../../../components/require-auth';
import { apiFetch, getTenantSlug } from '../../../lib/api';
import { getToken } from '../../../lib/keycloak';
import { useAuth } from '../../../lib/use-auth';
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DurumBadge,
  dummyGorseller,
  EmptyState,
  Input,
} from '@belediyesinden/ui';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3000/api';
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
  kullanici_ad?: string | null;
  tutar: string;
}

const TIP_LABEL: Record<string, string> = {
  ACIK_ARTIRMA: 'Açık Artırma',
  ACIK_TEKLIF: 'Açık Teklif',
  KAPALI_TEKLIF: 'Kapalı Teklif',
};

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
  pulse,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  highlight?: boolean;
  pulse?: boolean;
}) {
  return (
    <div className={`rounded-xl bg-gray-50 p-3 text-center transition-transform ${pulse ? 'scale-105' : ''}`}>
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
  const { user } = useAuth();
  const [ilan, setIlan] = useState<Ilan | null>(null);
  const [kapakGorsel, setKapakGorsel] = useState<string | null>(null);
  const [teklifler, setTeklifler] = useState<Teklif[]>([]);
  const [yeniTeklifIds, setYeniTeklifIds] = useState<Set<string>>(new Set());
  const [enYuksekPulse, setEnYuksekPulse] = useState(false);
  const [connected, setConnected] = useState(false);
  const [bid, setBid] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enYuksekOnceki = useRef<number | null>(null);

  const minAdim = Number(ilan?.kurallar?.minArtirmaAdimi ?? 0) || 0;

  useEffect(() => {
    apiFetch<Ilan>(`/ilan/${ilanId}`).then(setIlan).catch(() => setError('İlan yüklenemedi.'));
    apiFetch<Teklif[]>(`/teklif/ilan/${ilanId}`).then(setTeklifler).catch(() => {});
    apiFetch<{ id: string }[]>(`/ilan/${ilanId}/gorsel`)
      .then((rows) => {
        const slug = getTenantSlug();
        setKapakGorsel(rows.length > 0 ? `${API_URL}/ilan/gorsel/${rows[0].id}?tenant=${slug}` : dummyGorseller(ilanId, 1)[0]);
      })
      .catch(() => setKapakGorsel(dummyGorseller(ilanId, 1)[0]));
  }, [ilanId]);

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
          if (msg.event === 'teklif' && msg.ilanId === ilanId) {
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
  }, [ilanId, markTeklifYeni]);

  const enYuksek = useMemo(
    () => (teklifler.length ? Number(teklifler[0].tutar) : Number(ilan?.baslangic_fiyati ?? 0)),
    [teklifler, ilan],
  );

  useEffect(() => {
    if (enYuksekOnceki.current !== null && enYuksekOnceki.current !== enYuksek) {
      setEnYuksekPulse(true);
      const t = setTimeout(() => setEnYuksekPulse(false), 500);
      return () => clearTimeout(t);
    }
    enYuksekOnceki.current = enYuksek;
    return undefined;
  }, [enYuksek]);

  const minTeklif = enYuksek + minAdim;
  const canBid = ilan?.durum === 'CANLI_ARTIRMA';
  const kalanSure = useCountdown(ilan?.bitis_tarihi ?? null);
  const kazaniyorMu = teklifler.length > 0 && !!user && teklifler[0].kullanici_id === user.sub;

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
        setBid(String(minTeklif));
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
        // Başka biri az önce daha yüksek teklif vermiş olabilir (eşzamanlı yarış) —
        // tekrar denemeyi kolaylaştırmak için input'u güncel minimuma dolduruyoruz.
        setError(err instanceof Error ? err.message : 'Teklif başarısız.');
        setBid(String(minTeklif));
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
        <Card className="overflow-hidden">
          <div className="relative h-40 w-full sm:h-48">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={kapakGorsel ?? ''} alt={ilan.baslik} className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
              <div className="min-w-0">
                <span className="inline-block rounded-md bg-white/90 px-2 py-0.5 text-xs font-medium text-gray-700">
                  {TIP_LABEL[ilan.ihale_tipi] ?? ilan.ihale_tipi}
                </span>
                <h1 className="mt-1.5 truncate text-xl font-bold text-white drop-shadow-sm">{ilan.baslik}</h1>
              </div>
              <DurumBadge durum={ilan.durum} />
            </div>
          </div>
          <CardContent className="space-y-4 pt-4">
            <div className="grid grid-cols-3 gap-3">
              <StatCell icon={TrendingUp} label="En Yüksek Teklif" value={`${fmt(enYuksek)} ₺`} highlight pulse={enYuksekPulse} />
              <StatCell icon={Minus} label="Min. Artırma" value={`${fmt(minAdim)} ₺`} />
              <StatCell icon={Clock} label="Kalan Süre" value={kalanSure ?? '—'} />
            </div>

            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span
                className={`inline-block h-2 w-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-400'} ${connected ? 'animate-pulse' : ''}`}
              />
              {connected ? 'Canlı bağlantı aktif' : 'Bağlanıyor...'}
            </div>
          </CardContent>
        </Card>
      )}

      {canBid && kazaniyorMu && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-400/90">
            <Crown className="h-4.5 w-4.5 text-amber-950" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-amber-900">Şu anda en yüksek teklif sizde!</p>
            <p className="text-xs text-amber-700">İhale şimdi sonuçlansa {fmt(enYuksek)} ₺ ile kazanırdınız.</p>
          </div>
        </div>
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
            <div className="max-h-96 overflow-y-auto overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-white">
                  <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <th className="h-11 px-4">Sıra</th>
                    {ilan?.ihale_tipi === 'ACIK_ARTIRMA' && <th className="px-4">Katılımcı</th>}
                    <th className="px-4">Tutar</th>
                  </tr>
                </thead>
                <tbody>
                  {teklifler.map((t, i) => {
                    const benim = !!user && t.kullanici_id === user.sub;
                    return (
                      <tr
                        key={t.id}
                        className={`border-b border-gray-100 hover:bg-gray-50/60 ${benim ? 'accent-soft-bg' : ''} ${yeniTeklifIds.has(t.id) ? 'bid-drop-in' : ''}`}
                      >
                        <td className="h-12 px-4 text-gray-500">{i + 1}</td>
                        {ilan?.ihale_tipi === 'ACIK_ARTIRMA' && (
                          <td className="px-4 text-gray-700">{t.kullanici_ad ?? 'Katılımcı'}</td>
                        )}
                        <td className="px-4 font-semibold" style={i === 0 ? { color: 'var(--renk)' } : undefined}>
                          {fmt(Number(t.tutar))} ₺ {i === 0 && <span className="ml-1 text-xs text-gray-400">(önde)</span>}
                          {benim && (
                            <span
                              className="ml-1.5 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
                              style={{ background: 'var(--renk)' }}
                            >
                              Siz
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
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

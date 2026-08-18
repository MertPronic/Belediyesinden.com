'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Clock, Gavel, Minus, TrendingUp, Trophy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, EmptyState } from '@belediyesinden/ui';
import type { Teklif } from '../lib/use-canli-teklifler';

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

export interface CanliTeklifGorunumuProps {
  teklifler: Teklif[];
  yeniTeklifIds: Set<string>;
  connected: boolean;
  baslangicFiyati: number;
  minArtirmaAdimi: number;
  bitisTarihi: string | null;
  ihaleTipi: string;
  /** Verilirse, bu kullanıcının teklif satırı "Siz" etiketiyle vurgulanır (vatandaş görünümü). Admin izlerken boş bırakılır. */
  currentUserId?: string;
}

/**
 * Bir ilanın canlı teklif durumunu gösterir (en yüksek teklif, geri sayım, teklif
 * geçmişi) — WS ile anlık güncellenir. Hem vatandaşın teklif verme ekranında hem
 * de adminin ilan yönetim sayfasında (salt-okunur, Sonuçlandır'ın yanında) kullanılır.
 */
export function CanliTeklifGorunumu({
  teklifler,
  yeniTeklifIds,
  connected,
  baslangicFiyati,
  minArtirmaAdimi,
  bitisTarihi,
  ihaleTipi,
  currentUserId,
}: CanliTeklifGorunumuProps) {
  const [enYuksekPulse, setEnYuksekPulse] = useState(false);
  const enYuksekOnceki = useRef<number | null>(null);
  const kalanSure = useCountdown(bitisTarihi);

  const enYuksek = useMemo(
    () => (teklifler.length ? Number(teklifler[0].tutar) : baslangicFiyati),
    [teklifler, baslangicFiyati],
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

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatCell icon={TrendingUp} label="En Yüksek Teklif" value={`${fmt(enYuksek)} ₺`} highlight pulse={enYuksekPulse} />
        <StatCell icon={Minus} label="Min. Artırma" value={`${fmt(minArtirmaAdimi)} ₺`} />
        <StatCell icon={Clock} label="Kalan Süre" value={kalanSure ?? '—'} />
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span
          className={`inline-block h-2 w-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-400'} ${connected ? 'animate-pulse' : ''}`}
        />
        {connected ? 'Canlı bağlantı aktif' : 'Bağlanıyor...'}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-4 w-4 text-gray-400" />
            Teklif Geçmişi ({teklifler.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {teklifler.length === 0 ? (
            <EmptyState icon={<Gavel />} title="Henüz teklif yok" description="Katılımcılar teklif vermeye başladığında burada görünecek." />
          ) : (
            <div className="max-h-96 overflow-y-auto overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-white">
                  <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <th className="h-11 px-4">Sıra</th>
                    {ihaleTipi === 'ACIK_ARTIRMA' && <th className="px-4">Katılımcı</th>}
                    <th className="px-4">Tutar</th>
                  </tr>
                </thead>
                <tbody>
                  {teklifler.map((t, i) => {
                    const benim = !!currentUserId && t.kullanici_id === currentUserId;
                    return (
                      <tr
                        key={t.id}
                        className={`border-b border-gray-100 hover:bg-gray-50/60 ${benim ? 'accent-soft-bg' : ''} ${yeniTeklifIds.has(t.id) ? 'bid-drop-in' : ''}`}
                      >
                        <td className="h-12 px-4 text-gray-500">{i + 1}</td>
                        {ihaleTipi === 'ACIK_ARTIRMA' && (
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

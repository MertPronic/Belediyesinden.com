'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CalendarClock, Gavel, Trophy } from 'lucide-react';
import { RequireAuth } from '../../components/require-auth';
import { useAuth } from '../../lib/use-auth';
import { apiFetch, getTenantSlug } from '../../lib/api';
import { Card, CardContent, DurumBadge, dummyGorseller, EmptyState, Skeleton } from '@belediyesinden/ui';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3000/api';

/** KK-25: birim artık ilan değil varlık (kalem) — her varlığın kendi bağımsız durumu var. */
interface IhalemItem {
  ilan_kalemi_id: string;
  ilan_id: string;
  ilan_baslik: string;
  varlik_ad: string;
  kalem_durum: string;
  ihale_tipi: string;
  baslangic_fiyati: string;
  baslangic_tarihi: string | null;
  bitis_tarihi: string | null;
  kazanan_kullanici_id: string | null;
  gorsel_id: string | null;
}

const TIP_LABEL: Record<string, string> = {
  ACIK_ARTIRMA: 'Açık Artırma',
  ACIK_TEKLIF: 'Açık Teklif',
  KAPALI_TEKLIF: 'Kapalı Teklif',
};

function fmt(tl: string): string {
  return Number(tl).toLocaleString('tr-TR');
}

function IhaleKarti({ h, kullaniciId }: { h: IhalemItem; kullaniciId?: string }) {
  const slug = getTenantSlug();
  const gorselUrl = h.gorsel_id
    ? `${API_URL}/ilan/gorsel/${h.gorsel_id}?tenant=${slug}`
    : dummyGorseller(h.ilan_kalemi_id, 1)[0];
  const canli = h.kalem_durum === 'CANLI_ARTIRMA';
  const yaklasan = h.kalem_durum === 'BEKLIYOR';
  const kazandi = h.kalem_durum === 'SONUCLANDI' && h.kazanan_kullanici_id === kullaniciId;
  const baslangic = h.baslangic_tarihi ? new Date(h.baslangic_tarihi) : null;

  return (
    <Link href={`/varliklar/${h.ilan_kalemi_id}`} className="block">
      <Card interactive className="overflow-hidden">
        <div className="flex flex-col sm:flex-row">
          <div className="relative h-36 shrink-0 overflow-hidden sm:h-auto sm:w-48">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={gorselUrl} alt={h.varlik_ad} className="h-full w-full object-cover" />
            {canli && (
              <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-white/95 px-2 py-1 text-[11px] font-semibold text-gray-900 shadow-sm">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
                CANLI
              </span>
            )}
            {kazandi && (
              <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-amber-400 px-2 py-1 text-[11px] font-bold text-amber-950 shadow-sm">
                <Trophy className="h-3 w-3" />
                Kazandınız
              </span>
            )}
          </div>

          <CardContent className="flex flex-1 items-center justify-between gap-4 p-5">
            <div className="min-w-0 space-y-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-400">
                {TIP_LABEL[h.ihale_tipi] ?? h.ihale_tipi}
              </span>
              <h3 className="truncate text-lg font-semibold text-gray-900">{h.varlik_ad}</h3>
              <p className="truncate text-xs text-gray-400">{h.ilan_baslik}</p>
              <div className="flex flex-wrap items-center gap-2">
                <DurumBadge durum={h.kalem_durum} />
                <span className="text-sm font-bold text-gray-900">{fmt(h.baslangic_fiyati)} ₺</span>
              </div>
              {yaklasan && baslangic && (
                <p className="flex items-center gap-1 text-xs text-gray-500">
                  <CalendarClock className="h-3.5 w-3.5" />
                  İhale {baslangic.toLocaleDateString('tr-TR')} tarihinde başlayacak
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {canli && (
                <span
                  className="hidden rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm sm:inline-flex sm:items-center sm:gap-1.5"
                  style={{ background: 'var(--renk)' }}
                >
                  <Gavel className="h-4 w-4" />
                  Teklif Ver
                </span>
              )}
              <ArrowRight className="h-4 w-4 text-gray-400" />
            </div>
          </CardContent>
        </div>
      </Card>
    </Link>
  );
}

function Bolum({ baslik, aciklama, items, kullaniciId }: { baslik: string; aciklama: string; items: IhalemItem[]; kullaniciId?: string }) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{baslik}</h2>
        <p className="text-xs text-gray-400">{aciklama}</p>
      </div>
      <div className="space-y-3">
        {items.map((h) => (
          <IhaleKarti key={h.ilan_kalemi_id} h={h} kullaniciId={kullaniciId} />
        ))}
      </div>
    </div>
  );
}

function IhalelerimIcerik() {
  const { user } = useAuth();
  const [ihaleler, setIhaleler] = useState<IhalemItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<IhalemItem[]>('/basvuru/ihalelerim')
      .then(setIhaleler)
      .catch(() => setIhaleler([]))
      .finally(() => setLoading(false));
  }, []);

  const { canli, yaklasan, gecmis } = useMemo(
    () => ({
      canli: ihaleler.filter((h) => h.kalem_durum === 'CANLI_ARTIRMA'),
      yaklasan: ihaleler.filter((h) => h.kalem_durum === 'BEKLIYOR'),
      gecmis: ihaleler.filter((h) => h.kalem_durum === 'SONUCLANDI' || h.kalem_durum === 'IPTAL'),
    }),
    [ihaleler],
  );

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">İhalelerim</h1>
        <p className="mt-1 text-sm text-gray-500">Onaylı başvurunuz olan varlıklar — süresi gelince buradan katılın.</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-36 w-full" />
          ))}
        </div>
      ) : ihaleler.length === 0 ? (
        <EmptyState
          icon={<Gavel />}
          title="Katılabileceğiniz bir ihale yok"
          description="Başvurunuz onaylanınca ihaleler burada listelenir."
        />
      ) : (
        <>
          <Bolum baslik="Şu An Canlı" aciklama="Teklif verebilirsiniz." items={canli} kullaniciId={user?.sub} />
          <Bolum baslik="Yaklaşan" aciklama="Başvurunuz onaylandı, ihale henüz başlamadı." items={yaklasan} kullaniciId={user?.sub} />
          <Bolum baslik="Geçmiş" aciklama="Sonuçlanmış veya iptal edilmiş ihaleler." items={gecmis} kullaniciId={user?.sub} />
        </>
      )}
    </div>
  );
}

export default function IhalelerimPage() {
  return (
    <RequireAuth>
      <IhalelerimIcerik />
    </RequireAuth>
  );
}

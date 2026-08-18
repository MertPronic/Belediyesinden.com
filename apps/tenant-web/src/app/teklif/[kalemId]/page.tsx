'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Crown, Gavel } from 'lucide-react';
import { RequireAuth } from '../../../components/require-auth';
import { CanliTeklifGorunumu } from '../../../components/canli-teklif-gorunumu';
import { apiFetch, getTenantSlug } from '../../../lib/api';
import { useAuth } from '../../../lib/use-auth';
import { useCanliTeklifler } from '../../../lib/use-canli-teklifler';
import { Alert, Button, Card, CardContent, CardHeader, CardTitle, DurumBadge, dummyGorseller, TutarInput } from '@belediyesinden/ui';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3000/api';

interface KalemBaglami {
  id: string;
  varlik_id: string;
  varlik_ad: string;
  ilan_baslik: string;
  ihale_tipi: string;
  durum: string;
  baslangic_fiyati: string;
  bitis_tarihi: string | null;
  kurallar: { minArtirmaAdimi?: number } | null;
}

const TIP_LABEL: Record<string, string> = {
  ACIK_ARTIRMA: 'Açık Artırma',
  ACIK_TEKLIF: 'Açık Teklif',
  KAPALI_TEKLIF: 'Kapalı Teklif',
};

function fmt(tl: number): string {
  return tl.toLocaleString('tr-TR');
}

function TeklifEkrani({ kalemId }: { kalemId: string }) {
  const { user } = useAuth();
  const [kalem, setKalem] = useState<KalemBaglami | null>(null);
  const [kapakGorsel, setKapakGorsel] = useState<string | null>(null);
  const [bid, setBid] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { teklifler, yeniTeklifIds, connected } = useCanliTeklifler(kalemId);

  const minAdim = Number(kalem?.kurallar?.minArtirmaAdimi ?? 0) || 0;

  useEffect(() => {
    apiFetch<KalemBaglami>(`/ilan/kalem/${kalemId}`).then(setKalem).catch(() => setError('Varlık yüklenemedi.'));
  }, [kalemId]);

  useEffect(() => {
    if (!kalem) return;
    apiFetch<{ id: string }[]>(`/varlik/${kalem.varlik_id}/gorsel`)
      .then((rows) => {
        const slug = getTenantSlug();
        setKapakGorsel(rows.length > 0 ? `${API_URL}/varlik/gorsel/${rows[0].id}?tenant=${slug}` : dummyGorseller(kalemId, 1)[0]);
      })
      .catch(() => setKapakGorsel(dummyGorseller(kalemId, 1)[0]));
  }, [kalem, kalemId]);

  const enYuksek = useMemo(
    () => (teklifler.length ? Number(teklifler[0].tutar) : Number(kalem?.baslangic_fiyati ?? 0)),
    [teklifler, kalem],
  );

  const minTeklif = enYuksek + minAdim;
  const canBid = kalem?.durum === 'CANLI_ARTIRMA';
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
        await apiFetch(`/teklif/kalem/${kalemId}`, {
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
    [bid, minTeklif, kalemId],
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href={`/varliklar/${kalemId}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Varlığa dön
      </Link>

      {kalem && (
        <Card className="overflow-hidden">
          <div className="relative h-40 w-full sm:h-48">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={kapakGorsel ?? ''} alt={kalem.varlik_ad} className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
              <div className="min-w-0">
                <span className="inline-block rounded-md bg-white/90 px-2 py-0.5 text-xs font-medium text-gray-700">
                  {TIP_LABEL[kalem.ihale_tipi] ?? kalem.ihale_tipi}
                </span>
                <h1 className="mt-1.5 truncate text-xl font-bold text-white drop-shadow-sm">{kalem.varlik_ad}</h1>
                <p className="truncate text-xs text-white/80">{kalem.ilan_baslik}</p>
              </div>
              <DurumBadge durum={kalem.durum} />
            </div>
          </div>
          <CardContent className="pt-4">
            <CanliTeklifGorunumu
              teklifler={teklifler}
              yeniTeklifIds={yeniTeklifIds}
              connected={connected}
              baslangicFiyati={Number(kalem.baslangic_fiyati)}
              minArtirmaAdimi={minAdim}
              bitisTarihi={kalem.bitis_tarihi}
              ihaleTipi={kalem.ihale_tipi}
              currentUserId={user?.sub}
            />
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
                <TutarInput value={bid} onChange={setBid} placeholder={fmt(minTeklif)} />
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
        <Alert variant="info">Bu varlığın ihalesi şu anda teklif almıyor ({kalem?.durum}).</Alert>
      )}
    </div>
  );
}

export default function TeklifPage() {
  const params = useParams<{ kalemId: string }>();
  return (
    <RequireAuth>
      <TeklifEkrani kalemId={params.kalemId} />
    </RequireAuth>
  );
}

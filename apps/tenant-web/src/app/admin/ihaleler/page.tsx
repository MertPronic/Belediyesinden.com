'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Gavel, Inbox } from 'lucide-react';
import { apiFetch } from '../../../lib/api';
import { RequireTenantAdmin } from '../../../components/require-tenant-admin';
import { Button, Card, CardContent, DurumBadge, EmptyState, Skeleton } from '@belediyesinden/ui';

interface IlanKalemiSatiri {
  id: string;
  ilan_id: string;
  ilan_baslik: string;
  varlik_ad: string;
  varlik_tip: string;
  bitis_tarihi: string | null;
  durum: string;
  kazanan_kullanici_id: string | null;
  kazanan_tutar: string | null;
}

interface SonucSayfasi {
  data: IlanKalemiSatiri[];
  total: number;
}

const SAYFA_BOYUTU = 20;

const VARLIK_TIP_LABEL: Record<string, string> = {
  TASINIR: 'Taşınır',
  TASINMAZ: 'Taşınmaz',
  ISLETME_HAKKI: 'İşletme Hakkı',
  REKLAM_ALANI: 'Reklam Alanı',
};

const SEKMELER = [
  { deger: 'gelecek' as const, label: 'Yaklaşan / Canlı' },
  { deger: 'gecmis' as const, label: 'Geçmiş' },
];

export default function AdminIhalelerPage() {
  return (
    <RequireTenantAdmin>
      <AdminIhalelerIcerik />
    </RequireTenantAdmin>
  );
}

function AdminIhalelerIcerik() {
  const [zaman, setZaman] = useState<'gelecek' | 'gecmis'>('gelecek');
  const [kalemler, setKalemler] = useState<IlanKalemiSatiri[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dahaFazlaYukleniyor, setDahaFazlaYukleniyor] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const yukle = useCallback((zamanFiltre: 'gelecek' | 'gecmis') => {
    setLoading(true);
    setError(null);
    apiFetch<SonucSayfasi>(`/ilan/kalem?zaman=${zamanFiltre}&pageSize=${SAYFA_BOYUTU}`)
      .then((sonuc) => {
        setKalemler(sonuc.data);
        setTotal(sonuc.total);
      })
      .catch(() => setError('İhaleler yüklenemedi.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    yukle(zaman);
  }, [zaman, yukle]);

  async function dahaFazlaYukle() {
    setDahaFazlaYukleniyor(true);
    try {
      const sonrakiSayfa = Math.floor(kalemler.length / SAYFA_BOYUTU) + 1;
      const sonuc = await apiFetch<SonucSayfasi>(
        `/ilan/kalem?zaman=${zaman}&page=${sonrakiSayfa}&pageSize=${SAYFA_BOYUTU}`,
      );
      setKalemler((prev) => [...prev, ...sonuc.data]);
      setTotal(sonuc.total);
    } catch {
      setError('İhaleler yüklenemedi.');
    } finally {
      setDahaFazlaYukleniyor(false);
    }
  }

  const dahaFazlaVar = kalemler.length < total;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">İhaleler</h1>
        <p className="mt-1 text-sm text-gray-500">Belediyenin tüm ihaleleri — geçmiş ve gelecek</p>
      </div>

      <div className="inline-flex gap-1 rounded-lg bg-gray-100 p-1">
        {SEKMELER.map((s) => (
          <button
            key={s.deger}
            type="button"
            onClick={() => setZaman(s.deger)}
            className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${
              zaman === s.deger ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : kalemler.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Inbox />}
            title="İhale bulunamadı"
            description={
              zaman === 'gelecek' ? 'Yaklaşan ya da canlı bir ihale yok.' : 'Sonuçlanmış/iptal edilmiş bir ihale yok.'
            }
          />
        </Card>
      ) : (
        <Card>
          <CardContent className="divide-y divide-gray-100 p-0">
            {kalemler.map((k) => (
              <Link
                key={k.id}
                href={`/admin/ilanlar/${k.ilan_id}`}
                className="flex items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-gray-50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">{k.varlik_ad}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-400">
                    <span className="truncate">{k.ilan_baslik}</span>
                    <span>·</span>
                    <span>{VARLIK_TIP_LABEL[k.varlik_tip] ?? k.varlik_tip}</span>
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {k.durum === 'SONUCLANDI' && k.kazanan_tutar != null && (
                    <span className="text-sm font-semibold text-gray-900">
                      {Number(k.kazanan_tutar).toLocaleString('tr-TR')} ₺
                    </span>
                  )}
                  <span className="flex items-center gap-1.5 text-xs text-gray-400">
                    <Gavel className="h-3.5 w-3.5" />
                    {k.bitis_tarihi ? new Date(k.bitis_tarihi).toLocaleDateString('tr-TR') : '—'}
                  </span>
                  <DurumBadge durum={k.durum} />
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {dahaFazlaVar && !loading && (
        <div className="flex justify-center">
          <Button variant="outline" loading={dahaFazlaYukleniyor} onClick={dahaFazlaYukle}>
            Daha fazla yükle
          </Button>
        </div>
      )}
    </div>
  );
}

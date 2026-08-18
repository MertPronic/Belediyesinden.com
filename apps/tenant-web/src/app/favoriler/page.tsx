'use client';
import { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';
import { RequireAuth } from '../../components/require-auth';
import { apiFetch, getTenantSlug, ilanGorselUrl } from '../../lib/api';
import { Card, EmptyState, IlanKarti, type IlanKartiData } from '@belediyesinden/ui';

interface FavoriIlan extends IlanKartiData {
  /** Ham `/ilan/*` yanıtından gelir — `kapak_gorsel_url`'e dönüştürülmeden `IlanKarti` görseli çözemez. */
  kapak_gorsel_id?: string | null;
}

function FavorilerIcerik() {
  const [ilanlar, setIlanlar] = useState<FavoriIlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<FavoriIlan[]>('/ilan/favoriler/my')
      .then((rows) => {
        const slug = getTenantSlug();
        setIlanlar(
          rows.map((i) => ({
            ...i,
            kapak_gorsel_url: i.kapak_gorsel_id ? ilanGorselUrl(slug, i.kapak_gorsel_id) : null,
          })),
        );
      })
      .catch(() => setIlanlar([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Favori İlanlarım</h1>
        <p className="mt-1 text-sm text-gray-500">{ilanlar.length} favori ilan</p>
      </div>

      {ilanlar.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Heart />}
            title="Favori ilan yok"
            description="İlan detayındaki Favori butonuyla ilanları kaydedebilirsiniz."
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ilanlar.map((ilan) => (
            <IlanKarti key={ilan.id} ilan={ilan} href={`/ilanlar/${ilan.id}`} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FavorilerPage() {
  return (
    <RequireAuth>
      <FavorilerIcerik />
    </RequireAuth>
  );
}

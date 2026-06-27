'use client';
import { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';
import { RequireAuth } from '../../components/require-auth';
import { apiFetch } from '../../lib/api';
import { Card, EmptyState, IlanKarti, type IlanKartiData } from '@belediyesinden/ui';

function FavorilerIcerik() {
  const [ilanlar, setIlanlar] = useState<IlanKartiData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<IlanKartiData[]>('/ilan/favoriler/my')
      .then(setIlanlar)
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

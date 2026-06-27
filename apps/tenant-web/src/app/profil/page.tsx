'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FileText, Gavel, Heart, Inbox } from 'lucide-react';
import { RequireAuth } from '../../components/require-auth';
import { apiFetch } from '../../lib/api';
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Skeleton,
} from '@belediyesinden/ui';

interface Basvuru {
  id: string;
  ilan_id: string;
  ilan_baslik: string;
  durum: string;
  gereken_teminat: string | null;
  created_at: string;
}
interface Teklif {
  id: string;
  ilan_id: string;
  ilan_baslik: string;
  tutar: string;
  kabul_edildi: boolean;
  created_at: string;
}

const BASVURU_DURUM: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' | 'info' }> = {
  BASLADI: { label: 'Başladı', variant: 'info' },
  TEMINAT_BEKLENIYOR: { label: 'Teminat bekleniyor', variant: 'warning' },
  ONAYLANDI: { label: 'Onaylandı', variant: 'success' },
  REDDEDILDI: { label: 'Reddedildi', variant: 'danger' },
  IADE_EDILDI: { label: 'İade edildi', variant: 'default' },
  IPTAL_EDILDI: { label: 'İptal edildi', variant: 'default' },
};

function ProfilIcerik() {
  const [basvurular, setBasvurular] = useState<Basvuru[]>([]);
  const [teklifler, setTeklifler] = useState<Teklif[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch<Basvuru[]>('/basvuru/my').catch(() => []),
      apiFetch<Teklif[]>('/teklif/my').catch(() => []),
    ]).then(([b, t]) => {
      setBasvurular(b);
      setTeklifler(t);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Hesabım</h1>
        <p className="mt-1 text-sm text-gray-500">Başvuru ve teklifleriniz</p>
      </div>

      {/* Başvurularım */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-gray-400" />
            Başvurularım ({basvurular.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {basvurular.length === 0 ? (
            <EmptyState icon={<FileText />} title="Başvurunuz yok" description="İlan detayından başvurabilirsiniz." />
          ) : (
            <div className="divide-y divide-gray-100">
              {basvurular.map((b) => {
                const d = BASVURU_DURUM[b.durum] ?? { label: b.durum, variant: 'default' as const };
                return (
                  <div key={b.id} className="flex items-center justify-between gap-3 px-6 py-3">
                    <div className="min-w-0">
                      <Link href={`/ilanlar/${b.ilan_id}`} className="block truncate text-sm font-medium text-gray-900 hover:underline">
                        {b.ilan_baslik}
                      </Link>
                      <p className="text-xs text-gray-400">{new Date(b.created_at).toLocaleDateString('tr-TR')}</p>
                    </div>
                    <Badge variant={d.variant}>{d.label}</Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tekliflerim */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Gavel className="h-4 w-4 text-gray-400" />
            Tekliflerim ({teklifler.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {teklifler.length === 0 ? (
            <EmptyState icon={<Inbox />} title="Teklifiniz yok" />
          ) : (
            <div className="divide-y divide-gray-100">
              {teklifler.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3 px-6 py-3">
                  <div className="min-w-0">
                    <Link href={`/ilanlar/${t.ilan_id}`} className="block truncate text-sm font-medium text-gray-900 hover:underline">
                      {t.ilan_baslik}
                    </Link>
                    <p className="text-xs text-gray-400">{new Date(t.created_at).toLocaleDateString('tr-TR')}</p>
                  </div>
                  <span className="shrink-0 text-sm font-bold text-gray-900">
                    {Number(t.tutar).toLocaleString('tr-TR')} ₺
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Link
        href="/favoriler"
        className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
        style={{ color: 'var(--renk)' }}
      >
        <Heart className="h-4 w-4" />
        Favori ilanlarım
      </Link>
    </div>
  );
}

export default function ProfilPage() {
  return (
    <RequireAuth>
      <ProfilIcerik />
    </RequireAuth>
  );
}

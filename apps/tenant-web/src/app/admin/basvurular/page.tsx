'use client';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../../lib/api';
import { Card, CardContent, CardHeader, CardTitle, Badge } from '@belediyesinden/ui';

interface Teminat {
  id: string;
  basvuru_id: string;
  ilan_id: string;
  ilan_baslik: string;
  tutar: string;
  durum: string;
  dekont_dosya_adi: string | null;
  onaylayan: string | null;
  created_at: string;
}

const DURUM_RENK: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  BEKLEMEDE: 'warning',
  ONAYLANDI: 'success',
  REDDEDILDI: 'danger',
  IADE_EDILDI: 'default',
};
const DURUM_LABEL: Record<string, string> = {
  BEKLEMEDE: 'Beklemede',
  ONAYLANDI: 'Onaylandı',
  REDDEDILDI: 'Reddedildi',
  IADE_EDILDI: 'İade Edildi',
};

export default function AdminBasvurularPage() {
  const [teminatlar, setTeminatlar] = useState<Teminat[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const yukle = useCallback(() => {
    apiFetch<Teminat[]>('/teminat')
      .then(setTeminatlar)
      .catch(() => setError('Teminatlar yüklenemedi.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    yukle();
  }, [yukle]);

  async function aksiyon(id: string, islem: 'onayla' | 'reddet' | 'iade') {
    setBusy(id + islem);
    setError(null);
    try {
      await apiFetch(`/teminat/${id}/${islem}`, { method: 'POST' });
      await yukle();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'İşlem başarısız.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Başvurular & Teminat</h1>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Teminatlar ({teminatlar.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-6 text-center text-sm text-gray-500">Yükleniyor...</p>
          ) : teminatlar.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">Teminat kaydı yok.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="py-2">İlan</th>
                    <th>Tutar</th>
                    <th>Durum</th>
                    <th>Dekont</th>
                    <th className="text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {teminatlar.map((t) => (
                    <tr key={t.id} className="border-b align-middle">
                      <td className="py-2 font-medium">{t.ilan_baslik}</td>
                      <td>{Number(t.tutar).toLocaleString('tr-TR')} ₺</td>
                      <td>
                        <Badge variant={DURUM_RENK[t.durum] ?? 'default'}>
                          {DURUM_LABEL[t.durum] ?? t.durum}
                        </Badge>
                      </td>
                      <td className="text-gray-600">{t.dekont_dosya_adi ?? '—'}</td>
                      <td className="text-right">
                        {t.durum === 'BEKLEMEDE' && (
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              disabled={busy === t.id + 'onayla'}
                              onClick={() => aksiyon(t.id, 'onayla')}
                              className="rounded px-2 py-1 text-xs text-white disabled:opacity-50"
                              style={{ background: 'var(--renk)' }}
                            >
                              Onayla
                            </button>
                            <button
                              type="button"
                              disabled={busy === t.id + 'reddet'}
                              onClick={() => aksiyon(t.id, 'reddet')}
                              className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 disabled:opacity-50"
                            >
                              Reddet
                            </button>
                          </div>
                        )}
                        {(t.durum === 'ONAYLANDI' || t.durum === 'REDDEDILDI') && (
                          <button
                            type="button"
                            disabled={busy === t.id + 'iade'}
                            onClick={() => aksiyon(t.id, 'iade')}
                            className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 disabled:opacity-50"
                          >
                            İade Et
                          </button>
                        )}
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

'use client';
import { useCallback, useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { apiFetch, downloadFile } from '../../../lib/api';
import { RequireTenantAdmin } from '../../../components/require-tenant-admin';
import { Button, Card, CardContent, CardHeader, CardTitle, Badge, useToast } from '@belediyesinden/ui';

interface Teminat {
  id: string;
  basvuru_id: string;
  ilan_id: string;
  ilan_baslik: string;
  tutar: string;
  durum: string;
  dekont_dosya_adi: string | null;
  onaylayan: string | null;
  red_gerekcesi: string | null;
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
  return (
    <RequireTenantAdmin>
      <AdminBasvurularIcerik />
    </RequireTenantAdmin>
  );
}

function AdminBasvurularIcerik() {
  const toast = useToast();
  const [teminatlar, setTeminatlar] = useState<Teminat[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [redModal, setRedModal] = useState<{ id: string; ilanBaslik: string } | null>(null);
  const [redGerekce, setRedGerekce] = useState('');

  const yukle = useCallback(() => {
    apiFetch<Teminat[]>('/teminat')
      .then(setTeminatlar)
      .catch(() => setError('Teminatlar yüklenemedi.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    yukle();
  }, [yukle]);

  async function aksiyon(id: string, islem: 'onayla' | 'iade') {
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

  async function reddet() {
    if (!redModal) return;
    const gerekce = redGerekce.trim();
    if (!gerekce) return;
    setBusy(redModal.id + 'reddet');
    setError(null);
    try {
      await apiFetch(`/teminat/${redModal.id}/reddet`, {
        method: 'POST',
        body: JSON.stringify({ gerekce }),
      });
      setRedModal(null);
      setRedGerekce('');
      await yukle();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'İşlem başarısız.');
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
                        {t.durum === 'REDDEDILDI' && t.red_gerekcesi && (
                          <p className="mt-1 max-w-[220px] text-xs text-gray-500">{t.red_gerekcesi}</p>
                        )}
                      </td>
                      <td className="text-gray-600">
                        {t.dekont_dosya_adi ? (
                          <button
                            type="button"
                            onClick={() =>
                              downloadFile(`/teminat/${t.id}/dekont`, t.dekont_dosya_adi ?? 'dekont').catch((e) =>
                                toast.error(e instanceof Error ? e.message : 'İndirme başarısız.'),
                              )
                            }
                            className="inline-flex items-center gap-1 font-medium hover:underline"
                            style={{ color: 'var(--renk)' }}
                          >
                            <Download className="h-3.5 w-3.5" />
                            {t.dekont_dosya_adi}
                          </button>
                        ) : (
                          '—'
                        )}
                      </td>
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
                              onClick={() => {
                                setRedGerekce('');
                                setRedModal({ id: t.id, ilanBaslik: t.ilan_baslik });
                              }}
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

      {redModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-base">Teminatı Reddet</CardTitle>
              <p className="text-sm text-gray-500">{redModal.ilanBaslik}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">
                  Ret gerekçesi <span className="text-red-600">(zorunlu)</span>
                </label>
                <textarea
                  value={redGerekce}
                  onChange={(e) => setRedGerekce(e.target.value)}
                  rows={3}
                  placeholder="Örn. Dekont tutarı gereken teminatla uyuşmuyor."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200"
                />
                <p className="mt-1 text-xs text-gray-400">
                  Bu gerekçe vatandaşa gösterilecektir — boş veya sadece boşluk bırakılamaz.
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setRedModal(null);
                    setRedGerekce('');
                  }}
                >
                  Vazgeç
                </Button>
                <Button
                  variant="destructive"
                  onClick={reddet}
                  loading={busy === redModal.id + 'reddet'}
                  disabled={!redGerekce.trim()}
                >
                  Reddet
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

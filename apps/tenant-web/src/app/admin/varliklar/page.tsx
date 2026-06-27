'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '../../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@belediyesinden/ui';

interface Varlik {
  id: string;
  ad: string;
  tip: string;
  aciklama: string | null;
}

const TIPLER = [
  { value: 'TASINIR', label: 'Taşınır' },
  { value: 'TASINMAZ', label: 'Taşınmaz' },
  { value: 'ISLETME_HAKKI', label: 'İşletme Hakkı' },
  { value: 'REKLAM_ALANI', label: 'Reklam Alanı' },
];
const TIP_LABEL: Record<string, string> = Object.fromEntries(TIPLER.map((t) => [t.value, t.label]));

export default function VarliklarPage() {
  const [varliklar, setVarliklar] = useState<Varlik[]>([]);
  const [ad, setAd] = useState('');
  const [tip, setTip] = useState(TIPLER[0].value);
  const [aciklama, setAciklama] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Düzenleme durumu
  const [editId, setEditId] = useState<string | null>(null);
  const [editAd, setEditAd] = useState('');
  const [editAciklama, setEditAciklama] = useState('');
  const [saving, setSaving] = useState(false);

  const yukle = () => apiFetch<Varlik[]>('/varlik').then(setVarliklar).catch(() => {});

  useEffect(() => {
    yukle();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ad.trim()) {
      setError('Ad zorunludur.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch('/varlik', {
        method: 'POST',
        body: JSON.stringify({ tip, ad: ad.trim(), aciklama: aciklama.trim() || undefined }),
      });
      setAd('');
      setAciklama('');
      await yukle();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Oluşturma başarısız.');
    } finally {
      setSubmitting(false);
    }
  }

  function duzenleBasla(v: Varlik) {
    setEditId(v.id);
    setEditAd(v.ad);
    setEditAciklama(v.aciklama ?? '');
  }

  async function kaydet(id: string) {
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/varlik/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ ad: editAd.trim(), aciklama: editAciklama.trim() || null }),
      });
      setEditId(null);
      await yukle();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Güncelleme başarısız.');
    } finally {
      setSaving(false);
    }
  }

  async function sil(id: string, ad: string) {
    if (!window.confirm(`"${ad}" varlığını silmek istediğinize emin misiniz?`)) return;
    setError(null);
    try {
      await apiFetch(`/varlik/${id}`, { method: 'DELETE' });
      await yukle();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Silme başarısız.');
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Varlıklar</h1>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Yeni Varlık</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-gray-600">Tip</label>
              <select
                value={tip}
                onChange={(e) => setTip(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                {TIPLER.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-600">Ad</label>
              <input
                value={ad}
                onChange={(e) => setAd(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="Örn: Merkez arsa"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm text-gray-600">Açıklama (isteğe bağlı)</label>
              <textarea
                value={aciklama}
                onChange={(e) => setAciklama(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg px-5 py-2 text-white disabled:opacity-50"
                style={{ background: 'var(--renk)' }}
              >
                {submitting ? 'Ekleniyor...' : 'Varlık Ekle'}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Varlık Listesi ({varliklar.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {varliklar.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">Kayıtlı varlık yok.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="py-2">Ad</th>
                    <th>Tip</th>
                    <th>Açıklama</th>
                    <th className="text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {varliklar.map((v) => (
                    <tr key={v.id} className="border-b align-middle">
                      {editId === v.id ? (
                        <>
                          <td>
                            <input
                              value={editAd}
                              onChange={(e) => setEditAd(e.target.value)}
                              className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                            />
                          </td>
                          <td className="text-gray-500">{TIP_LABEL[v.tip] ?? v.tip}</td>
                          <td>
                            <input
                              value={editAciklama}
                              onChange={(e) => setEditAciklama(e.target.value)}
                              className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                            />
                          </td>
                          <td className="text-right">
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => kaydet(v.id)}
                              className="rounded px-2 py-1 text-xs text-white disabled:opacity-50"
                              style={{ background: 'var(--renk)' }}
                            >
                              Kaydet
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditId(null)}
                              className="ml-1 rounded border border-gray-300 px-2 py-1 text-xs text-gray-600"
                            >
                              İptal
                            </button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-2 font-medium">{v.ad}</td>
                          <td>{TIP_LABEL[v.tip] ?? v.tip}</td>
                          <td className="text-gray-600">{v.aciklama ?? '—'}</td>
                          <td className="text-right">
                            <button
                              type="button"
                              onClick={() => duzenleBasla(v)}
                              className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600"
                            >
                              Düzenle
                            </button>
                            <button
                              type="button"
                              onClick={() => sil(v.id, v.ad)}
                              className="ml-1 rounded border border-red-300 px-2 py-1 text-xs text-red-600"
                            >
                              Sil
                            </button>
                          </td>
                        </>
                      )}
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

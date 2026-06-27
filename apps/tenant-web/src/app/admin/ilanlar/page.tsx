'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '../../../lib/api';
import { Card, CardContent, CardHeader, CardTitle, DurumBadge } from '@belediyesinden/ui';

interface Ilan {
  id: string;
  baslik: string;
  ihale_tipi: string;
  durum: string;
  baslangic_fiyati: string;
}
interface Varlik {
  id: string;
  ad: string;
  tip: string;
}

const IHALE_TIP = [
  { value: 'ACIK_ARTIRMA', label: 'Açık Artırma' },
  { value: 'ACIK_TEKLIF', label: 'Açık Teklif' },
  { value: 'KAPALI_TEKLIF', label: 'Kapalı Teklif' },
];

export default function AdminIlanlarPage() {
  const [ilanlar, setIlanlar] = useState<Ilan[]>([]);
  const [varliklar, setVarliklar] = useState<Varlik[]>([]);
  const [baslik, setBaslik] = useState('');
  const [varlikId, setVarlikId] = useState('');
  const [ihaleTipi, setIhaleTipi] = useState(IHALE_TIP[0].value);
  const [fiyat, setFiyat] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const yukle = useCallback(() => {
    Promise.all([
      apiFetch<Ilan[]>('/ilan').catch(() => []),
      apiFetch<Varlik[]>('/varlik').catch(() => []),
    ]).then(([i, v]) => {
      setIlanlar(i);
      setVarliklar(v);
      if (v.length && !varlikId) setVarlikId(v[0].id);
    });
  }, [varlikId]);

  useEffect(() => {
    yukle();
  }, [yukle]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!baslik.trim() || !varlikId || !fiyat) {
      setError('Başlık, varlık ve başlangıç fiyatı zorunludur.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch('/ilan', {
        method: 'POST',
        body: JSON.stringify({
          baslik: baslik.trim(),
          varlikId,
          ihaleTipi,
          baslangicFiyati: Number(fiyat),
        }),
      });
      setBaslik('');
      setFiyat('');
      await yukle();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Oluşturma başarısız.');
    } finally {
      setSubmitting(false);
    }
  }

  async function durumDegistir(id: string, durum: string) {
    try {
      await apiFetch(`/ilan/${id}/durum`, { method: 'POST', body: JSON.stringify({ durum }) });
      await yukle();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Durum değişikliği başarısız.');
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">İlanlar</h1>

      <Card>
        <CardHeader>
          <CardTitle>Yeni İlan (Taslak)</CardTitle>
        </CardHeader>
        <CardContent>
          {varliklar.length === 0 ? (
            <p className="text-sm text-amber-700">
              Önce <Link href="/admin/varliklar" className="underline">bir varlık</Link> oluşturmalısınız.
            </p>
          ) : (
            <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm text-gray-600">Başlık</label>
                <input
                  value={baslik}
                  onChange={(e) => setBaslik(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-600">Varlık</label>
                <select
                  value={varlikId}
                  onChange={(e) => setVarlikId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  {varliklar.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.ad} ({v.tip})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-600">İhale Tipi</label>
                <select
                  value={ihaleTipi}
                  onChange={(e) => setIhaleTipi(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  {IHALE_TIP.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-600">Başlangıç Fiyatı (₺)</label>
                <input
                  type="number"
                  value={fiyat}
                  onChange={(e) => setFiyat(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg px-5 py-2 text-white disabled:opacity-50"
                  style={{ background: 'var(--renk)' }}
                >
                  {submitting ? 'Oluşturuluyor...' : 'İlan Oluştur'}
                </button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>İlan Listesi ({ilanlar.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {ilanlar.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">İlan yok.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="py-2">Başlık</th>
                  <th>Durum</th>
                  <th className="text-right">Fiyat</th>
                  <th className="text-right">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {ilanlar.map((ilan) => (
                  <tr key={ilan.id} className="border-b align-middle">
                    <td className="py-2">
                      <Link href={`/admin/ilanlar/${ilan.id}`} className="font-medium hover:underline">
                        {ilan.baslik}
                      </Link>
                      <span className="ml-2 text-xs text-gray-400">{ilan.ihale_tipi}</span>
                    </td>
                    <td>
                      <DurumBadge durum={ilan.durum} />
                    </td>
                    <td className="text-right">
                      {Number(ilan.baslangic_fiyati).toLocaleString('tr-TR')} ₺
                    </td>
                    <td className="text-right">
                      {ilan.durum === 'TASLAK' && (
                        <button
                          type="button"
                          onClick={() => durumDegistir(ilan.id, 'YAYINDA')}
                          className="rounded px-2 py-1 text-xs text-white"
                          style={{ background: 'var(--renk)' }}
                        >
                          Yayınla
                        </button>
                      )}
                      {(ilan.durum === 'YAYINDA' || ilan.durum === 'CANLI_ARTIRMA') && (
                        <button
                          type="button"
                          onClick={() => durumDegistir(ilan.id, 'IPTAL')}
                          className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600"
                        >
                          İptal Et
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

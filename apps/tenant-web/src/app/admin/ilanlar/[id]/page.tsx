'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch, downloadFile } from '../../../../lib/api';
import { Card, CardContent, CardHeader, CardTitle, DurumBadge } from '@belediyesinden/ui';

interface Ilan {
  id: string;
  baslik: string;
  aciklama: string | null;
  ihale_tipi: string;
  durum: string;
  baslangic_fiyati: string;
  bitis_tarihi: string | null;
}

interface Evrak {
  id: string;
  dosya_adi: string;
  content_type: string | null;
  boyut: number | null;
  created_at: string;
}

export default function AdminIlanDetayPage() {
  const params = useParams<{ id: string }>();
  const [ilan, setIlan] = useState<Ilan | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [evraklar, setEvraklar] = useState<Evrak[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const yukle = useCallback(() => {
    apiFetch<Ilan>(`/ilan/${params.id}`)
      .then(setIlan)
      .catch(() => setError('İlan yüklenemedi.'));
    apiFetch<Evrak[]>(`/evrak/ilan/${params.id}`)
      .then(setEvraklar)
      .catch(() => setEvraklar([]));
  }, [params.id]);

  useEffect(() => {
    yukle();
  }, [yukle]);

  async function durumDegistir(durum: string) {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/ilan/${params.id}/durum`, { method: 'POST', body: JSON.stringify({ durum }) });
      await yukle();
      setMsg(`Durum güncellendi.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'İşlem başarısız.');
    } finally {
      setBusy(false);
    }
  }

  async function sonuclandir() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/ilan/${params.id}/sonuclandir`, { method: 'POST' });
      await yukle();
      setMsg('İhale sonuçlandırıldı (en yüksek teklif kazanan).');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sonuçlandırma başarısız.');
    } finally {
      setBusy(false);
    }
  }

  async function evrakYukle(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError('Dosya seçin.');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await apiFetch(`/evrak/${params.id}`, { method: 'POST', body: fd });
      setFile(null);
      setMsg('Evrak yüklendi.');
      await yukle();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Yükleme başarısız.');
    } finally {
      setUploading(false);
    }
  }

  if (!ilan) {
    return <p className="py-8 text-center text-gray-500">{error ?? 'Yükleniyor...'}</p>;
  }

  return (
    <div className="space-y-6">
      <Link href="/admin/ilanlar" className="text-sm text-gray-500 hover:text-gray-800">
        ← İlanlara dön
      </Link>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-2xl">{ilan.baslik}</CardTitle>
              <p className="mt-1 text-sm text-gray-500">{ilan.ihale_tipi}</p>
            </div>
            <DurumBadge durum={ilan.durum} />
          </div>
        </CardHeader>
        <CardContent>
          {ilan.aciklama && <p className="mb-4 text-gray-700">{ilan.aciklama}</p>}
          <p className="text-sm">
            Başlangıç: <strong>{Number(ilan.baslangic_fiyati).toLocaleString('tr-TR')} ₺</strong>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Durum Yönetimi</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {msg && <p className="text-sm text-green-600">{msg}</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex flex-wrap gap-2">
            {ilan.durum === 'TASLAK' && (
              <button
                type="button"
                disabled={busy}
                onClick={() => durumDegistir('YAYINDA')}
                className="rounded-lg px-4 py-2 text-sm text-white disabled:opacity-50"
                style={{ background: 'var(--renk)' }}
              >
                Yayınla
              </button>
            )}
            {(ilan.durum === 'YAYINDA' || ilan.durum === 'CANLI_ARTIRMA') && (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={sonuclandir}
                  className="rounded-lg px-4 py-2 text-sm text-white disabled:opacity-50"
                  style={{ background: 'var(--renk)' }}
                >
                  Sonuçlandır
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => durumDegistir('IPTAL')}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 disabled:opacity-50"
                >
                  İptal Et
                </button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Şartname / Evrak</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={evrakYukle} className="space-y-3">
            <input
              type="file"
              accept=".pdf,image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:px-4 file:py-2 file:text-white"
              style={{ accentColor: 'var(--renk)' }}
            />
            <button
              type="submit"
              disabled={uploading}
              className="rounded-lg px-5 py-2 text-sm text-white disabled:opacity-50"
              style={{ background: 'var(--renk)' }}
            >
              {uploading ? 'Yükleniyor...' : 'Evrak Yükle'}
            </button>
          </form>

          {evraklar.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-sm font-medium text-gray-600">
                Yüklü Evraklar ({evraklar.length})
              </p>
              <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                {evraklar.map((ev) => (
                  <li key={ev.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="truncate text-gray-700">{ev.dosya_adi}</span>
                    <button
                      type="button"
                      onClick={() =>
                        downloadFile(`/evrak/${ev.id}`, ev.dosya_adi).catch((e) =>
                          setError(e instanceof Error ? e.message : 'İndirme başarısız.'),
                        )
                      }
                      className="ml-3 shrink-0 rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
                    >
                      İndir
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

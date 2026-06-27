'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { RequireAuth } from '../../../components/require-auth';
import { apiFetch } from '../../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@belediyesinden/ui';

function TeminatFormu({ basvuruId }: { basvuruId: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError('Lütfen e-dekont dosyasını seçin (PDF/Görüntü).');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await apiFetch(`/teminat/basvuru/${basvuruId}`, { method: 'POST', body: fd });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Yükleme başarısız.');
      setUploading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/ilanlar" className="text-sm text-gray-500 hover:text-gray-800">
        ← İlanlara dön
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Teminat E-Dekontu</CardTitle>
        </CardHeader>
        <CardContent>
          {done ? (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center">
              <p className="font-semibold text-green-700">E-dekontunuz alındı.</p>
              <p className="mt-1 text-sm text-green-600">
                Teminatınız belediye encümeni tarafından incelenecektir. Onaylandığında teklif
                verebilirsiniz.
              </p>
              <button
                type="button"
                onClick={() => router.push('/ilanlar')}
                className="mt-4 rounded-lg px-5 py-2 text-white"
                style={{ background: 'var(--renk)' }}
              >
                İlanlara Dön
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <p className="text-sm text-gray-600">
                Başvuru kaydınız oluşturuldu. İhaleye katılabilmek için teminat dekontunu yükleyin.
              </p>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  E-Dekont Dosyası
                </label>
                <input
                  type="file"
                  accept=".pdf,image/*"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:px-4 file:py-2 file:text-white"
                  style={{ accentColor: 'var(--renk)' }}
                />
                {file && (
                  <p className="mt-1 text-xs text-gray-500">
                    {file.name} ({(file.size / 1024).toFixed(0)} KB)
                  </p>
                )}
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={uploading}
                className="w-full rounded-lg px-5 py-2.5 text-white disabled:opacity-50"
                style={{ background: 'var(--renk)' }}
              >
                {uploading ? 'Yükleniyor...' : 'E-Dekontu Yükle'}
              </button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function TeminatPage() {
  const params = useParams<{ basvuruId: string }>();
  return (
    <RequireAuth>
      <TeminatFormu basvuruId={params.basvuruId} />
    </RequireAuth>
  );
}

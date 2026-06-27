'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Upload } from 'lucide-react';
import { RequireAuth } from '../../../components/require-auth';
import { apiFetch } from '../../../lib/api';
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@belediyesinden/ui';

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
      <Link
        href="/ilanlar"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        İlanlara dön
      </Link>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Teminat E-Dekontu</CardTitle>
        </CardHeader>
        <CardContent>
          {done ? (
            <Alert variant="success" icon={<CheckCircle2 />} title="E-dekontunuz alındı">
              Teminatınız belediye encümeni tarafından incelenecektir. Onaylandığında teklif
              verebilirsiniz.
              <div className="mt-3">
                <Button onClick={() => router.push('/ilanlar')}>İlanlara Dön</Button>
              </div>
            </Alert>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <p className="text-sm text-gray-600">
                Başvuru kaydınız oluşturuldu. İhaleye katılabilmek için teminat dekontunu yükleyin.
              </p>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">
                  E-Dekont Dosyası
                </label>
                <input
                  type="file"
                  accept=".pdf,image/*"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-4 file:py-2 file:text-gray-700 hover:file:bg-gray-200"
                />
                {file && (
                  <p className="mt-1.5 text-xs text-gray-500">
                    {file.name} ({(file.size / 1024).toFixed(0)} KB)
                  </p>
                )}
              </div>

              {error && <Alert variant="error">{error}</Alert>}

              <Button type="submit" loading={uploading} leftIcon={<Upload />} className="w-full">
                E-Dekontu Yükle
              </Button>
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

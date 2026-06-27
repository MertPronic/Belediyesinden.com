'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Ban, CheckCircle2, FileText, Trophy, Upload } from 'lucide-react';
import { apiFetch, downloadFile } from '../../../../lib/api';
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DurumBadge,
} from '@belediyesinden/ui';

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
  const [gorselFiles, setGorselFiles] = useState<FileList | null>(null);
  const [gorselUploading, setGorselUploading] = useState(false);
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
      setMsg('Durum güncellendi.');
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

  async function gorselYukle(e: React.FormEvent) {
    e.preventDefault();
    if (!gorselFiles || gorselFiles.length === 0) {
      setError('En az bir görsel seçin.');
      return;
    }
    setGorselUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      Array.from(gorselFiles).forEach((f) => fd.append('files', f));
      await apiFetch(`/ilan/${params.id}/gorsel`, { method: 'POST', body: fd });
      setGorselFiles(null);
      setMsg(`${gorselFiles.length} görsel yüklendi.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Görsel yükleme başarısız.');
    } finally {
      setGorselUploading(false);
    }
  }

  if (!ilan) {
    return <p className="py-8 text-center text-gray-500">{error ?? 'Yükleniyor...'}</p>;
  }

  return (
    <div className="space-y-6">
      <Link
        href="/admin/ilanlar"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        İlanlara dön
      </Link>

      <Card>
        <CardHeader className="pb-4">
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
            Başlangıç: <strong className="text-gray-900">{Number(ilan.baslangic_fiyati).toLocaleString('tr-TR')} ₺</strong>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Durum Yönetimi</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {msg && <Alert variant="success">{msg}</Alert>}
          {error && <Alert variant="error">{error}</Alert>}
          <div className="flex flex-wrap gap-2">
            {ilan.durum === 'TASLAK' && (
              <Button
                loading={busy}
                leftIcon={<CheckCircle2 />}
                onClick={() => durumDegistir('YAYINDA')}
              >
                Yayınla
              </Button>
            )}
            {(ilan.durum === 'YAYINDA' || ilan.durum === 'CANLI_ARTIRMA') && (
              <>
                <Button loading={busy} leftIcon={<Trophy />} onClick={sonuclandir}>
                  Sonuçlandır
                </Button>
                <Button
                  variant="outline"
                  loading={busy}
                  leftIcon={<Ban />}
                  className="text-red-600"
                  onClick={() => durumDegistir('IPTAL')}
                >
                  İptal Et
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Şartname / Evrak</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={evrakYukle} className="space-y-3">
            <input
              type="file"
              accept=".pdf,image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-4 file:py-2 file:text-gray-700 hover:file:bg-gray-200"
            />
            <Button type="submit" variant="outline" loading={uploading} leftIcon={<Upload />}>
              Evrak Yükle
            </Button>
          </form>

          {evraklar.length > 0 && (
            <div className="mt-4 divide-y divide-gray-100 rounded-lg border border-gray-100">
              {evraklar.map((ev) => (
                <div key={ev.id} className="flex items-center justify-between px-3 py-2.5 text-sm">
                  <span className="flex min-w-0 items-center gap-2 text-gray-700">
                    <FileText className="h-4 w-4 shrink-0 text-gray-400" />
                    <span className="truncate">{ev.dosya_adi}</span>
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      downloadFile(`/evrak/${ev.id}`, ev.dosya_adi).catch((e) =>
                        setError(e instanceof Error ? e.message : 'İndirme başarısız.'),
                      )
                    }
                  >
                    İndir
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">İlan Görselleri (galeri)</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={gorselYukle} className="space-y-3">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setGorselFiles(e.target.files)}
              className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-4 file:py-2 file:text-gray-700 hover:file:bg-gray-200"
            />
            {gorselFiles && (
              <p className="text-xs text-gray-500">{gorselFiles.length} görsel seçili</p>
            )}
            <Button type="submit" variant="outline" loading={gorselUploading} leftIcon={<Upload />}>
              Görselleri Yükle (max 15)
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

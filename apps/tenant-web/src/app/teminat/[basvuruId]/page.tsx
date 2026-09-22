'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Clock, Upload, XCircle } from 'lucide-react';
import { RequireAuth } from '../../../components/require-auth';
import { apiFetch } from '../../../lib/api';
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  StatusBanner,
  StatusStepper,
} from '@belediyesinden/ui';

interface Teminat {
  id: string;
  durum: string;
  dekont_dosya_adi: string | null;
  red_gerekcesi: string | null;
}

const KILITLI_DURUMLAR = ['BLOKE_EDILDI', 'IADE_EDILDI'];

/** Süreç hâlâ devam ediyorsa (happy-path) adım adım dolan bar gösterilir. */
const ADIMLAR = [{ label: 'Başvuru' }, { label: 'Teminat' }, { label: 'Onay' }];

function TeminatFormu({ basvuruId }: { basvuruId: string }) {
  const router = useRouter();
  const [mevcut, setMevcut] = useState<Teminat | null>(null);
  const [checked, setChecked] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    apiFetch<Teminat | null>(`/teminat/basvuru/${basvuruId}/benim`)
      .then(setMevcut)
      .catch(() => setMevcut(null))
      .finally(() => setChecked(true));
  }, [basvuruId]);

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

  const kilitli = !!mevcut && KILITLI_DURUMLAR.includes(mevcut.durum);

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
          {!checked ? (
            <div className="h-24 animate-pulse rounded-lg bg-gray-100" aria-hidden />
          ) : done ? (
            <StatusBanner
              renk="emerald"
              icon={<CheckCircle2 />}
              baslik="E-Dekontunuz Alındı"
              aciklama="Teminatınız belediye encümeni tarafından incelenecektir. Onaylandığında teklif verebilirsiniz."
              action={<Button onClick={() => router.push('/ilanlar')}>İlanlara Dön</Button>}
            />
          ) : mevcut?.durum === 'IADE_EDILDI' ? (
            <StatusBanner
              renk="gray"
              icon={<Clock />}
              baslik="Teminatınız İade Edildi"
              aciklama="Bu başvurunun teminatı iade edilmiş, dekont artık değiştirilemez."
            />
          ) : kilitli ? (
            <StatusStepper
              adimlar={ADIMLAR}
              aktifIndex={2}
              aktifTamamlandi
              aciklama="Teminatınız onaylandı. Encümen onayı sonrası dekont değiştirilemez, ihale başladığında teklif verebilirsiniz."
            />
          ) : (
            <form onSubmit={submit} className="space-y-4">
              {mevcut?.durum === 'REDDEDILDI' ? (
                <StatusBanner
                  renk="red"
                  icon={<XCircle />}
                  baslik="Dekontunuz Reddedildi"
                  aciklama={
                    <>
                      Yüklediğiniz dekont ({mevcut.dekont_dosya_adi}) reddedildi.
                      {mevcut.red_gerekcesi && (
                        <>
                          {' '}
                          Gerekçe: <strong>{mevcut.red_gerekcesi}</strong>
                        </>
                      )}{' '}
                      Yeni bir dekont yükleyerek tekrar deneyebilirsiniz.
                    </>
                  }
                />
              ) : mevcut ? (
                <StatusStepper
                  adimlar={ADIMLAR}
                  aktifIndex={1}
                  aciklama={`Mevcut dekontunuz (${mevcut.dekont_dosya_adi}) inceleniyor. Onaylanana kadar dilerseniz değiştirebilirsiniz.`}
                />
              ) : (
                <StatusStepper
                  adimlar={ADIMLAR}
                  aktifIndex={1}
                  aciklama="Başvuru kaydınız oluşturuldu. İhaleye katılabilmek için teminat dekontunu yükleyin."
                />
              )}
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
                {mevcut ? 'Dekontu Değiştir' : 'E-Dekontu Yükle'}
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

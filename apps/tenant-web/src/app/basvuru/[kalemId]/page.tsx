'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
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

interface KalemBaglami {
  id: string;
  ilan_id: string;
  ilan_baslik: string;
  varlik_ad: string;
  baslangic_fiyati: string;
}

interface Basvuru {
  id: string;
}

function BasvuruFormu({ kalemId }: { kalemId: string }) {
  const router = useRouter();
  const [kalem, setKalem] = useState<KalemBaglami | null>(null);
  const [kvkk, setKvkk] = useState(false);
  const [riza, setRiza] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // undefined: henüz kontrol edilmedi, null: başvuru yok (form gösterilir).
  const [mevcutBasvuruKontrol, setMevcutBasvuruKontrol] = useState<Basvuru | null | undefined>(undefined);

  useEffect(() => {
    apiFetch<KalemBaglami>(`/ilan/kalem/${kalemId}`)
      .then(setKalem)
      .catch(() => setError('Varlık bilgisi alınamadı.'));
  }, [kalemId]);

  // Kullanıcı bu varlığa daha önce başvurmuşsa (ör. login sonrası buraya düşünce)
  // KVKK formunu doldurup "zaten başvurdunuz" ile reddedilmesin — direkt varlık
  // sayfasına dön, orada BasvuruDurumu mevcut başvurunun durumunu zaten gösteriyor.
  useEffect(() => {
    apiFetch<Basvuru | null>(`/basvuru/kalem/${kalemId}/benim`)
      .then((b) => {
        if (b) {
          router.replace(`/varliklar/${kalemId}`);
        } else {
          setMevcutBasvuruKontrol(null);
        }
      })
      .catch(() => setMevcutBasvuruKontrol(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kalemId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!kvkk) {
      setError('KVKK aydınlatma metnini onaylamanız zorunludur.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const basvuru = await apiFetch<{ id: string }>('/basvuru/kalem/' + kalemId, {
        method: 'POST',
        body: JSON.stringify({ kvkkOnay: kvkk, acikRiza: riza }),
      });
      router.push(`/teminat/${basvuru.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Başvuru başarısız.');
      setSubmitting(false);
    }
  }

  if (mevcutBasvuruKontrol === undefined) {
    return (
      <div className="mx-auto max-w-2xl py-16">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[var(--renk,#2563eb)]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href={`/varliklar/${kalemId}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Varlığa dön
      </Link>

      {kalem && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{kalem.varlik_ad}</CardTitle>
            <p className="text-xs text-gray-400">{kalem.ilan_baslik}</p>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              Başlangıç fiyatı: {Number(kalem.baslangic_fiyati).toLocaleString('tr-TR')} ₺
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4" style={{ color: 'var(--renk)' }} />
            Başvuru
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm leading-relaxed text-gray-700">
              <h3 className="mb-2 font-semibold text-gray-900">KVKK Aydınlatma Metni</h3>
              <p>
                İşbu ihaleye başvurmanız halinde, 6698 sayılı Kişisel Verilerin Korunması Kanunu
                kapsamında kimlik ve iletişim bilgileriniz; başvuru ve teminat işlemlerinin
                yürütülmesi ile ihale sürecinin denetimi amacıyla işlenecektir. Verileriniz mevzuat
                gereklerine uygun olarak saklanacak ve ilgili süre sonunda imha edilecektir.
              </p>
            </div>

            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={kvkk}
                onChange={(e) => setKvkk(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300"
                style={{ accentColor: 'var(--renk)' }}
              />
              <span className="text-gray-700">
                KVKK aydınlatma metnini okudum, anladım ve onaylıyorum.{' '}
                <strong className="text-gray-900">(Zorunlu)</strong>
              </span>
            </label>

            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={riza}
                onChange={(e) => setRiza(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300"
                style={{ accentColor: 'var(--renk)' }}
              />
              <span className="text-gray-700">
                Kişisel verilerimin ilan süreci dışında bilgilendirme amacıyla işlenmesine açık rıza
                veriyorum. (İsteğe bağlı)
              </span>
            </label>

            {error && <Alert variant="error">{error}</Alert>}

            <Button type="submit" loading={submitting} className="w-full">
              Başvur ve Teminata Devam Et
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function BasvuruPage() {
  const params = useParams<{ kalemId: string }>();
  return (
    <RequireAuth>
      <BasvuruFormu kalemId={params.kalemId} />
    </RequireAuth>
  );
}

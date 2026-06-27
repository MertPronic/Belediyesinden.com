'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { RequireAuth } from '../../../components/require-auth';
import { apiFetch } from '../../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@belediyesinden/ui';

interface Ilan {
  id: string;
  baslik: string;
  ihale_tipi: string;
  baslangic_fiyati: string;
}

function BasvuruFormu({ ilanId }: { ilanId: string }) {
  const router = useRouter();
  const [ilan, setIlan] = useState<Ilan | null>(null);
  const [kvkk, setKvkk] = useState(false);
  const [riza, setRiza] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Ilan>(`/ilan/${ilanId}`)
      .then(setIlan)
      .catch(() => setError('İlan bilgisi alınamadı.'));
  }, [ilanId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!kvkk) {
      setError('KVKK aydınlatma metnini onaylamanız zorunludur.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const basvuru = await apiFetch<{ id: string }>('/basvuru/ilan/' + ilanId, {
        method: 'POST',
        body: JSON.stringify({ kvkkOnay: kvkk, acikRiza: riza }),
      });
      router.push(`/teminat/${basvuru.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Başvuru başarısız.');
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href={`/ilanlar/${ilanId}`} className="text-sm text-gray-500 hover:text-gray-800">
        ← İlana dön
      </Link>

      {ilan && (
        <Card>
          <CardHeader>
            <CardTitle>{ilan.baslik}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              {ilan.ihale_tipi} · Başlangıç: {Number(ilan.baslangic_fiyati).toLocaleString('tr-TR')} ₺
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Başvuru</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
              <h3 className="mb-2 font-semibold">KVKK Aydınlatma Metni</h3>
              <p>
                İşbu ihaleye başvurmanız halinde, 6698 sayılı Kişisel Verilerin Korunması Kanunu
                kapsamında kimlik ve iletişim bilgileriniz, başvuru ve teminat işlemlerinin
                yürütülmesi ile ihale sürecinin denetimi amacıyla işlenecektir. Verileriniz mevzuat
                gereklerine uygun olarak saklanacak ve ilgili süre sonunda imha edilecektir.
              </p>
            </div>

            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={kvkk}
                onChange={(e) => setKvkk(e.target.checked)}
                className="mt-1 h-4 w-4"
                style={{ accentColor: 'var(--renk)' }}
              />
              <span>KVKK aydınlatma metnini okudum, anladım ve onaylıyorum. <strong>(Zorunlu)</strong></span>
            </label>

            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={riza}
                onChange={(e) => setRiza(e.target.checked)}
                className="mt-1 h-4 w-4"
                style={{ accentColor: 'var(--renk)' }}
              />
              <span>
                Kişisel verilerimin ilan süreci dışında pazarlama/bilgilendirme amacıyla
                işlenmesine açık rıza veriyorum. (İsteğe bağlı)
              </span>
            </label>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg px-5 py-2.5 text-white disabled:opacity-50"
              style={{ background: 'var(--renk)' }}
            >
              {submitting ? 'Gönderiliyor...' : 'Başvur ve Teminata Devam Et'}
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function BasvuruPage() {
  const params = useParams<{ ilanId: string }>();
  return (
    <RequireAuth>
      <BasvuruFormu ilanId={params.ilanId} />
    </RequireAuth>
  );
}

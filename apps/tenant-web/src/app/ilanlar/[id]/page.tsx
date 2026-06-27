import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { serverApiFetch } from '../../../lib/api';
import { Card, CardContent, CardHeader, CardTitle, DurumBadge } from '@belediyesinden/ui';

interface Ilan {
  id: string;
  baslik: string;
  aciklama: string | null;
  ihale_tipi: string;
  durum: string;
  baslangic_fiyati: string;
  baslangic_tarihi: string | null;
  bitis_tarihi: string | null;
}

const PUBLIC_DURUMLAR = ['YAYINDA', 'CANLI_ARTIRMA', 'SONUCLANDI'];

async function getTenantSlug(): Promise<string> {
  const h = await headers();
  const xSlug = h.get('x-tenant-slug');
  if (xSlug) return xSlug;
  const host = h.get('host') ?? '';
  const first = host.split(':')[0].split('.')[0]?.toLowerCase();
  return first && !['localhost', 'www', 'belediyesinden'].includes(first) ? first : '';
}

export default async function IlanDetayPage({ params }: { params: { id: string } }) {
  const slug = await getTenantSlug();
  if (!slug) notFound();

  let ilan: Ilan | null = null;
  try {
    ilan = await serverApiFetch<Ilan>(`/ilan/${params.id}`, slug);
  } catch {
    notFound();
  }

  // Taslak/iptal edilmiş ilanlar public olarak görüntülenmez.
  if (!ilan || !PUBLIC_DURUMLAR.includes(ilan.durum)) {
    notFound();
  }

  const canBid = ilan.durum === 'YAYINDA' || ilan.durum === 'CANLI_ARTIRMA';

  return (
    <div className="space-y-6">
      <Link href="/ilanlar" className="text-sm text-gray-500 hover:text-gray-800">
        ← İlanlara dön
      </Link>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-2xl">{ilan.baslik}</CardTitle>
              <p className="mt-1 text-sm text-gray-500">{ilan.ihale_tipi}</p>
            </div>
            <DurumBadge durum={ilan.durum} />
          </div>
        </CardHeader>
        <CardContent>
          {ilan.aciklama && (
            <p className="mb-6 whitespace-pre-wrap text-gray-700">{ilan.aciklama}</p>
          )}

          <div className="grid grid-cols-2 gap-4 border-t pt-4 text-sm sm:grid-cols-3">
            <div>
              <span className="block text-gray-500">Başlangıç Fiyatı</span>
              <strong className="text-lg" style={{ color: 'var(--renk)' }}>
                {Number(ilan.baslangic_fiyati).toLocaleString('tr-TR')} ₺
              </strong>
            </div>
            {ilan.baslangic_tarihi && (
              <div>
                <span className="block text-gray-500">Başlangıç</span>
                <strong>{new Date(ilan.baslangic_tarihi).toLocaleDateString('tr-TR')}</strong>
              </div>
            )}
            {ilan.bitis_tarihi && (
              <div>
                <span className="block text-gray-500">Bitiş</span>
                <strong>{new Date(ilan.bitis_tarihi).toLocaleDateString('tr-TR')}</strong>
              </div>
            )}
          </div>

          {canBid ? (
            <Link
              href={`/teklif/${ilan.id}`}
              className="mt-6 inline-block rounded-lg px-6 py-2.5 text-white"
              style={{ background: 'var(--renk)' }}
            >
              Teklif Ver
            </Link>
          ) : (
            <p className="mt-6 rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-600">
              Bu ihale sonuçlandırılmıştır.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

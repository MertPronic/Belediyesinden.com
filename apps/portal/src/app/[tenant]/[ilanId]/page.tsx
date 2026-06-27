import Link from 'next/link';
import { notFound } from 'next/navigation';
import { portalFetch, tenantUrl } from '../../../lib/api';
import { Card, CardContent, CardHeader, CardTitle, Badge, DurumBadge } from '@belediyesinden/ui';

interface Ilan {
  id: string;
  baslik: string;
  aciklama: string | null;
  ihale_tipi: string;
  durum: string;
  baslangic_fiyati: string;
  bitis_tarihi: string | null;
}

const PUBLIC_DURUMLAR = ['YAYINDA', 'CANLI_ARTIRMA', 'SONUCLANDI'];

export default async function PortalIlanDetayPage({
  params,
}: {
  params: Promise<{ tenant: string; ilanId: string }>;
}) {
  const { tenant, ilanId } = await params;

  let ilan: Ilan | null = null;
  try {
    ilan = await portalFetch<Ilan>(`/ilan/${ilanId}`, tenant);
  } catch {
    notFound();
  }

  if (!ilan || !PUBLIC_DURUMLAR.includes(ilan.durum)) {
    notFound();
  }

  const canBid = ilan.durum === 'YAYINDA' || ilan.durum === 'CANLI_ARTIRMA';

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/" className="text-sm text-gray-500 hover:text-gray-800">
        ← Tüm ilanlara dön
      </Link>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-2xl">{ilan.baslik}</CardTitle>
              <div className="mt-1 flex items-center gap-2">
                <Badge variant="info">{tenant}</Badge>
                <span className="text-sm text-gray-500">{ilan.ihale_tipi}</span>
              </div>
            </div>
            <DurumBadge durum={ilan.durum} />
          </div>
        </CardHeader>
        <CardContent>
          {ilan.aciklama && <p className="mb-4 whitespace-pre-wrap text-gray-700">{ilan.aciklama}</p>}
          <div className="grid grid-cols-2 gap-4 border-t pt-4 text-sm sm:grid-cols-3">
            <div>
              <span className="block text-gray-500">Başlangıç Fiyatı</span>
              <strong className="text-lg" style={{ color: 'var(--renk)' }}>
                {Number(ilan.baslangic_fiyati).toLocaleString('tr-TR')} ₺
              </strong>
            </div>
            {ilan.bitis_tarihi && (
              <div>
                <span className="block text-gray-500">Bitiş</span>
                <strong>{new Date(ilan.bitis_tarihi).toLocaleDateString('tr-TR')}</strong>
              </div>
            )}
          </div>

          {canBid ? (
            <div className="mt-6 rounded-lg bg-gray-50 p-4">
              <p className="mb-3 text-sm text-gray-600">
                Bu ilana başvurmak ve teklif vermek için belediyenin portalına gidin:
              </p>
              <a
                href={tenantUrl(tenant, `/ilanlar/${ilan.id}`)}
                className="inline-block rounded-lg px-5 py-2.5 text-white"
                style={{ background: 'var(--renk)' }}
              >
                {tenant} portalında devam et →
              </a>
            </div>
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

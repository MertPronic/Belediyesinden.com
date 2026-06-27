import { headers } from 'next/headers';
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
  kurallar: Record<string, unknown>;
}

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

  let ilan: Ilan | null = null;
  let teklifler: Array<{ tutar: string; kullanici_id: string }> = [];

  if (slug) {
    try {
      const all = await serverApiFetch<Ilan[]>('/search/ilan', slug);
      ilan = all.find((i) => i.id === params.id) ?? null;
      if (ilan) {
        teklifler = await serverApiFetch<typeof teklifler>(`/teklif/ilan/${params.id}`, slug);
      }
    } catch {
      /* */
    }
  }

  if (!ilan) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-gray-500">İlan bulunamadı.</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">{ilan.baslik}</CardTitle>
              <p className="mt-1 text-sm text-gray-500">{ilan.ihale_tipi}</p>
            </div>
            <DurumBadge durum={ilan.durum} />
          </div>
        </CardHeader>
        <CardContent>
          {ilan.aciklama && <p className="mb-4 text-gray-700">{ilan.aciklama}</p>}
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="block text-gray-500">Başlangıç Fiyatı</span>
              <strong className="text-lg">{Number(ilan.baslangic_fiyati).toLocaleString('tr-TR')} ₺</strong>
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
          {ilan.durum === 'YAYINDA' && (
            <a
              href={`/teklif/${ilan.id}`}
              className="mt-4 inline-block rounded-lg px-6 py-2.5 text-white"
              style={{ background: 'var(--renk)' }}
            >
              Teklif Ver
            </a>
          )}
        </CardContent>
      </Card>

      {teklifler.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Teklifler ({teklifler.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="py-2">Sıra</th>
                  <th>Tutar</th>
                </tr>
              </thead>
              <tbody>
                {teklifler.map((t, i) => (
                  <tr key={i} className="border-b">
                    <td className="py-2">{i + 1}</td>
                    <td className="font-semibold">{Number(t.tutar).toLocaleString('tr-TR')} ₺</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

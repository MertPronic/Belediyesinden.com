'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle, DurumBadge } from '@belediyesinden/ui';

interface RaporOzet {
  ilanlar: Record<string, number>;
  teklifSayisi: number;
  basvurular: Record<string, number>;
  varliklar: Record<string, number>;
  katilimciSayisi: number;
  gelir: number;
}

interface Ilan {
  id: string;
  baslik: string;
  durum: string;
  baslangic_fiyati: string;
}

const ILAN_DURUM_LABEL: Record<string, string> = {
  TASLAK: 'Taslak',
  YAYINDA: 'Yayında',
  CANLI_ARTIRMA: 'Canlı Artırma',
  SONUCLANDI: 'Sonuçlandı',
  IPTAL: 'İptal',
};

function Stat({
  label,
  value,
  suffix,
  renk,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  renk?: boolean;
}) {
  return (
    <Card>
      <CardContent className="py-5">
        <p className="text-sm text-gray-500">{label}</p>
        <p className="mt-1 text-2xl font-bold" style={renk ? { color: 'var(--renk)' } : undefined}>
          {value}
          {suffix ? <span className="ml-1 text-sm font-normal text-gray-400">{suffix}</span> : null}
        </p>
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const [ozet, setOzet] = useState<RaporOzet | null>(null);
  const [ilanlar, setIlanlar] = useState<Ilan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch<RaporOzet>('/rapor/ozet').catch(() => null),
      apiFetch<Ilan[]>('/ilan').catch(() => []),
    ]).then(([o, i]) => {
      setOzet(o);
      setIlanlar(i);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <p className="py-8 text-center text-gray-500">Yükleniyor...</p>;
  }

  const ilanToplam = ozet ? Object.values(ozet.ilanlar).reduce((a, b) => a + b, 0) : 0;
  const yayinda = (ozet?.ilanlar['YAYINDA'] ?? 0) + (ozet?.ilanlar['CANLI_ARTIRMA'] ?? 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Genel Bakış</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Toplam İlan" value={ilanToplam} renk />
        <Stat label="Yayında" value={yayinda} />
        <Stat label="Teklif" value={ozet?.teklifSayisi ?? 0} />
        <Stat label="Katılımcı" value={ozet?.katilimciSayisi ?? 0} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Stat label="Tahmini Gelir (sonuçlanan)" value={(ozet?.gelir ?? 0).toLocaleString('tr-TR')} suffix="₺" renk />
        <Stat label="Toplam Varlık" value={ozet ? Object.values(ozet.varliklar).reduce((a, b) => a + b, 0) : 0} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>İlan Durum Dağılımı</CardTitle>
          </CardHeader>
          <CardContent>
            {ozet && Object.keys(ozet.ilanlar).length > 0 ? (
              <ul className="space-y-2 text-sm">
                {Object.entries(ozet.ilanlar).map(([durum, n]) => (
                  <li key={durum} className="flex items-center justify-between">
                    <DurumBadge durum={durum} />
                    <span className="font-semibold">{n}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">Veri yok.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Başvuru Durumu</CardTitle>
          </CardHeader>
          <CardContent>
            {ozet && Object.keys(ozet.basvurular).length > 0 ? (
              <ul className="space-y-2 text-sm">
                {Object.entries(ozet.basvurular).map(([durum, n]) => (
                  <li key={durum} className="flex items-center justify-between">
                    <span className="text-gray-600">{ILAN_DURUM_LABEL[durum] ?? durum}</span>
                    <span className="font-semibold">{n}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">Başvuru yok.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Son İlanlar</CardTitle>
        </CardHeader>
        <CardContent>
          {ilanlar.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">Henüz ilan yok.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="py-2">Başlık</th>
                  <th>Durum</th>
                  <th className="text-right">Başlangıç</th>
                </tr>
              </thead>
              <tbody>
                {ilanlar.slice(0, 8).map((ilan) => (
                  <tr key={ilan.id} className="border-b">
                    <td className="py-2">
                      <Link href={`/admin/ilanlar/${ilan.id}`} className="hover:underline">
                        {ilan.baslik}
                      </Link>
                    </td>
                    <td>
                      <DurumBadge durum={ilan.durum} />
                    </td>
                    <td className="text-right">
                      {Number(ilan.baslangic_fiyati).toLocaleString('tr-TR')} ₺
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

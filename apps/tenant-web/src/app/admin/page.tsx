'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle, DurumBadge } from '@belediyesinden/ui';

interface Ilan {
  id: string;
  baslik: string;
  durum: string;
  baslangic_fiyati: string;
}
interface Varlik {
  id: string;
  ad: string;
  tip: string;
}
interface Teminat {
  id: string;
  durum: string;
  tutar: string;
}

function Stat({ label, value, renk }: { label: string; value: number; renk?: boolean }) {
  return (
    <Card>
      <CardContent className="py-5">
        <p className="text-sm text-gray-500">{label}</p>
        <p className="mt-1 text-2xl font-bold" style={renk ? { color: 'var(--renk)' } : undefined}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const [ilanlar, setIlanlar] = useState<Ilan[]>([]);
  const [varliklar, setVarliklar] = useState<Varlik[]>([]);
  const [teminatlar, setTeminatlar] = useState<Teminat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch<Ilan[]>('/ilan').catch(() => []),
      apiFetch<Varlik[]>('/varlik').catch(() => []),
      apiFetch<Teminat[]>('/teminat').catch(() => []),
    ]).then(([i, v, t]) => {
      setIlanlar(i);
      setVarliklar(v);
      setTeminatlar(t);
      setLoading(false);
    });
  }, []);

  const bekleyenTeminat = teminatlar.filter((t) => t.durum === 'BEKLEMEDE').length;
  const yayindaIlan = ilanlar.filter(
    (i) => i.durum === 'YAYINDA' || i.durum === 'CANLI_ARTIRMA',
  ).length;

  if (loading) {
    return <p className="py-8 text-center text-gray-500">Yükleniyor...</p>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Genel Bakış</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Toplam İlan" value={ilanlar.length} renk />
        <Stat label="Yayında" value={yayindaIlan} />
        <Stat label="Varlık" value={varliklar.length} />
        <Stat label="Bekleyen Teminat" value={bekleyenTeminat} />
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

'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Ban, CheckCircle2, Plus } from 'lucide-react';
import { apiFetch } from '../../../lib/api';
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DurumBadge,
  EmptyState,
  Field,
  FieldLabel,
  Input,
  Select,
} from '@belediyesinden/ui';

interface Ilan {
  id: string;
  baslik: string;
  ihale_tipi: string;
  durum: string;
  baslangic_fiyati: string;
}
interface Varlik {
  id: string;
  ad: string;
  tip: string;
}

const IHALE_TIP = [
  { value: 'ACIK_ARTIRMA', label: 'Açık Artırma' },
  { value: 'ACIK_TEKLIF', label: 'Açık Teklif' },
  { value: 'KAPALI_TEKLIF', label: 'Kapalı Teklif' },
];

export default function AdminIlanlarPage() {
  const [ilanlar, setIlanlar] = useState<Ilan[]>([]);
  const [varliklar, setVarliklar] = useState<Varlik[]>([]);
  const [baslik, setBaslik] = useState('');
  const [varlikId, setVarlikId] = useState('');
  const [ihaleTipi, setIhaleTipi] = useState(IHALE_TIP[0].value);
  const [fiyat, setFiyat] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const yukle = useCallback(() => {
    Promise.all([
      apiFetch<Ilan[]>('/ilan').catch(() => []),
      apiFetch<Varlik[]>('/varlik').catch(() => []),
    ]).then(([i, v]) => {
      setIlanlar(i);
      setVarliklar(v);
      if (v.length && !varlikId) setVarlikId(v[0].id);
    });
  }, [varlikId]);

  useEffect(() => {
    yukle();
  }, [yukle]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!baslik.trim() || !varlikId || !fiyat) {
      setError('Başlık, varlık ve başlangıç fiyatı zorunludur.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch('/ilan', {
        method: 'POST',
        body: JSON.stringify({
          baslik: baslik.trim(),
          varlikId,
          ihaleTipi,
          baslangicFiyati: Number(fiyat),
        }),
      });
      setBaslik('');
      setFiyat('');
      await yukle();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Oluşturma başarısız.');
    } finally {
      setSubmitting(false);
    }
  }

  async function durumDegistir(id: string, durum: string) {
    setError(null);
    try {
      await apiFetch(`/ilan/${id}/durum`, { method: 'POST', body: JSON.stringify({ durum }) });
      await yukle();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Durum değişikliği başarısız.');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">İlanlar</h1>
        <p className="mt-1 text-sm text-gray-500">İhale ilanlarını oluşturun ve yönetin</p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Yeni İlan (Taslak)</CardTitle>
        </CardHeader>
        <CardContent>
          {varliklar.length === 0 ? (
            <Alert variant="warning">
              Önce <Link href="/admin/varliklar" className="font-semibold underline">bir varlık</Link> oluşturmalısınız.
            </Alert>
          ) : (
            <form onSubmit={submit} className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
              <Field className="sm:col-span-2">
                <FieldLabel required>Başlık</FieldLabel>
                <Input value={baslik} onChange={(e) => setBaslik(e.target.value)} placeholder="İlan başlığı" />
              </Field>
              <Field>
                <FieldLabel>Varlık</FieldLabel>
                <Select value={varlikId} onChange={(e) => setVarlikId(e.target.value)}>
                  {varliklar.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.ad} ({v.tip})
                    </option>
                  ))}
                </Select>
              </Field>
              <Field>
                <FieldLabel>İhale Tipi</FieldLabel>
                <Select value={ihaleTipi} onChange={(e) => setIhaleTipi(e.target.value)}>
                  {IHALE_TIP.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field>
                <FieldLabel required>Başlangıç Fiyatı (₺)</FieldLabel>
                <Input type="number" value={fiyat} onChange={(e) => setFiyat(e.target.value)} />
              </Field>
              <div className="mt-3 sm:col-span-2">
                <Button type="submit" loading={submitting} leftIcon={<Plus />}>
                  İlan Oluştur
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">İlan Listesi ({ilanlar.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {ilanlar.length === 0 ? (
            <EmptyState title="İlan yok" description="Yukarıdaki formdan ilk ilanı oluşturun." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <th className="h-11 px-4">Başlık</th>
                    <th className="px-4">Durum</th>
                    <th className="px-4 text-right">Fiyat</th>
                    <th className="px-4 text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {ilanlar.map((ilan) => (
                    <tr key={ilan.id} className="border-b border-gray-100 align-middle hover:bg-gray-50/60">
                      <td className="px-4 py-3">
                        <Link href={`/admin/ilanlar/${ilan.id}`} className="font-medium text-gray-900 hover:underline">
                          {ilan.baslik}
                        </Link>
                        <span className="ml-2 text-xs text-gray-400">{ilan.ihale_tipi}</span>
                      </td>
                      <td className="px-4">
                        <DurumBadge durum={ilan.durum} />
                      </td>
                      <td className="px-4 text-right tabular-nums">
                        {Number(ilan.baslangic_fiyati).toLocaleString('tr-TR')} ₺
                      </td>
                      <td className="px-4 text-right">
                        {ilan.durum === 'TASLAK' && (
                          <Button
                            size="sm"
                            leftIcon={<CheckCircle2 />}
                            onClick={() => durumDegistir(ilan.id, 'YAYINDA')}
                          >
                            Yayınla
                          </Button>
                        )}
                        {(ilan.durum === 'YAYINDA' || ilan.durum === 'CANLI_ARTIRMA') && (
                          <Button
                            size="sm"
                            variant="outline"
                            leftIcon={<Ban />}
                            className="text-red-600"
                            onClick={() => durumDegistir(ilan.id, 'IPTAL')}
                          >
                            İptal
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, FileText, Save } from 'lucide-react';
import type { VarlikTipi } from '@belediyesinden/shared';
import { varlikDetayAlanlari } from '@belediyesinden/varlik-core';
import { apiFetch } from '../../../../lib/api';
import { RequireTenantAdmin } from '../../../../components/require-tenant-admin';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Field,
  FieldLabel,
  Input,
  Select,
  Textarea,
  useToast,
} from '@belediyesinden/ui';

interface Varlik {
  id: string;
  tip: string;
  ad: string;
  aciklama: string | null;
  detay: Record<string, string>;
}

const TIP_ETIKET: Record<string, string> = {
  TASINIR: 'Taşınır',
  TASINMAZ: 'Taşınmaz',
  ISLETME_HAKKI: 'İşletme Hakkı',
  REKLAM_ALANI: 'Reklam Alanı',
};

export default function VarlikDuzenlePage() {
  return (
    <RequireTenantAdmin>
      <VarlikDuzenleIcerik />
    </RequireTenantAdmin>
  );
}

function VarlikDuzenleIcerik() {
  const params = useParams<{ id: string }>();
  const toast = useToast();
  const [varlik, setVarlik] = useState<Varlik | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);

  const [ad, setAd] = useState('');
  const [aciklama, setAciklama] = useState('');
  const [detay, setDetay] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const detayAlanlari = useMemo(
    () => (varlik ? varlikDetayAlanlari(varlik.tip as VarlikTipi, detay['cinsi']) : []),
    [varlik, detay['cinsi']],
  );

  const yukle = useCallback(() => {
    apiFetch<Varlik>(`/varlik/${params.id}`)
      .then((v) => {
        setVarlik(v);
        setAd(v.ad);
        setAciklama(v.aciklama ?? '');
        setDetay(v.detay ?? {});
      })
      .catch(() => toast.error('Varlık yüklenemedi.'))
      .finally(() => setYukleniyor(false));
  }, [params.id]);

  useEffect(() => {
    yukle();
  }, [yukle]);

  function detayAlanDegisti(key: string, value: string) {
    setDetay((prev) => (key === 'cinsi' ? { cinsi: value } : { ...prev, [key]: value }));
  }

  async function kaydet() {
    if (!ad.trim()) {
      toast.error('Ad zorunludur.');
      return;
    }
    setSaving(true);
    try {
      const temizDetay = Object.fromEntries(
        Object.entries(detay).filter(([, deger]) => deger.trim() !== ''),
      );
      await apiFetch(`/varlik/${params.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          ad: ad.trim(),
          aciklama: aciklama.trim() || null,
          detay: temizDetay,
        }),
      });
      toast.success('Varlık güncellendi.');
      await yukle();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Güncelleme başarısız.');
    } finally {
      setSaving(false);
    }
  }

  if (yukleniyor) {
    return (
      <div className="space-y-6">
        <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
        <div className="h-64 animate-pulse rounded-xl bg-gray-100" />
      </div>
    );
  }

  if (!varlik) {
    return <EmptyState icon={<FileText />} title="Varlık bulunamadı" description="Bu varlık silinmiş ya da hiç var olmamış olabilir." />;
  }

  return (
    <div className="space-y-6">
      <Link
        href="/admin/varliklar"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Varlıklara dön
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">{varlik.ad}</h1>
        <p className="mt-1 text-sm text-gray-500">{TIP_ETIKET[varlik.tip] ?? varlik.tip} — tip sonradan değiştirilemez</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Varlık Bilgileri</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
            <Field className="sm:col-span-2">
              <FieldLabel required>Ad</FieldLabel>
              <Input value={ad} onChange={(e) => setAd(e.target.value)} placeholder="Örn: Merkez arsa" />
            </Field>
            <Field className="sm:col-span-2">
              <FieldLabel>Açıklama (isteğe bağlı)</FieldLabel>
              <Textarea
                value={aciklama}
                onChange={(e) => setAciklama(e.target.value)}
                rows={2}
                placeholder="Varlık detayları..."
              />
            </Field>
          </div>

          {detayAlanlari.length > 0 && (
            <div className="mt-3 grid gap-x-4 gap-y-1 border-t border-gray-100 pt-3 sm:grid-cols-2">
              {detayAlanlari.map((alan) => (
                <Field key={alan.key}>
                  <FieldLabel required={alan.zorunlu}>{alan.etiket}</FieldLabel>
                  {alan.tip === 'select' ? (
                    <Select value={detay[alan.key] ?? ''} onChange={(e) => detayAlanDegisti(alan.key, e.target.value)}>
                      <option value="">Seçiniz</option>
                      {alan.secenekler?.map((s) => (
                        <option key={s.deger} value={s.deger}>
                          {s.etiket}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <Input
                      type={alan.tip === 'number' ? 'number' : 'text'}
                      value={detay[alan.key] ?? ''}
                      onChange={(e) => detayAlanDegisti(alan.key, e.target.value)}
                    />
                  )}
                </Field>
              ))}
            </div>
          )}

          <div className="mt-4">
            <Button loading={saving} leftIcon={<Save />} onClick={kaydet}>
              Kaydet
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

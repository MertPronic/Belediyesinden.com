'use client';
import { useCallback, useEffect, useState } from 'react';
import { LifeBuoy, Inbox } from 'lucide-react';
import { apiFetch } from '../../../lib/api';
import { useAuth } from '../../../lib/use-auth';
import {
  Badge,
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
  Skeleton,
  Textarea,
  useToast,
} from '@belediyesinden/ui';

interface DestekTalebi {
  id: string;
  tenantSlug: string;
  tenantAd: string | null;
  acanKullaniciId: string;
  konu: string;
  baslik: string;
  mesaj: string;
  durum: string;
  cevap: string | null;
  cevapTarihi: string | null;
  createdAt: string;
}

const KONU_LABEL: Record<string, string> = {
  MUHASEBE: 'Muhasebe',
  TEKNIK: 'Teknik',
  DIGER: 'Diğer',
};

const DURUM_BADGE: Record<string, { label: string; variant: 'warning' | 'success' }> = {
  ACIK: { label: 'Açık', variant: 'warning' },
  CEVAPLANDI: { label: 'Cevaplandı', variant: 'success' },
};

export default function DestekPage() {
  const { user } = useAuth();
  const isSuperadmin = !!user?.roller?.includes('SUPERADMIN');
  return isSuperadmin ? <SuperadminDestekIcerik /> : <PersonelDestekIcerik />;
}

/** Tenant admin/encümen: yeni talep aç + kendi taleplerini gör. */
function PersonelDestekIcerik() {
  const toast = useToast();
  const [talepler, setTalepler] = useState<DestekTalebi[] | null>(null);
  const [konu, setKonu] = useState('MUHASEBE');
  const [baslik, setBaslik] = useState('');
  const [mesaj, setMesaj] = useState('');
  const [gonderiliyor, setGonderiliyor] = useState(false);

  const yukle = useCallback(() => {
    apiFetch<DestekTalebi[]>('/destek/my')
      .then(setTalepler)
      .catch(() => setTalepler([]));
  }, []);

  useEffect(() => {
    yukle();
  }, [yukle]);

  async function gonder() {
    if (!baslik.trim() || !mesaj.trim()) {
      toast.error('Başlık ve mesaj boş olamaz.');
      return;
    }
    setGonderiliyor(true);
    try {
      await apiFetch('/destek', { method: 'POST', body: JSON.stringify({ konu, baslik, mesaj }) });
      toast.success('Destek talebiniz iletildi.');
      setBaslik('');
      setMesaj('');
      setKonu('MUHASEBE');
      yukle();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Talep gönderilemedi.');
    } finally {
      setGonderiliyor(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Destek</h1>
        <p className="mt-1 text-sm text-gray-500">Muhasebe, teknik ya da diğer konularda destek talebi açın.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Yeni Destek Talebi</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <Field>
            <FieldLabel>Konu</FieldLabel>
            <Select value={konu} onChange={(e) => setKonu(e.target.value)}>
              <option value="MUHASEBE">Muhasebe</option>
              <option value="TEKNIK">Teknik</option>
              <option value="DIGER">Diğer</option>
            </Select>
          </Field>
          <Field>
            <FieldLabel>Başlık</FieldLabel>
            <Input
              value={baslik}
              maxLength={200}
              onChange={(e) => setBaslik(e.target.value)}
              placeholder="Kısaca konuyu özetleyin"
            />
          </Field>
          <Field>
            <FieldLabel>Mesaj</FieldLabel>
            <Textarea value={mesaj} onChange={(e) => setMesaj(e.target.value)} rows={4} placeholder="Detayları yazın" />
          </Field>
          <Button loading={gonderiliyor} onClick={gonder}>
            Talebi Gönder
          </Button>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Taleplerim</h2>
        {talepler === null ? (
          <div className="space-y-2">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        ) : talepler.length === 0 ? (
          <Card>
            <EmptyState icon={<Inbox />} title="Henüz destek talebiniz yok" />
          </Card>
        ) : (
          <Card>
            <CardContent className="divide-y divide-gray-100 p-0">
              {talepler.map((t) => (
                <div key={t.id} className="space-y-1.5 px-5 py-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-gray-900">{t.baslik}</p>
                    <Badge variant={DURUM_BADGE[t.durum]?.variant ?? 'default'}>
                      {DURUM_BADGE[t.durum]?.label ?? t.durum}
                    </Badge>
                  </div>
                  <p className="flex items-center gap-x-2 text-xs text-gray-400">
                    <span>{KONU_LABEL[t.konu] ?? t.konu}</span>
                    <span>·</span>
                    <span>{new Date(t.createdAt).toLocaleString('tr-TR')}</span>
                  </p>
                  <p className="text-sm text-gray-600">{t.mesaj}</p>
                  {t.cevap && (
                    <div className="mt-2 rounded-lg bg-gray-50 px-3 py-2">
                      <p className="text-xs font-medium text-gray-500">Cevap</p>
                      <p className="mt-0.5 text-sm text-gray-700">{t.cevap}</p>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

/** Süper admin: tüm belediyelerin taleplerini görür ve cevaplar. */
function SuperadminDestekIcerik() {
  const toast = useToast();
  const [talepler, setTalepler] = useState<DestekTalebi[] | null>(null);
  const [durumFiltre, setDurumFiltre] = useState<'' | 'ACIK' | 'CEVAPLANDI'>('ACIK');
  const [cevapMetni, setCevapMetni] = useState<Record<string, string>>({});
  const [gonderiliyorId, setGonderiliyorId] = useState<string | null>(null);

  const yukle = useCallback((durum: string) => {
    setTalepler(null);
    apiFetch<DestekTalebi[]>(`/destek${durum ? `?durum=${durum}` : ''}`)
      .then(setTalepler)
      .catch(() => setTalepler([]));
  }, []);

  useEffect(() => {
    yukle(durumFiltre);
  }, [durumFiltre, yukle]);

  async function cevapla(id: string) {
    const cevap = (cevapMetni[id] ?? '').trim();
    if (!cevap) {
      toast.error('Cevap boş olamaz.');
      return;
    }
    setGonderiliyorId(id);
    try {
      await apiFetch(`/destek/${id}/cevapla`, { method: 'POST', body: JSON.stringify({ cevap }) });
      toast.success('Cevap gönderildi.');
      yukle(durumFiltre);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Cevap gönderilemedi.');
    } finally {
      setGonderiliyorId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Destek Talepleri</h1>
        <p className="mt-1 text-sm text-gray-500">Tüm belediyelerden gelen destek talepleri</p>
      </div>

      <div className="inline-flex gap-1 rounded-lg bg-gray-100 p-1">
        {(
          [
            { deger: 'ACIK' as const, label: 'Açık' },
            { deger: 'CEVAPLANDI' as const, label: 'Cevaplandı' },
            { deger: '' as const, label: 'Tümü' },
          ]
        ).map((s) => (
          <button
            key={s.deger}
            type="button"
            onClick={() => setDurumFiltre(s.deger)}
            className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${
              durumFiltre === s.deger ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {talepler === null ? (
        <div className="space-y-2">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : talepler.length === 0 ? (
        <Card>
          <EmptyState icon={<LifeBuoy />} title="Destek talebi yok" />
        </Card>
      ) : (
        <div className="space-y-3">
          {talepler.map((t) => (
            <Card key={t.id}>
              <CardContent className="space-y-2 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{t.baslik}</p>
                    <p className="mt-0.5 flex items-center gap-x-2 text-xs text-gray-400">
                      <span>{t.tenantAd ?? t.tenantSlug}</span>
                      <span>·</span>
                      <span>{KONU_LABEL[t.konu] ?? t.konu}</span>
                      <span>·</span>
                      <span>{new Date(t.createdAt).toLocaleString('tr-TR')}</span>
                    </p>
                  </div>
                  <Badge variant={DURUM_BADGE[t.durum]?.variant ?? 'default'}>
                    {DURUM_BADGE[t.durum]?.label ?? t.durum}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600">{t.mesaj}</p>
                {t.cevap ? (
                  <div className="rounded-lg bg-gray-50 px-3 py-2">
                    <p className="text-xs font-medium text-gray-500">Cevabınız</p>
                    <p className="mt-0.5 text-sm text-gray-700">{t.cevap}</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Textarea
                      className="sm:flex-1"
                      rows={2}
                      placeholder="Cevap yazın"
                      value={cevapMetni[t.id] ?? ''}
                      onChange={(e) => setCevapMetni((prev) => ({ ...prev, [t.id]: e.target.value }))}
                    />
                    <Button
                      className="sm:self-end"
                      loading={gonderiliyorId === t.id}
                      onClick={() => cevapla(t.id)}
                    >
                      Cevapla
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

'use client';
import { useEffect, useState } from 'react';
import { Gavel, Save, ShieldAlert } from 'lucide-react';
import { apiFetch } from '../../../lib/api';
import { useAuth } from '../../../lib/use-auth';
import { RequireAuth } from '../../../components/require-auth';
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  FieldLabel,
  Input,
  Skeleton,
  TutarInput,
  useToast,
} from '@belediyesinden/ui';

interface IlanKurallari {
  minArtirmaAdimi: number;
  teminatOrani: number;
  ihaleSuresiGun: number;
  sureUzatmaDakika: number;
  minIlanIhaleAraligiGun: number;
  minSimdiIlanAraligiGun: number;
}

const IHALE_TIPLERI = [
  { value: 'ACIK_ARTIRMA', label: 'Açık Artırma' },
  { value: 'ACIK_TEKLIF', label: 'Açık Teklif' },
  { value: 'KAPALI_TEKLIF', label: 'Kapalı Teklif' },
] as const;

const ASGARI_GUN = 10;

export default function KurallarPage() {
  return (
    <RequireAuth>
      <KurallarIcerik />
    </RequireAuth>
  );
}

function KurallarIcerik() {
  const { user } = useAuth();
  const isTenantAdmin = user?.roller?.includes('TENANT_ADMIN') ?? false;

  if (!isTenantAdmin) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h2 className="text-xl font-semibold text-gray-900">Yetkisiz erişim</h2>
        <p className="mt-2 text-sm text-gray-600">Bu alan yalnızca belediye yöneticileri (TenantAdmin) içindir.</p>
      </div>
    );
  }

  return <KurallarFormu />;
}

function KurallarFormu() {
  const toast = useToast();
  const [kurallar, setKurallar] = useState<Record<string, IlanKurallari> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Record<string, IlanKurallari>>('/ilan-kurallari')
      .then(setKurallar)
      .catch(() => toast.error('Kurallar yüklenemedi.'))
      .finally(() => setLoading(false));
  }, [toast]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">İhale Kuralları</h1>
        <p className="mt-1 text-sm text-gray-500">
          İhale tipine göre parametreler. Gün alanları {ASGARI_GUN} günün altına indirilemez (2886 sayılı Kanun asgari süresi).
        </p>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-56 w-full" />
          ))}
        </div>
      ) : !kurallar ? (
        <Alert variant="error">Kurallar yüklenemedi.</Alert>
      ) : (
        IHALE_TIPLERI.map((t) => (
          <KuralKarti key={t.value} tip={t.value} baslik={t.label} kurallar={kurallar[t.value]} />
        ))
      )}
    </div>
  );
}

function KuralKarti({ tip, baslik, kurallar }: { tip: string; baslik: string; kurallar: IlanKurallari }) {
  const toast = useToast();
  const [form, setForm] = useState(kurallar);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof IlanKurallari>(alan: K, deger: string) {
    const sayi = Number(deger);
    setForm((f) => ({ ...f, [alan]: Number.isFinite(sayi) ? sayi : f[alan] }));
  }

  async function kaydet() {
    setSaving(true);
    try {
      const { minArtirmaAdimi, teminatOrani, sureUzatmaDakika, minIlanIhaleAraligiGun, minSimdiIlanAraligiGun } = form;
      const guncel = await apiFetch<IlanKurallari>(`/ilan-kurallari/${tip}`, {
        method: 'PATCH',
        body: JSON.stringify({ minArtirmaAdimi, teminatOrani, sureUzatmaDakika, minIlanIhaleAraligiGun, minSimdiIlanAraligiGun }),
      });
      setForm(guncel);
      toast.success(`${baslik} kuralları güncellendi.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Güncelleme başarısız.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Gavel className="h-4 w-4" style={{ color: 'var(--renk)' }} />
          {baslik}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-x-4 gap-y-1 sm:grid-cols-3">
          <Field>
            <FieldLabel>Min. Artırma Adımı (₺)</FieldLabel>
            <TutarInput value={String(form.minArtirmaAdimi)} onChange={(v) => set('minArtirmaAdimi', v)} />
          </Field>
          <Field>
            <FieldLabel>Teminat Oranı (0–1)</FieldLabel>
            <Input type="number" step="0.01" min={0} max={1} value={form.teminatOrani} onChange={(e) => set('teminatOrani', e.target.value)} />
          </Field>
          <Field>
            <FieldLabel>Süre Uzatma (dk)</FieldLabel>
            <Input type="number" min={0} value={form.sureUzatmaDakika} onChange={(e) => set('sureUzatmaDakika', e.target.value)} />
          </Field>
          <Field>
            <FieldLabel>Şimdi → İlan Aralığı (gün)</FieldLabel>
            <Input type="number" min={ASGARI_GUN} value={form.minSimdiIlanAraligiGun} onChange={(e) => set('minSimdiIlanAraligiGun', e.target.value)} />
            <p className="mt-1 flex items-center gap-1 text-xs text-gray-400">
              <ShieldAlert className="h-3 w-3" /> Asgari {ASGARI_GUN} gün
            </p>
          </Field>
          <Field>
            <FieldLabel>İlan → İhale Aralığı (gün)</FieldLabel>
            <Input type="number" min={ASGARI_GUN} value={form.minIlanIhaleAraligiGun} onChange={(e) => set('minIlanIhaleAraligiGun', e.target.value)} />
            <p className="mt-1 flex items-center gap-1 text-xs text-gray-400">
              <ShieldAlert className="h-3 w-3" /> Asgari {ASGARI_GUN} gün
            </p>
          </Field>
        </div>
        <Button size="sm" loading={saving} leftIcon={<Save />} onClick={kaydet}>
          Kaydet
        </Button>
      </CardContent>
    </Card>
  );
}

'use client';
import { useCallback, useEffect, useState } from 'react';
import { Building2, Copy, ExternalLink, Landmark, Plus } from 'lucide-react';
import { apiFetch } from '../../../lib/api';
import { RequireSuperadmin } from '../../../components/require-superadmin';
import {
  Alert,
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
  Separator,
  useToast,
} from '@belediyesinden/ui';

interface Tenant {
  id: string;
  slug: string;
  ad: string;
  durum: string;
  createdAt: string;
}

interface ProvisionSonuc {
  slug: string;
  ad: string;
  ilkYonetici: { username: string; password: string };
}

const BOS_FORM = { slug: '', ad: '', adminUsername: '', adminEmail: '', adminAd: '', adminSoyad: '' };

export default function TenantlarPage() {
  const toast = useToast();
  const [tenantlar, setTenantlar] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(BOS_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [sonuc, setSonuc] = useState<ProvisionSonuc | null>(null);

  const yukle = useCallback(() => {
    setLoading(true);
    apiFetch<Tenant[]>('/tenants')
      .then(setTenantlar)
      .catch(() => setTenantlar([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    yukle();
  }, [yukle]);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.slug.trim() || !form.ad.trim() || !form.adminUsername.trim() || !form.adminEmail.trim()) {
      toast.error('Slug, belediye adı, yönetici kullanıcı adı ve e-posta zorunludur.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch<ProvisionSonuc>('/tenants', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setSonuc(res);
      setForm(BOS_FORM);
      toast.success(`"${res.ad}" oluşturuldu.`);
      await yukle();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Oluşturma başarısız.');
    } finally {
      setSubmitting(false);
    }
  }

  function kopyala(deger: string) {
    navigator.clipboard.writeText(deger).then(() => toast.info('Kopyalandı.'));
  }

  return (
    <RequireSuperadmin>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Belediyeler</h1>
          <p className="mt-1 text-sm text-gray-500">Platformdaki tüm tenant'lar — süper admin</p>
        </div>

        {sonuc && (
          <Alert variant="success" title={`"${sonuc.ad}" hazır — ilk yönetici bilgileri (bir kereliğine gösterilir)`}>
            <div className="mt-2 space-y-1.5 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-24 text-gray-500">Kullanıcı adı</span>
                <code className="rounded bg-white/60 px-2 py-0.5 font-mono">{sonuc.ilkYonetici.username}</code>
                <button type="button" onClick={() => kopyala(sonuc.ilkYonetici.username)} className="text-gray-500 hover:text-gray-800">
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-24 text-gray-500">Şifre</span>
                <code className="rounded bg-white/60 px-2 py-0.5 font-mono">{sonuc.ilkYonetici.password}</code>
                <button type="button" onClick={() => kopyala(sonuc.ilkYonetici.password)} className="text-gray-500 hover:text-gray-800">
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
              <a
                href={`http://${sonuc.slug}.localhost:4200`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium hover:underline"
              >
                {sonuc.slug}.localhost:4200 <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </Alert>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Yeni Belediye</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
              <Field>
                <FieldLabel required>Slug</FieldLabel>
                <Input value={form.slug} onChange={(e) => set('slug', e.target.value.toLowerCase())} placeholder="orn: testkoy" />
                <p className="mt-1 text-xs text-gray-400">Sadece a-z 0-9, 3-40 karakter. Subdomain olur.</p>
              </Field>
              <Field>
                <FieldLabel required>Belediye Adı</FieldLabel>
                <Input value={form.ad} onChange={(e) => set('ad', e.target.value)} placeholder="Örn: Testköy Belediyesi" />
              </Field>

              <div className="sm:col-span-2">
                <Separator className="my-2" />
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">İlk Yönetici</p>
              </div>

              <Field>
                <FieldLabel required>Kullanıcı Adı</FieldLabel>
                <Input value={form.adminUsername} onChange={(e) => set('adminUsername', e.target.value)} placeholder="orn: testkoy_admin" />
              </Field>
              <Field>
                <FieldLabel required>E-posta</FieldLabel>
                <Input type="email" value={form.adminEmail} onChange={(e) => set('adminEmail', e.target.value)} placeholder="admin@testkoy.bel.tr" />
              </Field>
              <Field>
                <FieldLabel>Ad</FieldLabel>
                <Input value={form.adminAd} onChange={(e) => set('adminAd', e.target.value)} />
              </Field>
              <Field>
                <FieldLabel>Soyad</FieldLabel>
                <Input value={form.adminSoyad} onChange={(e) => set('adminSoyad', e.target.value)} />
              </Field>

              <div className="mt-3 sm:col-span-2">
                <Button type="submit" loading={submitting} leftIcon={<Plus />}>
                  Belediye Oluştur
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Tenant Listesi ({tenantlar.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {!loading && tenantlar.length === 0 ? (
              <EmptyState icon={<Landmark />} title="Kayıtlı belediye yok" description="Yukarıdaki formdan ilk belediyeyi oluşturun." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <th className="h-11 px-4">Belediye</th>
                      <th className="px-4">Slug</th>
                      <th className="px-4">Durum</th>
                      <th className="px-4 text-right">Bağlantı</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenantlar.map((t) => (
                      <tr key={t.id} className="border-b border-gray-100 align-middle hover:bg-gray-50/60">
                        <td className="px-4 py-3 font-medium text-gray-900">{t.ad}</td>
                        <td className="px-4 text-gray-600">{t.slug}</td>
                        <td className="px-4">
                          <Badge variant={t.durum === 'AKTIF' ? 'success' : 'default'} icon={<Building2 />}>
                            {t.durum}
                          </Badge>
                        </td>
                        <td className="px-4 text-right">
                          <a
                            href={`http://${t.slug}.localhost:4200`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm font-medium hover:underline"
                            style={{ color: 'var(--renk)' }}
                          >
                            Ziyaret et <ExternalLink className="h-3.5 w-3.5" />
                          </a>
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
    </RequireSuperadmin>
  );
}

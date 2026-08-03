'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, Handshake, Megaphone, Package, Pencil, Plus, Trash2 } from 'lucide-react';
import { apiFetch } from '../../../lib/api';
import { RequireTenantAdmin } from '../../../components/require-tenant-admin';
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
  Skeleton,
  Textarea,
  useToast,
} from '@belediyesinden/ui';

interface Varlik {
  id: string;
  ad: string;
  tip: string;
  aciklama: string | null;
}

const TIPLER = [
  { value: 'TASINIR', label: 'Taşınır', icon: Package, renk: 'text-blue-600 bg-blue-50' },
  { value: 'TASINMAZ', label: 'Taşınmaz', icon: Building2, renk: 'text-emerald-600 bg-emerald-50' },
  { value: 'ISLETME_HAKKI', label: 'İşletme Hakkı', icon: Handshake, renk: 'text-amber-600 bg-amber-50' },
  { value: 'REKLAM_ALANI', label: 'Reklam Alanı', icon: Megaphone, renk: 'text-purple-600 bg-purple-50' },
] as const;
const TIP_BILGI: Record<string, (typeof TIPLER)[number]> = Object.fromEntries(TIPLER.map((t) => [t.value, t]));

function TipRozeti({ tip }: { tip: string }) {
  const bilgi = TIP_BILGI[tip];
  if (!bilgi) return <span className="text-gray-600">{tip}</span>;
  const Icon = bilgi.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ${bilgi.renk}`}>
      <Icon className="h-3.5 w-3.5" />
      {bilgi.label}
    </span>
  );
}

export default function VarliklarPage() {
  return (
    <RequireTenantAdmin>
      <VarliklarIcerik />
    </RequireTenantAdmin>
  );
}

function VarliklarIcerik() {
  const toast = useToast();
  const [varliklar, setVarliklar] = useState<Varlik[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtreTip, setFiltreTip] = useState('');

  const [ad, setAd] = useState('');
  const [tip, setTip] = useState<string>(TIPLER[0].value);
  const [aciklama, setAciklama] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [editId, setEditId] = useState<string | null>(null);
  const [editAd, setEditAd] = useState('');
  const [editAciklama, setEditAciklama] = useState('');
  const [saving, setSaving] = useState(false);

  const yukle = useCallback((tipFiltre: string) => {
    setLoading(true);
    const qs = tipFiltre ? `?tip=${tipFiltre}` : '';
    return apiFetch<Varlik[]>(`/varlik${qs}`)
      .then(setVarliklar)
      .catch(() => setVarliklar([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    yukle(filtreTip);
  }, [yukle, filtreTip]);

  const istatistikler = useMemo(
    () => TIPLER.map((t) => ({ ...t, sayi: varliklar.filter((v) => v.tip === t.value).length })),
    [varliklar],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ad.trim()) {
      toast.error('Ad zorunludur.');
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch('/varlik', {
        method: 'POST',
        body: JSON.stringify({ tip, ad: ad.trim(), aciklama: aciklama.trim() || undefined }),
      });
      setAd('');
      setAciklama('');
      toast.success('Varlık eklendi.');
      await yukle(filtreTip);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Oluşturma başarısız.');
    } finally {
      setSubmitting(false);
    }
  }

  function duzenleBasla(v: Varlik) {
    setEditId(v.id);
    setEditAd(v.ad);
    setEditAciklama(v.aciklama ?? '');
  }

  async function kaydet(id: string) {
    setSaving(true);
    try {
      await apiFetch(`/varlik/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ ad: editAd.trim(), aciklama: editAciklama.trim() || null }),
      });
      setEditId(null);
      toast.success('Varlık güncellendi.');
      await yukle(filtreTip);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Güncelleme başarısız.');
    } finally {
      setSaving(false);
    }
  }

  async function sil(id: string, ad: string) {
    if (!window.confirm(`"${ad}" varlığını silmek istediğinize emin misiniz?`)) return;
    try {
      await apiFetch(`/varlik/${id}`, { method: 'DELETE' });
      toast.success('Varlık silindi.');
      await yukle(filtreTip);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Silme başarısız.');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Varlıklar</h1>
        <p className="mt-1 text-sm text-gray-500">Belediye varlık envanteri</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {istatistikler.map((s) => (
          <div key={s.value} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-xs">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${s.renk}`}>
              <s.icon className="h-4.5 w-4.5" />
            </span>
            <div className="min-w-0">
              <p className="text-lg font-bold leading-tight text-gray-900">{s.sayi}</p>
              <p className="truncate text-xs text-gray-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Yeni Varlık</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
            <Field>
              <FieldLabel>Tip</FieldLabel>
              <Select value={tip} onChange={(e) => setTip(e.target.value)}>
                {TIPLER.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field>
              <FieldLabel required>Ad</FieldLabel>
              <Input
                value={ad}
                onChange={(e) => setAd(e.target.value)}
                placeholder="Örn: Merkez arsa"
              />
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
            <div className="sm:col-span-2">
              <Button type="submit" loading={submitting} leftIcon={<Plus />}>
                Varlık Ekle
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3 pb-3">
          <CardTitle className="text-base">Varlık Listesi ({varliklar.length})</CardTitle>
          <Select
            value={filtreTip}
            onChange={(e) => setFiltreTip(e.target.value)}
            className="w-auto min-w-[9rem]"
          >
            <option value="">Tüm Tipler</option>
            {TIPLER.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-4">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : varliklar.length === 0 ? (
            <EmptyState
              icon={<Package />}
              title="Kayıtlı varlık yok"
              description={
                filtreTip ? 'Bu tipte kayıtlı varlık bulunmuyor.' : 'Yukarıdaki formdan ilk varlığı ekleyin.'
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <th className="h-11 px-4">Ad</th>
                    <th className="px-4">Tip</th>
                    <th className="px-4">Açıklama</th>
                    <th className="px-4 text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {varliklar.map((v) => (
                    <tr key={v.id} className="border-b border-gray-100 align-middle hover:bg-gray-50/60">
                      {editId === v.id ? (
                        <>
                          <td className="px-4 py-2">
                            <Input value={editAd} onChange={(e) => setEditAd(e.target.value)} />
                          </td>
                          <td className="px-4">
                            <TipRozeti tip={v.tip} />
                          </td>
                          <td className="px-4">
                            <Input
                              value={editAciklama}
                              onChange={(e) => setEditAciklama(e.target.value)}
                            />
                          </td>
                          <td className="px-4 text-right">
                            <Button size="sm" loading={saving} onClick={() => kaydet(v.id)}>
                              Kaydet
                            </Button>
                            <Button size="sm" variant="ghost" className="ml-1" onClick={() => setEditId(null)}>
                              İptal
                            </Button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3 font-medium text-gray-900">{v.ad}</td>
                          <td className="px-4">
                            <TipRozeti tip={v.tip} />
                          </td>
                          <td className="px-4 text-gray-600">{v.aciklama ?? '—'}</td>
                          <td className="px-4 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              leftIcon={<Pencil />}
                              onClick={() => duzenleBasla(v)}
                            >
                              Düzenle
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="ml-1 text-red-600 hover:bg-red-50"
                              leftIcon={<Trash2 />}
                              onClick={() => sil(v.id, v.ad)}
                            >
                              Sil
                            </Button>
                          </td>
                        </>
                      )}
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

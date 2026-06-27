'use client';
import { useEffect, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { apiFetch } from '../../../lib/api';
import {
  Alert,
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
} from '@belediyesinden/ui';

interface Varlik {
  id: string;
  ad: string;
  tip: string;
  aciklama: string | null;
}

const TIPLER = [
  { value: 'TASINIR', label: 'Taşınır' },
  { value: 'TASINMAZ', label: 'Taşınmaz' },
  { value: 'ISLETME_HAKKI', label: 'İşletme Hakkı' },
  { value: 'REKLAM_ALANI', label: 'Reklam Alanı' },
];
const TIP_LABEL: Record<string, string> = Object.fromEntries(TIPLER.map((t) => [t.value, t.label]));

export default function VarliklarPage() {
  const [varliklar, setVarliklar] = useState<Varlik[]>([]);
  const [ad, setAd] = useState('');
  const [tip, setTip] = useState(TIPLER[0].value);
  const [aciklama, setAciklama] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editId, setEditId] = useState<string | null>(null);
  const [editAd, setEditAd] = useState('');
  const [editAciklama, setEditAciklama] = useState('');
  const [saving, setSaving] = useState(false);

  const yukle = () => apiFetch<Varlik[]>('/varlik').then(setVarliklar).catch(() => {});
  useEffect(() => {
    yukle();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ad.trim()) {
      setError('Ad zorunludur.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch('/varlik', {
        method: 'POST',
        body: JSON.stringify({ tip, ad: ad.trim(), aciklama: aciklama.trim() || undefined }),
      });
      setAd('');
      setAciklama('');
      await yukle();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Oluşturma başarısız.');
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
    setError(null);
    try {
      await apiFetch(`/varlik/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ ad: editAd.trim(), aciklama: editAciklama.trim() || null }),
      });
      setEditId(null);
      await yukle();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Güncelleme başarısız.');
    } finally {
      setSaving(false);
    }
  }

  async function sil(id: string, ad: string) {
    if (!window.confirm(`"${ad}" varlığını silmek istediğinize emin misiniz?`)) return;
    setError(null);
    try {
      await apiFetch(`/varlik/${id}`, { method: 'DELETE' });
      await yukle();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Silme başarısız.');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Varlıklar</h1>
        <p className="mt-1 text-sm text-gray-500">Belediye varlık envanteri</p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

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
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Varlık Listesi ({varliklar.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {varliklar.length === 0 ? (
            <EmptyState title="Kayıtlı varlık yok" description="Yukarıdaki formdan ilk varlığı ekleyin." />
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
                          <td className="px-4 text-gray-500">{TIP_LABEL[v.tip] ?? v.tip}</td>
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
                          <td className="px-4 text-gray-600">{TIP_LABEL[v.tip] ?? v.tip}</td>
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

'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Ban, CheckCircle2, FileEdit, FileText, Gavel, Plus, Trophy } from 'lucide-react';
import { apiFetch } from '../../../lib/api';
import { RequireTenantAdmin } from '../../../components/require-tenant-admin';
import {
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
  useToast,
} from '@belediyesinden/ui';

interface Ilan {
  id: string;
  baslik: string;
  ihale_tipi: string;
  islem_turu: string | null;
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

const ISLEM_TURU = [
  { value: 'SATIS', label: 'Satış' },
  { value: 'KIRALAMA', label: 'Kiralama' },
  { value: 'ISLETME_HAKKI_DEVRI', label: 'İşletme Hakkı Devri' },
];
const ISLEM_TURU_ETIKET: Record<string, string> = Object.fromEntries(ISLEM_TURU.map((t) => [t.value, t.label]));

const STAT_TANIMLARI = [
  { durum: 'TASLAK', label: 'Taslak', icon: FileEdit, renk: 'text-gray-500 bg-gray-100' },
  { durum: 'YAYINDA', label: 'Yayında', icon: Gavel, renk: 'text-emerald-600 bg-emerald-50' },
  { durum: 'SONUCLANDI', label: 'Sonuçlandı', icon: Trophy, renk: 'text-amber-600 bg-amber-50' },
  { durum: 'IPTAL', label: 'İptal', icon: Ban, renk: 'text-red-500 bg-red-50' },
] as const;

export default function AdminIlanlarPage() {
  return (
    <RequireTenantAdmin>
      <AdminIlanlarIcerik />
    </RequireTenantAdmin>
  );
}

function AdminIlanlarIcerik() {
  const toast = useToast();
  const router = useRouter();
  const [ilanlar, setIlanlar] = useState<Ilan[]>([]);
  const [varliklar, setVarliklar] = useState<Varlik[]>([]);
  const [baslik, setBaslik] = useState('');
  const [varlikId, setVarlikId] = useState('');
  const [ihaleTipi, setIhaleTipi] = useState(IHALE_TIP[0].value);
  const [islemTuru, setIslemTuru] = useState(ISLEM_TURU[0].value);
  const [fiyat, setFiyat] = useState('');
  const [ilanTarihi, setIlanTarihi] = useState('');
  const [ihaleTarihi, setIhaleTarihi] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

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

  const istatistikler = useMemo(
    () => STAT_TANIMLARI.map((s) => ({ ...s, sayi: ilanlar.filter((i) => i.durum === s.durum).length })),
    [ilanlar],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!baslik.trim() || !varlikId || !fiyat) {
      toast.error('Başlık, varlık ve başlangıç fiyatı zorunludur.');
      return;
    }
    if (!ilanTarihi || !ihaleTarihi) {
      toast.error('İlan tarihi ve ihale tarihi zorunludur.');
      return;
    }
    setSubmitting(true);
    try {
      const created = await apiFetch<{ id: string }>('/ilan', {
        method: 'POST',
        body: JSON.stringify({
          baslik: baslik.trim(),
          varlikId,
          ihaleTipi,
          islemTuru,
          baslangicFiyati: Number(fiyat),
          ilanTarihi,
          ihaleTarihi,
        }),
      });
      toast.success('İlan oluşturuldu (taslak) — fotoğraf ve evrak eklemeye devam edin.');
      router.push(`/admin/ilanlar/${created.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Oluşturma başarısız.');
    } finally {
      setSubmitting(false);
    }
  }

  async function durumDegistir(id: string, durum: string, onayMesaji: string) {
    if (!window.confirm(onayMesaji)) return;
    setBusyId(id);
    try {
      await apiFetch(`/ilan/${id}/durum`, { method: 'POST', body: JSON.stringify({ durum }) });
      toast.success(durum === 'YAYINDA' ? 'İlan yayınlandı.' : 'İlan iptal edildi.');
      await yukle();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Durum değişikliği başarısız.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">İlanlar</h1>
        <p className="mt-1 text-sm text-gray-500">İhale ilanlarını oluşturun ve yönetin</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {istatistikler.map((s) => (
          <div key={s.durum} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-xs">
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
          <CardTitle className="text-base">Yeni İlan (Taslak)</CardTitle>
        </CardHeader>
        <CardContent>
          {varliklar.length === 0 ? (
            <EmptyState
              icon={<FileText />}
              title="Önce bir varlık gerekli"
              description="İlan oluşturmadan önce belediye envanterine en az bir varlık eklenmeli."
              action={
                <Button size="sm" leftIcon={<Plus />} onClick={() => router.push('/admin/varliklar')}>
                  Varlık Ekle
                </Button>
              }
            />
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
                <FieldLabel required>İşlem Türü</FieldLabel>
                <Select value={islemTuru} onChange={(e) => setIslemTuru(e.target.value)}>
                  {ISLEM_TURU.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field>
                <FieldLabel required>Başlangıç Fiyatı (₺)</FieldLabel>
                <Input type="number" value={fiyat} onChange={(e) => setFiyat(e.target.value)} placeholder="Örn: 250000" />
              </Field>
              <Field>
                <FieldLabel required>İlan Tarihi</FieldLabel>
                <Input type="date" value={ilanTarihi} onChange={(e) => setIlanTarihi(e.target.value)} />
                <p className="mt-1 text-xs text-gray-400">Bugünden en az 10 gün sonrası seçilmeli.</p>
              </Field>
              <Field>
                <FieldLabel required>İhale Tarihi</FieldLabel>
                <Input type="date" value={ihaleTarihi} onChange={(e) => setIhaleTarihi(e.target.value)} />
                <p className="mt-1 text-xs text-gray-400">İlan tarihinden en az 10 gün sonrası seçilmeli.</p>
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
            <EmptyState icon={<FileText />} title="İlan yok" description="Yukarıdaki formdan ilk ilanı oluşturun." />
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
                        <span className="ml-2 text-xs text-gray-400">
                          {ilan.ihale_tipi}
                          {ilan.islem_turu && ` · ${ISLEM_TURU_ETIKET[ilan.islem_turu] ?? ilan.islem_turu}`}
                        </span>
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
                            loading={busyId === ilan.id}
                            leftIcon={<CheckCircle2 />}
                            onClick={() =>
                              durumDegistir(ilan.id, 'YAYINDA', `"${ilan.baslik}" ilanını yayınlamak istediğinize emin misiniz?`)
                            }
                          >
                            Yayınla
                          </Button>
                        )}
                        {(ilan.durum === 'YAYINDA' || ilan.durum === 'CANLI_ARTIRMA') && (
                          <Button
                            size="sm"
                            variant="outline"
                            loading={busyId === ilan.id}
                            leftIcon={<Ban />}
                            className="text-red-600"
                            onClick={() =>
                              durumDegistir(ilan.id, 'IPTAL', `"${ilan.baslik}" ilanını iptal etmek istediğinize emin misiniz? Bu işlem geri alınamaz.`)
                            }
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

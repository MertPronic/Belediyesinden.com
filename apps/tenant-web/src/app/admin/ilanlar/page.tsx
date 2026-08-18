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
  /** Tek-varlık dönemden kalma (KK-25 öncesi) — yeni ilanlarda null, fiyat kalem bazlı. */
  baslangic_fiyati: string | null;
  baslangic_tarihi: string | null;
  bitis_tarihi: string | null;
  il: string | null;
  ilce: string | null;
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
  const [baslik, setBaslik] = useState('');
  const [ihaleTipi, setIhaleTipi] = useState(IHALE_TIP[0].value);
  const [islemTuru, setIslemTuru] = useState(ISLEM_TURU[0].value);
  const [ilanTarihi, setIlanTarihi] = useState('');
  const [ihaleTarihi, setIhaleTarihi] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const yukle = useCallback(() => {
    apiFetch<Ilan[]>('/ilan')
      .catch(() => [])
      .then(setIlanlar);
  }, []);

  useEffect(() => {
    yukle();
  }, [yukle]);

  const istatistikler = useMemo(
    () => STAT_TANIMLARI.map((s) => ({ ...s, sayi: ilanlar.filter((i) => i.durum === s.durum).length })),
    [ilanlar],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!baslik.trim()) {
      toast.error('Başlık zorunludur.');
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
          ihaleTipi,
          islemTuru,
          ilanTarihi,
          ihaleTarihi,
        }),
      });
      toast.success('İlan oluşturuldu (taslak) — şimdi varlık ekleyin.');
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
          <p className="mb-4 text-xs text-gray-500">
            Varlıklar ilan oluşturulduktan sonra, ilan detay sayfasından tek tek eklenir — bir
            ilan istediğiniz kadar varlık içerebilir.
          </p>
          <form onSubmit={submit} className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
            <Field className="sm:col-span-2">
              <FieldLabel required>Başlık</FieldLabel>
              <Input value={baslik} onChange={(e) => setBaslik(e.target.value)} placeholder="İlan başlığı" />
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
              <FieldLabel required>İlan Tarihi</FieldLabel>
              <Input type="date" value={ilanTarihi} onChange={(e) => setIlanTarihi(e.target.value)} />
              <p className="mt-1 text-xs text-gray-400">Bugünden en az 10 gün sonrası seçilmeli.</p>
            </Field>
            <Field>
              <FieldLabel required>İhale Tarihi</FieldLabel>
              <Input type="date" value={ihaleTarihi} onChange={(e) => setIhaleTarihi(e.target.value)} />
              <p className="mt-1 text-xs text-gray-400">
                İlan tarihinden en az 10 gün sonrası seçilmeli — ilandaki tüm varlıklar bu tarihte
                birlikte ihaleye açılır.
              </p>
            </Field>
            <div className="mt-3 sm:col-span-2">
              <Button type="submit" loading={submitting} leftIcon={<Plus />}>
                İlan Oluştur
              </Button>
            </div>
          </form>
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
                    <th className="px-4">Konum</th>
                    <th className="px-4">İlan Tarihi</th>
                    <th className="px-4">İhale Tarihi</th>
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
                      <td className="px-4 text-gray-500">
                        {[ilan.ilce, ilan.il].filter(Boolean).join(', ') || '—'}
                      </td>
                      <td className="px-4 text-gray-500">
                        {ilan.baslangic_tarihi ? new Date(ilan.baslangic_tarihi).toLocaleDateString('tr-TR') : '—'}
                      </td>
                      <td className="px-4 text-gray-500">
                        {ilan.bitis_tarihi ? new Date(ilan.bitis_tarihi).toLocaleDateString('tr-TR') : '—'}
                      </td>
                      <td className="px-4">
                        <DurumBadge durum={ilan.durum} />
                      </td>
                      <td className="px-4 text-right tabular-nums">
                        {ilan.baslangic_fiyati != null
                          ? `${Number(ilan.baslangic_fiyati).toLocaleString('tr-TR')} ₺`
                          : '—'}
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

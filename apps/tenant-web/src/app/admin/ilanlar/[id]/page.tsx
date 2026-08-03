'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Ban, Check, CheckCircle2, FileText, Gavel, Trophy, Upload, X } from 'lucide-react';
import { apiFetch, downloadFile } from '../../../../lib/api';
import { RequireTenantAdmin } from '../../../../components/require-tenant-admin';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  cn,
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
  aciklama: string | null;
  ihale_tipi: string;
  durum: string;
  baslangic_fiyati: string;
  baslangic_tarihi: string | null;
  bitis_tarihi: string | null;
  sartname_ucretli: boolean;
  sartname_tutari: string | null;
  katilim_sartlari: string[];
  il: string | null;
  ilce: string | null;
}

interface Evrak {
  id: string;
  dosya_adi: string;
  content_type: string | null;
  boyut: number | null;
  tip: string;
  created_at: string;
}

const EVRAK_TIPLERI = [
  { value: 'IDARI_SARTNAME', label: 'İdari Şartname' },
  { value: 'TEKNIK_SARTNAME', label: 'Teknik Şartname' },
  { value: 'IHALE_DOSYASI', label: 'İhale Dosyası' },
  { value: 'DIGER', label: 'Diğer' },
];
const EVRAK_TIPI_ETIKET: Record<string, string> = Object.fromEntries(
  EVRAK_TIPLERI.map((t) => [t.value, t.label]),
);
const ZORUNLU_EVRAK_TIPLERI = ['IDARI_SARTNAME', 'TEKNIK_SARTNAME', 'IHALE_DOSYASI'];

/** Katılım şartları — taslak liste, Harun (PO) ile teyit edilecek. */
const KATILIM_SARTLARI = [
  { value: 'VERGI_BORCU_OLMAMA', label: 'Vergi borcu olmama' },
  { value: 'SGK_BORCU_OLMAMA', label: 'SGK borcu olmama' },
  { value: 'GECICI_TEMINAT_YATIRMA', label: 'Geçici teminat yatırma' },
  { value: 'IHALEYE_KATILIM_YASAGI_OLMAMA', label: 'İhaleye katılım yasağı bulunmama' },
  { value: 'TICARET_SICIL_KAYDI', label: 'Ticaret sicil kaydı' },
  { value: 'IMZA_SIRKULERI_VEKALETNAME', label: 'İmza sirküleri / vekaletname' },
];

/** ISO tarih/datetime'ı <input type="date"> için YYYY-MM-DD'ye kırpar. */
function tarihInputDegeri(iso: string | null): string {
  return iso ? iso.slice(0, 10) : '';
}

export default function AdminIlanDetayPage() {
  return (
    <RequireTenantAdmin>
      <AdminIlanDetayIcerik />
    </RequireTenantAdmin>
  );
}

function AdminIlanDetayIcerik() {
  const params = useParams<{ id: string }>();
  const toast = useToast();
  const [ilan, setIlan] = useState<Ilan | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [evrakTipi, setEvrakTipi] = useState(EVRAK_TIPLERI[0].value);
  const [evraklar, setEvraklar] = useState<Evrak[]>([]);
  const [uploading, setUploading] = useState(false);
  const [gorselFiles, setGorselFiles] = useState<FileList | null>(null);
  const [gorselUploading, setGorselUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(true);

  // TASLAK düzenleme formu (yayınlama ön koşulları).
  const [ilanTarihi, setIlanTarihi] = useState('');
  const [ihaleTarihi, setIhaleTarihi] = useState('');
  const [sartnameUcretli, setSartnameUcretli] = useState(false);
  const [sartnameTutari, setSartnameTutari] = useState('');
  const [katilimSartlari, setKatilimSartlari] = useState<string[]>([]);
  const [il, setIl] = useState('');
  const [ilce, setIlce] = useState('');
  const [taslakSaving, setTaslakSaving] = useState(false);

  const yukle = useCallback(() => {
    apiFetch<Ilan>(`/ilan/${params.id}`)
      .then((i) => {
        setIlan(i);
        setIlanTarihi(tarihInputDegeri(i.baslangic_tarihi));
        setIhaleTarihi(tarihInputDegeri(i.bitis_tarihi));
        setSartnameUcretli(i.sartname_ucretli);
        setSartnameTutari(i.sartname_tutari ?? '');
        setKatilimSartlari(i.katilim_sartlari ?? []);
        setIl(i.il ?? '');
        setIlce(i.ilce ?? '');
      })
      .catch(() => toast.error('İlan yüklenemedi.'))
      .finally(() => setYukleniyor(false));
    apiFetch<Evrak[]>(`/evrak/ilan/${params.id}`)
      .then(setEvraklar)
      .catch(() => setEvraklar([]));
  }, [params.id]);

  useEffect(() => {
    yukle();
  }, [yukle]);

  const yuklenenTipSeti = useMemo(() => new Set(evraklar.map((e) => e.tip)), [evraklar]);
  const zorunluTamamlanan = ZORUNLU_EVRAK_TIPLERI.filter((t) => yuklenenTipSeti.has(t)).length;

  function katilimSartiToggle(value: string) {
    setKatilimSartlari((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  }

  async function taslakKaydet() {
    if (sartnameUcretli && !(Number(sartnameTutari) > 0)) {
      toast.error("Şartname ücretliyse tutar girilmeli (0'dan büyük).");
      return;
    }
    setTaslakSaving(true);
    try {
      await apiFetch(`/ilan/${params.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          ilanTarihi: ilanTarihi || undefined,
          ihaleTarihi: ihaleTarihi || undefined,
          sartnameUcretli,
          sartnameTutari: sartnameUcretli ? Number(sartnameTutari) : undefined,
          katilimSartlari,
          il: il.trim() || undefined,
          ilce: ilce.trim() || undefined,
        }),
      });
      toast.success('Taslak kaydedildi.');
      await yukle();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kaydetme başarısız.');
    } finally {
      setTaslakSaving(false);
    }
  }

  async function durumDegistir(durum: string, onayMesaji: string) {
    if (!window.confirm(onayMesaji)) return;
    setBusy(true);
    try {
      await apiFetch(`/ilan/${params.id}/durum`, { method: 'POST', body: JSON.stringify({ durum }) });
      await yukle();
      const basariMesaji: Record<string, string> = {
        YAYINDA: 'İlan yayınlandı.',
        CANLI_ARTIRMA: 'İhale başlatıldı — teklif verilebilir.',
        IPTAL: 'İlan iptal edildi.',
      };
      toast.success(basariMesaji[durum] ?? 'Durum güncellendi.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'İşlem başarısız.');
    } finally {
      setBusy(false);
    }
  }

  async function sonuclandir() {
    if (!window.confirm('İhaleyi sonuçlandırmak istediğinize emin misiniz? En yüksek teklif kazanan ilan edilecek ve bu işlem geri alınamaz.')) return;
    setBusy(true);
    try {
      await apiFetch(`/ilan/${params.id}/sonuclandir`, { method: 'POST' });
      await yukle();
      toast.success('İhale sonuçlandırıldı (en yüksek teklif kazanan).');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sonuçlandırma başarısız.');
    } finally {
      setBusy(false);
    }
  }

  async function evrakYukle(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      toast.error('Dosya seçin.');
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('tip', evrakTipi);
      await apiFetch(`/evrak/${params.id}`, { method: 'POST', body: fd });
      setFile(null);
      toast.success('Evrak yüklendi.');
      await yukle();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Yükleme başarısız.');
    } finally {
      setUploading(false);
    }
  }

  async function gorselYukle(e: React.FormEvent) {
    e.preventDefault();
    if (!gorselFiles || gorselFiles.length === 0) {
      toast.error('En az bir görsel seçin.');
      return;
    }
    setGorselUploading(true);
    try {
      const fd = new FormData();
      Array.from(gorselFiles).forEach((f) => fd.append('files', f));
      await apiFetch(`/ilan/${params.id}/gorsel`, { method: 'POST', body: fd });
      const adet = gorselFiles.length;
      setGorselFiles(null);
      toast.success(`${adet} görsel yüklendi.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Görsel yükleme başarısız.');
    } finally {
      setGorselUploading(false);
    }
  }

  if (yukleniyor) {
    return (
      <div className="space-y-6">
        <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
        <div className="h-32 animate-pulse rounded-xl bg-gray-100" />
        <div className="h-48 animate-pulse rounded-xl bg-gray-100" />
      </div>
    );
  }

  if (!ilan) {
    return <EmptyState icon={<FileText />} title="İlan bulunamadı" description="Bu ilan silinmiş ya da hiç var olmamış olabilir." />;
  }

  return (
    <div className="space-y-6">
      <Link
        href="/admin/ilanlar"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        İlanlara dön
      </Link>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-2xl">{ilan.baslik}</CardTitle>
              <p className="mt-1 text-sm text-gray-500">{ilan.ihale_tipi}</p>
            </div>
            <DurumBadge durum={ilan.durum} />
          </div>
        </CardHeader>
        <CardContent>
          {ilan.aciklama && <p className="mb-4 text-gray-700">{ilan.aciklama}</p>}
          <p className="text-sm">
            Başlangıç: <strong className="text-gray-900">{Number(ilan.baslangic_fiyati).toLocaleString('tr-TR')} ₺</strong>
          </p>
        </CardContent>
      </Card>

      {ilan.durum === 'TASLAK' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Taslak Düzenle (yayınlama ön koşulları)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
              <Field>
                <FieldLabel required>İlan Tarihi</FieldLabel>
                <Input type="date" value={ilanTarihi} onChange={(e) => setIlanTarihi(e.target.value)} />
                <p className="mt-1 text-xs text-gray-400">Bugünden en az 10 gün sonrası olmalı.</p>
              </Field>
              <Field>
                <FieldLabel required>İhale Tarihi</FieldLabel>
                <Input type="date" value={ihaleTarihi} onChange={(e) => setIhaleTarihi(e.target.value)} />
                <p className="mt-1 text-xs text-gray-400">İlan tarihinden en az 10 gün sonrası olmalı.</p>
              </Field>
              <Field>
                <FieldLabel>İl</FieldLabel>
                <Input value={il} onChange={(e) => setIl(e.target.value)} placeholder="Örn: Kayseri" />
              </Field>
              <Field>
                <FieldLabel>İlçe</FieldLabel>
                <Input value={ilce} onChange={(e) => setIlce(e.target.value)} placeholder="Örn: Talas" />
                <p className="mt-1 text-xs text-gray-400">İsteğe bağlı — vatandaş sayfasında konum olarak gösterilir.</p>
              </Field>
            </div>

            <Field className="mb-0">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={sartnameUcretli}
                  onChange={(e) => setSartnameUcretli(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                Şartname bedeli ücretli
              </label>
            </Field>
            {sartnameUcretli && (
              <Field className="sm:w-56">
                <FieldLabel required>Şartname Tutarı (₺)</FieldLabel>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={sartnameTutari}
                  onChange={(e) => setSartnameTutari(e.target.value)}
                />
              </Field>
            )}

            <Field className="mb-0">
              <FieldLabel required>Katılım Şartları</FieldLabel>
              <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
                {KATILIM_SARTLARI.map((s) => {
                  const secili = katilimSartlari.includes(s.value);
                  return (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => katilimSartiToggle(s.value)}
                      className={cn(
                        'flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors',
                        secili
                          ? 'border-[var(--renk,#2563eb)] bg-[color-mix(in_srgb,var(--renk,#2563eb)_8%,white)] text-gray-900'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                          secili ? 'border-[var(--renk,#2563eb)] bg-[var(--renk,#2563eb)]' : 'border-gray-300',
                        )}
                      >
                        {secili && <Check className="h-3.5 w-3.5 text-white" />}
                      </span>
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </Field>

            <Button loading={taslakSaving} onClick={taslakKaydet}>
              Taslağı Kaydet
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Durum Yönetimi</CardTitle>
        </CardHeader>
        <CardContent>
          {ilan.durum === 'TASLAK' && (
            <Button loading={busy} leftIcon={<CheckCircle2 />} onClick={() => durumDegistir('YAYINDA', 'İlanı yayınlamak istediğinize emin misiniz?')}>
              Yayınla
            </Button>
          )}
          {ilan.durum === 'YAYINDA' && (
            <div className="flex flex-wrap gap-2">
              <Button
                loading={busy}
                leftIcon={<Gavel />}
                onClick={() => durumDegistir('CANLI_ARTIRMA', 'İhaleyi başlatmak istediğinize emin misiniz? Başlatıldıktan sonra teklif kabul edilmeye başlanır.')}
              >
                İhaleyi Başlat
              </Button>
              <Button
                variant="outline"
                loading={busy}
                leftIcon={<Ban />}
                className="text-red-600"
                onClick={() => durumDegistir('IPTAL', 'İlanı iptal etmek istediğinize emin misiniz? Bu işlem geri alınamaz.')}
              >
                İptal Et
              </Button>
            </div>
          )}
          {ilan.durum === 'YAYINDA' && (
            <p className="mt-2 text-xs text-gray-400">
              İhale tarihi gelmeden ihale başlatılamaz — tarih gelmeden denerseniz backend reddeder.
            </p>
          )}
          {ilan.durum === 'CANLI_ARTIRMA' && (
            <div className="flex flex-wrap gap-2">
              <Button loading={busy} leftIcon={<Trophy />} onClick={sonuclandir}>
                Sonuçlandır
              </Button>
              <Button
                variant="outline"
                loading={busy}
                leftIcon={<Ban />}
                className="text-red-600"
                onClick={() => durumDegistir('IPTAL', 'İlanı iptal etmek istediğinize emin misiniz? Bu işlem geri alınamaz.')}
              >
                İptal Et
              </Button>
            </div>
          )}
          {ilan.durum === 'IPTAL' && (
            <EmptyState icon={<Ban />} title="Bu ilan iptal edilmiş" description="İptal edilen ilanlar üzerinde başka bir işlem yapılamaz." />
          )}
          {ilan.durum === 'SONUCLANDI' && (
            <EmptyState icon={<Trophy />} title="İhale sonuçlandı" description="Kazanan belirlendi, bu ilan üzerinde başka bir işlem yapılamaz." />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Şartname / Evrak</CardTitle>
        </CardHeader>
        <CardContent>
          {ilan.durum === 'TASLAK' && (
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 px-3 py-2.5 text-xs">
              <span className="font-medium text-gray-700">Zorunlu belgeler: {zorunluTamamlanan}/3</span>
              {ZORUNLU_EVRAK_TIPLERI.map((t) => (
                <span
                  key={t}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2 py-0.5',
                    yuklenenTipSeti.has(t) ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-500',
                  )}
                >
                  {yuklenenTipSeti.has(t) ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                  {EVRAK_TIPI_ETIKET[t]}
                </span>
              ))}
            </div>
          )}

          <form onSubmit={evrakYukle} className="space-y-3">
            <Field className="sm:w-64">
              <FieldLabel required>Evrak Kategorisi</FieldLabel>
              <Select value={evrakTipi} onChange={(e) => setEvrakTipi(e.target.value)}>
                {EVRAK_TIPLERI.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
            <input
              type="file"
              accept=".pdf,image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-4 file:py-2 file:text-gray-700 hover:file:bg-gray-200"
            />
            <Button type="submit" variant="outline" loading={uploading} leftIcon={<Upload />}>
              Evrak Yükle
            </Button>
          </form>

          {evraklar.length > 0 && (
            <div className="mt-4 divide-y divide-gray-100 rounded-lg border border-gray-100">
              {evraklar.map((ev) => (
                <div key={ev.id} className="flex items-center justify-between px-3 py-2.5 text-sm">
                  <span className="flex min-w-0 items-center gap-2 text-gray-700">
                    <FileText className="h-4 w-4 shrink-0 text-gray-400" />
                    <span className="truncate">{ev.dosya_adi}</span>
                    <Badge variant="default">{EVRAK_TIPI_ETIKET[ev.tip] ?? ev.tip}</Badge>
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      downloadFile(`/evrak/${ev.id}`, ev.dosya_adi).catch((e) =>
                        toast.error(e instanceof Error ? e.message : 'İndirme başarısız.'),
                      )
                    }
                  >
                    İndir
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">İlan Görselleri (galeri)</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={gorselYukle} className="space-y-3">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setGorselFiles(e.target.files)}
              className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-4 file:py-2 file:text-gray-700 hover:file:bg-gray-200"
            />
            {gorselFiles && <p className="text-xs text-gray-500">{gorselFiles.length} görsel seçili</p>}
            <Button type="submit" variant="outline" loading={gorselUploading} leftIcon={<Upload />}>
              Görselleri Yükle (max 15)
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Ban, Building2, Camera, Check, CheckCircle2, ChevronDown, ChevronUp, FileText, Gavel, Handshake, ImagePlus, MapPin, Megaphone, Package, Plus, Trash2, Trophy, Upload, X } from 'lucide-react';
import { apiFetch, downloadFile, getTenantSlug } from '../../../../lib/api';
import { useCanliTeklifler } from '../../../../lib/use-canli-teklifler';
import { RequireTenantAdmin } from '../../../../components/require-tenant-admin';
import { CanliTeklifGorunumu } from '../../../../components/canli-teklif-gorunumu';
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
  TutarInput,
  useToast,
} from '@belediyesinden/ui';

interface Ilan {
  id: string;
  baslik: string;
  aciklama: string | null;
  ihale_tipi: string;
  islem_turu: string | null;
  durum: string;
  /** Tek-varlık dönemden kalma (KK-25 öncesi) — yeni ilanlarda null, fiyat kalem bazlı (bkz. Kalem). */
  baslangic_fiyati: string | null;
  baslangic_tarihi: string | null;
  bitis_tarihi: string | null;
  sartname_ucretli: boolean;
  sartname_tutari: string | null;
  katilim_sartlari: string[];
  kurallar: { minArtirmaAdimi?: number } | null;
  /** Varlıktan oluşturma anında kopyalanır — ilan seviyesinde düzenlenemez (KK-24). */
  il: string | null;
  ilce: string | null;
  lat: number | null;
  lng: number | null;
}

/** İlan kalemi — ilana eklenmiş bir varlık + o varlığın bu ilandaki fiyatı/durumu (KK-25). */
interface Kalem {
  id: string;
  varlik_id: string;
  varlik_ad: string;
  varlik_tip: string;
  baslangic_fiyati: string;
  bitis_tarihi: string | null;
  durum: string;
}

interface VarlikSecenek {
  id: string;
  ad: string;
  tip: string;
}

interface Evrak {
  id: string;
  dosya_adi: string;
  content_type: string | null;
  boyut: number | null;
  tip: string;
  created_at: string;
}

interface Gorsel {
  id: string;
  dosya_adi: string;
}

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3000/api';

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

const ISLEM_TURU_ETIKET: Record<string, string> = {
  SATIS: 'Satış',
  KIRALAMA: 'Kiralama',
  ISLETME_HAKKI_DEVRI: 'İşletme Hakkı Devri',
};

/** Katılım şartları — taslak liste, Harun (PO) ile teyit edilecek. */
const KATILIM_SARTLARI = [
  { value: 'VERGI_BORCU_OLMAMA', label: 'Vergi borcu olmama' },
  { value: 'SGK_BORCU_OLMAMA', label: 'SGK borcu olmama' },
  { value: 'GECICI_TEMINAT_YATIRMA', label: 'Geçici teminat yatırma' },
  { value: 'IHALEYE_KATILIM_YASAGI_OLMAMA', label: 'İhaleye katılım yasağı bulunmama' },
  { value: 'TICARET_SICIL_KAYDI', label: 'Ticaret sicil kaydı' },
  { value: 'IMZA_SIRKULERI_VEKALETNAME', label: 'İmza sirküleri / vekaletname' },
];

/** Durum makinesinin ilerleme sırası — stepper bundan türetilir, IPTAL akış dışı terminal olduğu için ayrı ele alınır. */
const DURUM_SIRASI = ['TASLAK', 'YAYINDA', 'CANLI_ARTIRMA', 'SONUCLANDI'];
const DURUM_ETIKET: Record<string, string> = {
  TASLAK: 'Taslak',
  YAYINDA: 'Yayında',
  CANLI_ARTIRMA: 'Canlı Artırma',
  SONUCLANDI: 'Sonuçlandı',
};

/** ISO tarih/datetime'ı <input type="date"> için YYYY-MM-DD'ye kırpar. */
function tarihInputDegeri(iso: string | null): string {
  return iso ? iso.slice(0, 10) : '';
}

/** Varlık tipi → ikon + renk (admin/varliklar listesiyle tutarlı, KK-25). */
const VARLIK_TIP_BILGI: Record<string, { label: string; icon: typeof Package; renk: string; bg: string }> = {
  TASINIR: { label: 'Taşınır', icon: Package, renk: 'text-blue-600', bg: 'bg-blue-50' },
  TASINMAZ: { label: 'Taşınmaz', icon: Building2, renk: 'text-emerald-600', bg: 'bg-emerald-50' },
  ISLETME_HAKKI: { label: 'İşletme Hakkı', icon: Handshake, renk: 'text-amber-600', bg: 'bg-amber-50' },
  REKLAM_ALANI: { label: 'Reklam Alanı', icon: Megaphone, renk: 'text-purple-600', bg: 'bg-purple-50' },
};

/**
 * Tek bir kalem (varlık) satırı — CANLI_ARTIRMA'daysa kendi canlı teklif akışına
 * abone olur ve "Sonuçlandır" butonunu gösterir. Her kalem bağımsız (KK-25),
 * bu yüzden `useCanliTeklifler` burada, satır bazında çağrılıyor.
 */
function KalemSatiri({
  kalem,
  ilanDurum,
  ihaleTipi,
  minArtirmaAdimi,
  silinenId,
  sonuclandiranId,
  onCikar,
  onSonuclandir,
}: {
  kalem: Kalem;
  ilanDurum: string;
  ihaleTipi: string;
  minArtirmaAdimi: number;
  silinenId: string | null;
  sonuclandiranId: string | null;
  onCikar: (kalemId: string) => void;
  onSonuclandir: (kalemId: string) => void;
}) {
  const canliAktif = kalem.durum === 'CANLI_ARTIRMA';
  const { teklifler, yeniTeklifIds, connected } = useCanliTeklifler(kalem.id, canliAktif);

  const [fotoAcik, setFotoAcik] = useState(false);
  const [gorseller, setGorseller] = useState<Gorsel[]>([]);
  const [gorselFiles, setGorselFiles] = useState<FileList | null>(null);
  const [gorselUploading, setGorselUploading] = useState(false);
  const toast = useToast();

  const gorselleriYukle = useCallback(() => {
    apiFetch<Gorsel[]>(`/varlik/${kalem.varlik_id}/gorsel`)
      .then(setGorseller)
      .catch(() => setGorseller([]));
  }, [kalem.varlik_id]);

  useEffect(() => {
    gorselleriYukle();
  }, [gorselleriYukle]);

  async function fotoYukle(e: React.FormEvent) {
    e.preventDefault();
    if (!gorselFiles || gorselFiles.length === 0) {
      toast.error('En az bir fotoğraf seçin.');
      return;
    }
    setGorselUploading(true);
    try {
      const fd = new FormData();
      Array.from(gorselFiles).forEach((f) => fd.append('files', f));
      await apiFetch(`/varlik/${kalem.varlik_id}/gorsel`, { method: 'POST', body: fd });
      const adet = gorselFiles.length;
      setGorselFiles(null);
      toast.success(`${adet} fotoğraf yüklendi.`);
      gorselleriYukle();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fotoğraf yükleme başarısız.');
    } finally {
      setGorselUploading(false);
    }
  }

  const tipBilgi = VARLIK_TIP_BILGI[kalem.varlik_tip] ?? {
    label: kalem.varlik_tip,
    icon: Package,
    renk: 'text-gray-500',
    bg: 'bg-gray-100',
  };
  const TipIcon = tipBilgi.icon;
  const kapak = gorseller[0] ? `${API_URL}/varlik/gorsel/${gorseller[0].id}?tenant=${getTenantSlug()}` : null;
  const cikarilabilir = kalem.durum === 'BEKLIYOR' && (ilanDurum === 'TASLAK' || ilanDurum === 'YAYINDA');

  return (
    <Card className="overflow-hidden">
      <div className="flex gap-3 p-3">
        {/* Kapak küçük resmi — yoksa tip ikonlu placeholder */}
        <div className={cn('flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg', tipBilgi.bg)}>
          {kapak ? (
            <img src={kapak} alt={kalem.varlik_ad} className="h-full w-full object-cover" />
          ) : (
            <TipIcon className={cn('h-6 w-6', tipBilgi.renk)} />
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <span className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium', tipBilgi.renk, tipBilgi.bg)}>
                <TipIcon className="h-3 w-3" />
                {tipBilgi.label}
              </span>
              <p className="mt-1 truncate text-sm font-semibold text-gray-900">{kalem.varlik_ad}</p>
            </div>
            <DurumBadge durum={kalem.durum} />
          </div>
          <p className="text-lg font-bold tracking-tight text-gray-900">
            {Number(kalem.baslangic_fiyati).toLocaleString('tr-TR')} ₺
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1 border-t border-gray-100 bg-gray-50/60 px-2 py-1.5">
        <Button
          size="sm"
          variant="ghost"
          className="text-gray-500"
          onClick={() => setFotoAcik((v) => !v)}
          rightIcon={fotoAcik ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        >
          <Camera className="h-3.5 w-3.5" />
          {gorseller.length > 0 ? `Fotoğraflar (${gorseller.length})` : 'Fotoğraf ekle'}
        </Button>
        <div className="flex-1" />
        {canliAktif && (
          <Button
            size="sm"
            loading={sonuclandiranId === kalem.id}
            leftIcon={<Trophy className="h-3.5 w-3.5" />}
            onClick={() => onSonuclandir(kalem.id)}
          >
            Sonuçlandır
          </Button>
        )}
        {cikarilabilir && (
          <Button
            size="sm"
            variant="ghost"
            className="text-red-600"
            loading={silinenId === kalem.id}
            onClick={() => onCikar(kalem.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {fotoAcik && (
        <div className="border-t border-gray-100 bg-gray-50 p-3">
          {gorseller.length > 0 ? (
            <div className="mb-3 grid grid-cols-4 gap-2 sm:grid-cols-5">
              {gorseller.map((g) => (
                <img
                  key={g.id}
                  src={`${API_URL}/varlik/gorsel/${g.id}?tenant=${getTenantSlug()}`}
                  alt={g.dosya_adi}
                  className="aspect-square w-full rounded-lg border border-gray-200 object-cover"
                />
              ))}
            </div>
          ) : (
            <p className="mb-2 text-xs text-gray-400">Bu varlığa henüz fotoğraf eklenmedi.</p>
          )}
          <form onSubmit={fotoYukle} className="flex flex-wrap items-center gap-2">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setGorselFiles(e.target.files)}
              className="text-xs text-gray-600 file:mr-2 file:rounded-lg file:border-0 file:bg-gray-200 file:px-3 file:py-1.5 file:text-xs file:text-gray-700 hover:file:bg-gray-300"
            />
            <Button type="submit" size="sm" variant="outline" loading={gorselUploading} leftIcon={<Upload className="h-3.5 w-3.5" />}>
              Yükle
            </Button>
          </form>
        </div>
      )}

      {canliAktif && (
        <div className="border-t border-gray-100 bg-gray-50 p-3">
          <CanliTeklifGorunumu
            teklifler={teklifler}
            yeniTeklifIds={yeniTeklifIds}
            connected={connected}
            baslangicFiyati={Number(kalem.baslangic_fiyati)}
            minArtirmaAdimi={minArtirmaAdimi}
            bitisTarihi={kalem.bitis_tarihi}
            ihaleTipi={ihaleTipi}
          />
        </div>
      )}
    </Card>
  );
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
  const [gorseller, setGorseller] = useState<Gorsel[]>([]);
  const [busy, setBusy] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(true);

  // Kalem (ilana eklenmiş varlık) yönetimi — KK-25.
  const [kalemler, setKalemler] = useState<Kalem[]>([]);
  const [varlikSecenekleri, setVarlikSecenekleri] = useState<VarlikSecenek[]>([]);
  const [kalemVarlikId, setKalemVarlikId] = useState('');
  const [kalemFiyat, setKalemFiyat] = useState('');
  const [kalemEkleniyor, setKalemEkleniyor] = useState(false);
  const [kalemSilinenId, setKalemSilinenId] = useState<string | null>(null);
  const [kalemSonuclandiranId, setKalemSonuclandiranId] = useState<string | null>(null);

  // TASLAK düzenleme formu (yayınlama ön koşulları).
  const [aciklama, setAciklama] = useState('');
  const [ilanTarihi, setIlanTarihi] = useState('');
  const [ihaleTarihi, setIhaleTarihi] = useState('');
  const [sartnameUcretli, setSartnameUcretli] = useState(false);
  const [sartnameTutari, setSartnameTutari] = useState('');
  const [katilimSartlari, setKatilimSartlari] = useState<string[]>([]);
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [taslakSaving, setTaslakSaving] = useState(false);

  const yukle = useCallback(() => {
    apiFetch<Ilan>(`/ilan/${params.id}`)
      .then((i) => {
        setIlan(i);
        setAciklama(i.aciklama ?? '');
        setIlanTarihi(tarihInputDegeri(i.baslangic_tarihi));
        setIhaleTarihi(tarihInputDegeri(i.bitis_tarihi));
        setSartnameUcretli(i.sartname_ucretli);
        setSartnameTutari(i.sartname_tutari ?? '');
        setKatilimSartlari(i.katilim_sartlari ?? []);
        setLat(i.lat != null ? String(i.lat) : '');
        setLng(i.lng != null ? String(i.lng) : '');
      })
      .catch(() => toast.error('İlan yüklenemedi.'))
      .finally(() => setYukleniyor(false));
    apiFetch<Evrak[]>(`/evrak/ilan/${params.id}`)
      .then(setEvraklar)
      .catch(() => setEvraklar([]));
    apiFetch<Gorsel[]>(`/ilan/${params.id}/gorsel`)
      .then(setGorseller)
      .catch(() => setGorseller([]));
    apiFetch<Kalem[]>(`/ilan/${params.id}/kalem`)
      .then(setKalemler)
      .catch(() => setKalemler([]));
    apiFetch<VarlikSecenek[]>('/varlik')
      .then(setVarlikSecenekleri)
      .catch(() => setVarlikSecenekleri([]));
  }, [params.id]);

  useEffect(() => {
    yukle();
  }, [yukle]);

  const yuklenenTipSeti = useMemo(() => new Set(evraklar.map((e) => e.tip)), [evraklar]);
  const zorunluTamamlanan = ZORUNLU_EVRAK_TIPLERI.filter((t) => yuklenenTipSeti.has(t)).length;

  // Zaten eklenmiş varlıklar seçim listesinden çıkarılır (aynı varlık ilana iki kez eklenemez).
  const eklenebilirVarliklar = useMemo(() => {
    const eklenmis = new Set(kalemler.map((k) => k.varlik_id));
    return varlikSecenekleri.filter((v) => !eklenmis.has(v.id));
  }, [varlikSecenekleri, kalemler]);

  function katilimSartiToggle(value: string) {
    setKatilimSartlari((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  }

  async function kalemEkle(e: React.FormEvent) {
    e.preventDefault();
    if (!kalemVarlikId || !kalemFiyat) {
      toast.error('Varlık ve başlangıç fiyatı zorunludur.');
      return;
    }
    setKalemEkleniyor(true);
    try {
      await apiFetch(`/ilan/${params.id}/kalem`, {
        method: 'POST',
        body: JSON.stringify({ varlikId: kalemVarlikId, baslangicFiyati: Number(kalemFiyat) }),
      });
      setKalemVarlikId('');
      setKalemFiyat('');
      toast.success('Varlık ilana eklendi.');
      await yukle();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Varlık eklenemedi.');
    } finally {
      setKalemEkleniyor(false);
    }
  }

  async function kalemCikar(kalemId: string) {
    if (!window.confirm('Bu varlığı ilandan çıkarmak istediğinize emin misiniz?')) return;
    setKalemSilinenId(kalemId);
    try {
      await apiFetch(`/ilan/${params.id}/kalem/${kalemId}`, { method: 'DELETE' });
      toast.success('Varlık ilandan çıkarıldı.');
      await yukle();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Çıkarma başarısız.');
    } finally {
      setKalemSilinenId(null);
    }
  }

  async function taslakKaydet() {
    if (sartnameUcretli && !(Number(sartnameTutari) > 0)) {
      toast.error("Şartname ücretliyse tutar girilmeli (0'dan büyük).");
      return;
    }
    if ((lat.trim() !== '') !== (lng.trim() !== '')) {
      toast.error('Harita konumu için enlem ve boylam birlikte girilmeli.');
      return;
    }
    setTaslakSaving(true);
    try {
      await apiFetch(`/ilan/${params.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          aciklama: aciklama.trim() || null,
          ilanTarihi: ilanTarihi || undefined,
          ihaleTarihi: ihaleTarihi || undefined,
          sartnameUcretli,
          sartnameTutari: sartnameUcretli ? Number(sartnameTutari) : undefined,
          katilimSartlari,
          lat: lat.trim() ? Number(lat) : undefined,
          lng: lng.trim() ? Number(lng) : undefined,
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

  async function kalemSonuclandir(kalemId: string) {
    if (!window.confirm('Bu varlığı sonuçlandırmak istediğinize emin misiniz? En yüksek teklif kazanan ilan edilecek ve bu işlem geri alınamaz.')) return;
    setKalemSonuclandiranId(kalemId);
    try {
      await apiFetch(`/ilan/${params.id}/kalem/${kalemId}/sonuclandir`, { method: 'POST' });
      await yukle();
      toast.success('Varlık sonuçlandırıldı (en yüksek teklif kazanan).');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sonuçlandırma başarısız.');
    } finally {
      setKalemSonuclandiranId(null);
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
      apiFetch<Gorsel[]>(`/ilan/${params.id}/gorsel`)
        .then(setGorseller)
        .catch(() => {});
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

  const durumSiraIndex = DURUM_SIRASI.indexOf(ilan.durum);

  return (
    <div className="space-y-6">
      <Link
        href="/admin/ilanlar"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        İlanlara dön
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">{ilan.baslik}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {ilan.ihale_tipi}
            {ilan.islem_turu && ` · ${ISLEM_TURU_ETIKET[ilan.islem_turu] ?? ilan.islem_turu}`}
          </p>
        </div>
        <DurumBadge durum={ilan.durum} />
      </div>

      <div className="grid items-start gap-[22px] lg:grid-cols-[minmax(0,1fr)_336px]">
        {/* Ana sütun */}
        <div className="flex min-w-0 flex-col gap-[22px]">
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--renk,#2563eb)]">
                    {ilan.baslangic_fiyati != null ? 'Başlangıç Bedeli' : 'Varlık Sayısı'}
                  </p>
                  <p className="text-2xl font-bold tracking-tight text-gray-900">
                    {ilan.baslangic_fiyati != null
                      ? `${Number(ilan.baslangic_fiyati).toLocaleString('tr-TR')} ₺`
                      : kalemler.length}
                  </p>
                </div>
                {(ilan.il || ilan.ilce) && (
                  <div>
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--renk,#2563eb)]">
                      Konum
                    </p>
                    <p className="flex items-center gap-1.5 pt-0.5 text-base text-gray-900">
                      <MapPin className="h-4 w-4 shrink-0 text-gray-400" />
                      {[ilan.il, ilan.ilce].filter(Boolean).join(', ')}
                    </p>
                  </div>
                )}
              </div>
              {ilan.aciklama && (
                <>
                  <hr className="my-5 border-gray-100" />
                  <p className="text-sm leading-relaxed text-gray-700">{ilan.aciklama}</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Varlıklar ({kalemler.length})</CardTitle>
              <p className="mt-0.5 text-xs text-gray-500">
                Bu ilana eklenen varlıklar — her biri kendi fiyatıyla ayrı ihale birimi olarak yayınlanır.
              </p>
            </CardHeader>
            <CardContent>
              {kalemler.length === 0 ? (
                <EmptyState icon={<FileText />} title="Henüz varlık eklenmedi" description="Yayınlamadan önce en az bir varlık eklenmeli." />
              ) : (
                <div className="mb-4 grid gap-3 sm:grid-cols-2">
                  {kalemler.map((k) => (
                    <KalemSatiri
                      key={k.id}
                      kalem={k}
                      ilanDurum={ilan.durum}
                      ihaleTipi={ilan.ihale_tipi}
                      minArtirmaAdimi={Number(ilan.kurallar?.minArtirmaAdimi ?? 0) || 0}
                      silinenId={kalemSilinenId}
                      sonuclandiranId={kalemSonuclandiranId}
                      onCikar={kalemCikar}
                      onSonuclandir={kalemSonuclandir}
                    />
                  ))}
                </div>
              )}

              {(ilan.durum === 'TASLAK' || ilan.durum === 'YAYINDA') &&
                (eklenebilirVarliklar.length > 0 ? (
                  <form
                    onSubmit={kalemEkle}
                    className="flex flex-wrap items-end gap-3 rounded-xl border border-dashed border-gray-300 bg-gray-50/60 p-3"
                  >
                    <Field className="mb-0 min-w-48 flex-1">
                      <FieldLabel required>Varlık</FieldLabel>
                      <Select value={kalemVarlikId} onChange={(e) => setKalemVarlikId(e.target.value)}>
                        <option value="">Seçiniz</option>
                        {eklenebilirVarliklar.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.ad} ({v.tip})
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field className="mb-0 w-40">
                      <FieldLabel required>Fiyat (₺)</FieldLabel>
                      <TutarInput value={kalemFiyat} onChange={setKalemFiyat} placeholder="Örn: 250.000" />
                    </Field>
                    <Button type="submit" loading={kalemEkleniyor} leftIcon={<Plus />}>
                      Varlık Ekle
                    </Button>
                  </form>
                ) : (
                  <p className="text-xs text-gray-400">
                    Eklenebilecek varlık kalmadı —{' '}
                    <Link href="/admin/varliklar" className="font-medium underline">
                      yeni varlık oluşturun
                    </Link>
                    .
                  </p>
                ))}
            </CardContent>
          </Card>

          {ilan.durum === 'TASLAK' && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Taslak Düzenle</CardTitle>
                <p className="mt-0.5 text-xs text-gray-500">Yayınlama ön koşulları — kaydedip yayına alabilirsiniz.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <Field>
                  <FieldLabel>Açıklama</FieldLabel>
                  <textarea
                    value={aciklama}
                    onChange={(e) => setAciklama(e.target.value)}
                    rows={4}
                    placeholder="İlan açıklaması — vatandaşa gösterilir."
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[var(--renk,#2563eb)] focus:outline-none"
                  />
                </Field>

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
                    <FieldLabel>Enlem (lat)</FieldLabel>
                    <Input type="number" step="0.000001" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="Örn: 38.7205" />
                  </Field>
                  <Field>
                    <FieldLabel>Boylam (lng)</FieldLabel>
                    <Input type="number" step="0.000001" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="Örn: 35.4826" />
                    <p className="mt-1 text-xs text-gray-400">İsteğe bağlı — vatandaş sayfasında harita gösterir.</p>
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
                    <TutarInput value={sartnameTutari} onChange={setSartnameTutari} />
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
              </CardContent>
            </Card>
          )}

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

              <form onSubmit={evrakYukle} className="flex flex-wrap items-end gap-3">
                <Field className="mb-0 w-56">
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
                  className="text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-4 file:py-2 file:text-gray-700 hover:file:bg-gray-200"
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
              {gorseller.length > 0 && (
                <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {gorseller.map((g) => (
                    <img
                      key={g.id}
                      src={`${API_URL}/ilan/gorsel/${g.id}?tenant=${getTenantSlug()}`}
                      alt={g.dosya_adi}
                      className="aspect-square w-full rounded-lg border border-gray-100 object-cover"
                    />
                  ))}
                </div>
              )}
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

        {/* Sidebar */}
        <aside className="flex flex-col gap-[22px] lg:sticky lg:top-20">
          <Card variant="elevated">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Durum Yönetimi</CardTitle>
            </CardHeader>
            <CardContent>
              {ilan.durum !== 'IPTAL' && (
                <div className="mb-4 flex flex-col">
                  {DURUM_SIRASI.map((d, i) => {
                    const tamam = durumSiraIndex >= 0 && i < durumSiraIndex;
                    const aktif = i === durumSiraIndex;
                    return (
                      <div key={d} className="flex items-center gap-2.5 py-1">
                        <span
                          className={cn(
                            'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                            tamam && 'border-[var(--renk,#2563eb)] bg-[var(--renk,#2563eb)]',
                            aktif &&
                              'border-[var(--renk,#2563eb)] ring-4 ring-[color-mix(in_srgb,var(--renk,#2563eb)_20%,transparent)]',
                            !tamam && !aktif && 'border-gray-200',
                          )}
                        >
                          {tamam && <Check className="h-3 w-3 text-white" />}
                        </span>
                        <span
                          className={cn(
                            'text-sm',
                            aktif ? 'font-medium text-gray-900' : tamam ? 'text-gray-500' : 'text-gray-400',
                          )}
                        >
                          {DURUM_ETIKET[d]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {ilan.durum === 'TASLAK' && (
                <div className="flex flex-col gap-2">
                  <Button variant="secondary" className="w-full" loading={taslakSaving} onClick={taslakKaydet}>
                    Taslağı Kaydet
                  </Button>
                  <Button
                    className="w-full bg-slate-900 hover:bg-slate-800"
                    loading={busy}
                    leftIcon={<CheckCircle2 />}
                    onClick={() => durumDegistir('YAYINDA', 'İlanı yayınlamak istediğinize emin misiniz?')}
                  >
                    Yayınla
                  </Button>
                </div>
              )}
              {ilan.durum === 'YAYINDA' && (
                <div className="flex flex-col gap-2">
                  <Button
                    className="w-full bg-slate-900 hover:bg-slate-800"
                    loading={busy}
                    leftIcon={<Gavel />}
                    onClick={() => durumDegistir('CANLI_ARTIRMA', 'İhaleyi başlatmak istediğinize emin misiniz? Başlatıldıktan sonra teklif kabul edilmeye başlanır.')}
                  >
                    İhaleyi Başlat
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full text-red-600"
                    loading={busy}
                    leftIcon={<Ban />}
                    onClick={() => durumDegistir('IPTAL', 'İlanı iptal etmek istediğinize emin misiniz? Bu işlem geri alınamaz.')}
                  >
                    İptal Et
                  </Button>
                  <p className="mt-1 text-xs leading-relaxed text-gray-400">
                    İhale tarihi gelmeden ihale başlatılamaz — tarih gelmeden denerseniz backend reddeder.
                  </p>
                </div>
              )}
              {ilan.durum === 'CANLI_ARTIRMA' && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs leading-relaxed text-gray-400">
                    Her varlık kendi ihalesini bağımsız sonuçlandırır — "Varlıklar" kartındaki
                    ilgili satırdan "Sonuçlandır"a basın. Tüm varlıklar sonuçlanınca ilan otomatik
                    Sonuçlandı'ya geçer.
                  </p>
                  <Button
                    variant="outline"
                    className="w-full text-red-600"
                    loading={busy}
                    leftIcon={<Ban />}
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
              <CardTitle className="text-sm">Özet</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-gray-500">İhale Tipi</span>
                <span className="text-right text-gray-900">{ilan.ihale_tipi}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-gray-500">İşlem Türü</span>
                <span className="text-gray-900">{ilan.islem_turu ? ISLEM_TURU_ETIKET[ilan.islem_turu] ?? ilan.islem_turu : '—'}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-gray-500">İlan Tarihi</span>
                <span className="text-gray-900">{ilanTarihi || '—'}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-gray-500">İhale Tarihi</span>
                <span className="text-gray-900">{ihaleTarihi || '—'}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-gray-500">Şartname</span>
                <span className="text-gray-900">
                  {ilan.sartname_ucretli ? `${Number(ilan.sartname_tutari ?? 0).toLocaleString('tr-TR')} ₺` : 'Ücretsiz'}
                </span>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

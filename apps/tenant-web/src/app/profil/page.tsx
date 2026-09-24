'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, FileText, Gavel, Heart, Inbox, Phone } from 'lucide-react';
import { RequireAuth } from '../../components/require-auth';
import { apiFetch } from '../../lib/api';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Field,
  Input,
  Skeleton,
} from '@belediyesinden/ui';

interface KullaniciProfili {
  email: string;
  ad: string;
  soyad: string;
  telefon: string | null;
}

interface Basvuru {
  id: string;
  ilan_kalemi_id: string;
  ilan_baslik: string;
  varlik_ad: string;
  durum: string;
  gereken_teminat: string | null;
  created_at: string;
}
interface Teklif {
  id: string;
  ilan_kalemi_id: string;
  ilan_baslik: string;
  varlik_ad: string;
  tutar: string;
  kabul_edildi: boolean;
  created_at: string;
}

const BASVURU_DURUM: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' | 'info' }> = {
  BASLADI: { label: 'Başladı', variant: 'info' },
  TEMINAT_BEKLENIYOR: { label: 'Teminat bekleniyor', variant: 'warning' },
  ONAYLANDI: { label: 'Onaylandı', variant: 'success' },
  REDDEDILDI: { label: 'Reddedildi', variant: 'danger' },
  IADE_EDILDI: { label: 'İade edildi', variant: 'default' },
  IPTAL_EDILDI: { label: 'İptal edildi', variant: 'default' },
};

/** İletişim bilgileri — şu an sadece telefon (ihale hatırlatma SMS'i için, Harun/PO). */
function IletisimBilgileri() {
  const [telefon, setTelefon] = useState('');
  const [yukleniyor, setYukleniyor] = useState(true);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [kaydedildi, setKaydedildi] = useState(false);

  useEffect(() => {
    apiFetch<KullaniciProfili>('/kullanici-profili/me')
      .then((p) => setTelefon(p.telefon ?? ''))
      .catch(() => {})
      .finally(() => setYukleniyor(false));
  }, []);

  async function kaydet() {
    setKaydediliyor(true);
    setKaydedildi(false);
    try {
      await apiFetch('/kullanici-profili/me', { method: 'PATCH', body: JSON.stringify({ telefon }) });
      setKaydedildi(true);
    } catch {
      /* sessizce yoksay — buton "Kaydet" halinde kalır, kullanıcı tekrar dener */
    } finally {
      setKaydediliyor(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Phone className="h-4 w-4 text-gray-400" />
          İletişim Bilgileri
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-gray-500">
          Katıldığınız ihalelerle ilgili SMS hatırlatması alabilmeniz için telefon numaranızı girin.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <Field className="mb-0 min-w-[200px] flex-1">
            <label className="mb-1.5 block text-xs font-medium text-gray-500">Telefon</label>
            <Input
              type="tel"
              placeholder="05xx xxx xx xx"
              value={telefon}
              onChange={(e) => setTelefon(e.target.value)}
              disabled={yukleniyor}
            />
          </Field>
          <Button onClick={kaydet} loading={kaydediliyor} disabled={yukleniyor}>
            Kaydet
          </Button>
        </div>
        {kaydedildi && (
          <p className="flex items-center gap-1.5 text-xs text-green-600">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Kaydedildi
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ProfilIcerik() {
  const [basvurular, setBasvurular] = useState<Basvuru[]>([]);
  const [teklifler, setTeklifler] = useState<Teklif[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch<Basvuru[]>('/basvuru/my').catch(() => []),
      apiFetch<Teklif[]>('/teklif/my').catch(() => []),
    ]).then(([b, t]) => {
      setBasvurular(b);
      setTeklifler(t);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Hesabım</h1>
        <p className="mt-1 text-sm text-gray-500">Başvuru ve teklifleriniz</p>
      </div>

      <IletisimBilgileri />

      {/* Başvurularım */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-gray-400" />
            Başvurularım ({basvurular.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {basvurular.length === 0 ? (
            <EmptyState icon={<FileText />} title="Başvurunuz yok" description="İlan detayından başvurabilirsiniz." />
          ) : (
            <div className="divide-y divide-gray-100">
              {basvurular.map((b) => {
                const d = BASVURU_DURUM[b.durum] ?? { label: b.durum, variant: 'default' as const };
                return (
                  <div key={b.id} className="flex items-center justify-between gap-3 px-6 py-3">
                    <div className="min-w-0">
                      <Link href={`/varliklar/${b.ilan_kalemi_id}`} className="block truncate text-sm font-medium text-gray-900 hover:underline">
                        {b.varlik_ad}
                      </Link>
                      <p className="truncate text-xs text-gray-400">{b.ilan_baslik}</p>
                      <p className="text-xs text-gray-400">{new Date(b.created_at).toLocaleDateString('tr-TR')}</p>
                    </div>
                    <Badge variant={d.variant}>{d.label}</Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tekliflerim */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Gavel className="h-4 w-4 text-gray-400" />
            Tekliflerim ({teklifler.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {teklifler.length === 0 ? (
            <EmptyState icon={<Inbox />} title="Teklifiniz yok" />
          ) : (
            <div className="divide-y divide-gray-100">
              {teklifler.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3 px-6 py-3">
                  <div className="min-w-0">
                    <Link href={`/varliklar/${t.ilan_kalemi_id}`} className="block truncate text-sm font-medium text-gray-900 hover:underline">
                      {t.varlik_ad}
                    </Link>
                    <p className="truncate text-xs text-gray-400">{t.ilan_baslik}</p>
                    <p className="text-xs text-gray-400">{new Date(t.created_at).toLocaleDateString('tr-TR')}</p>
                  </div>
                  <span className="shrink-0 text-sm font-bold text-gray-900">
                    {Number(t.tutar).toLocaleString('tr-TR')} ₺
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Link
        href="/favoriler"
        className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
        style={{ color: 'var(--renk)' }}
      >
        <Heart className="h-4 w-4" />
        Favori ilanlarım
      </Link>
    </div>
  );
}

export default function ProfilPage() {
  return (
    <RequireAuth>
      <ProfilIcerik />
    </RequireAuth>
  );
}

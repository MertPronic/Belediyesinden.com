'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Inbox, Search } from 'lucide-react';
import { API_URL, getTenantSlug, ilanGorselUrl } from '../../lib/api';
import {
  Button,
  Card,
  CardContent,
  EmptyState,
  Field,
  Input,
  Select,
  Switch,
  IlanKarti,
  type IlanKartiData,
} from '@belediyesinden/ui';

interface Ilan extends IlanKartiData {
  /** Arama indeksinden gelir — `kapak_gorsel_url`'e dönüştürülmeden `IlanKarti` görseli çözemez. */
  kapak_gorsel_id?: string | null;
}

interface AramaSonucu {
  data: Ilan[];
  total: number;
}

interface Filtre {
  q: string;
  varlikTipi: string;
  sonuclananlar: boolean;
}

const VARLIK_TIPLERI = [
  { value: '', label: 'Tüm Türler' },
  { value: 'TASINIR', label: 'Taşınır' },
  { value: 'TASINMAZ', label: 'Taşınmaz' },
  { value: 'ISLETME_HAKKI', label: 'İşletme Hakkı' },
  { value: 'REKLAM_ALANI', label: 'Reklam Alanı' },
];

const DEBOUNCE_MS = 400;

function urlOlustur(f: Filtre): string {
  const params = new URLSearchParams();
  if (f.q) params.set('q', f.q);
  if (f.varlikTipi) params.set('varlikTipi', f.varlikTipi);
  if (f.sonuclananlar) params.set('sonuclananlar', '1');
  const qs = params.toString();
  return qs ? `/ilanlar?${qs}` : '/ilanlar';
}

async function ilanlariGetir(slug: string, f: Filtre): Promise<AramaSonucu> {
  const params = new URLSearchParams();
  if (f.q) params.set('q', f.q);
  if (f.varlikTipi) params.set('varlikTipi', f.varlikTipi);
  if (f.sonuclananlar) params.set('sonuclananlar', '1');
  const qs = params.toString();
  const res = await fetch(`${API_URL}/search/ilan${qs ? `?${qs}` : ''}`, {
    headers: { 'x-tenant-slug': slug },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Arama başarısız (HTTP ${res.status})`);
  const sonuc = (await res.json()) as AramaSonucu;
  return {
    ...sonuc,
    data: sonuc.data.map((i) => ({
      ...i,
      kapak_gorsel_url: i.kapak_gorsel_id ? ilanGorselUrl(slug, i.kapak_gorsel_id) : null,
    })),
  };
}

/**
 * Ana sayfadaki portal arama paneliyle aynı desen — yazdıkça/değiştikçe filtreler
 * (debounce'lu), "Ara" butonuna basmaya gerek yok. İlk render sunucudan gelen
 * veriyle eşleşir (SSR ilk boya), sonraki her filtre değişikliği client-side fetch
 * ile sonuçları günceller.
 */
export function IlanListesi({
  ilkFiltre,
  ilkSonuc,
}: {
  ilkFiltre: Filtre;
  ilkSonuc: Ilan[];
}) {
  const [q, setQ] = useState(ilkFiltre.q);
  const [varlikTipi, setVarlikTipi] = useState(ilkFiltre.varlikTipi);
  const [sonuclananlar, setSonuclananlar] = useState(ilkFiltre.sonuclananlar);
  const [ilanlar, setIlanlar] = useState(ilkSonuc);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hataVar, setHataVar] = useState(false);

  const ilkRenderRef = useRef(true);
  const istekSirasiRef = useRef(0);

  useEffect(() => {
    if (ilkRenderRef.current) {
      ilkRenderRef.current = false;
      return;
    }
    const slug = getTenantSlug();
    setYukleniyor(true);
    const zamanlayici = setTimeout(() => {
      const siraNo = ++istekSirasiRef.current;
      const filtre = { q, varlikTipi, sonuclananlar };
      window.history.replaceState(null, '', urlOlustur(filtre));
      ilanlariGetir(slug, filtre)
        .then((sonuc) => {
          if (siraNo !== istekSirasiRef.current) return; // eski/geride kalmış istek — yut
          setIlanlar(sonuc.data);
          setHataVar(false);
        })
        .catch(() => {
          // İstek başarısız (rate-limit, ağ vb.) — mevcut sonuçlar korunur, "0 sonuç"a düşürülmez.
          if (siraNo === istekSirasiRef.current) setHataVar(true);
        })
        .finally(() => {
          if (siraNo === istekSirasiRef.current) setYukleniyor(false);
        });
    }, DEBOUNCE_MS);
    return () => clearTimeout(zamanlayici);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, varlikTipi, sonuclananlar]);

  const aktifFiltre = !!(q || varlikTipi);

  return (
    <>
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field className="mb-0 flex-1">
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">
                Ara
              </label>
              <Input
                type="text"
                placeholder="İlan başlığı veya açıklama..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                icon={<Search />}
              />
            </Field>
            <Field className="mb-0 sm:w-56">
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">
                Varlık Türü
              </label>
              <Select value={varlikTipi} onChange={(e) => setVarlikTipi(e.target.value)}>
                {VARLIK_TIPLERI.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Switch
              checked={sonuclananlar}
              onChange={(e) => setSonuclananlar(e.target.checked)}
              label="Sonuçlananları göster"
              wrapperClassName="mb-0.5 h-10"
            />
          </div>
        </CardContent>
      </Card>

      {hataVar && (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-amber-600">
          <AlertTriangle className="h-4 w-4" />
          Arama şu an güncellenemedi, önceki sonuçlar gösteriliyor. Az sonra tekrar deneyin.
        </p>
      )}

      {ilanlar.length === 0 && !yukleniyor ? (
        <Card className="mt-6">
          <EmptyState
            icon={<Inbox />}
            title={aktifFiltre ? 'İlan bulunamadı' : 'Yayında ilan yok'}
            description={
              aktifFiltre
                ? 'Arama kriterlerinize uygun ilan bulunamadı. Filtreleri değiştirmeyi deneyin.'
                : 'Şu anda yayında ilan bulunmuyor.'
            }
            action={
              aktifFiltre ? (
                <Link href="/ilanlar" className="text-sm font-medium" style={{ color: 'var(--renk)' }}>
                  Filtreleri temizle
                </Link>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div
          className={`mt-6 grid gap-4 transition-opacity sm:grid-cols-2 lg:grid-cols-3 ${yukleniyor ? 'opacity-50' : 'opacity-100'}`}
        >
          {ilanlar.map((ilan) => (
            <IlanKarti key={ilan.id} ilan={ilan} href={`/ilanlar/${ilan.id}`} />
          ))}
        </div>
      )}
    </>
  );
}

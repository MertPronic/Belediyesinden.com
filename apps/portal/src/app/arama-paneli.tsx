'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Building2, Inbox, Search } from 'lucide-react';
import { TURKIYE_ILLERI } from '@belediyesinden/shared';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Select,
  Combobox,
  IlanKarti,
  type IlanKartiData,
} from '@belediyesinden/ui';
import { PORTAL_PUBLIC_API_URL, portalGorselUrl, tenantUrl } from '../lib/api';

export interface PortalIlan extends IlanKartiData {
  tenant_slug: string;
  tenant_ad?: string | null;
  kapak_gorsel_id?: string | null;
}

interface Filtre {
  q: string;
  il: string;
  ilce: string;
  tip: string;
}

const SAYFA_BOYUTU = 24;
const DEBOUNCE_MS = 400;

const TIPLER = [
  { value: '', label: 'Tüm Tipler' },
  { value: 'ACIK_ARTIRMA', label: 'Açık Artırma' },
  { value: 'ACIK_TEKLIF', label: 'Açık Teklif' },
  { value: 'KAPALI_TEKLIF', label: 'Kapalı Teklif' },
];

function urlOlustur(f: Filtre): string {
  const params = new URLSearchParams();
  if (f.q) params.set('q', f.q);
  if (f.il) params.set('il', f.il);
  if (f.ilce) params.set('ilce', f.ilce);
  if (f.tip) params.set('tip', f.tip);
  const qs = params.toString();
  return qs ? `/?${qs}` : '/';
}

/**
 * HTTP hatasında (rate-limit, ağ sorunu vb.) exception fırlatır — çağıran, hatayı
 * "0 sonuç" ile karıştırmamalı; ekrandaki son bilinen sonuçları korumalı.
 */
async function ilanlariGetir(f: Filtre, page: number): Promise<{ data: PortalIlan[]; total: number }> {
  const params = new URLSearchParams();
  if (f.q) params.set('q', f.q);
  if (f.tip) params.set('tip', f.tip);
  if (f.il) params.set('il', f.il);
  if (f.ilce) params.set('ilce', f.ilce);
  params.set('page', String(page));
  params.set('pageSize', String(SAYFA_BOYUTU));
  const res = await fetch(`${PORTAL_PUBLIC_API_URL}/search/ilan?${params.toString()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Arama başarısız (HTTP ${res.status})`);
  return res.json() as Promise<{ data: PortalIlan[]; total: number }>;
}

async function ilceleriGetir(il: string): Promise<string[]> {
  if (!il) return [];
  const res = await fetch(`${PORTAL_PUBLIC_API_URL}/search/lokasyonlar?il=${encodeURIComponent(il)}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`İlçe listesi alınamadı (HTTP ${res.status})`);
  const json = (await res.json()) as { ilceler: string[] };
  return json.ilceler;
}

/**
 * Ana sayfa arama paneli — yazdıkça filtreler (debounce'lu), sayfa yenilenmez.
 * İlk render sunucudan gelen veriyle eşleşir (SSR ilk boya), sonraki her filtre
 * değişikliği client-side fetch ile sonuçları günceller.
 */
export function AramaPaneli({
  ilkFiltre,
  ilkSonuc,
  ilkIlceler,
}: {
  ilkFiltre: Filtre;
  ilkSonuc: { data: PortalIlan[]; total: number };
  ilkIlceler: string[];
}) {
  const [q, setQ] = useState(ilkFiltre.q);
  const [il, setIl] = useState(ilkFiltre.il);
  const [ilce, setIlce] = useState(ilkFiltre.ilce);
  const [tip, setTip] = useState(ilkFiltre.tip);
  const [ilanlar, setIlanlar] = useState(ilkSonuc.data);
  const [total, setTotal] = useState(ilkSonuc.total);
  const [ilceler, setIlceler] = useState(ilkIlceler);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [dahaFazlaYukleniyor, setDahaFazlaYukleniyor] = useState(false);
  const [hataVar, setHataVar] = useState(false);

  const ilkRenderRef = useRef(true);
  const istekSirasiRef = useRef(0);

  // Filtre değişince debounce'lu arama — ilk mount'ta atlanır (sunucudan gelen
  // veri zaten ilkFiltre ile eşleşiyor, tekrar fetch gereksiz).
  useEffect(() => {
    if (ilkRenderRef.current) {
      ilkRenderRef.current = false;
      return;
    }
    setYukleniyor(true);
    const zamanlayici = setTimeout(() => {
      const siraNo = ++istekSirasiRef.current;
      const filtre = { q, il, ilce, tip };
      window.history.replaceState(null, '', `${urlOlustur(filtre)}#sonuclar`);
      ilanlariGetir(filtre, 1)
        .then((sonuc) => {
          if (siraNo !== istekSirasiRef.current) return; // eski/geride kalmış istek — yut
          setIlanlar(sonuc.data);
          setTotal(sonuc.total);
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
  }, [q, il, ilce, tip]);

  async function ilDegisti(yeniIl: string) {
    setIl(yeniIl);
    setIlce('');
    if (!yeniIl) {
      setIlceler([]);
      return;
    }
    try {
      setIlceler(await ilceleriGetir(yeniIl));
    } catch {
      // İstek başarısız — mevcut ilçe listesi korunur, sessizce boşaltılmaz.
    }
  }

  async function dahaFazlaYukle() {
    setDahaFazlaYukleniyor(true);
    try {
      const sonrakiSayfa = Math.floor(ilanlar.length / SAYFA_BOYUTU) + 1;
      const sonuc = await ilanlariGetir({ q, il, ilce, tip }, sonrakiSayfa);
      setIlanlar((prev) => [...prev, ...sonuc.data]);
      setTotal(sonuc.total);
      setHataVar(false);
    } catch {
      setHataVar(true);
    } finally {
      setDahaFazlaYukleniyor(false);
    }
  }

  const aktifFiltre = !!(q || il || ilce || tip);
  const dahaFazlaVar = ilanlar.length < total;

  return (
    <>
      <form
        onSubmit={(e) => e.preventDefault()}
        className="rounded-xl border border-gray-100 bg-white/95 p-3 shadow-lg backdrop-blur sm:p-4"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <Field className="mb-0 min-w-[200px] flex-1">
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">Ara</label>
            <Input
              type="text"
              placeholder="İlan ara..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              icon={<Search />}
            />
          </Field>
          <Field className="mb-0 sm:w-44">
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">İl</label>
            <Combobox
              name="il"
              defaultValue={il}
              options={TURKIYE_ILLERI}
              placeholder="İl seçin veya yazın"
              onValueChange={ilDegisti}
            />
          </Field>
          <Field className="mb-0 sm:w-44">
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">İlçe</label>
            <Combobox
              name="ilce"
              defaultValue={ilce}
              options={ilceler}
              placeholder={il ? 'İlçe seçin veya yazın' : 'Önce il seçin'}
              disabled={!il}
              onValueChange={setIlce}
            />
          </Field>
          <Field className="mb-0 sm:w-52">
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">
              İhale Tipi
            </label>
            <Select value={tip} onChange={(e) => setTip(e.target.value)}>
              {TIPLER.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </form>

      {hataVar && (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-amber-600">
          <AlertTriangle className="h-4 w-4" />
          Arama şu an güncellenemedi, önceki sonuçlar gösteriliyor. Az sonra tekrar deneyin.
        </p>
      )}

      <div id="sonuclar">
        {ilanlar.length === 0 && !yukleniyor ? (
          <Card>
            <EmptyState
              icon={<Inbox />}
              title={aktifFiltre ? 'İlan bulunamadı' : 'Henüz ilan yok'}
              description={
                aktifFiltre ? 'Arama kriterlerinize uygun ilan bulunamadı.' : 'Şu anda yayında ilan bulunmuyor.'
              }
              action={
                aktifFiltre ? (
                  <button
                    type="button"
                    onClick={() => {
                      setQ('');
                      setIl('');
                      setIlce('');
                      setTip('');
                    }}
                    className="text-sm font-medium"
                    style={{ color: 'var(--renk)' }}
                  >
                    Filtreleri temizle
                  </button>
                ) : undefined
              }
            />
          </Card>
        ) : (
          <div className={`space-y-6 transition-opacity ${yukleniyor ? 'opacity-50' : 'opacity-100'}`}>
            <p className="text-sm text-gray-500">
              {total} ilandan {ilanlar.length} tanesi gösteriliyor
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {ilanlar.map((ilan) => (
                <IlanKarti
                  key={`${ilan.tenant_slug}:${ilan.id}`}
                  ilan={{
                    ...ilan,
                    kapak_gorsel_url: ilan.kapak_gorsel_id
                      ? portalGorselUrl(ilan.tenant_slug, ilan.kapak_gorsel_id)
                      : null,
                  }}
                  href={tenantUrl(ilan.tenant_slug, `/ilanlar/${ilan.id}`)}
                  extra={
                    <Badge variant="default" icon={<Building2 />}>
                      {ilan.tenant_ad ?? ilan.tenant_slug}
                    </Badge>
                  }
                />
              ))}
            </div>
            {dahaFazlaVar && (
              <div className="flex justify-center pt-2">
                <Button variant="outline" loading={dahaFazlaYukleniyor} onClick={dahaFazlaYukle}>
                  Daha fazla yükle
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

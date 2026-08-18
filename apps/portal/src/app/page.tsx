import { Building2, FileText, ShieldCheck } from 'lucide-react';
import { portalFetch } from '../lib/api';
import { AramaPaneli, type PortalIlan } from './arama-paneli';

interface AramaSonucu {
  data: PortalIlan[];
  total: number;
}

interface Lokasyonlar {
  ilceler: string[];
  belediyeSayisi: number;
}

interface AramaParams {
  q?: string;
  tip?: string;
  il?: string;
  ilce?: string;
}

const SAYFA_BOYUTU = 24;

async function fetchTumIlanlar(sp: AramaParams): Promise<AramaSonucu> {
  try {
    const params = new URLSearchParams();
    if (sp.q) params.set('q', sp.q);
    if (sp.tip) params.set('tip', sp.tip);
    if (sp.il) params.set('il', sp.il);
    if (sp.ilce) params.set('ilce', sp.ilce);
    params.set('pageSize', String(SAYFA_BOYUTU));
    return await portalFetch<AramaSonucu>(`/search/ilan?${params.toString()}`);
  } catch {
    return { data: [], total: 0 };
  }
}

async function fetchLokasyonlar(il?: string): Promise<Lokasyonlar> {
  try {
    return await portalFetch<Lokasyonlar>(
      il ? `/search/lokasyonlar?il=${encodeURIComponent(il)}` : '/search/lokasyonlar',
    );
  } catch {
    return { ilceler: [], belediyeSayisi: 0 };
  }
}

export default async function PortalHomePage({
  searchParams,
}: {
  searchParams: Promise<AramaParams>;
}) {
  const sp = await searchParams;
  const ilkFiltre = { q: sp.q ?? '', il: sp.il ?? '', ilce: sp.ilce ?? '', tip: sp.tip ?? '' };

  const [sonuc, lokasyonlar] = await Promise.all([fetchTumIlanlar(sp), fetchLokasyonlar(sp.il)]);

  return (
    <div className="space-y-10">
      {/* Hero + gömülü arama/filtre (yazdıkça filtreler — bkz. AramaPaneli) */}
      <section className="hero-accent overflow-hidden rounded-2xl border border-gray-100">
        <div className="px-6 py-14 sm:px-10 sm:py-20">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white/70 px-3 py-1 text-xs font-medium text-gray-600 backdrop-blur">
            <ShieldCheck className="h-3.5 w-3.5" style={{ color: 'var(--renk)' }} />
            Tüm Belediyeler Tek Çatı Altında
          </span>
          <h1 className="mt-4 max-w-2xl text-4xl font-extrabold leading-tight tracking-tight text-gray-900 sm:text-5xl">
            Belediye İlanları Tek Portalda
          </h1>
          <p className="mt-3 max-w-xl text-base text-gray-600 sm:text-lg">
            Türkiye genelindeki belediyelerin satış, kiralama ve açık artırma ilanlarını
            arayın, kendi belediyenizin portalına yönlendirilin.
          </p>

          {lokasyonlar.belediyeSayisi > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              <div className="flex items-center gap-2 rounded-lg accent-soft-bg py-1.5 pl-1.5 pr-3.5">
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
                  style={{ background: 'var(--renk)' }}
                >
                  <Building2 className="h-3.5 w-3.5 text-white" />
                </span>
                <p className="text-sm text-gray-700">
                  <strong className="font-semibold text-gray-900">{lokasyonlar.belediyeSayisi}</strong> belediye
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-lg accent-soft-bg py-1.5 pl-1.5 pr-3.5">
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
                  style={{ background: 'var(--renk)' }}
                >
                  <FileText className="h-3.5 w-3.5 text-white" />
                </span>
                <p className="text-sm text-gray-700">
                  <strong className="font-semibold text-gray-900">{sonuc.total}</strong> aktif ilan
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      <AramaPaneli ilkFiltre={ilkFiltre} ilkSonuc={sonuc} ilkIlceler={lokasyonlar.ilceler} />
    </div>
  );
}

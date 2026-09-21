import { Boxes, Building2, Gavel, Handshake, Landmark, Megaphone, Sparkles } from 'lucide-react';
import { TURKIYE_ILCELERI } from '@belediyesinden/shared';
import { portalFetch } from '../lib/api';
import { AramaPaneli, type PortalIlan } from './arama-paneli';

interface AramaSonucu {
  data: PortalIlan[];
  total: number;
}

interface Lokasyonlar {
  belediyeSayisi: number;
}

interface AramaParams {
  q?: string;
  il?: string;
  ilce?: string;
  varlikTipi?: string;
  sort?: string;
  sonuclananlar?: string;
}

const SAYFA_BOYUTU = 24;

const KATEGORILER = [
  { varlikTipi: 'TASINMAZ', label: 'Taşınmaz', icon: Landmark },
  { varlikTipi: 'TASINIR', label: 'Taşınır', icon: Boxes },
  { varlikTipi: 'ISLETME_HAKKI', label: 'İşletme Hakkı', icon: Handshake },
  { varlikTipi: 'REKLAM_ALANI', label: 'Reklam Alanı', icon: Megaphone },
];

async function fetchTumIlanlar(sp: AramaParams): Promise<AramaSonucu> {
  try {
    const params = new URLSearchParams();
    if (sp.q) params.set('q', sp.q);
    if (sp.il) params.set('il', sp.il);
    if (sp.ilce) params.set('ilce', sp.ilce);
    if (sp.varlikTipi) params.set('varlikTipi', sp.varlikTipi);
    if (sp.sort) params.set('sort', sp.sort);
    if (sp.sonuclananlar) params.set('sonuclananlar', sp.sonuclananlar);
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
    return { belediyeSayisi: 0 };
  }
}

export default async function PortalHomePage({
  searchParams,
}: {
  searchParams: Promise<AramaParams>;
}) {
  const sp = await searchParams;
  const ilkFiltre = {
    q: sp.q ?? '',
    il: sp.il ?? '',
    ilce: sp.ilce ?? '',
    varlikTipi: sp.varlikTipi ?? '',
    sort: sp.sort ?? '',
    sonuclananlar: sp.sonuclananlar === '1',
  };

  const [sonuc, lokasyonlar] = await Promise.all([fetchTumIlanlar(sp), fetchLokasyonlar(sp.il)]);

  return (
    <div>
      <section
        className="relative overflow-hidden rounded-3xl px-6 py-14 text-white shadow-xl sm:px-14 sm:py-20"
        style={{
          backgroundImage: `radial-gradient(circle at 15% 20%, color-mix(in srgb, var(--renk) 55%, #0f172a) 0%, transparent 45%), linear-gradient(135deg, var(--renk), #0f172a 130%)`,
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Ccircle cx='2' cy='2' r='1.4' fill='white'/%3E%3C/svg%3E\")",
          }}
        />
        <div className="relative mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" />
            Türkiye'nin belediye ilan &amp; açık artırma portalı
          </span>
          <h1 className="mt-5 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Belediye ilanlarını tek yerden keşfedin
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm font-light text-white/75 sm:text-base">
            Taşınmaz, taşınır, işletme hakkı ve reklam alanı ihalelerine göz atın; başvurunuzu ve teminatınızı
            elektronik olarak tamamlayın.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-white/70" />
              <span className="text-lg font-bold">{lokasyonlar.belediyeSayisi}</span>
              <span className="text-sm text-white/70">belediye</span>
            </div>
            <div className="flex items-center gap-2">
              <Gavel className="h-5 w-5 text-white/70" />
              <span className="text-lg font-bold">{sonuc.total}</span>
              <span className="text-sm text-white/70">ilan</span>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            {KATEGORILER.map(({ varlikTipi, label, icon: Icon }) => (
              <a
                key={varlikTipi}
                href={`/?varlikTipi=${varlikTipi}#sonuclar`}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-white/20"
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </a>
            ))}
          </div>
        </div>
      </section>

      <div className="relative z-10 -mt-12 sm:-mt-14">
        <AramaPaneli
          ilkFiltre={ilkFiltre}
          ilkSonuc={sonuc}
          ilkIlceler={ilkFiltre.il ? [...(TURKIYE_ILCELERI[ilkFiltre.il] ?? [])] : []}
        />
      </div>
    </div>
  );
}

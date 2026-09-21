import { TURKIYE_ILCELERI } from '@belediyesinden/shared';
import { portalFetch } from '../lib/api';
import { AramaPaneli, type PortalIlan } from './arama-paneli';
import { OneCikanCarousel } from './one-cikan-carousel';

interface AramaSonucu {
  data: PortalIlan[];
  total: number;
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

const ONE_CIKAN_SAYISI = 8;

/** Ana sayfa üstündeki "öne çıkan ilanlar" şeridi — ihale tarihi en yakın aktif ilanlar. */
async function fetchOneCikanIlanlar(): Promise<PortalIlan[]> {
  try {
    const sonuc = await portalFetch<AramaSonucu>(`/search/ilan?sort=ihale_yakin&pageSize=${ONE_CIKAN_SAYISI}`);
    return sonuc.data;
  } catch {
    return [];
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

  const [sonuc, oneCikanlar] = await Promise.all([fetchTumIlanlar(sp), fetchOneCikanIlanlar()]);

  return (
    <div>
      <OneCikanCarousel ilanlar={oneCikanlar} />

      <div className="mt-8">
        <AramaPaneli
          ilkFiltre={ilkFiltre}
          ilkSonuc={sonuc}
          ilkIlceler={ilkFiltre.il ? [...(TURKIYE_ILCELERI[ilkFiltre.il] ?? [])] : []}
        />
      </div>
    </div>
  );
}

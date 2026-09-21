'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Gavel, MapPin } from 'lucide-react';
import { dummyGorseller } from '@belediyesinden/ui';
import { portalGorselUrl, tenantUrl } from '../lib/api';
import type { PortalIlan } from './arama-paneli';

const OTOMATIK_GECIS_MS = 5000;

function fmt(tl: string | number): string {
  return Number(tl).toLocaleString('tr-TR');
}

/**
 * Hero'daki "öne çıkan ilanlar" şeridi — sağa/sola kayan, otomatik geçişli.
 * Native scroll-snap kullanır (mobilde parmakla kaydırma bedava); JS sadece
 * otomatik geçiş + ok/nokta navigasyonu için. Harun/PO: ileride duyuru gibi
 * başka slayt türleri eklenebilir, o zaman bu bileşen genişletilir.
 */
export function OneCikanCarousel({ ilanlar }: { ilanlar: PortalIlan[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const durduRef = useRef(false);
  const [aktif, setAktif] = useState(0);

  useEffect(() => {
    if (ilanlar.length < 2) return;
    const zamanlayici = setInterval(() => {
      if (durduRef.current) return;
      kaydir((aktif + 1) % ilanlar.length);
    }, OTOMATIK_GECIS_MS);
    return () => clearInterval(zamanlayici);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aktif, ilanlar.length]);

  function kaydir(index: number) {
    trackRef.current?.scrollTo({ left: trackRef.current.clientWidth * index, behavior: 'smooth' });
    setAktif(index);
  }

  function scrollTakipEt() {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;
    setAktif(Math.round(track.scrollLeft / track.clientWidth));
  }

  if (ilanlar.length === 0) return null;

  return (
    <div
      className="group/carousel relative overflow-hidden rounded-2xl shadow-2xl"
      onMouseEnter={() => {
        durduRef.current = true;
      }}
      onMouseLeave={() => {
        durduRef.current = false;
      }}
    >
      <div
        ref={trackRef}
        onScroll={scrollTakipEt}
        className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {ilanlar.map((ilan) => {
          const kapak = ilan.kapak_gorsel_id
            ? portalGorselUrl(ilan.tenant_slug, ilan.kapak_gorsel_id)
            : dummyGorseller(ilan.id, 1)[0];
          const fiyat =
            ilan.baslangic_fiyati != null
              ? Number(ilan.baslangic_fiyati)
              : ilan.fiyat_min != null
                ? Number(ilan.fiyat_min)
                : null;
          const ihaleTarihi = ilan.bitis_tarihi ? new Date(ilan.bitis_tarihi) : null;
          const konum = [ilan.ilce, ilan.il].filter(Boolean).join(', ');

          return (
            <Link
              key={`${ilan.tenant_slug}:${ilan.id}`}
              href={tenantUrl(ilan.tenant_slug, `/ilanlar/${ilan.id}`)}
              className="relative aspect-[16/9] w-full shrink-0 snap-center sm:aspect-[21/8]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- harici/proxy görsel, tenant başına değişken host */}
              <img src={kapak} alt="" className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5 pb-9 sm:p-8 sm:pb-11">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-white/20 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
                    {ilan.tenant_ad ?? ilan.tenant_slug}
                  </span>
                  {konum && (
                    <span className="inline-flex items-center gap-1 text-xs text-white/80">
                      <MapPin className="h-3 w-3" />
                      {konum}
                    </span>
                  )}
                </div>
                <h2 className="line-clamp-1 text-lg font-bold text-white sm:text-2xl">{ilan.baslik}</h2>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/85">
                  {fiyat != null && <span className="font-semibold text-white">{fmt(fiyat)} ₺</span>}
                  {ihaleTarihi && (
                    <span className="inline-flex items-center gap-1">
                      <Gavel className="h-3.5 w-3.5" />
                      İhale: {ihaleTarihi.toLocaleDateString('tr-TR')}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {ilanlar.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Önceki ilan"
            onClick={() => kaydir((aktif - 1 + ilanlar.length) % ilanlar.length)}
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/30 p-1.5 text-white opacity-0 backdrop-blur transition-opacity hover:bg-black/50 group-hover/carousel:opacity-100"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Sonraki ilan"
            onClick={() => kaydir((aktif + 1) % ilanlar.length)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/30 p-1.5 text-white opacity-0 backdrop-blur transition-opacity hover:bg-black/50 group-hover/carousel:opacity-100"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
            {ilanlar.map((ilan, i) => (
              <button
                key={ilan.id}
                type="button"
                aria-label={`${i + 1}. ilana git`}
                onClick={() => kaydir(i)}
                className={`h-1.5 rounded-full transition-all ${i === aktif ? 'w-5 bg-white' : 'w-1.5 bg-white/50'}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

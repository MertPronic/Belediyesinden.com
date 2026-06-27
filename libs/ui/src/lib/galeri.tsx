'use client';
import { useState } from 'react';
import { ChevronLeft, ChevronRight, Expand, ImageIcon } from 'lucide-react';
import { cn } from './cn';

/**
 * Foto galeri — sahibinden slider tarzı: ana görsel + alt thumbnail şeridi.
 * 15'e kadar görsel. Boşsa placeholder.
 */
export function FotoGaleri({ images, alt = 'İlan görseli' }: { images: string[]; alt?: string }) {
  const [active, setActive] = useState(0);

  if (!images || images.length === 0) {
    return (
      <div className="flex aspect-[16/10] items-center justify-center rounded-xl border border-gray-200 bg-gray-50">
        <div className="text-center text-gray-400">
          <ImageIcon className="mx-auto h-10 w-10" />
          <p className="mt-2 text-sm">Görsel yok</p>
        </div>
      </div>
    );
  }

  const prev = () => setActive((i) => (i - 1 + images.length) % images.length);
  const next = () => setActive((i) => (i + 1) % images.length);

  return (
    <div className="space-y-2">
      {/* Ana görsel */}
      <div className="group relative aspect-[16/10] overflow-hidden rounded-xl bg-gray-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={active}
          src={images[active]}
          alt={`${alt} ${active + 1}`}
          className="h-full w-full object-cover"
        />

        {/* Sayaç */}
        <span className="absolute bottom-3 right-3 rounded-full bg-black/65 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
          {active + 1} / {images.length}
        </span>

        {/* Tam ekran (placeholder ikon) */}
        <span className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
          <Expand className="h-4 w-4" />
        </span>

        {/* Prev / Next */}
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={prev}
              aria-label="Önceki"
              className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-gray-700 shadow-md backdrop-blur transition-colors hover:bg-white"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Sonraki"
              className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-gray-700 shadow-md backdrop-blur transition-colors hover:bg-white"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>

      {/* Thumbnail şeridi */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              className={cn(
                'relative h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 transition-all',
                i === active ? 'border-[var(--renk,#2563eb)] opacity-100' : 'border-transparent opacity-70 hover:opacity-100',
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

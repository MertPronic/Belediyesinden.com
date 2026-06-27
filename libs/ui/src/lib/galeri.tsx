'use client';
import { useState } from 'react';
import { ChevronLeft, ChevronRight, Expand, ImageIcon } from 'lucide-react';
import { cn } from './cn';

/**
 * Foto galeri — tek büyük ana görsel + altta küçük thumbnail şeridi.
 * "İki slider" algısını önlemek için: ana görsel sabit yükseklik,
 * thumbnail'lar küçük + aktif olmayanlar sönük. Klavye: Sol/Sağ ok.
 */
export function FotoGaleri({ images, alt = 'İlan görseli' }: { images: string[]; alt?: string }) {
  const [active, setActive] = useState(0);

  const prev = () => setActive((i) => (i - 1 + images.length) % images.length);
  const next = () => setActive((i) => (i + 1) % images.length);
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
    if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
  };

  if (!images || images.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center rounded-xl border border-gray-200 bg-gray-50">
        <div className="text-center text-gray-400">
          <ImageIcon className="mx-auto h-10 w-10" />
          <p className="mt-2 text-sm">Görsel yok</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Ana görsel — sabit yükseklik (geniş ekranda devasa olmaz). Klavye: ok tuşları. */}
      <div
        className="group relative h-72 overflow-hidden rounded-xl bg-gray-100 outline-none focus-visible:ring-2 focus-visible:ring-[var(--renk,#2563eb)] sm:h-80"
        tabIndex={0}
        role="group"
        aria-label={`İlan görseli ${active + 1} / ${images.length}. Gezinmek için ok tuşlarını kullanın.`}
        onKeyDown={images.length > 1 ? onKeyDown : undefined}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img key={active} src={images[active]} alt={`${alt} ${active + 1}`} className="h-full w-full object-cover" />

        {/* Sayaç */}
        <span className="absolute bottom-3 right-3 rounded-full bg-black/65 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
          {active + 1} / {images.length}
        </span>

        <span className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
          <Expand className="h-4 w-4" />
        </span>

        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={prev}
              aria-label="Önceki"
              className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-gray-700 shadow-md transition-colors hover:bg-white"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Sonraki"
              className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-gray-700 shadow-md transition-colors hover:bg-white"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>

      {/* Thumbnail şeridi — küçük, aktif olmayan sönük (net "thumbnail" algısı) */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              className={cn(
                'relative h-14 w-20 shrink-0 overflow-hidden rounded-md border transition-all',
                i === active
                  ? 'border-[var(--renk,#2563eb)] opacity-100 ring-1 ring-[var(--renk,#2563eb)]'
                  : 'border-gray-200 opacity-50 hover:opacity-90',
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

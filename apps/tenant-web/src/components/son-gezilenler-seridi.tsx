'use client';
import { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { IlanKarti } from '@belediyesinden/ui';
import { sonGezilenleriGetir, type SonGezilenIlan } from '../lib/son-gezilenler';

const GOSTERILECEK_ADET = 8;

/**
 * Sayfanın en altında "Son Gezdiklerin" şeridi — localStorage'dan okunur (client-only,
 * SSR'da boş döner), o yüzden mount sonrası state ile dolduruluyor (hydration uyumsuzluğu
 * yaratmaması için ilk render'da hiç gösterilmiyor).
 */
export function SonGezilenlerSeridi({ haricTutulacakId }: { haricTutulacakId?: string }) {
  const [ilanlar, setIlanlar] = useState<SonGezilenIlan[] | null>(null);

  useEffect(() => {
    setIlanlar(sonGezilenleriGetir(haricTutulacakId).slice(0, GOSTERILECEK_ADET));
  }, [haricTutulacakId]);

  if (!ilanlar || ilanlar.length === 0) return null;

  return (
    <section className="mt-10 border-t border-gray-100 pt-8">
      <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-gray-900">
        <History className="h-4 w-4 text-gray-400" />
        Son Gezdiklerin
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {ilanlar.map((ilan) => (
          <IlanKarti key={ilan.id} ilan={ilan} href={`/ilanlar/${ilan.id}`} />
        ))}
      </div>
    </section>
  );
}

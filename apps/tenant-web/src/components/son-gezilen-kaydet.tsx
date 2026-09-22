'use client';
import { useEffect } from 'react';
import type { IlanKartiData } from '@belediyesinden/ui';
import { sonGezilenEkle } from '../lib/son-gezilenler';

/** Görünmez — ilan detay sayfası mount olunca bu ilanı "son gezilenler"e kaydeder. */
export function SonGezilenKaydet({ tenantSlug, ilan }: { tenantSlug: string; ilan: IlanKartiData }) {
  useEffect(() => {
    sonGezilenEkle(tenantSlug, ilan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ilan.id]);

  return null;
}

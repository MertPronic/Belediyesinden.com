'use client';
import { useState } from 'react';
import { Heart } from 'lucide-react';
import { Button } from '@belediyesinden/ui';
import { apiFetch } from '../lib/api';

/** İlan favori toggle butonu (ilan detay sağ panelinde). */
export function FavoriButton({ ilanId }: { ilanId: string }) {
  const [favori, setFavori] = useState(false);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      const res = await apiFetch<{ favori: boolean }>(`/ilan/${ilanId}/favori`, { method: 'POST' });
      setFavori(res.favori);
    } catch {
      /* yoksay */
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="outline" className="flex-1" loading={busy} onClick={toggle}>
      <Heart className={`h-4 w-4 ${favori ? 'fill-current text-red-500' : ''}`} />
      {favori ? 'Favorilerde' : 'Favori'}
    </Button>
  );
}

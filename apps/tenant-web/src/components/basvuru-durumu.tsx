'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, ClipboardCheck, Clock, Info, XCircle } from 'lucide-react';
import { Alert } from '@belediyesinden/ui';
import { apiFetch } from '../lib/api';
import { useAuth } from '../lib/use-auth';

interface Basvuru {
  id: string;
  durum: string;
}

const DURUM_GORUNUM: Record<
  string,
  { variant: 'info' | 'success' | 'warning' | 'error'; icon: typeof Info; mesaj: string }
> = {
  BASLADI: { variant: 'info', icon: Clock, mesaj: 'Bu ilana başvurdunuz — teminat bekleniyor.' },
  TEMINAT_BEKLENIYOR: { variant: 'info', icon: Clock, mesaj: 'Bu ilana başvurdunuz — teminat dekontunuz inceleniyor.' },
  ONAYLANDI: { variant: 'success', icon: CheckCircle2, mesaj: 'Başvurunuz ve teminatınız onaylandı. İhale başladığında teklif verebilirsiniz.' },
  REDDEDILDI: { variant: 'error', icon: XCircle, mesaj: 'Başvurunuz/teminatınız reddedildi.' },
  IADE_EDILDI: { variant: 'info', icon: Info, mesaj: 'Teminatınız iade edildi.' },
  IPTAL_EDILDI: { variant: 'info', icon: Info, mesaj: 'Başvurunuzu geri çektiniz.' },
};

/**
 * Varlık detay sayfasındaki "Başvur" CTA'sının yerini alır. Sayfa vatandaş için
 * anonim/public render edildiğinden (bkz. serverApiFetch), kullanıcının bu
 * varlığa daha önce başvurup başvurmadığı ancak tarayıcıda (giriş yapmışsa)
 * öğrenilebilir — bu yüzden ayrı bir client component. KK-25: birim ilan değil varlık (kalem).
 */
export function BasvuruDurumu({ kalemId }: { kalemId: string }) {
  const { ready, authenticated } = useAuth();
  const [basvuru, setBasvuru] = useState<Basvuru | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!authenticated) {
      setChecked(true);
      return;
    }
    apiFetch<Basvuru | null>(`/basvuru/kalem/${kalemId}/benim`)
      .then(setBasvuru)
      .catch(() => setBasvuru(null))
      .finally(() => setChecked(true));
  }, [ready, authenticated, kalemId]);

  if (!checked) {
    return (
      <div className="h-12 animate-pulse rounded-lg bg-gray-100" aria-hidden />
    );
  }

  if (basvuru) {
    const gorunum = DURUM_GORUNUM[basvuru.durum] ?? DURUM_GORUNUM['TEMINAT_BEKLENIYOR'];
    return (
      <div className="space-y-3">
        <Alert variant={gorunum.variant} icon={<gorunum.icon />}>
          {gorunum.mesaj}
        </Alert>
        {(basvuru.durum === 'BASLADI' || basvuru.durum === 'TEMINAT_BEKLENIYOR') && (
          <Link
            href={`/teminat/${basvuru.id}`}
            className="flex h-11 items-center justify-center gap-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Teminat sayfasına git
            <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>
    );
  }

  return (
    <Link
      href={`/basvuru/${kalemId}`}
      className="flex h-12 items-center justify-center gap-2 rounded-lg text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
      style={{ background: 'var(--renk)' }}
    >
      <ClipboardCheck className="h-4 w-4" />
      Başvur
      <ArrowRight className="h-4 w-4" />
    </Link>
  );
}

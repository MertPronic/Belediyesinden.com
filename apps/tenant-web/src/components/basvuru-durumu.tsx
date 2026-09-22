'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ClipboardCheck, Info } from 'lucide-react';
import { StatusBanner, StatusStepper } from '@belediyesinden/ui';
import { apiFetch } from '../lib/api';
import { useAuth } from '../lib/use-auth';
import { AuthAwareLink } from './auth-aware-link';

interface Basvuru {
  id: string;
  durum: string;
}

interface StepperGorunum {
  aktifIndex: number;
  aktifTamamlandi?: boolean;
  /** Süreç bu adımda durduysa (reddedildi/iptal) — bkz. StatusStepper. */
  durakIndex?: number;
  durakRenk?: 'red' | 'gray';
  aciklama: string;
}

/**
 * Süreç hâlâ devam ediyorsa (happy-path) uçtan uca 4 adım gösterilir — sadece
 * başvuru/teminat değil, kalemin kendi ihale durumu da (BEKLIYOR/CANLI_ARTIRMA/
 * SONUCLANDI, bkz. DECISIONS.md KK-25) bu tek çubuğa dahil edilir. Reddedildi/iptal
 * gibi süreç dışı durumlar da aynı çubukta — o adımda kırmızı/gri bir durak işaretiyle
 * biter (Harun bey/PO geri bildirimi, 2026-08-24).
 */
const ADIMLAR = [{ label: 'Başvuru' }, { label: 'Teminat' }, { label: 'İhale' }, { label: 'Sonuç' }];

function stepperGorunumu(basvuruDurum: string, kalemDurum: string): StepperGorunum {
  switch (basvuruDurum) {
    case 'BASLADI':
      return {
        aktifIndex: 1,
        aciklama: 'Başvurunuz alındı — ihaleye katılmak için teminat dekontu yüklemeniz gerekiyor.',
      };
    case 'TEMINAT_BEKLENIYOR':
      return {
        aktifIndex: 1,
        aciklama: 'Dekontunuz belediye tarafından inceleniyor, onaylandığında bilgilendirileceksiniz.',
      };
    case 'ONAYLANDI':
      if (kalemDurum === 'CANLI_ARTIRMA') {
        return {
          aktifIndex: 2,
          aciklama: 'Teminatınız onaylandı ve ihale şu anda canlı — teklif verebilirsiniz.',
        };
      }
      if (kalemDurum === 'SONUCLANDI' || kalemDurum === 'IPTAL') {
        return {
          aktifIndex: 3,
          aktifTamamlandi: true,
          aciklama:
            kalemDurum === 'IPTAL'
              ? 'İhale iptal edildi.'
              : 'İhale sonuçlandı. Sonucu "İhalelerim" sayfasından görebilirsiniz.',
        };
      }
      // kalemDurum === 'BEKLIYOR'
      return {
        aktifIndex: 2,
        aciklama: 'Teminatınız onaylandı. İhale başladığında teklif verebilirsiniz.',
      };
    case 'REDDEDILDI':
      return {
        aktifIndex: 1,
        durakIndex: 1,
        durakRenk: 'red',
        aciklama: 'Teminat dekontunuz veya başvurunuz reddedildi.',
      };
    case 'IPTAL_EDILDI':
      return {
        aktifIndex: 1,
        durakIndex: 1,
        durakRenk: 'gray',
        aciklama: 'Başvurunuzu geri çektiniz.',
      };
    case 'IADE_EDILDI':
      return {
        aktifIndex: 3,
        aktifTamamlandi: true,
        aciklama: 'İhale sonuçlandı, teminatınız iade edildi.',
      };
    default:
      return { aktifIndex: 1, durakIndex: 1, durakRenk: 'red', aciklama: 'Başvurunuz reddedildi.' };
  }
}

/**
 * Varlık detay sayfasındaki "Başvur" CTA'sının yerini alır. Sayfa vatandaş için
 * anonim/public render edildiğinden (bkz. serverApiFetch), kullanıcının bu
 * varlığa daha önce başvurup başvurmadığı ancak tarayıcıda (giriş yapmışsa)
 * öğrenilebilir — bu yüzden ayrı bir client component. KK-25: birim ilan değil varlık (kalem).
 */
export function BasvuruDurumu({ kalemId, kalemDurum }: { kalemId: string; kalemDurum: string }) {
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
    const s = stepperGorunumu(basvuru.durum, kalemDurum);
    return (
      <div className="space-y-3">
        <StatusStepper
          adimlar={ADIMLAR}
          aktifIndex={s.aktifIndex}
          aktifTamamlandi={s.aktifTamamlandi}
          durakIndex={s.durakIndex}
          durakRenk={s.durakRenk}
          aciklama={s.aciklama}
        />
        {(basvuru.durum === 'BASLADI' ||
          basvuru.durum === 'TEMINAT_BEKLENIYOR' ||
          basvuru.durum === 'REDDEDILDI') && (
          <Link
            href={`/teminat/${basvuru.id}`}
            className="flex h-11 items-center justify-center gap-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            {basvuru.durum === 'REDDEDILDI' ? 'Yeni dekont yükle' : 'Teminat sayfasına git'}
            <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>
    );
  }

  // Hiç başvuru yok — ihale bu varlık için artık BEKLIYOR aşamasında değilse
  // (canlı/sonuçlanmış) "Başvur" CTA'sı yanıltıcı olur, o pencere kapanmıştır.
  if (kalemDurum !== 'BEKLIYOR') {
    return (
      <StatusBanner
        renk="gray"
        icon={<Info />}
        baslik="Başvuru Yapılmadı"
        aciklama="Bu varlığa başvuru yapılmamış — başvuru süresi bu varlık için sona ermiştir."
      />
    );
  }

  return (
    <AuthAwareLink
      href={`/basvuru/${kalemId}`}
      className="flex h-12 items-center justify-center gap-2 rounded-lg text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
      style={{ background: 'var(--renk)' }}
    >
      <ClipboardCheck className="h-4 w-4" />
      Başvur
      <ArrowRight className="h-4 w-4" />
    </AuthAwareLink>
  );
}

import Link from 'next/link';
import { ArrowRight, Building2, Inbox, Search, ShieldCheck } from 'lucide-react';
import { portalFetch } from '../lib/api';
import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  Field,
  Input,
  Select,
  IlanKarti,
  type IlanKartiData,
} from '@belediyesinden/ui';

interface PortalIlan extends IlanKartiData {
  tenant_slug: string;
}

async function fetchTumIlanlar(query?: string, tip?: string): Promise<PortalIlan[]> {
  try {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (tip) params.set('tip', tip);
    const qs = params.toString();
    return await portalFetch<PortalIlan[]>(qs ? `/search/ilan?${qs}` : '/search/ilan');
  } catch {
    return [];
  }
}

const TIPLER = [
  { value: '', label: 'Tüm Tipler' },
  { value: 'ACIK_ARTIRMA', label: 'Açık Artırma' },
  { value: 'ACIK_TEKLIF', label: 'Açık Teklif' },
  { value: 'KAPALI_TEKLIF', label: 'Kapalı Teklif' },
];

export default async function PortalHomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tip?: string }>;
}) {
  const sp = await searchParams;
  const ilanlar = await fetchTumIlanlar(sp['q'], sp['tip']);
  const aktifFiltre = !!(sp['q'] || sp['tip']);

  return (
    <div className="space-y-10">
      {/* Hero */}
      <section className="hero-accent overflow-hidden rounded-2xl border border-gray-100">
        <div className="px-6 py-12 sm:px-10 sm:py-16">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white/70 px-3 py-1 text-xs font-medium text-gray-600 backdrop-blur">
            <ShieldCheck className="h-3.5 w-3.5" style={{ color: 'var(--renk)' }} />
            Tüm Belediyeler Tek Çatı Altında
          </span>
          <h1 className="mt-4 max-w-2xl text-4xl font-extrabold leading-tight tracking-tight text-gray-900 sm:text-5xl">
            Belediye İlanları Tek Portalda
          </h1>
          <p className="mt-3 max-w-xl text-base text-gray-600 sm:text-lg">
            Türkiye genelindeki belediyelerin satış, kiralama ve açık artırma ilanlarını
            arayın, kendi belediyenizin portalına yönlendirilin.
          </p>
        </div>
      </section>

      {/* Filtre */}
      <Card>
        <CardContent className="p-4">
          <form className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field className="mb-0 flex-1">
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">
                Ara
              </label>
              <Input
                type="text"
                name="q"
                placeholder="İlan ara..."
                defaultValue={sp['q'] ?? ''}
                icon={<Search />}
              />
            </Field>
            <Field className="mb-0 sm:w-56">
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">
                İhale Tipi
              </label>
              <Select name="tip" defaultValue={sp['tip'] ?? ''}>
                {TIPLER.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Button type="submit" leftIcon={<Search />} className="sm:h-10">
              Ara
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Sonuçlar */}
      {ilanlar.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Inbox />}
            title={aktifFiltre ? 'İlan bulunamadı' : 'Henüz ilan yok'}
            description={
              aktifFiltre
                ? 'Arama kriterlerinize uygun ilan bulunamadı.'
                : 'Şu anda yayında ilan bulunmuyor.'
            }
            action={
              aktifFiltre ? (
                <Link href="/" className="text-sm font-medium" style={{ color: 'var(--renk)' }}>
                  Filtreleri temizle
                </Link>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">{ilanlar.length} ilan bulundu</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ilanlar.map((ilan) => (
              <IlanKarti
                key={`${ilan.tenant_slug}:${ilan.id}`}
                ilan={ilan}
                href={`/${ilan.tenant_slug}/${ilan.id}`}
                extra={
                  <Badge variant="default" icon={<Building2 />}>
                    {ilan.tenant_slug}
                  </Badge>
                }
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

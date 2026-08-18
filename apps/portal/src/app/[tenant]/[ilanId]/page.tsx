import { notFound, redirect } from 'next/navigation';
import { portalFetch, tenantUrl } from '../../../lib/api';

interface Ilan {
  id: string;
  durum: string;
}

const PUBLIC_DURUMLAR = ['YAYINDA', 'CANLI_ARTIRMA', 'SONUCLANDI'];

/**
 * Portal artık ilan ayrıntısını göstermiyor — kartlar doğrudan tenant alt alan
 * adına yönlendiriyor (bkz. arama-paneli.tsx). Bu rota yalnızca eski/paylaşılmış
 * bağlantıları aynı hedefe yönlendirmek için korunuyor.
 */
export default async function PortalIlanDetayPage({
  params,
}: {
  params: Promise<{ tenant: string; ilanId: string }>;
}) {
  const { tenant, ilanId } = await params;

  let ilan: Ilan | null = null;
  try {
    ilan = await portalFetch<Ilan>(`/ilan/${ilanId}`, tenant);
  } catch {
    notFound();
  }

  if (!ilan || !PUBLIC_DURUMLAR.includes(ilan.durum)) {
    notFound();
  }

  redirect(tenantUrl(tenant, `/ilanlar/${ilan.id}`));
}

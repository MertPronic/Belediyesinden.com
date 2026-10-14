import { NextResponse, type NextRequest } from 'next/server';

/**
 * Subdomain → tenant slug çözümleme. `admin` ayrılmış — süper admin'in hiçbir
 * belediye temasına bağlı olmayan nötr paneli için (bkz. api.ts getTenantSlug()) —
 * bu yüzden `null` (belirsiz, dev fallback tenant'a düşülebilir) değil, boş
 * string (KESİN nötr, asla fallback'e düşmez) döner.
 */
function resolveTenantSlug(host: string): string | null {
  const first = host.split(':')[0].split('.')[0]?.toLowerCase();
  if (first === 'admin') return '';
  if (first && !['localhost', 'www', 'belediyesinden'].includes(first)) {
    return first;
  }
  return null;
}

/** Next.js 16 proxy (eski adıyla middleware): subdomain → x-tenant-slug header. */
export function proxy(request: NextRequest) {
  const host = request.headers.get('host') ?? '';
  const resolved = resolveTenantSlug(host);
  const slug = resolved !== null ? resolved : process.env['NEXT_PUBLIC_TENANT_SLUG'] || '';

  // İstek başlıklarına x-tenant-slug enjekte et (server component'ler buradan okur).
  const requestHeaders = new Headers(request.headers);
  if (slug) {
    requestHeaders.set('x-tenant-slug', slug);
  }

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/hello).*)'],
};

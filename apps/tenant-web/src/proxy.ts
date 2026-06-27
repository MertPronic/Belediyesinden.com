import { NextResponse, type NextRequest } from 'next/server';

/** Subdomain → tenant slug çözümleme. */
function resolveTenantSlug(host: string): string {
  const first = host.split(':')[0].split('.')[0]?.toLowerCase();
  if (first && !['localhost', 'www', 'belediyesinden'].includes(first)) {
    return first;
  }
  return '';
}

/** Next.js 16 proxy (eski adıyla middleware): subdomain → x-tenant-slug header. */
export function proxy(request: NextRequest) {
  const host = request.headers.get('host') ?? '';
  const slug = resolveTenantSlug(host) || process.env['NEXT_PUBLIC_TENANT_SLUG'] || '';

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

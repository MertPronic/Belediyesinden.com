import { headers } from 'next/headers';

const API_URL = process.env['API_URL'] ?? 'http://localhost:3000';

interface TenantTheme {
  slug: string;
  ad: string;
  tema: { renk?: string; siteName?: string } | null;
}

/** İstekten tenant slug çözer: önce x-tenant-slug, sonra host subdomain'i. */
async function resolveSlug(): Promise<string | null> {
  const h = await headers();
  const xSlug = h.get('x-tenant-slug');
  if (xSlug) {
    return xSlug;
  }
  const hostname = (h.get('host') ?? '').split(':')[0].toLowerCase();
  if (['localhost', '', 'www'].includes(hostname)) {
    return null;
  }
  const first = hostname.split('.')[0];
  if (first && !['belediyesinden', 'www'].includes(first)) {
    return first;
  }
  return null;
}

async function getTenantTheme(): Promise<TenantTheme> {
  const slug = await resolveSlug();
  if (!slug) {
    return { slug: '', ad: 'Belediyesinden', tema: { renk: '#2563eb', siteName: 'Belediyesinden' } };
  }
  try {
    const r = await fetch(`${API_URL}/api/tenants/current`, {
      headers: { 'x-tenant-slug': slug },
      cache: 'no-store',
    });
    if (!r.ok) {
      throw new Error(`theme fetch ${r.status}`);
    }
    return (await r.json()) as TenantTheme;
  } catch {
    return { slug, ad: slug, tema: { renk: '#64748b', siteName: slug } };
  }
}

/**
 * Belediye (tenant) ana sayfası — subdomain'e göre dinamik marka.
 * Server-side tenant temasını fetch eder; renk + site adı uygular.
 */
export default async function Home() {
  const theme = await getTenantTheme();
  const renk = theme.tema?.renk ?? '#2563eb';
  const siteName = theme.tema?.siteName ?? theme.ad;

  return (
    <main
      style={{
        minHeight: '100vh',
        background: `linear-gradient(135deg, ${renk} 0%, #ffffff 60%)`,
        color: '#0f172a',
        fontFamily: 'system-ui, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          background: 'white',
          padding: '2.5rem 3rem',
          borderRadius: '1rem',
          boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
          textAlign: 'center',
        }}
      >
        <div
          style={{ width: 56, height: 56, borderRadius: '0.75rem', background: renk, margin: '0 auto 1rem' }}
        />
        <h1 style={{ margin: 0, fontSize: '1.8rem' }}>{siteName}</h1>
        <p style={{ margin: '0.5rem 0 0', color: '#64748b' }}>
          Belediyesinden · tenant: <code>{theme.slug || 'merkezi'}</code>
        </p>
        <p style={{ margin: '0.5rem 0 0', color: '#94a3b8', fontSize: '0.85rem' }}>
          Dinamik tema — renk: <code>{renk}</code>
        </p>
      </div>
    </main>
  );
}

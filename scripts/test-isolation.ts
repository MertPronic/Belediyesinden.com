/**
 * test-isolation — uçtan uca tenant izolasyon testi (F1-PR4 doğrulaması).
 * İki tenant admin token'ı ile duyuru ekler; her tenant kendi verisini görür;
 * çapraz tenant erişimi (talas token @ melikgazi subdomain) 403 döner.
 *
 * Önkoşul: api ayağında (pnpm nx serve api) + talas/melikgazi provision edili.
 */
const API = 'http://localhost:3000/api';
const BASE = 'belediyesinden.com';

async function getToken(username: string, password: string): Promise<string> {
  const r = await fetch('http://localhost:8080/realms/belediyesinden/protocol/openid-connect/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: 'portal',
      username,
      password,
    }),
  });
  if (!r.ok) {
    throw new Error(`token ${username}: ${r.status} ${await r.text()}`);
  }
  return ((await r.json()) as { access_token: string }).access_token;
}

async function call(
  method: string,
  path: string,
  slug: string,
  token: string,
  body?: unknown,
): Promise<{ status: number; text: string }> {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-tenant-slug': slug,
      authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, text: await r.text() };
}

async function main(): Promise<void> {
  const talasTok = await getToken('admin_talas', 'Test1234!');
  const melikgaziTok = await getToken('admin_melikgazi', 'Test1234!');

  const p1 = await call('POST', '/duyuru', 'talas', talasTok, { baslik: 'Talas duyurusu' });
  const p2 = await call('POST', '/duyuru', 'melikgazi', melikgaziTok, { baslik: 'Melikgazi duyurusu' });
  console.log(`POST talas=${p1.status}  melikgazi=${p2.status}`);

  const tList = await call('GET', '/duyuru', 'talas', talasTok);
  const mList = await call('GET', '/duyuru', 'melikgazi', melikgaziTok);
  console.log(`GET talas [${tList.status}]:`, tList.text.slice(0, 120));
  console.log(`GET melikgazi [${mList.status}]:`, mList.text.slice(0, 120));

  // Çapraz tenant: talas token ile melikgazi subdomain → 403 beklenir.
  const cross = await call('GET', '/duyuru', 'melikgazi', talasTok);
  console.log(`CROSS talas-token@melikgazi [${cross.status}]: ${cross.status === 403 ? 'IZOLE ✓' : cross.text.slice(0, 80)}`);

  // Doğrulama: talas listesinde sadece Talas, melikgazi'de sadece Melikgazi olmalı.
  const tHasTalas = tList.text.includes('Talas duyurusu');
  const tHasMelikgazi = tList.text.includes('Melikgazi duyurusu');
  console.log(`IZOLASYON: talas sadece-talas=${tHasTalas && !tHasMelikgazi ? '✓' : '✗'}`);
}

main().catch((e) => {
  console.error('Hata:', e instanceof Error ? e.message : e);
  process.exit(1);
});

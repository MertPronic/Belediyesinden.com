/**
 * test-rate-limit — per-tenant rate-limit doğrulaması (F1-PR6).
 * Bir tenant'ı limit'in üstünde istekle boğar → bazıları 429; diğer tenant
 * (ayrı bucket) etkilenmez. THROTTLE_LIMIT düşük olmalı (örn. .env'de 3).
 */
const API = 'http://localhost:3000/api';

async function getToken(username: string, password: string): Promise<string> {
  const r = await fetch('http://localhost:8080/realms/belediyesinden/protocol/openid-connect/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'password', client_id: 'portal', username, password }),
  });
  if (!r.ok) {
    throw new Error(`token ${username}: ${r.status}`);
  }
  return ((await r.json()) as { access_token: string }).access_token;
}

async function call(slug: string, token: string): Promise<number> {
  const r = await fetch(`${API}/duyuru`, {
    headers: { 'x-tenant-slug': slug, authorization: `Bearer ${token}` },
  });
  return r.status;
}

async function main(): Promise<void> {
  const talasTok = await getToken('admin_talas', 'Test1234!');
  const melikgaziTok = await getToken('admin_melikgazi', 'Test1234!');

  console.log('talas flood (6 istek):');
  const talasStatuses: number[] = [];
  for (let i = 0; i < 6; i++) {
    talasStatuses.push(await call('talas', talasTok));
  }
  console.log('  ' + talasStatuses.join(', '));

  // melikgazi ayrı bucket → etkilenmemeli (200).
  const mgz = await call('melikgazi', melikgaziTok);
  console.log(`melikgazi (ayrı bucket): ${mgz}`);

  const talasThrottled = talasStatuses.some((s) => s === 429);
  console.log(`SONUC: talas-throttle(429)=${talasThrottled ? '✓' : '✗'}  melikgazi-etkilenmedi(200)=${mgz === 200 ? '✓' : '✗'}`);
}

main().catch((e) => {
  console.error('Hata:', e instanceof Error ? e.message : e);
  process.exit(1);
});

/**
 * test-faz2 — Faz 2 uçtan uca testi: varlık → ilan → kural snapshot'lı yayın →
 * OpenSearch arama + tenant izolasyon. (evrak MinIO build+tablo ile doğrulu.)
 *
 * Önkoşul: api ayağında + talas/melikgazi provision edili + OpenSearch çalışıyor.
 */
const API = 'http://localhost:3000/api';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getToken(username: string): Promise<string> {
  const r = await fetch('http://localhost:8080/realms/belediyesinden/protocol/openid-connect/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'password', client_id: 'portal', username, password: 'Test1234!' }),
  });
  if (!r.ok) {
    throw new Error(`token ${username}: ${r.status}`);
  }
  return ((await r.json()) as { access_token: string }).access_token;
}

async function call(
  method: string,
  path: string,
  slug: string,
  token: string,
  body?: unknown,
): Promise<{ status: number; data: unknown }> {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-tenant-slug': slug,
      authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let data: unknown = text;
  try {
    data = JSON.parse(text);
  } catch {
    /* metin bırak */
  }
  return { status: r.status, data };
}

async function flow(slug: string, token: string, ad: string): Promise<{ ilanId: string; pubStatus: number; kurallar: unknown }> {
  const varlik = await call('POST', '/varlik', slug, token, { tip: 'TASINMAZ', ad: `${ad} arsa`, detay: { alanM2: 500 } });
  const varlikId = (varlik.data as { id: string }).id;
  const ilan = await call('POST', '/ilan', slug, token, { baslik: `${ad} satılık arsa`, varlikId, ihaleTipi: 'ACIK_ARTIRMA', baslangicFiyati: 100000 });
  const ilanId = (ilan.data as { id: string }).id;
  const pub = await call('POST', `/ilan/${ilanId}/durum`, slug, token, { durum: 'YAYINDA' });
  return { ilanId, pubStatus: pub.status, kurallar: (pub.data as { kurallar?: unknown }).kurallar };
}

async function main(): Promise<void> {
  const tTok = await getToken('admin_talas');
  const mTok = await getToken('admin_melikgazi');

  const tRes = await flow('talas', tTok, 'Talas');
  const mRes = await flow('melikgazi', mTok, 'Melikgazi');
  console.log(`talas  yayın=${tRes.pubStatus}  kural-snapshot=${JSON.stringify(tRes.kurallar)}`);
  console.log(`melikgazi yayın=${mRes.pubStatus}  kural-snapshot=${JSON.stringify(mRes.kurallar)}`);

  await sleep(2000); // OpenSearch refresh

  const tSearch = await call('GET', '/search/ilan?q=Talas', 'talas', tTok);
  const mSearch = await call('GET', '/search/ilan?q=Melikgazi', 'melikgazi', mTok);
  const tStr = JSON.stringify(tSearch.data);
  const mStr = JSON.stringify(mSearch.data);
  const tHasTalas = tStr.includes('Talas');
  const tHasMelikgazi = tStr.includes('Melikgazi');
  const mHasMelikgazi = mStr.includes('Melikgazi');

  console.log(`talas arama: ${tStr.slice(0, 100)}`);
  console.log(`melikgazi arama: ${mStr.slice(0, 100)}`);
  console.log(
    `SONUC: talas-yayin=${tRes.pubStatus >= 200 && tRes.pubStatus < 300 ? '✓' : '✗'}  kural-snapshot=${tRes.kurallar ? '✓' : '✗'}  ` +
      `arama-izolasyon(talas→talas, melikgazi→yok)=${tHasTalas && !tHasMelikgazi ? '✓' : '✗'}  ` +
      `melikgazi-bulundu=${mHasMelikgazi ? '✓' : '✗'}`,
  );
}

main().catch((e) => {
  console.error('Hata:', e instanceof Error ? e.message : e);
  process.exit(1);
});

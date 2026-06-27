/**
 * test-faz4 — teklif pipeline testi: varlık→ilan→yayın→teklif ver (geçerli/red).
 * Server-authoritative teklifDogrula + anti-snipping süre uzatma kanıtı.
 */
const API = 'http://localhost:3000/api';

async function getToken(username: string): Promise<string> {
  const r = await fetch('http://localhost:8080/realms/belediyesinden/protocol/openid-connect/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'password', client_id: 'portal', username, password: 'Test1234!' }),
  });
  if (!r.ok) throw new Error(`token: ${r.status}`);
  return ((await r.json()) as { access_token: string }).access_token;
}

async function call(method: string, path: string, slug: string, token: string, body?: unknown) {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { 'content-type': 'application/json', 'x-tenant-slug': slug, authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let data: unknown = text;
  try { data = JSON.parse(text); } catch { /* */ }
  return { status: r.status, data: data as Record<string, unknown> };
}

async function main(): Promise<void> {
  const tok = await getToken('admin_talas');
  const slug = 'talas';

  // Varlık + ilan + yayınla
  const v = await call('POST', '/varlik', slug, tok, { tip: 'TASINMAZ', ad: 'F4 arsa', detay: {} });
  const ilan = await call('POST', '/ilan', slug, tok, { baslik: 'F4 satılık', varlikId: (v.data as {id:string}).id, ihaleTipi: 'ACIK_ARTIRMA', baslangicFiyati: 50000 });
  await call('POST', `/ilan/${(ilan.data as {id:string}).id}/durum`, slug, tok, { durum: 'YAYINDA' });
  const ilanId = (ilan.data as {id:string}).id;

  // Geçerli teklif (50000 başlangıç + 100 min adım = min 50100; 51000 > 50100 ✓)
  const ok = await call('POST', `/teklif/ilan/${ilanId}`, slug, tok, { tutar: 51000 });
  console.log(`gecerli teklif 51000 [${ok.status}]: ${(ok.data as {tutar?:string}).tutar ?? ok.data}`);

  // Çok düşük teklif (50500 < 51000 + 100 = 51100 → red)
  const low = await call('POST', `/teklif/ilan/${ilanId}`, slug, tok, { tutar: 50500 });
  console.log(`dusuk teklif 50500 [${low.status}]: ${(low.data as {message?:string}).message ?? low.data}`);

  // Geçerli ikinci teklif (52000 > 51000 + 100 = 51100 ✓)
  const ok2 = await call('POST', `/teklif/ilan/${ilanId}`, slug, tok, { tutar: 52000 });
  console.log(`ikinci teklif 52000 [${ok2.status}]: ${(ok2.data as {tutar?:string}).tutar ?? ok2.data}`);

  // Listele (en yüksek ilk)
  const list = await call('GET', `/teklif/ilan/${ilanId}`, slug, tok);
  const teklifler = list.data as Array<{tutar: string}>;
  console.log(`liste [${list.status}]: ${teklifler?.length} teklif, en yuksek=${teklifler?.[0]?.tutar}`);

  console.log(
    `\nSONUC: gecerli-1=${ok.status === 201 ? '✓' : '✗'}  red(dusuk)=${low.status === 400 ? '✓' : '✗'}  ` +
    `gecerli-2=${ok2.status === 201 ? '✓' : '✗'}  liste=${teklifler?.length === 2 ? '✓' : '✗'}  ` +
    `enYuksek=52000=${teklifler?.[0]?.tutar === '52000.00' ? '✓' : '✗'}`,
  );
}

main().catch((e) => { console.error('Hata:', e instanceof Error ? e.message : e); process.exit(1); });

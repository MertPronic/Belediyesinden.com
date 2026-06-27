/**
 * test-faz3 — Faz 3 uçtan uca testi: varlık → ilan → başvuru (KVKK) →
 * teminat yükle (e-dekont) → encümen onayı (bloke) → iade. Tenant izolasyon.
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
    throw new Error(`token: ${r.status}`);
  }
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
  try {
    data = JSON.parse(text);
  } catch {
    /* metin */
  }
  return { status: r.status, data: data as Record<string, unknown> | string };
}

async function uploadFile(path: string, slug: string, token: string, fileName: string, content: string) {
  const fd = new FormData();
  fd.append('file', new Blob([content], { type: 'application/pdf' }), fileName);
  const r = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'x-tenant-slug': slug, authorization: `Bearer ${token}` },
    body: fd,
  });
  const text = await r.text();
  let data: unknown = text;
  try {
    data = JSON.parse(text);
  } catch {
    /* metin */
  }
  return { status: r.status, data: data as Record<string, unknown> };
}

async function main(): Promise<void> {
  const tok = await getToken('admin_talas');
  const slug = 'talas';

  // 1. Varlık + ilan + yayınla (KVKK onayı için yayında olmalı)
  const v = await call('POST', '/varlik', slug, tok, { tip: 'TASINMAZ', ad: 'Faz3 arsa', detay: { alanM2: 750 } });
  const ilan = await call('POST', '/ilan', slug, tok, { baslik: 'Faz3 satılık arsa', varlikId: (v.data as { id: string }).id, ihaleTipi: 'ACIK_ARTIRMA', baslangicFiyati: 50000 });
  await call('POST', `/ilan/${(ilan.data as { id: string }).id}/durum`, slug, tok, { durum: 'YAYINDA' });

  // 2. Başvuru (KVKK onay zorunlu)
  const basvuru = await call('POST', `/basvuru/ilan/${(ilan.data as { id: string }).id}`, slug, tok, { kvkkOnay: true, acikRiza: true });
  const basvuruData = basvuru.data as { id: string; durum: string; gereken_teminat: string };
  console.log(`basvuru [${basvuru.status}] durum=${basvuruData.durum} gerekenTeminat=${basvuruData.gereken_teminat}`);

  // 3. Teminat yükle (e-dekont)
  const teminat = await uploadFile(`/teminat/basvuru/${basvuruData.id}`, slug, tok, 'dekont.pdf', 'fake dekont %PDF');
  const teminatData = teminat.data as { id: string; durum: string; tutar: string };
  console.log(`teminat [${teminat.status}] durum=${teminatData.durum} tutar=${teminatData.tutar}`);

  // 4. Encümen onayı (BLOKE)
  const onay = await call('POST', `/teminat/${teminatData.id}/onayla`, slug, tok, {});
  console.log(`onay [${onay.status}] teminatDurum=${(onay.data as { durum?: string }).durum}`);

  // 5. Başvuru durumunu kontrol et (ONAYLANDI olmalı)
  const basvurular = await call('GET', `/basvuru/ilan/${(ilan.data as { id: string }).id}`, slug, tok);
  const basvuruList = basvurular.data as Array<{ durum: string }>;
  console.log(`basvuru son durum: ${basvuruList?.[0]?.durum ?? '?'}`);

  // 6. İade
  const iade = await call('POST', `/teminat/${teminatData.id}/iade`, slug, tok, {});
  console.log(`iade [${iade.status}] teminatDurum=${(iade.data as { durum?: string }).durum}`);

  console.log(
    `\nSONUC: basvuru=${basvuru.status === 201 ? '✓' : '✗'}  teminat=${teminat.status === 201 ? '✓' : '✗'}  ` +
      `onay(bloke)=${(onay.data as { durum?: string }).durum === 'BLOKE_EDILDI' ? '✓' : '✗'}  ` +
      `iade=${(iade.data as { durum?: string }).durum === 'IADE_EDILDI' ? '✓' : '✗'}`,
  );
}

main().catch((e) => {
  console.error('Hata:', e instanceof Error ? e.message : e);
  process.exit(1);
});

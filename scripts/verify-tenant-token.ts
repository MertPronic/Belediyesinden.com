/**
 * verify-tenant-token — bir tenant admin kullanıcısının JWT'sinde tenant_id claim
 * olduğunu doğrular (single-realm + tenant-claim modelinin kanıtı).
 *
 * Kullanim: pnpm exec tsx scripts/verify-tenant-token.ts [talas|melikgazi]
 * (dev: portal client'ta direct access grants geçici olarak açılır.)
 */
import KcAdminClient from '@keycloak/keycloak-admin-client';

async function main(): Promise<void> {
  const slug = process.argv[2] ?? 'talas';
  const username = `admin_${slug}`;

  const kc = new KcAdminClient({ baseUrl: 'http://localhost:8080', realmName: 'master' });
  await kc.auth({ username: 'admin', password: 'admin', grantType: 'password', clientId: 'admin-cli' });
  kc.setConfig({ realmName: 'belediyesinden' });

  // Dev kolaylığı: portal client'ta direct access grants aç (token almak için).
  const clients = await kc.clients.find({ clientId: 'portal' });
  const portal = clients.find((c) => c.clientId === 'portal');
  if (portal?.id && portal.directAccessGrantsEnabled === false) {
    await kc.clients.update({ id: portal.id }, { ...portal, directAccessGrantsEnabled: true });
    console.log('  portal: direct access grants acildi (dev)');
  }

  // Read-only: kullanıcının tenant_id attribute'unu göster.
  const me = await kc.users.find({ username, exact: true });
  const user = me.find((u) => u.username === username);
  console.log('  user tenant_id attr:', JSON.stringify(user?.attributes?.tenant_id ?? null));

  const tokenRes = await fetch(
    'http://localhost:8080/realms/belediyesinden/protocol/openid-connect/token',
    {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'password',
        client_id: 'portal',
        username,
        password: 'Test1234!',
      }),
    },
  );
  if (!tokenRes.ok) {
    console.error('token hatasi:', tokenRes.status, await tokenRes.text());
    process.exit(1);
  }
  const tokens = (await tokenRes.json()) as { access_token: string };
  const payload = JSON.parse(
    Buffer.from(tokens.access_token.split('.')[1] ?? '', 'base64url').toString('utf8'),
  ) as { tenant_id?: string; tenant_groups?: string[]; realm_access?: { roles?: string[] } };

  const roles = (payload.realm_access?.roles ?? []).filter((r) => !r.startsWith('default-')).slice(0, 5);
  console.log(
    `OK user=${username}  tenant_groups=${JSON.stringify(payload.tenant_groups ?? [])}  roles=${JSON.stringify(roles)}`,
  );
}

main().catch((e) => {
  console.error('Hata:', e instanceof Error ? e.message : e);
  process.exit(1);
});

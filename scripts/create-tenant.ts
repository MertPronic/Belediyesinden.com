/**
 * create-tenant CLI — bir belediye (tenant) provision eder: DB + Keycloak + audit.
 *
 * Kullanım (dockerized postgres + keycloak ayağında):
 *   pnpm exec tsx scripts/create-tenant.ts talas "Talas Belediyesi"
 *   pnpm exec tsx scripts/create-tenant.ts melikgazi
 *
 * Yapar:
 *   1) tenant_id protocol mapper (idempotent, realm düzeyinde bir kez)
 *   2) DB: shared.tenants kaydı + tenant_<slug> schema + tenant_config
 *   3) Keycloak: tenant_<slug> grubu
 *   4) Keycloak: test kullanıcısı admin_<slug> (tenant_id attribute + grup + şifre)
 *   5) audit log (TENANT_PROVISION)
 *
 * Varsayılanlar local docker-compose ile eşleşir; env ile geçersiz kılınabilir.
 */
import { createDataSource } from '@belediyesinden/db';
import { provisionTenant } from '@belediyesinden/tenancy';
import { KeycloakAdminService } from '@belediyesinden/auth';
import { appendAuditLog } from '@belediyesinden/audit';

function env(key: string, fallback: string): string {
  const v = process.env[key];
  return v && v.length ? v : fallback;
}

async function main(): Promise<void> {
  const [slug, ad] = process.argv.slice(2);
  if (!slug) {
    console.error('Kullanim: pnpm exec tsx scripts/create-tenant.ts <slug> [ad]');
    console.error('Ornek:  pnpm exec tsx scripts/create-tenant.ts talas "Talas Belediyesi"');
    process.exit(1);
  }
  const tenantAd = ad ?? slug;

  // Keycloak admin client (master realm'de admin-cli ile doğrula, belediyesinden'e geç).
  const keycloak = new KeycloakAdminService();
  keycloak.configure({
    baseUrl: env('KEYCLOAK_ADMIN_BASE_URL', 'http://localhost:8080'),
    targetRealm: env('KEYCLOAK_ADMIN_TARGET_REALM', 'belediyesinden'),
    adminClientId: env('KEYCLOAK_ADMIN_CLIENT_ID', 'admin-cli'),
    adminUsername: env('KEYCLOAK_ADMIN_USER', 'admin'),
    adminPassword: env('KEYCLOAK_ADMIN_PASSWORD', 'admin'),
  });

  // 1) tenant_id protocol mapper (idempotent) — token YAYINLAYAN client'larda.
  //    Not: api client bearer-only'dir (token yayınlamaz, sadece doğrular);
  //    dolayısıyla mapper portal ve tenant-web (token yayınlayanlar) üzerinde olmalı.
  const mapperClients = ['portal', 'tenant-web'];
  let mapperOk = true;
  for (const c of mapperClients) {
    const ok = await keycloak
      .ensureTenantGroupClaim(c)
      .then(() => true)
      .catch((e) => {
        console.warn(`  [uyari] ${c} mapper atlandi:`, e instanceof Error ? e.message : e);
        return false;
      });
    mapperOk = mapperOk && ok;
  }

  // 2) DB provisioning.
  const tenant = await provisionTenant(slug, tenantAd);

  // 3) Keycloak grubu.
  const groupId = await keycloak.ensureTenantGroup(slug);

  // 4) test kullanıcısı.
  const username = `admin_${slug}`;
  await keycloak
    .createTenantUser({
      username,
      email: `${username}@${slug}.local`,
      firstName: tenantAd,
      lastName: 'Admin',
      tenantSlug: slug,
      password: env('KEYCLOAK_TEST_USER_PASSWORD', 'Test1234!'),
    })
    .catch((e) => console.warn('  [uyari] kullanici atlandi:', e instanceof Error ? e.message : e));

  // 5) audit log.
  const ds = createDataSource();
  await ds.initialize();
  try {
    await appendAuditLog(ds, {
      tenantId: tenant.id,
      actorId: 'system:provisioning',
      action: 'TENANT_PROVISION',
      entityType: 'tenant',
      entityId: tenant.id,
      payload: { slug, ad: tenantAd, schema: `tenant_${slug}`, keycloakGroup: groupId, mapper: mapperOk },
    });
  } finally {
    await ds.destroy();
  }

  console.log(
    `OK tenant="${tenant.slug}" ad="${tenantAd}" durum=${tenant.durum} ` +
      `schema=tenant_${slug} keycloakGroup=${groupId ?? '-'} testUser=${username}`,
  );
}

main().catch((err) => {
  console.error('Hata:', err instanceof Error ? err.message : err);
  process.exit(1);
});

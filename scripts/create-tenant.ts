/**
 * create-tenant CLI — yeni bir belediye (tenant) provision eder.
 *
 * Kullanım (dockerized postgres ayağında):
 *   pnpm exec tsx scripts/create-tenant.ts talas "Talas Belediyesi"
 *   pnpm exec tsx scripts/create-tenant.ts melikgazi
 *
 * Sonuç: shared.tenants kaydı + tenant_<slug> schema + tenant_config tablosu.
 */
import { provisionTenant } from '@belediyesinden/tenancy';

async function main(): Promise<void> {
  const [slug, ad] = process.argv.slice(2);
  if (!slug) {
    console.error('Kullanim: pnpm exec tsx scripts/create-tenant.ts <slug> [ad]');
    console.error('Ornek:  pnpm exec tsx scripts/create-tenant.ts talas "Talas Belediyesi"');
    process.exit(1);
  }

  const tenant = await provisionTenant(slug, ad ?? slug);
  console.log(
    `OK  tenant="${tenant.slug}" ad="${tenant.ad}" id=${tenant.id} ` +
      `durum=${tenant.durum} schema=tenant_${tenant.slug}`,
  );
}

main().catch((err) => {
  console.error('Hata:', err instanceof Error ? err.message : err);
  process.exit(1);
});

import type { DataSource } from 'typeorm';
import { createDataSource, Tenant } from '@belediyesinden/db';
import { isValidSlug, tenantSchema } from './tenant-resolver';
import { tenantMigrations } from './tenant-migrations';

/**
 * Yeni bir tenant (belediye) provision eder:
 *   1) `shared.tenants` kaydı oluşturur (durum = PROVISIONING).
 *   2) `tenant_<slug>` schema'sını oluşturur.
 *   3) Tenant migration'larını o schema'da koşturur (tenant_config vb.).
 *   4) Durumu AKTIF'e çevirir.
 *
 * İleride (PR-6): Keycloak realm/client oluşturma + varsayılan kural seti/tema seed.
 *
 * @param slug   Tenant URL anahtarı (örn. `talas`).
 * @param ad     Belediye tam adı (örn. "Talas Belediyesi").
 * @param root   Harici DataSource verilirse onu kullanır (CLI/test); verilmezse kendi bağlantısını açar.
 */
export async function provisionTenant(slug: string, ad: string, root?: DataSource): Promise<Tenant> {
  if (!isValidSlug(slug)) {
    throw new Error(`Geçersiz tenant slug: "${slug}" (sadece a-z 0-9, 3-40 karakter)`);
  }
  const schema = tenantSchema(slug);
  const ownConnection = !root;
  const ds = root ?? createDataSource();
  if (ownConnection) await ds.initialize();

  try {
    const repo = ds.getRepository(Tenant);

    // 1) shared.tenants kaydı (yoksa oluştur).
    let tenant = await repo.findOne({ where: { slug } });
    if (!tenant) {
      tenant = repo.create({
        slug,
        ad,
        durum: 'PROVISIONING',
        keycloakRealm: null,
        temaConfig: null,
      });
      await repo.save(tenant);
    }

    // 2) tenant schema oluştur.
    await ds.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);

    // 3) tenant-scoped DataSource ile migration'ları çalıştır.
    const tenantDs = createDataSource({ schema, migrations: tenantMigrations });
    await tenantDs.initialize();
    try {
      await tenantDs.runMigrations();
    } finally {
      await tenantDs.destroy();
    }

    // 4) durumu AKTIF'e çevir.
    tenant.durum = 'AKTIF';
    await repo.save(tenant);
    return tenant;
  } finally {
    if (ownConnection) await ds.destroy();
  }
}

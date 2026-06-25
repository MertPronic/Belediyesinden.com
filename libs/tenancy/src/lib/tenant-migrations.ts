import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tenant schema'sına koşan migration'lar — her tenant için ayrı çalışır.
 * Domain tabloları (ilan, varlık, başvuru vb.) ilerideki PR'larla buraya eklenir.
 */
class InitTenant1740000000000 implements MigrationInterface {
  name = 'InitTenant1740000000000';

  async up(qr: QueryRunner): Promise<void> {
    // Tenant bazlı anahtar/değer yapılandırması (tema, yerel ayarlar, kural overrides).
    await qr.query(`
      CREATE TABLE IF NOT EXISTS tenant_config (
        key        VARCHAR(100) PRIMARY KEY,
        value      JSONB        NOT NULL,
        updated_at TIMESTAMPTZ  NOT NULL DEFAULT now()
      )
    `);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP TABLE IF EXISTS tenant_config`);
  }
}

/**
 * Tüm tenant schema'larında koşacak migration listesi.
 * TypeORM 1.0: migration'lar sınıf (Function) olarak verilir — instance değil;
 * TypeORM bunları kendi new'leyip up/down çağırır.
 */
export const tenantMigrations = [InitTenant1740000000000];

import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tenant şemasına koşan migration'lar — her tenant için ayrı çalışır.
 *
 * ÖNEMLİ: TypeORM raw `qr.query()` sorguları DataSource `schema` opsiyonunu otomatik
 * uygulamaz (tablolar public'e düşer). Bu yüzden her tenant migration'ı, up/down başında
 * `SET search_path TO <tenant şeması>` yapmalıdır. `TenantMigration` temel sınıfı bunu
 * bağlantı options'undan okuyarak otomatik yapar; alt sınıflar sadece `runUp`/`runDown`
 * uygular (şemayı nitelemeden, düz tablo adlarıyla).
 */
export abstract class TenantMigration implements MigrationInterface {
  abstract name: string;

  protected abstract runUp(qr: QueryRunner): Promise<void>;
  protected abstract runDown(qr: QueryRunner): Promise<void>;

  private async setSearchPath(qr: QueryRunner): Promise<void> {
    const schema = (qr.connection.options as { schema?: string }).schema ?? 'public';
    await qr.query(`SET search_path TO ${schema}`);
  }

  async up(qr: QueryRunner): Promise<void> {
    await this.setSearchPath(qr);
    await this.runUp(qr);
  }

  async down(qr: QueryRunner): Promise<void> {
    await this.setSearchPath(qr);
    await this.runDown(qr);
  }
}

/**
 * 0001 — tenant bazlı yapılandırma tablosu (tema, yerel ayarlar, kural overrides).
 * Domain tabloları (ilan, varlık, başvuru vb.) ilerideki PR'larla eklenir.
 */
class InitTenant1740000000000 extends TenantMigration {
  name = 'InitTenant1740000000000';

  protected async runUp(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE TABLE IF NOT EXISTS tenant_config (
        key        VARCHAR(100) PRIMARY KEY,
        value      JSONB        NOT NULL,
        updated_at TIMESTAMPTZ  NOT NULL DEFAULT now()
      )
    `);
  }

  protected async runDown(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP TABLE IF EXISTS tenant_config`);
  }
}

/** Tüm tenant schema'larında koşacak migration listesi. */
export const tenantMigrations = [InitTenant1740000000000];

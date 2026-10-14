import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `shared` şeması migration'ları — merkezi (tüm tenant'ları aşan) tablolar.
 * TypeORM 1.0: sınıf (Function) olarak verilir, instance değil.
 */

/** 0001 — tenants + users temel tabloları. */
class InitShared1740000001000 implements MigrationInterface {
  name = 'InitShared1740000001000';

  async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE TABLE shared.tenants (
        id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        ad             VARCHAR(120) NOT NULL,
        slug           VARCHAR(60)  NOT NULL,
        durum          VARCHAR(20)  NOT NULL DEFAULT 'PROVISIONING',
        keycloak_realm VARCHAR(100),
        tema_config    JSONB,
        created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
        updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
      )
    `);
    await qr.query(`CREATE UNIQUE INDEX ux_tenants_slug ON shared.tenants (slug)`);

    await qr.query(`
      CREATE TABLE shared.users (
        id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        keycloak_sub VARCHAR(100) NOT NULL,
        email        VARCHAR(160) NOT NULL,
        ad           VARCHAR(100) NOT NULL,
        soyad        VARCHAR(100) NOT NULL,
        rol          VARCHAR(20)  NOT NULL,
        tenant_id    UUID,
        created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
        updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
      )
    `);
    await qr.query(`CREATE UNIQUE INDEX ux_users_keycloak_sub ON shared.users (keycloak_sub)`);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP TABLE IF EXISTS shared.users`);
    await qr.query(`DROP TABLE IF EXISTS shared.tenants`);
  }
}

/** 0002 — audit_log (append-only) + UPDATE/DELETE engelleyen trigger. */
class AuditLog1740000002000 implements MigrationInterface {
  name = 'AuditLog1740000002000';

  async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE TABLE shared.audit_log (
        id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id   UUID,
        actor_id    VARCHAR(100),
        action      VARCHAR(100) NOT NULL,
        entity_type VARCHAR(100),
        entity_id   VARCHAR(100),
        payload     JSONB        NOT NULL DEFAULT '{}'::jsonb,
        prev_hash   VARCHAR(64),
        hash        VARCHAR(64)  NOT NULL,
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
      )
    `);
    await qr.query(`CREATE INDEX ix_audit_log_tenant_created ON shared.audit_log (tenant_id, created_at)`);

    // Append-only: UPDATE/DELETE'i veritabanı seviyesinde engelle.
    await qr.query(`
      CREATE OR REPLACE FUNCTION shared.prevent_audit_modification() RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'audit_log append-only: % operation forbidden', TG_OP;
      END;
      $$ LANGUAGE plpgsql
    `);
    await qr.query(
      `CREATE TRIGGER audit_log_no_update BEFORE UPDATE ON shared.audit_log ` +
        `FOR EACH ROW EXECUTE FUNCTION shared.prevent_audit_modification()`,
    );
    await qr.query(
      `CREATE TRIGGER audit_log_no_delete BEFORE DELETE ON shared.audit_log ` +
        `FOR EACH ROW EXECUTE FUNCTION shared.prevent_audit_modification()`,
    );
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP TRIGGER IF EXISTS audit_log_no_delete ON shared.audit_log`);
    await qr.query(`DROP TRIGGER IF EXISTS audit_log_no_update ON shared.audit_log`);
    await qr.query(`DROP FUNCTION IF EXISTS shared.prevent_audit_modification()`);
    await qr.query(`DROP TABLE IF EXISTS shared.audit_log`);
  }
}

/**
 * 0003 — audit_log.tenant_id UUID → varchar: servisler slug (tenant adı) geçer,
 * uuid bekleyen kolon INSERT'leri sessizce fail ediyordu. Slug her yerde tutarlı.
 */
class AuditTenantIdVarchar1740000003000 implements MigrationInterface {
  name = 'AuditTenantIdVarchar1740000003000';

  async up(qr: QueryRunner): Promise<void> {
    await qr.query(`ALTER TABLE shared.audit_log ALTER COLUMN tenant_id TYPE varchar(100) USING tenant_id::text`);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`ALTER TABLE shared.audit_log ALTER COLUMN tenant_id TYPE uuid USING NULL`);
  }
}

/**
 * 0004 — kullanıcı telefon numarası. SMS bildirimleri (ihale hatırlatma) için;
 * Hesabım sayfasından kullanıcının kendisi girer (Keycloak'ta/JWT'de telefon yok).
 */
class AddUserTelefon1740000004000 implements MigrationInterface {
  name = 'AddUserTelefon1740000004000';

  async up(qr: QueryRunner): Promise<void> {
    await qr.query(`ALTER TABLE shared.users ADD COLUMN IF NOT EXISTS telefon VARCHAR(20)`);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`ALTER TABLE shared.users DROP COLUMN IF EXISTS telefon`);
  }
}

/**
 * 0005 — destek talebi (Muhasebe/Teknik/Diğer) + süper admin bildirimi. Tenant
 * personeli talep açar, süper admin TÜM belediyelerin taleplerini tek yerde
 * görür — bu yüzden tenant şeması değil, `shared` (Harun/PO, 2026-09-26).
 */
class CreateDestekTalebi1740000005000 implements MigrationInterface {
  name = 'CreateDestekTalebi1740000005000';

  async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE TABLE shared.destek_talebi (
        id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_slug       VARCHAR(60)  NOT NULL,
        tenant_ad         VARCHAR(120),
        acan_kullanici_id VARCHAR(100) NOT NULL,
        konu              VARCHAR(20)  NOT NULL,
        baslik            VARCHAR(200) NOT NULL,
        mesaj             TEXT         NOT NULL,
        durum             VARCHAR(20)  NOT NULL DEFAULT 'ACIK',
        cevap             TEXT,
        cevaplayan_id     VARCHAR(100),
        cevap_tarihi      TIMESTAMPTZ,
        created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
        updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
      )
    `);
    await qr.query(`CREATE INDEX ix_destek_talebi_tenant_slug ON shared.destek_talebi (tenant_slug)`);
    await qr.query(`CREATE INDEX ix_destek_talebi_durum ON shared.destek_talebi (durum, created_at DESC)`);

    await qr.query(`
      CREATE TABLE shared.superadmin_bildirim (
        id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        tip        VARCHAR(40)  NOT NULL,
        baslik     VARCHAR(200) NOT NULL,
        mesaj      TEXT,
        link       VARCHAR(300),
        okundu     BOOLEAN      NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
      )
    `);
    await qr.query(`CREATE INDEX ix_superadmin_bildirim_okundu ON shared.superadmin_bildirim (okundu, created_at DESC)`);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP TABLE IF EXISTS shared.superadmin_bildirim`);
    await qr.query(`DROP TABLE IF EXISTS shared.destek_talebi`);
  }
}

/** shared DataSource için migration listesi. */
export const sharedMigrations = [
  InitShared1740000001000,
  AuditLog1740000002000,
  AuditTenantIdVarchar1740000003000,
  AddUserTelefon1740000004000,
  CreateDestekTalebi1740000005000,
];

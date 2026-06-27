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

/** 0002 — duyuru (demo tenant-scoped kaynak). İzolasyon testi için. */
class CreateDuyuru1740000003000 extends TenantMigration {
  name = 'CreateDuyuru1740000003000';

  protected async runUp(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE TABLE IF NOT EXISTS duyuru (
        id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        baslik     VARCHAR(200) NOT NULL,
        icerik     TEXT,
        aktif      BOOLEAN      NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ  NOT NULL DEFAULT now()
      )
    `);
  }

  protected async runDown(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP TABLE IF EXISTS duyuru`);
  }
}

/** 0003 — ilan_kurallari (parametrik kural motoru, İP6). */
class CreateIlanKurallari1740000004000 extends TenantMigration {
  name = 'CreateIlanKurallari1740000004000';

  protected async runUp(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE TABLE IF NOT EXISTS ilan_kurallari (
        ihale_tipi  VARCHAR(30) PRIMARY KEY,
        kurallar    JSONB       NOT NULL,
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
  }

  protected async runDown(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP TABLE IF EXISTS ilan_kurallari`);
  }
}

/** 0004 — varlik (polimorfik belediye varlığı: taşınır/taşınmaz/işletme/reklam). */
class CreateVarlik1740000005000 extends TenantMigration {
  name = 'CreateVarlik1740000005000';

  protected async runUp(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE TABLE IF NOT EXISTS varlik (
        id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        tip        VARCHAR(20)  NOT NULL,
        ad         VARCHAR(200) NOT NULL,
        aciklama   TEXT,
        detay      JSONB        NOT NULL DEFAULT '{}'::jsonb,
        durum      VARCHAR(20)  NOT NULL DEFAULT 'AKTIF',
        created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ  NOT NULL DEFAULT now()
      )
    `);
    await qr.query(`CREATE INDEX ix_varlik_tip ON varlik (tip)`);
  }

  protected async runDown(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP TABLE IF EXISTS varlik`);
  }
}

/** 0005 — ilan (ihale ilanı + durum makinesi + kural snapshot). */
class CreateIlan1740000006000 extends TenantMigration {
  name = 'CreateIlan1740000006000';

  protected async runUp(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE TABLE IF NOT EXISTS ilan (
        id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        baslik          VARCHAR(300)  NOT NULL,
        aciklama        TEXT,
        varlik_id       UUID          NOT NULL REFERENCES varlik(id),
        ihale_tipi      VARCHAR(20)   NOT NULL,
        durum           VARCHAR(20)   NOT NULL DEFAULT 'TASLAK',
        baslangic_fiyati NUMERIC(18,2) NOT NULL,
        baslangic_tarihi TIMESTAMPTZ,
        bitis_tarihi     TIMESTAMPTZ,
        kurallar        JSONB         NOT NULL DEFAULT '{}'::jsonb,
        created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
        updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
      )
    `);
    await qr.query(`CREATE INDEX ix_ilan_durum ON ilan (durum)`);
  }

  protected async runDown(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP TABLE IF EXISTS ilan`);
  }
}

/** 0006 — evrak (şartname/ek, MinIO key + imza durumu placeholder). */
class CreateEvrak1740000007000 extends TenantMigration {
  name = 'CreateEvrak1740000007000';

  protected async runUp(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE TABLE IF NOT EXISTS evrak (
        id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        ilan_id     UUID         NOT NULL REFERENCES ilan(id),
        dosya_adi   VARCHAR(255) NOT NULL,
        minio_key   VARCHAR(500) NOT NULL,
        content_type VARCHAR(100),
        boyut       BIGINT       NOT NULL DEFAULT 0,
        imza_durumu VARCHAR(20)  NOT NULL DEFAULT 'IMZASIZ',
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
      )
    `);
    await qr.query(`CREATE INDEX ix_evrak_ilan ON evrak (ilan_id)`);
  }

  protected async runDown(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP TABLE IF EXISTS evrak`);
  }
}

/** 0007 — basvuru (ilan'a katılım + KVKK onay + gereken teminat). */
class CreateBasvuru1740000008000 extends TenantMigration {
  name = 'CreateBasvuru1740000008000';

  protected async runUp(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE TABLE IF NOT EXISTS basvuru (
        id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        ilan_id         UUID         NOT NULL REFERENCES ilan(id),
        kullanici_id    VARCHAR(100) NOT NULL,
        durum           VARCHAR(20)  NOT NULL DEFAULT 'BASLADI',
        kvkk_onay       BOOLEAN      NOT NULL DEFAULT false,
        acik_riza       BOOLEAN      NOT NULL DEFAULT false,
        gereken_teminat NUMERIC(18,2),
        created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
        updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
      )
    `);
    await qr.query(`CREATE UNIQUE INDEX ux_basvuru_ilan_kullanici ON basvuru (ilan_id, kullanici_id)`);
  }

  protected async runDown(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP TABLE IF EXISTS basvuru`);
  }
}

/** 0008 — teminat (e-dekont + bloke/iade simülasyon). */
class CreateTeminat1740000009000 extends TenantMigration {
  name = 'CreateTeminat1740000009000';

  protected async runUp(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE TABLE IF NOT EXISTS teminat (
        id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        basvuru_id       UUID         NOT NULL REFERENCES basvuru(id),
        tutar            NUMERIC(18,2) NOT NULL,
        durum            VARCHAR(20)  NOT NULL DEFAULT 'BEKLEMEDE',
        dekont_minio_key VARCHAR(500),
        dekont_dosya_adi VARCHAR(255),
        onaylayan        VARCHAR(100),
        onay_tarihi      TIMESTAMPTZ,
        iade_tarihi      TIMESTAMPTZ,
        created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
        updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
      )
    `);
  }

  protected async runDown(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP TABLE IF EXISTS teminat`);
  }
}

/** 0009 — teklif (açık artırma teklifi, server-authoritative). */
class CreateTeklif1740000010000 extends TenantMigration {
  name = 'CreateTeklif1740000010000';

  protected async runUp(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE TABLE IF NOT EXISTS teklif (
        id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        ilan_id      UUID          NOT NULL REFERENCES ilan(id),
        kullanici_id VARCHAR(100)  NOT NULL,
        tutar        NUMERIC(18,2) NOT NULL,
        kabul_edildi BOOLEAN       NOT NULL DEFAULT false,
        created_at   TIMESTAMPTZ   NOT NULL DEFAULT now()
      )
    `);
    await qr.query(`CREATE INDEX ix_teklif_ilan ON teklif (ilan_id)`);
  }

  protected async runDown(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP TABLE IF EXISTS teklif`);
  }
}

/**
 * 0010 — ilan'a kazanan kolonları (sonuçlandırma persist).
 * sonuclandir en yüksek teklif sahibini + tutarı yazar; rapor geliri buradan okur.
 */
class AddIlanKazanan1740000011000 extends TenantMigration {
  name = 'AddIlanKazanan1740000011000';

  protected async runUp(qr: QueryRunner): Promise<void> {
    await qr.query(`ALTER TABLE ilan ADD COLUMN IF NOT EXISTS kazanan_kullanici_id VARCHAR(100)`);
    await qr.query(`ALTER TABLE ilan ADD COLUMN IF NOT EXISTS kazanan_tutar NUMERIC(18,2)`);
  }

  protected async runDown(qr: QueryRunner): Promise<void> {
    await qr.query(`ALTER TABLE ilan DROP COLUMN IF EXISTS kazanan_tutar`);
    await qr.query(`ALTER TABLE ilan DROP COLUMN IF EXISTS kazanan_kullanici_id`);
  }
}

/**
 * 0011 — ilan_favoriler (vatandaş ilan favorileme). Kullanıcı+ilan unique.
 */
class CreateIlanFavoriler1740000012000 extends TenantMigration {
  name = 'CreateIlanFavoriler1740000012000';

  protected async runUp(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE TABLE IF NOT EXISTS ilan_favoriler (
        id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        kullanici_id VARCHAR(100) NOT NULL,
        ilan_id     UUID         NOT NULL REFERENCES ilan(id),
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT ux_favoriler_kullanici_ilan UNIQUE (kullanici_id, ilan_id)
      )
    `);
  }

  protected async runDown(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP TABLE IF EXISTS ilan_favoriler`);
  }
}

/**
 * 0012 — ilan görselleri (MinIO) + ilan konum kolonları (lat/lng/il/ilçe/mahalle).
 */
class IlanGorselKonum1740000013000 extends TenantMigration {
  name = 'IlanGorselKonum1740000013000';

  protected async runUp(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE TABLE IF NOT EXISTS ilan_gorseller (
        id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        ilan_id      UUID          NOT NULL REFERENCES ilan(id) ON DELETE CASCADE,
        minio_key    VARCHAR(500)  NOT NULL,
        dosya_adi    VARCHAR(255)  NOT NULL,
        content_type VARCHAR(100),
        boyut        BIGINT        NOT NULL DEFAULT 0,
        sira         INTEGER       NOT NULL DEFAULT 0,
        created_at   TIMESTAMPTZ   NOT NULL DEFAULT now()
      )
    `);
    await qr.query(`CREATE INDEX ix_ilan_gorseller_ilan ON ilan_gorseller (ilan_id)`);
    await qr.query(`ALTER TABLE ilan ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION`);
    await qr.query(`ALTER TABLE ilan ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION`);
    await qr.query(`ALTER TABLE ilan ADD COLUMN IF NOT EXISTS il VARCHAR(100)`);
    await qr.query(`ALTER TABLE ilan ADD COLUMN IF NOT EXISTS ilce VARCHAR(100)`);
    await qr.query(`ALTER TABLE ilan ADD COLUMN IF NOT EXISTS mahalle VARCHAR(100)`);
  }

  protected async runDown(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP TABLE IF EXISTS ilan_gorseller`);
    await qr.query(`ALTER TABLE ilan DROP COLUMN IF EXISTS mahalle`);
    await qr.query(`ALTER TABLE ilan DROP COLUMN IF EXISTS ilce`);
    await qr.query(`ALTER TABLE ilan DROP COLUMN IF EXISTS il`);
    await qr.query(`ALTER TABLE ilan DROP COLUMN IF EXISTS lng`);
    await qr.query(`ALTER TABLE ilan DROP COLUMN IF EXISTS lat`);
  }
}

/**
 * 0014 — 2886 encümen karar kaydı (ilan'a karar no/tarih).
 */
class IlanEncumenKarar1740000014000 extends TenantMigration {
  name = 'IlanEncumenKarar1740000014000';

  protected async runUp(qr: QueryRunner): Promise<void> {
    await qr.query(`ALTER TABLE ilan ADD COLUMN IF NOT EXISTS encumen_karar_no VARCHAR(100)`);
    await qr.query(`ALTER TABLE ilan ADD COLUMN IF NOT EXISTS encumen_karar_tarihi TIMESTAMPTZ`);
  }

  protected async runDown(qr: QueryRunner): Promise<void> {
    await qr.query(`ALTER TABLE ilan DROP COLUMN IF EXISTS encumen_karar_tarihi`);
    await qr.query(`ALTER TABLE ilan DROP COLUMN IF EXISTS encumen_karar_no`);
  }
}

/** Tüm tenant schema'larında koşacak migration listesi. */
export const tenantMigrations = [
  InitTenant1740000000000,
  CreateDuyuru1740000003000,
  CreateIlanKurallari1740000004000,
  CreateVarlik1740000005000,
  CreateIlan1740000006000,
  CreateEvrak1740000007000,
  CreateBasvuru1740000008000,
  CreateTeminat1740000009000,
  CreateTeklif1740000010000,
  AddIlanKazanan1740000011000,
  CreateIlanFavoriler1740000012000,
  IlanGorselKonum1740000013000,
  IlanEncumenKarar1740000014000,
];

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

/**
 * 0015 — ilan verme akışı sağlamlaştırma: şartname bedeli + katılım şartları
 * (ilan) + evrak kategorisi (evrak). Harun (PO) ile konuşulan gerçek süreç.
 */
class IlanVermeSaglamlastirma1740000015000 extends TenantMigration {
  name = 'IlanVermeSaglamlastirma1740000015000';

  protected async runUp(qr: QueryRunner): Promise<void> {
    await qr.query(`ALTER TABLE ilan ADD COLUMN IF NOT EXISTS sartname_ucretli BOOLEAN NOT NULL DEFAULT false`);
    await qr.query(`ALTER TABLE ilan ADD COLUMN IF NOT EXISTS sartname_tutari NUMERIC(18,2)`);
    await qr.query(`ALTER TABLE ilan ADD COLUMN IF NOT EXISTS katilim_sartlari JSONB NOT NULL DEFAULT '[]'::jsonb`);
    await qr.query(`ALTER TABLE evrak ADD COLUMN IF NOT EXISTS tip VARCHAR(30) NOT NULL DEFAULT 'DIGER'`);
  }

  protected async runDown(qr: QueryRunner): Promise<void> {
    await qr.query(`ALTER TABLE evrak DROP COLUMN IF EXISTS tip`);
    await qr.query(`ALTER TABLE ilan DROP COLUMN IF EXISTS katilim_sartlari`);
    await qr.query(`ALTER TABLE ilan DROP COLUMN IF EXISTS sartname_tutari`);
    await qr.query(`ALTER TABLE ilan DROP COLUMN IF EXISTS sartname_ucretli`);
  }
}

/**
 * 0016 — soft delete: `varlik` ve `ilan` için hard DELETE yasağı (CLAUDE.md
 * kırmızı çizgisi). `deleted_at` dolu satırlar sorgulardan filtrelenir.
 */
class SoftDeleteVarlikIlan1740000016000 extends TenantMigration {
  name = 'SoftDeleteVarlikIlan1740000016000';

  protected async runUp(qr: QueryRunner): Promise<void> {
    await qr.query(`ALTER TABLE varlik ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`);
    await qr.query(`ALTER TABLE ilan ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`);
  }

  protected async runDown(qr: QueryRunner): Promise<void> {
    await qr.query(`ALTER TABLE ilan DROP COLUMN IF EXISTS deleted_at`);
    await qr.query(`ALTER TABLE varlik DROP COLUMN IF EXISTS deleted_at`);
  }
}

/**
 * 0017 — teklif satırında katılımcı adı (yalnızca açık artırmada gösterilir,
 * bkz. TeklifService.list). Kısaltılmış format ("Ad S.") — controller'da üretilir.
 */
class TeklifKullaniciAd1740000017000 extends TenantMigration {
  name = 'TeklifKullaniciAd1740000017000';

  protected async runUp(qr: QueryRunner): Promise<void> {
    await qr.query(`ALTER TABLE teklif ADD COLUMN IF NOT EXISTS kullanici_ad VARCHAR(100)`);
  }

  protected async runDown(qr: QueryRunner): Promise<void> {
    await qr.query(`ALTER TABLE teklif DROP COLUMN IF EXISTS kullanici_ad`);
  }
}

/**
 * 0018 — ilan işlem türü (Satış/Kiralama/İşletme Hakkı Devri). `ihale_tipi`den
 * ayrı — o ihale usulünü (2886) tutar, bu ilanın niteliğini tutar. Var olan
 * ilan kayıtları geriye dönük NULL kalır (backfill gerektirmiyor, POC).
 */
class AddIlanIslemTuru1740000018000 extends TenantMigration {
  name = 'AddIlanIslemTuru1740000018000';

  protected async runUp(qr: QueryRunner): Promise<void> {
    await qr.query(`ALTER TABLE ilan ADD COLUMN IF NOT EXISTS islem_turu VARCHAR(20)`);
  }

  protected async runDown(qr: QueryRunner): Promise<void> {
    await qr.query(`ALTER TABLE ilan DROP COLUMN IF EXISTS islem_turu`);
  }
}

/**
 * 0019 — `ilan_kalemi`: bir ilanın artık N varlık içerebilmesi (DECISIONS.md
 * KK-25). Gerçek ihale/teklif birimi buradan sonra bu tablo — `ilan` "duyuru"
 * rolüne iner (başlık/tarih/şartname ortak; fiyat/kazanan/durum kalem bazlı).
 * Mevcut her ilan satırı (hepsi bugüne dek tek `varlik_id` taşıyordu) burada
 * tek bir kaleme backfill edilir — geriye dönük veri kaybı yok.
 */
class CreateIlanKalemi1740000019000 extends TenantMigration {
  name = 'CreateIlanKalemi1740000019000';

  protected async runUp(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE TABLE IF NOT EXISTS ilan_kalemi (
        id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        ilan_id              UUID          NOT NULL REFERENCES ilan(id),
        varlik_id            UUID          NOT NULL REFERENCES varlik(id),
        baslangic_fiyati     NUMERIC(18,2) NOT NULL,
        bitis_tarihi         TIMESTAMPTZ,
        durum                VARCHAR(20)   NOT NULL DEFAULT 'BEKLIYOR',
        kazanan_kullanici_id VARCHAR(100),
        kazanan_tutar        NUMERIC(18,2),
        encumen_karar_no     VARCHAR(100),
        encumen_karar_tarihi TIMESTAMPTZ,
        deleted_at           TIMESTAMPTZ,
        created_at           TIMESTAMPTZ   NOT NULL DEFAULT now(),
        updated_at           TIMESTAMPTZ   NOT NULL DEFAULT now()
      )
    `);
    await qr.query(`CREATE INDEX ix_ilan_kalemi_ilan ON ilan_kalemi (ilan_id)`);
    await qr.query(`CREATE INDEX ix_ilan_kalemi_durum ON ilan_kalemi (durum)`);
    await qr.query(
      `CREATE UNIQUE INDEX ux_ilan_kalemi_ilan_varlik ON ilan_kalemi (ilan_id, varlik_id) WHERE deleted_at IS NULL`,
    );

    // Backfill: bugüne dek her ilan tam olarak bir varlık taşıyordu — o satır tek kaleme taşınır.
    await qr.query(`
      INSERT INTO ilan_kalemi (
        ilan_id, varlik_id, baslangic_fiyati, bitis_tarihi, durum,
        kazanan_kullanici_id, kazanan_tutar, encumen_karar_no, encumen_karar_tarihi,
        deleted_at, created_at, updated_at
      )
      SELECT
        id, varlik_id, baslangic_fiyati, bitis_tarihi,
        CASE durum
          WHEN 'CANLI_ARTIRMA' THEN 'CANLI_ARTIRMA'
          WHEN 'SONUCLANDI' THEN 'SONUCLANDI'
          WHEN 'IPTAL' THEN 'IPTAL'
          ELSE 'BEKLIYOR'
        END,
        kazanan_kullanici_id, kazanan_tutar, encumen_karar_no, encumen_karar_tarihi,
        deleted_at, created_at, updated_at
      FROM ilan
    `);
  }

  protected async runDown(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP TABLE IF EXISTS ilan_kalemi`);
  }
}

/**
 * 0020 — `ilan.varlik_id`/`ilan.baslangic_fiyati` artık NOT NULL değil (KK-25
 * devamı). Yeni ilanlar varlıksız/fiyatsız "boş" TASLAK olarak doğuyor —
 * varlık(lar) ve onların fiyatı `ilan_kalemi` üzerinden ekleniyor. Mevcut
 * satırlar (0019'da backfill edilenler dahil) dokunulmadan kalır.
 */
class IlanTekVarlikAlanlariOpsiyonel1740000020000 extends TenantMigration {
  name = 'IlanTekVarlikAlanlariOpsiyonel1740000020000';

  protected async runUp(qr: QueryRunner): Promise<void> {
    await qr.query(`ALTER TABLE ilan ALTER COLUMN varlik_id DROP NOT NULL`);
    await qr.query(`ALTER TABLE ilan ALTER COLUMN baslangic_fiyati DROP NOT NULL`);
  }

  protected async runDown(qr: QueryRunner): Promise<void> {
    await qr.query(`ALTER TABLE ilan ALTER COLUMN baslangic_fiyati SET NOT NULL`);
    await qr.query(`ALTER TABLE ilan ALTER COLUMN varlik_id SET NOT NULL`);
  }
}

/**
 * 0021 — `basvuru`/`teklif` artık `ilan_kalemi_id` taşıyor (KK-25, Faz 2):
 * gerçek başvuru/teklif birimi ilan değil, ilan içindeki tek bir varlık (kalem).
 * Backfill: bugüne dek her ilan tam 1 kalem taşıdığı için (0019 backfill'i)
 * mevcut satırlar o tek kaleme bağlanır — çoklu-kalemli ilanlarda henüz
 * başvuru/teklif olmadığından belirsizlik yok. `basvuru`'nun tekillik kısıtı
 * `(ilan_id, kullanici_id)`'den `(ilan_kalemi_id, kullanici_id)`'ye taşınır —
 * eskisi aynı ilandaki 2 farklı varlığa başvuruyu yanlışlıkla engellerdi.
 * `ilan_id` kolonları ikisinde de kalıyor (KK-24 emsaliyle denormalize,
 * sorgu kolaylığı) ama artık yalnızca bilgi amaçlı.
 */
class AddIlanKalemiToBasvuruTeklif1740000021000 extends TenantMigration {
  name = 'AddIlanKalemiToBasvuruTeklif1740000021000';

  protected async runUp(qr: QueryRunner): Promise<void> {
    await qr.query(`ALTER TABLE basvuru ADD COLUMN IF NOT EXISTS ilan_kalemi_id UUID REFERENCES ilan_kalemi(id)`);
    await qr.query(`ALTER TABLE teklif ADD COLUMN IF NOT EXISTS ilan_kalemi_id UUID REFERENCES ilan_kalemi(id)`);

    await qr.query(`
      UPDATE basvuru b SET ilan_kalemi_id = k.id
      FROM ilan_kalemi k
      WHERE k.ilan_id = b.ilan_id AND b.ilan_kalemi_id IS NULL
        AND (SELECT COUNT(*) FROM ilan_kalemi k2 WHERE k2.ilan_id = b.ilan_id) = 1
    `);
    await qr.query(`
      UPDATE teklif t SET ilan_kalemi_id = k.id
      FROM ilan_kalemi k
      WHERE k.ilan_id = t.ilan_id AND t.ilan_kalemi_id IS NULL
        AND (SELECT COUNT(*) FROM ilan_kalemi k2 WHERE k2.ilan_id = t.ilan_id) = 1
    `);

    await qr.query(`ALTER TABLE basvuru ALTER COLUMN ilan_kalemi_id SET NOT NULL`);
    await qr.query(`ALTER TABLE teklif ALTER COLUMN ilan_kalemi_id SET NOT NULL`);

    await qr.query(`DROP INDEX IF EXISTS ux_basvuru_ilan_kullanici`);
    await qr.query(
      `CREATE UNIQUE INDEX ux_basvuru_kalem_kullanici ON basvuru (ilan_kalemi_id, kullanici_id)`,
    );
    await qr.query(`CREATE INDEX ix_teklif_ilan_kalemi ON teklif (ilan_kalemi_id)`);
  }

  protected async runDown(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP INDEX IF EXISTS ix_teklif_ilan_kalemi`);
    await qr.query(`DROP INDEX IF EXISTS ux_basvuru_kalem_kullanici`);
    await qr.query(`CREATE UNIQUE INDEX ux_basvuru_ilan_kullanici ON basvuru (ilan_id, kullanici_id)`);
    await qr.query(`ALTER TABLE teklif DROP COLUMN IF EXISTS ilan_kalemi_id`);
    await qr.query(`ALTER TABLE basvuru DROP COLUMN IF EXISTS ilan_kalemi_id`);
  }
}

/**
 * 0022 — `varlik_gorseller`: varlığa özel fotoğraf galerisi (KK-25, Faz 4).
 * `ilan_gorseller` ile birebir aynı desen — bir ilan artık N varlık
 * içerebildiği için ortak ilan galerisi tek bir varlığı temsil edemez.
 */
class CreateVarlikGorseller1740000022000 extends TenantMigration {
  name = 'CreateVarlikGorseller1740000022000';

  protected async runUp(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE TABLE IF NOT EXISTS varlik_gorseller (
        id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        varlik_id    UUID          NOT NULL REFERENCES varlik(id) ON DELETE CASCADE,
        minio_key    VARCHAR(500)  NOT NULL,
        dosya_adi    VARCHAR(255)  NOT NULL,
        content_type VARCHAR(100),
        boyut        BIGINT        NOT NULL DEFAULT 0,
        sira         INTEGER       NOT NULL DEFAULT 0,
        created_at   TIMESTAMPTZ   NOT NULL DEFAULT now()
      )
    `);
    await qr.query(`CREATE INDEX ix_varlik_gorseller_varlik ON varlik_gorseller (varlik_id)`);
  }

  protected async runDown(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP TABLE IF EXISTS varlik_gorseller`);
  }
}

class AddTeminatRedGerekcesi1740000023000 extends TenantMigration {
  name = 'AddTeminatRedGerekcesi1740000023000';

  protected async runUp(qr: QueryRunner): Promise<void> {
    await qr.query(`ALTER TABLE teminat ADD COLUMN IF NOT EXISTS red_gerekcesi VARCHAR(500)`);
  }

  protected async runDown(qr: QueryRunner): Promise<void> {
    await qr.query(`ALTER TABLE teminat DROP COLUMN IF EXISTS red_gerekcesi`);
  }
}

/**
 * 0024 — bildirim (uygulama-içi bildirim). `kullanici_id` belirli bir
 * kullanıcıya özel bildirim, `hedef_rol` rol-bazlı yayın (örn. 'TENANT_OPS' =
 * tenant'ın tüm TENANT_ADMIN/ENCUMEN personeli için paylaşımlı gelen kutusu —
 * Keycloak rolleri yerelde kullanıcı bazlı takip edilmediğinden per-personel
 * okundu-durumu bilinçli olarak kapsam dışı bırakıldı).
 */
class CreateBildirim1740000024000 extends TenantMigration {
  name = 'CreateBildirim1740000024000';

  protected async runUp(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE TABLE IF NOT EXISTS bildirim (
        id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        kullanici_id VARCHAR(100),
        hedef_rol    VARCHAR(30),
        tip          VARCHAR(40)  NOT NULL,
        baslik       VARCHAR(200) NOT NULL,
        mesaj        TEXT,
        link         VARCHAR(300),
        okundu       BOOLEAN      NOT NULL DEFAULT false,
        created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT ck_bildirim_hedef CHECK (kullanici_id IS NOT NULL OR hedef_rol IS NOT NULL)
      )
    `);
    await qr.query(`CREATE INDEX ix_bildirim_kullanici ON bildirim (kullanici_id, okundu, created_at DESC)`);
    await qr.query(`CREATE INDEX ix_bildirim_hedef_rol ON bildirim (hedef_rol, okundu, created_at DESC)`);
  }

  protected async runDown(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP TABLE IF EXISTS bildirim`);
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
  IlanVermeSaglamlastirma1740000015000,
  SoftDeleteVarlikIlan1740000016000,
  TeklifKullaniciAd1740000017000,
  AddIlanIslemTuru1740000018000,
  CreateIlanKalemi1740000019000,
  IlanTekVarlikAlanlariOpsiyonel1740000020000,
  AddIlanKalemiToBasvuruTeklif1740000021000,
  CreateVarlikGorseller1740000022000,
  AddTeminatRedGerekcesi1740000023000,
  CreateBildirim1740000024000,
];

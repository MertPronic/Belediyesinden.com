import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { createDataSource, Tenant } from '@belediyesinden/db';
import { tenantSchema, tenantMigrations } from '@belediyesinden/tenancy';

/**
 * Startup'ta tüm tenant'ların pending migration'larını koşar.
 *
 * Tenant migration'ları normalde `provisionTenant` sırasında koşar (yeni tenant).
 * Mevcut tenant'larda şema evrimi (yeni kolon/tablo) için bu servis, API açılışında
 * tüm AKTIF tenant şemalarında `runMigrations()` çağırır — idempotent, sadece
 * pending olanları uygular. Böylece yeni bir tenant migration commit'lendiğinde
 * restart sonrası tüm tenant'lara otomatik yayılır.
 */
@Injectable()
export class TenantMigrationBootstrap implements OnModuleInit {
  private readonly logger = new Logger('TenantMigrations');

  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async onModuleInit(): Promise<void> {
    let tenants: Tenant[] = [];
    try {
      tenants = await this.ds.getRepository(Tenant).find();
    } catch (e) {
      this.logger.warn('Tenant listesi alınamadı, migration bootstrap atlandı: ' + (e instanceof Error ? e.message : e));
      return;
    }

    let ok = 0;
    for (const t of tenants) {
      const schema = tenantSchema(t.slug);
      const tenantDs = createDataSource({ schema, migrations: tenantMigrations });
      try {
        await tenantDs.initialize();
        const ran = await tenantDs.runMigrations();
        if (ran.length > 0) {
          this.logger.log(`${t.slug}: ${ran.length} migration uygulandı (${ran.map((m) => m.name).join(', ')})`);
        }
        ok++;
      } catch (e) {
        this.logger.error(`${t.slug} migration hatası: ` + (e instanceof Error ? e.message : e));
      } finally {
        await tenantDs.destroy().catch(() => undefined);
      }
    }
    this.logger.log(`${tenants.length} tenant kontrol edildi, ${ok} başarılı`);
  }
}

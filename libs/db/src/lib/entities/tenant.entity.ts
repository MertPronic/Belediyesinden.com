import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

/**
 * Belediye (tenant) merkezi kaydı — `shared` şemasında.
 * Her satır bir belediyeyi temsil eder; `slug` → `tenant_<slug>` schema'sına işaret eder.
 */
@Entity({ schema: 'shared', name: 'tenants' })
@Index('ux_tenants_slug', ['slug'], { unique: true })
export class Tenant extends BaseEntity {
  /** Belediye tam adı (örn. "Talas Belediyesi"). */
  @Column({ type: 'varchar', length: 120 })
  ad!: string;

  /** URL/subdomain anahtarı (örn. "talas" → talas.belediyesinden.com). */
  @Column({ type: 'varchar', length: 60 })
  slug!: string;

  /** Tenant durumu (TenantDurumu enum değerleri — @belediyesinden/shared). */
  @Column({ type: 'varchar', length: 20, default: 'PROVISIONING' })
  durum!: string;

  /** Keycloak realm adı (tek-realm + claim modelinde null kalabilir). */
  @Column({ name: 'keycloak_realm', type: 'varchar', length: 100, nullable: true })
  keycloakRealm!: string | null;

  /** Tenant bazlı tema/içerik konfigürasyonu (logo, renkler vb.). */
  @Column({ name: 'tema_config', type: 'jsonb', nullable: true })
  temaConfig!: Record<string, unknown> | null;
}

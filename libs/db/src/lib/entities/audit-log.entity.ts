import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Değiştirilemez (append-only) denetim kaydı — `shared.audit_log`.
 *
 * Her kayıt bir öncekinin hash'ini (`prevHash`) içerir → hash-chain.
 * UPDATE/DELETE'ler veritabanı trigger'ı ile engellenir (bkz. shared migration 0002).
 * Bu yüzden `updatedAt` yoktur; BaseEntity (güncellenebilir) yerine kendi alanları kullanılır.
 */
@Entity({ schema: 'shared', name: 'audit_log' })
@Index('ix_audit_log_tenant_created', ['tenantId', 'createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** İlgili tenant (merkezi işlem için null). */
  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId!: string | null;

  /** İşlemi yapan aktör (Keycloak sub / sistem). */
  @Column({ name: 'actor_id', type: 'varchar', length: 100, nullable: true })
  actorId!: string | null;

  /** İşlem tipi (örn. `ILAN_CREATE`, `TEKLIF_SUBMIT`, `TENANT_PROVISION`). */
  @Column({ type: 'varchar', length: 100 })
  action!: string;

  @Column({ name: 'entity_type', type: 'varchar', length: 100, nullable: true })
  entityType!: string | null;

  @Column({ name: 'entity_id', type: 'varchar', length: 100, nullable: true })
  entityId!: string | null;

  /** İşlem detayı (önceki durum, yeni durum, bağlam). */
  @Column({ type: 'jsonb', default: {} })
  payload!: Record<string, unknown>;

  /** Önceki audit kaydının hash'i (zincir). İlk kayıt için GENESIS_HASH (libs/audit). */
  @Column({ name: 'prev_hash', type: 'varchar', length: 64, nullable: true })
  prevHash!: string | null;

  /** Bu kaydın hash'i: sha256(prevHash | canonical(payload) | createdAt). */
  @Column({ type: 'varchar', length: 64 })
  hash!: string;

  /** Kayıt zamanı (hash hesabına dahil — kodda açıkça set edilir). */
  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

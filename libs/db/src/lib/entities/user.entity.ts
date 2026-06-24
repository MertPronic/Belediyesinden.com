import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

/**
 * Merkezi kullanıcı kaydı — `shared` şemasında.
 * Keycloak 'sub' claim'i ile eşleşir. tenant_admin/encumen için tenantId dolu olur;
 * vatandaş/yatırımcı merkezi olabileceği için null kalabilir.
 */
@Entity({ schema: 'shared', name: 'users' })
@Index('ux_users_keycloak_sub', ['keycloakSub'], { unique: true })
export class User extends BaseEntity {
  /** Keycloak kullanıcı kimliği (sub claim). */
  @Column({ name: 'keycloak_sub', type: 'varchar', length: 100 })
  keycloakSub!: string;

  @Column({ type: 'varchar', length: 160 })
  email!: string;

  @Column({ type: 'varchar', length: 100 })
  ad!: string;

  @Column({ type: 'varchar', length: 100 })
  soyad!: string;

  /** Kullanıcı rolü (KullaniciRolu enum — @belediyesinden/shared). */
  @Column({ type: 'varchar', length: 20 })
  rol!: string;

  /** Bağlı tenant (belediye personeli için); vatandaş için null. */
  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId!: string | null;
}

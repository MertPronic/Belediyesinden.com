import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * Demo tenant-scoped kaynak — `duyuru` (her tenant kendi şemasında).
 *
 * Şema belirtilmez (`@Entity({ name: 'duyuru' })`); tablo, istek başına kurulan
 * `search_path` (TenancyInterceptor) sayesinde `tenant_<slug>.duyuru`'ya düşer.
 * Bu, schema-per-tenant izolasyonunun somut kanıtıdır.
 */
@Entity({ name: 'duyuru' })
export class Duyuru {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 200 })
  baslik!: string;

  @Column({ type: 'text', nullable: true })
  icerik!: string | null;

  @Column({ type: 'boolean', default: true })
  aktif!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

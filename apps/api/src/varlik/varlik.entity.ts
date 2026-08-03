import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * Polimorfik belediye varlığı — tenant şemasında (`tenant_<slug>.varlik`).
 * `tip` (`VarlikTipi`) + jsonb `detay` (tip'e özel alanlar). Tek entity, tüm tipler.
 * Raw sorguyla erişilir (search_path → tenant_<slug>).
 */
@Entity({ name: 'varlik' })
export class Varlik {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 20 })
  tip!: string;

  @Column({ type: 'varchar', length: 200 })
  ad!: string;

  @Column({ type: 'text', nullable: true })
  aciklama!: string | null;

  @Column({ type: 'jsonb', default: {} })
  detay!: Record<string, unknown>;

  @Column({ type: 'varchar', length: 20, default: 'AKTIF' })
  durum!: string;

  /** Soft delete — dolu ise silinmiş sayılır, sorgulardan filtrelenir. Hard DELETE yasak (CLAUDE.md). */
  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

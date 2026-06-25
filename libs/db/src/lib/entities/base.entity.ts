import { CreateDateColumn, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * Tüm entity'ler için ortak temel alanlar.
 * UUID primary key + oluşturma/güncelleme zaman damgaları.
 */
export abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

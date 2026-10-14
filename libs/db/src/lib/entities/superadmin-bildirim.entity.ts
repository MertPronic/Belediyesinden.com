import { Column, Entity } from 'typeorm';
import { BaseEntity } from './base.entity';

/**
 * Süper admin bildirimi — `shared` şemasında, tenant'lardan bağımsız. Mevcut
 * `bildirim` sistemi tamamen tenant şemasına bağlı (her belediyenin kendi
 * tablosu); SÜPERADMIN hiçbir tenant'a ait olmadığı için (tenantId null) o
 * mekanizmayı kullanamıyor — bu yüzden ayrı, basit bir paralel tablo
 * (Harun/PO, 2026-09-26). Tek süperadmin varsayımıyla `okundu` tek bir
 * boolean — çoklu süperadmin senaryosunda per-kullanıcı okuma gerekirse
 * ayrı bir tabloya taşınabilir.
 */
@Entity({ schema: 'shared', name: 'superadmin_bildirim' })
export class SuperadminBildirim extends BaseEntity {
  /** BildirimTipi enum değeri (@belediyesinden/shared) — örn. YENI_DESTEK_TALEBI. */
  @Column({ type: 'varchar', length: 40 })
  tip!: string;

  @Column({ type: 'varchar', length: 200 })
  baslik!: string;

  @Column({ type: 'text', nullable: true })
  mesaj!: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  link!: string | null;

  @Column({ type: 'boolean', default: false })
  okundu!: boolean;
}

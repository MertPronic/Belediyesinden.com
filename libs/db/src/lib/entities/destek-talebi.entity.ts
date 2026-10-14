import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

/**
 * Destek talebi — belediye personelinin (TenantAdmin/Encümen) platforma açtığı
 * destek/yardım talebi. `shared` şemasında: süper admin TÜM belediyelerin
 * taleplerini tek yerde görmesi gerektiği için tenant şemasında değil burada
 * (Harun/PO, 2026-09-26).
 */
@Entity({ schema: 'shared', name: 'destek_talebi' })
@Index('ix_destek_talebi_tenant_slug', ['tenantSlug'])
export class DestekTalebi extends BaseEntity {
  /** Talebi açan belediyenin slug'ı (uuid FK yerine — bkz. KK-03/audit_log dersi, slug daha az sürtüşmeli). */
  @Column({ name: 'tenant_slug', type: 'varchar', length: 60 })
  tenantSlug!: string;

  /** Belediye adı — süper admin listesinde slug çözmeye gerek kalmasın diye eklenmiş kopya. */
  @Column({ name: 'tenant_ad', type: 'varchar', length: 120, nullable: true })
  tenantAd!: string | null;

  /** Talebi açan personelin Keycloak sub'ı. */
  @Column({ name: 'acan_kullanici_id', type: 'varchar', length: 100 })
  acanKullaniciId!: string;

  /** DestekKonusu enum değeri (MUHASEBE/TEKNIK/DIGER — @belediyesinden/shared). */
  @Column({ type: 'varchar', length: 20 })
  konu!: string;

  @Column({ type: 'varchar', length: 200 })
  baslik!: string;

  @Column({ type: 'text' })
  mesaj!: string;

  /** DestekDurumu enum değeri (ACIK/CEVAPLANDI/KAPALI). */
  @Column({ type: 'varchar', length: 20, default: 'ACIK' })
  durum!: string;

  @Column({ type: 'text', nullable: true })
  cevap!: string | null;

  @Column({ name: 'cevaplayan_id', type: 'varchar', length: 100, nullable: true })
  cevaplayanId!: string | null;

  @Column({ name: 'cevap_tarihi', type: 'timestamptz', nullable: true })
  cevapTarihi!: Date | null;
}

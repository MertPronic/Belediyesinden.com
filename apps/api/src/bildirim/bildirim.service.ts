import { Injectable } from '@nestjs/common';
import type { QueryRunner } from 'typeorm';
import { getCurrentTenant } from '@belediyesinden/tenancy';
import { rawQuery } from '@belediyesinden/db';
import type { BildirimTipi } from '@belediyesinden/shared';
import type { Bildirim } from './bildirim.entity';

/** Rol-bazlı yayın hedefi: tenant'ın tüm TENANT_ADMIN/ENCUMEN personeli için paylaşımlı gelen kutusu. */
export const TENANT_OPS_HEDEF_ROL = 'TENANT_OPS';

export interface BildirimOlusturGirdisi {
  kullaniciId?: string;
  hedefRol?: string;
  tip: BildirimTipi;
  baslik: string;
  mesaj?: string;
  link?: string;
}

/**
 * Uygulama-içi bildirim servisi (tenant-scoped). `olustur` diğer servisler
 * tarafından audit log ile aynı üslupta fire-and-forget çağrılır — bildirim
 * de dokümante edilmiş bir yan-etkidir, iş mantığının kendisi değil.
 */
@Injectable()
export class BildirimService {
  private qr(): QueryRunner {
    const tenant = getCurrentTenant();
    if (!tenant) {
      throw new Error('Tenant bağlamı yok');
    }
    return tenant.queryRunner;
  }

  async olustur(input: BildirimOlusturGirdisi): Promise<void> {
    if (!input.kullaniciId && !input.hedefRol) {
      throw new Error('Bildirim için kullaniciId veya hedefRol gerekli');
    }
    await this.qr().query(
      `INSERT INTO bildirim (kullanici_id, hedef_rol, tip, baslik, mesaj, link)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [input.kullaniciId ?? null, input.hedefRol ?? null, input.tip, input.baslik, input.mesaj ?? null, input.link ?? null],
    );
  }

  /** Kullanıcının kendi bildirimleri + hedeflendiği rol yayınları — okunmamışlar önce. */
  list(kullaniciId: string, hedefGruplar: string[], limit: number, offset: number): Promise<Bildirim[]> {
    return rawQuery<Bildirim>(
      this.qr(),
      `SELECT * FROM bildirim
       WHERE kullanici_id = $1 OR hedef_rol = ANY($2::varchar[])
       ORDER BY okundu ASC, created_at DESC
       LIMIT $3 OFFSET $4`,
      [kullaniciId, hedefGruplar, limit, offset],
    );
  }

  async sayac(kullaniciId: string, hedefGruplar: string[]): Promise<number> {
    const rows = await rawQuery<{ adet: string }>(
      this.qr(),
      `SELECT COUNT(*) AS adet FROM bildirim
       WHERE (kullanici_id = $1 OR hedef_rol = ANY($2::varchar[])) AND okundu = false`,
      [kullaniciId, hedefGruplar],
    );
    return Number(rows[0]?.adet ?? 0);
  }

  async okunduIsaretle(id: string, kullaniciId: string, hedefGruplar: string[]): Promise<void> {
    await this.qr().query(
      `UPDATE bildirim SET okundu = true
       WHERE id = $1 AND (kullanici_id = $2 OR hedef_rol = ANY($3::varchar[]))`,
      [id, kullaniciId, hedefGruplar],
    );
  }

  async hepsiniOkunduIsaretle(kullaniciId: string, hedefGruplar: string[]): Promise<void> {
    await this.qr().query(
      `UPDATE bildirim SET okundu = true
       WHERE (kullanici_id = $1 OR hedef_rol = ANY($2::varchar[])) AND okundu = false`,
      [kullaniciId, hedefGruplar],
    );
  }
}

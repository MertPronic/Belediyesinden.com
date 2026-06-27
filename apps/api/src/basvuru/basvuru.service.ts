import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource, QueryRunner } from 'typeorm';
import { getCurrentTenant } from '@belediyesinden/tenancy';
import { BasvuruDurumu, IhaleTipi, IlanDurumu } from '@belediyesinden/shared';
import { appendAuditLog } from '@belediyesinden/audit';
import { getIlanKurallari } from '@belediyesinden/rule-engine';
import { rawQuery } from '@belediyesinden/db';
import type { Ilan } from '../ilan/ilan.entity';
import type { Basvuru } from './basvuru.entity';

/** Tenant-scoped başvuru servisi: KVKK onayı + gereken teminat hesabı. */
@Injectable()
export class BasvuruService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  private qr(): QueryRunner {
    const tenant = getCurrentTenant();
    if (!tenant) {
      throw new Error('Tenant bağlamı yok');
    }
    return tenant.queryRunner;
  }

  list(ilanId: string): Promise<Basvuru[]> {
    return rawQuery<Basvuru>(this.qr(), 'SELECT * FROM basvuru WHERE ilan_id = $1 ORDER BY created_at DESC', [ilanId]);
  }

  /** Kullanıcının kendi başvuruları (ilan başlığı join'li). */
  async listMy(kullaniciId: string): Promise<
    Array<{ id: string; ilan_id: string; ilan_baslik: string; durum: string; gereken_teminat: string | null; created_at: Date }>
  > {
    return rawQuery(
      this.qr(),
      `SELECT b.id, b.ilan_id, i.baslik AS ilan_baslik, b.durum, b.gereken_teminat, b.created_at
       FROM basvuru b JOIN ilan i ON i.id = b.ilan_id
       WHERE b.kullanici_id = $1 ORDER BY b.created_at DESC`,
      [kullaniciId],
    );
  }

  /**
   * İlan'a başvuru oluştur. KVKK aydınlatma + açık rıza onayı zorunlu.
   * Gereken teminat = ilan başlangıç fiyatı × kural.teminatOrani (ilan tipine göre).
   * Sadece yayındaki ilanlara başvurulabilir.
   */
  async create(
    ilanId: string,
    kullaniciId: string,
    kvkkOnay: boolean,
    acikRiza: boolean,
  ): Promise<Basvuru> {
    if (!kvkkOnay) {
      throw new BadRequestException('KVKK aydınlatma metni onayı zorunludur');
    }
    const ilanRows = await rawQuery<Ilan>(this.qr(), 'SELECT * FROM ilan WHERE id = $1', [ilanId]);
    const ilan = ilanRows[0];
    if (!ilan) {
      throw new NotFoundException('İlan bulunamadı');
    }
    if (ilan.durum !== IlanDurumu.Yayinda) {
      throw new BadRequestException('Yalnızca yayındaki ilanlara başvurulabilir');
    }

    const kurallar = await getIlanKurallari(this.qr(), ilan.ihale_tipi as IhaleTipi);
    const gereken = Number(ilan.baslangic_fiyati) * kurallar.teminatOrani;

    try {
      const rows = await rawQuery<Basvuru>(
        this.qr(),
        `INSERT INTO basvuru (ilan_id, kullanici_id, durum, kvkk_onay, acik_riza, gereken_teminat)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [ilanId, kullaniciId, BasvuruDurumu.TeminatBekleniyor, kvkkOnay, acikRiza, gereken],
      );
      appendAuditLog(this.ds, {
        tenantId: getCurrentTenant()?.slug ?? null,
        actorId: kullaniciId,
        action: 'BASVURU_OLUSTUR',
        entityType: 'basvuru',
        entityId: rows[0].id,
        payload: { ilan_id: ilanId, kvkk_onay: kvkkOnay, acik_riza: acikRiza, gereken_teminat: gereken },
      }).catch(() => {});
      return rows[0];
    } catch {
      throw new BadRequestException('Bu ilana zaten başvurdunuz');
    }
  }

  /** Başvuruyu geri çek (vatandaş). Sadece onaylanMAMış + sahibi. */
  async withdraw(basvuruId: string, kullaniciId: string): Promise<Basvuru> {
    const rows = await rawQuery<Basvuru>(this.qr(), 'SELECT * FROM basvuru WHERE id = $1', [basvuruId]);
    const b = rows[0];
    if (!b) throw new NotFoundException('Başvuru bulunamadı');
    if (b.kullanici_id !== kullaniciId) {
      throw new BadRequestException('Bu başvuruyu geri çekme yetkiniz yok');
    }
    if (b.durum === BasvuruDurumu.Onaylandi) {
      throw new BadRequestException('Onaylanmış başvuru geri çekilemez');
    }
    const updated = await rawQuery<Basvuru>(
      this.qr(),
      'UPDATE basvuru SET durum = $1 WHERE id = $2 RETURNING *',
      [BasvuruDurumu.IptalEdildi, basvuruId],
    );
    appendAuditLog(this.ds, {
      tenantId: getCurrentTenant()?.slug ?? null,
      actorId: kullaniciId,
      action: 'BASVURU_GERI_CEK',
      entityType: 'basvuru',
      entityId: basvuruId,
      payload: { ilan_id: b.ilan_id, onceki_durum: b.durum },
    }).catch(() => {});
    return updated[0];
  }
}

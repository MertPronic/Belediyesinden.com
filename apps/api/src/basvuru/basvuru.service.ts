import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { QueryRunner } from 'typeorm';
import { getCurrentTenant } from '@belediyesinden/tenancy';
import { BasvuruDurumu, IhaleTipi, IlanDurumu } from '@belediyesinden/shared';
import { getIlanKurallari } from '@belediyesinden/rule-engine';
import { rawQuery } from '@belediyesinden/db';
import type { Ilan } from '../ilan/ilan.entity';
import type { Basvuru } from './basvuru.entity';

/** Tenant-scoped başvuru servisi: KVKK onayı + gereken teminat hesabı. */
@Injectable()
export class BasvuruService {
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
      return rows[0];
    } catch {
      throw new BadRequestException('Bu ilana zaten başvurdunuz');
    }
  }
}

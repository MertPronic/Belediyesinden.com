import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource, type QueryRunner } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { appendAuditLog } from '@belediyesinden/audit';
import { getCurrentTenant } from '@belediyesinden/tenancy';
import { IhaleTipi } from '@belediyesinden/shared';
import {
  getIlanKurallari,
  ilanKurallariGuncellemeGecerliMi,
  updateIlanKurallari,
  type IlanKurallari,
} from '@belediyesinden/rule-engine';

const TUM_IHALE_TIPLERI = Object.values(IhaleTipi);

/** İlan kuralları servisi — ihale tipine göre tenant-özel parametreleri okur/günceller. */
@Injectable()
export class IlanKurallariService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  private qr(): QueryRunner {
    const tenant = getCurrentTenant();
    if (!tenant) {
      throw new Error('Tenant bağlamı yok');
    }
    return tenant.queryRunner;
  }

  async listAll(): Promise<Record<IhaleTipi, IlanKurallari>> {
    const qr = this.qr();
    const sonuc = {} as Record<IhaleTipi, IlanKurallari>;
    for (const tip of TUM_IHALE_TIPLERI) {
      sonuc[tip] = await getIlanKurallari(qr, tip);
    }
    return sonuc;
  }

  async update(tip: IhaleTipi, yeni: Partial<IlanKurallari>, actorId: string): Promise<IlanKurallari> {
    const dogrulama = ilanKurallariGuncellemeGecerliMi(yeni);
    if (!dogrulama.gecerli) {
      throw new BadRequestException(dogrulama.hata ?? 'Geçersiz kural güncellemesi');
    }
    const guncel = await updateIlanKurallari(this.qr(), tip, yeni);

    appendAuditLog(this.ds, {
      tenantId: getCurrentTenant()?.slug ?? null,
      actorId,
      action: 'ILAN_KURALLARI_GUNCELLE',
      entityType: 'ilan_kurallari',
      entityId: tip,
      payload: { yeni },
    }).catch(() => {});

    return guncel;
  }
}

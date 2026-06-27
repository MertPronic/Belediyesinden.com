import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, type QueryRunner } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { appendAuditLog } from '@belediyesinden/audit';
import { getCurrentTenant } from '@belediyesinden/tenancy';
import { IhaleTipi, IlanDurumu } from '@belediyesinden/shared';
import { getIlanKurallari } from '@belediyesinden/rule-engine';
import { rawQuery } from '@belediyesinden/db';
import { OpenSearchService } from '../search/opensearch.service';
import { TeminatIadeService } from '../teminat/teminat-iade.service';
import type { Ilan } from './ilan.entity';

const GECERLI_TIP = new Set<string>(Object.values(IhaleTipi));
const GECERLI_DURUM = new Set<string>(Object.values(IlanDurumu));
const GUN_MS = 86_400_000;

/** Tenant-scoped ilan servisi + durum makinesi. */
@Injectable()
export class IlanService {
  constructor(
    private readonly os: OpenSearchService,
    @InjectDataSource() private readonly ds: DataSource,
    private readonly iadeService: TeminatIadeService,
  ) {}

  private qr(): QueryRunner {
    const tenant = getCurrentTenant();
    if (!tenant) {
      throw new Error('Tenant bağlamı yok');
    }
    return tenant.queryRunner;
  }

  list(): Promise<Ilan[]> {
    return rawQuery<Ilan>(this.qr(), 'SELECT * FROM ilan ORDER BY created_at DESC');
  }

  async get(id: string): Promise<Ilan | null> {
    const rows = await rawQuery<Ilan>(this.qr(), 'SELECT * FROM ilan WHERE id = $1', [id]);
    return rows[0] ?? null;
  }

  async create(data: {
    baslik: string;
    aciklama?: string | null;
    varlikId: string;
    ihaleTipi: string;
    baslangicFiyati: number;
  }): Promise<Ilan> {
    if (!GECERLI_TIP.has(data.ihaleTipi)) {
      throw new BadRequestException('Geçersiz ihale tipi');
    }
    const rows = await rawQuery<Ilan>(
      this.qr(),
      `INSERT INTO ilan (baslik, aciklama, varlik_id, ihale_tipi, durum, baslangic_fiyati)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [data.baslik, data.aciklama ?? null, data.varlikId, data.ihaleTipi, IlanDurumu.Taslak, data.baslangicFiyati],
    );
    return rows[0];
  }

  /**
   * Durum makinesi.
   *  TASLAK → YAYINDA: kural motorundan kuralları çekip snapshot'lar + başlangıç/bitiş tarihleri.
   *  Her durum → IPTAL. CANLI_ARTIRMA / SONUCLANDI: stub (Faz 4).
   */
  async changeDurum(id: string, hedef: string): Promise<Ilan> {
    if (!GECERLI_DURUM.has(hedef)) {
      throw new BadRequestException('Geçersiz durum');
    }
    const ilan = await this.get(id);
    if (!ilan) {
      throw new NotFoundException('İlan bulunamadı');
    }

    if (hedef === IlanDurumu.Yayinda) {
      if (ilan.durum !== IlanDurumu.Taslak) {
        throw new BadRequestException('Yalnızca TASLAK ilanlar yayınlanabilir');
      }
      const kurallar = await getIlanKurallari(this.qr(), ilan.ihale_tipi as IhaleTipi);
      const baslangic = new Date();
      const bitis = new Date(baslangic.getTime() + kurallar.ihaleSuresiGun * GUN_MS);
      const rows = await rawQuery<Ilan>(
        this.qr(),
        'UPDATE ilan SET durum=$1, kurallar=$2, baslangic_tarihi=$3, bitis_tarihi=$4 WHERE id=$5 RETURNING *',
        [IlanDurumu.Yayinda, JSON.stringify(kurallar), baslangic, bitis, id],
      );
      const updated = rows[0];
      const tenant = getCurrentTenant();
      if (tenant && updated) {
        await this.os.indexIlan(tenant.slug, {
          id: updated.id,
          baslik: updated.baslik,
          aciklama: updated.aciklama,
          ihale_tipi: updated.ihale_tipi,
          baslangic_fiyati: updated.baslangic_fiyati,
          durum: updated.durum,
        });
      }
      // Audit (hash-chain) — fire-and-forget.
      appendAuditLog(this.ds, {
        tenantId: tenant?.slug ?? null,
        actorId: 'system:ilan',
        action: 'ILAN_YAYINLA',
        entityType: 'ilan',
        entityId: id,
        payload: { ihale_tipi: ilan.ihale_tipi },
      }).catch(() => {});
      return updated;
    }

    const rows = await rawQuery<Ilan>(
      this.qr(),
      'UPDATE ilan SET durum=$1 WHERE id=$2 RETURNING *',
      [hedef, id],
    );
    return rows[0];
  }

  /**
   * İhaleyi sonuçlandır: en yüksek teklifi bul → ilan SONUCLANDI.
   * @Roller(TenantAdmin, Encumen) tarafından çağrılır.
   */
  async sonuclandir(id: string): Promise<{
    winnerId: string | null;
    kazananTutar: number | null;
    ilan: Ilan;
  }> {
    const ilan = await this.get(id);
    if (!ilan) {
      throw new NotFoundException('İlan bulunamadı');
    }
    if (ilan.durum !== IlanDurumu.Yayinda) {
      throw new BadRequestException('Sadece yayındaki ilanlar sonuçlandırılabilir');
    }
    const maxRows = await rawQuery<{ kullanici_id: string; tutar: string }>(
      this.qr(),
      'SELECT kullanici_id, tutar FROM teklif WHERE ilan_id = $1 AND kabul_edildi = true ORDER BY tutar DESC LIMIT 1',
      [id],
    );
    const winner = maxRows[0];
    const rows = await rawQuery<Ilan>(
      this.qr(),
      'UPDATE ilan SET durum = $1, kazanan_kullanici_id = $2, kazanan_tutar = $3 WHERE id = $4 RETURNING *',
      [IlanDurumu.Sonuclandi, winner?.kullanici_id ?? null, winner?.tutar ?? null, id],
    );
    // BullMQ gecikmeli iade planla (fire-and-forget).
    this.iadeService.planlaIadeForIlan(id).catch(() => {});

    appendAuditLog(this.ds, {
      tenantId: getCurrentTenant()?.slug ?? null,
      actorId: 'system:ilan',
      action: 'ILAN_SONUCLANDIR',
      entityType: 'ilan',
      entityId: id,
      payload: {
        kazanan_kullanici_id: winner?.kullanici_id ?? null,
        kazanan_tutar: winner ? Number(winner.tutar) : null,
      },
    }).catch(() => {});

    return {
      winnerId: winner?.kullanici_id ?? null,
      kazananTutar: winner ? Number(winner.tutar) : null,
      ilan: rows[0],
    };
  }
}

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { QueryRunner } from 'typeorm';
import { getCurrentTenant } from '@belediyesinden/tenancy';
import { IhaleTipi, IlanDurumu } from '@belediyesinden/shared';
import { getIlanKurallari } from '@belediyesinden/rule-engine';
import type { Ilan } from './ilan.entity';

const GECERLI_TIP = new Set<string>(Object.values(IhaleTipi));
const GECERLI_DURUM = new Set<string>(Object.values(IlanDurumu));
const GUN_MS = 86_400_000;

/** Tenant-scoped ilan servisi + durum makinesi. */
@Injectable()
export class IlanService {
  private qr(): QueryRunner {
    const tenant = getCurrentTenant();
    if (!tenant) {
      throw new Error('Tenant bağlamı yok');
    }
    return tenant.queryRunner;
  }

  list(): Promise<Ilan[]> {
    return this.qr().query('SELECT * FROM ilan ORDER BY created_at DESC');
  }

  async get(id: string): Promise<Ilan | null> {
    const rows: Ilan[] = await this.qr().query('SELECT * FROM ilan WHERE id = $1', [id]);
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
    const rows: Ilan[] = await this.qr().query(
      `INSERT INTO ilan (baslik, aciklama, varlik_id, ihale_tipi, durum, baslangic_fiyati)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [data.baslik, data.aciklama ?? null, data.varlikId, data.ihaleTipi, IlanDurumu.Taslak, data.baslangicFiyati],
    );
    return rows[0];
  }

  /**
   * Durum makinesi.
   *  TASLAK → YAYINDA: kural motorundan kuralları çekip snapshot'lar + başlangıç/bitiş tarihlerini kurar.
   *  Her durum → IPTAL: izinli. CANLI_ARTIRMA / SONUCLANDI: stub (Faz 4 doldurur).
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
      const rows: Ilan[] = await this.qr().query(
        'UPDATE ilan SET durum=$1, kurallar=$2, baslangic_tarihi=$3, bitis_tarihi=$4 WHERE id=$5 RETURNING *',
        [IlanDurumu.Yayinda, JSON.stringify(kurallar), baslangic, bitis, id],
      );
      return rows[0];
    }

    const rows: Ilan[] = await this.qr().query(
      'UPDATE ilan SET durum=$1 WHERE id=$2 RETURNING *',
      [hedef, id],
    );
    return rows[0];
  }
}

import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Queue, Worker } from 'bullmq';
import { rawQuery } from '@belediyesinden/db';
import { getCurrentTenant } from '@belediyesinden/tenancy';
import type { Teminat } from './teminat.entity';

const IADE_GECIKME_MS = Number(process.env.TEMINAT_IADE_GECIKME_MS ?? 10_000);

/**
 * BullMQ ile gecikmeli teminat iade servisi.
 * İhale sonuçlandığında tüm BLOKE teminatlar için iade job planlanır.
 * Worker (api içinde) job'u işleyip teminat durumunu IADE_EDILDI'ye çevirir.
 */
@Injectable()
export class TeminatIadeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TeminatIadeService.name);
  private queue!: Queue;
  private worker!: Worker;

  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  onModuleInit(): void {
    const connection = {
      host: process.env['REDIS_HOST'] ?? 'localhost',
      port: Number(process.env['REDIS_PORT'] ?? 6379),
    };
    this.queue = new Queue('teminat-iade', { connection });
    this.worker = new Worker(
      'teminat-iade',
      async (job) => {
        const { teminatId, schema } = job.data as { teminatId: string; schema: string };
        await this.ds.query(
          `UPDATE ${schema}.teminat SET durum = 'IADE_EDILDI', iade_tarihi = now() WHERE id = $1 AND durum = 'BLOKE_EDILDI'`,
          [teminatId],
        );
        this.logger.log(`iade işlendi: teminat=${teminatId} (schema=${schema})`);
      },
      { connection },
    );
    this.logger.log('BullMQ teminat-iade queue+worker hazır');
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }

  /** Bir ilan'ın tüm BLOKE teminatları için gecikmeli iade planla. */
  async planlaIadeForIlan(ilanId: string): Promise<number> {
    const tenant = getCurrentTenant();
    if (!tenant) {
      return 0;
    }
    const schema = `tenant_${tenant.slug}`;
    const rows = await rawQuery<{ id: string }>(
      tenant.queryRunner,
      `SELECT t.id FROM teminat t
       JOIN basvuru b ON t.basvuru_id = b.id
       WHERE b.ilan_id = $1 AND t.durum = 'BLOKE_EDILDI'`,
      [ilanId],
    );
    for (const row of rows) {
      await this.queue.add(
        'iade',
        { teminatId: row.id, schema },
        { delay: IADE_GECIKME_MS, removeOnComplete: true },
      );
    }
    this.logger.log(`${rows.length} teminat iade için planlandı (ilan=${ilanId}, gecikme=${IADE_GECIKME_MS}ms)`);
    return rows.length;
  }
}

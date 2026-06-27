import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { sharedDataSourceOptions } from '@belediyesinden/db';
import { TeminatModule } from '../../../api/src/teminat/teminat.module';

/**
 * Worker modülü — bağımsız çalışan BullMQ işçi (teminat iade).
 * API'den ayrı deploy edilebilir. TeminatIadeService constructor'da
 * BullMQ queue + worker başlatır (Redis bağlantısı env'den).
 *
 * NOT: REST controller'lar import edilir ama createApplicationContext
 * (HTTP listener yok) ile çalıştırıldığı için aktif HTTP endpoint yok.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', 'apps/api/.env'] }),
    TypeOrmModule.forRoot({ ...sharedDataSourceOptions, migrationsRun: false }),
    TeminatModule,
  ],
})
export class WorkerModule {}

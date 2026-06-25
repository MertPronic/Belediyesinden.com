import { Module } from '@nestjs/common';
import { EvrakController } from './evrak.controller';
import { EvrakService } from './evrak.service';
import { MinioService } from './minio.service';

/** Tenant-scoped evrak modülü (MinIO + DB). */
@Module({
  controllers: [EvrakController],
  providers: [EvrakService, MinioService],
})
export class EvrakModule {}

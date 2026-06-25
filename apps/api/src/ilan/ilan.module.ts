import { Module } from '@nestjs/common';
import { IlanController } from './ilan.controller';
import { IlanService } from './ilan.service';

/** Tenant-scoped ilan modülü (CRUD + durum makinesi). */
@Module({
  controllers: [IlanController],
  providers: [IlanService],
})
export class IlanModule {}

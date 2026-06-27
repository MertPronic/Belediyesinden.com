import { Module } from '@nestjs/common';
import { RaporController } from './rapor.controller';
import { RaporService } from './rapor.service';

/** Tenant-scoped raporlama modülü (dashboard aggregasyonları). */
@Module({
  controllers: [RaporController],
  providers: [RaporService],
})
export class RaporModule {}

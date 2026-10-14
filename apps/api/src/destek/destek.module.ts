import { Module } from '@nestjs/common';
import { BildirimModule } from '../bildirim/bildirim.module';
import { DestekController } from './destek.controller';
import { DestekService } from './destek.service';

/** Destek talebi modülü (shared şema) + süper admin bildirimi. */
@Module({
  imports: [BildirimModule],
  controllers: [DestekController],
  providers: [DestekService],
})
export class DestekModule {}

import { Module } from '@nestjs/common';
import { BildirimController } from './bildirim.controller';
import { BildirimService } from './bildirim.service';

/** Tenant-scoped uygulama-içi bildirim modülü. Diğer modüller `BildirimService`'i import edip kullanır. */
@Module({
  controllers: [BildirimController],
  providers: [BildirimService],
  exports: [BildirimService],
})
export class BildirimModule {}

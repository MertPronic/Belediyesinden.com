import { Module } from '@nestjs/common';
import { BildirimModule } from '../bildirim/bildirim.module';
import { BasvuruController } from './basvuru.controller';
import { BasvuruService } from './basvuru.service';

/** Tenant-scoped başvuru modülü (KVKK + teminat hesabı). */
@Module({
  imports: [BildirimModule],
  controllers: [BasvuruController],
  providers: [BasvuruService],
})
export class BasvuruModule {}

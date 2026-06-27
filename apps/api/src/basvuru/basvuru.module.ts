import { Module } from '@nestjs/common';
import { BasvuruController } from './basvuru.controller';
import { BasvuruService } from './basvuru.service';

/** Tenant-scoped başvuru modülü (KVKK + teminat hesabı). */
@Module({
  controllers: [BasvuruController],
  providers: [BasvuruService],
})
export class BasvuruModule {}

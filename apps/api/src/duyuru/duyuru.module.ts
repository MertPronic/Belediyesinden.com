import { Module } from '@nestjs/common';
import { DuyuruController } from './duyuru.controller';
import { DuyuruService } from './duyuru.service';

/**
 * Demo duyuru modülü. Repository enjeksiyonu yok — DuyuruService, istek başına
 * tenant QueryRunner'ından repository alır (tenant izolasyonu için).
 */
@Module({
  controllers: [DuyuruController],
  providers: [DuyuruService],
})
export class DuyuruModule {}

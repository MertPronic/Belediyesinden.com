import { Module } from '@nestjs/common';
import { TeklifController } from './teklif.controller';
import { TeklifService } from './teklif.service';

/** Teklif modülü (server-authoritative teklif işleme + anti-snipping). */
@Module({
  controllers: [TeklifController],
  providers: [TeklifService],
})
export class TeklifModule {}

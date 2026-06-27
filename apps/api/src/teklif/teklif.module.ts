import { Module } from '@nestjs/common';
import { AuctionGatewayModule } from '../auction/auction-gateway.module';
import { TeklifController } from './teklif.controller';
import { TeklifService } from './teklif.service';

/** Teklif modülü (server-authoritative teklif + anti-snipping + ws broadcast). */
@Module({
  imports: [AuctionGatewayModule],
  controllers: [TeklifController],
  providers: [TeklifService],
})
export class TeklifModule {}

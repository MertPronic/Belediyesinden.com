import { Module } from '@nestjs/common';
import { AuctionGateway } from './auction-gateway';

/** WebSocket gateway modülü (gerçek zamanlı teklif yayını). */
@Module({
  providers: [AuctionGateway],
  exports: [AuctionGateway],
})
export class AuctionGatewayModule {}

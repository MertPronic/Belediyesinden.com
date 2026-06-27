import { Logger } from '@nestjs/common';
import { OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { type Server, WebSocket } from 'ws';

/**
 * Gerçek zamanlı açık artırma WebSocket gateway'i (`/ws`).
 * Teklif olaylarını tüm bağlı istemcilere yayınlar (real-time teklif akışı).
 *
 * İstemci: `new WebSocket('ws://localhost:3000/ws')` → teklif olaylarını dinler.
 */
@WebSocketGateway({ path: '/ws' })
export class AuctionGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(AuctionGateway.name);

  @WebSocketServer()
  server?: Server;

  handleConnection(): void {
    this.logger.log('ws istemci bağlandı');
  }

  handleDisconnect(): void {
    this.logger.log('ws istemci ayrıldı');
  }

  /** Başarılı bir teklif → tüm bağlı istemcilere yayınla. */
  broadcastTeklif(ilanId: string, teklif: { id: string; kullanici_id: string; tutar: string }): void {
    if (!this.server) {
      return;
    }
    const msg = JSON.stringify({ event: 'teklif', ilanId, teklif });
    this.server.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    });
    this.logger.log(`teklif yayınlandı: ilan=${ilanId} tutar=${teklif.tutar} (${this.server.clients.size} istemci)`);
  }
}

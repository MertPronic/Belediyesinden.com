import { Logger, OnModuleInit } from '@nestjs/common';
import { OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import Redis from 'ioredis';
import { type Server, WebSocket } from 'ws';

const CHANNEL = 'teklif';

/**
 * Gerçek zamanlı açık artırma WebSocket gateway'i (`/ws`).
 * Redis Pub/Sub ile çok-instance desteği: teklif Redis'e publish edilir,
 * tüm instance'ların subscriber'ı local ws istemcilerine yayınlar.
 */
@WebSocketGateway({ path: '/ws' })
export class AuctionGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit {
  private readonly logger = new Logger(AuctionGateway.name);
  private pubRedis!: Redis;
  private subRedis!: Redis;

  @WebSocketServer()
  server?: Server;

  onModuleInit(): void {
    const opts = { host: process.env['REDIS_HOST'] ?? 'localhost', port: Number(process.env['REDIS_PORT'] ?? 6379) };
    this.pubRedis = new Redis(opts);
    this.subRedis = new Redis(opts);
    this.subRedis.subscribe(CHANNEL);
    this.subRedis.on('message', (_ch: string, msg: string) => {
      // Redis'ten gelen mesajı local ws istemcilerine yayınla.
      this.server?.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(msg);
        }
      });
    });
    this.logger.log('Redis Pub/Sub teklif kanalı hazır');
  }

  handleConnection(): void {
    this.logger.log('ws istemci bağlandı');
  }

  handleDisconnect(): void {
    this.logger.log('ws istemci ayrıldı');
  }

  /** Teklif → Redis'e publish (tüm instance'lara ulaşır). */
  broadcastTeklif(ilanId: string, teklif: { id: string; kullanici_id: string; tutar: string }): void {
    const msg = JSON.stringify({ event: 'teklif', ilanId, teklif });
    this.pubRedis?.publish(CHANNEL, msg);
    this.logger.log(`teklif yayınlandı: ilan=${ilanId} tutar=${teklif.tutar}`);
  }
}

import { Logger, OnModuleInit } from '@nestjs/common';
import { OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import type { IncomingMessage } from 'http';
import Redis from 'ioredis';
import { type Server, WebSocket } from 'ws';

const CHANNEL = 'teklif';
const KC_URL = process.env['KEYCLOAK_URL'] ?? 'http://localhost:8080';
const KC_REALM = process.env['KEYCLOAK_REALM'] ?? 'belediyesinden';

/** Tenant grubundan slug çıkar: 'tenant_talas' → 'talas'. */
function tenantFromGroups(groups?: string[]): string | null {
  const g = groups?.find((x) => x.startsWith('tenant_'));
  return g ? g.slice('tenant_'.length) : null;
}

/**
 * Gerçek zamanlı açık artırma WebSocket gateway'i (`/ws`).
 * Güvenlik: her bağlantıda Keycloak JWT doğrulanır (JWKS, offline); geçersizse reddedilir.
 * Tenant izolasyonu: client tenant'ına göre sadece o tenant'ın teklifleri yayınlanır.
 * Redis Pub/Sub ile çok-instance desteği.
 */
@WebSocketGateway({ path: '/ws' })
export class AuctionGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit {
  private readonly logger = new Logger(AuctionGateway.name);
  private pubRedis!: Redis;
  private subRedis!: Redis;
  private readonly jwks = createRemoteJWKSet(
    new URL(`${KC_URL}/realms/${KC_REALM}/protocol/openid-connect/certs`),
  );
  /** Bağlı istemci → tenant/userId. */
  private readonly clients = new Map<WebSocket, { tenant: string; userId: string }>();

  @WebSocketServer()
  server?: Server;

  onModuleInit(): void {
    const opts = {
      host: process.env['REDIS_HOST'] ?? 'localhost',
      port: Number(process.env['REDIS_PORT'] ?? 6379),
    };
    this.pubRedis = new Redis(opts);
    this.subRedis = new Redis(opts);
    this.subRedis.subscribe(CHANNEL);
    this.subRedis.on('message', (_ch: string, msg: string) => {
      // Redis'ten gelen mesajı tenant'sı eşleşen local istemcilere yayınla.
      try {
        const parsed = JSON.parse(msg) as {
          event: string;
          tenant: string;
          ilanId: string;
          kalemId: string;
          teklif: unknown;
        };
        this.server?.clients.forEach((client) => {
          if (client.readyState !== WebSocket.OPEN) return;
          const meta = this.clients.get(client);
          if (meta?.tenant === parsed.tenant) client.send(msg);
        });
      } catch {
        /* bozuk mesaj — yoksay */
      }
    });
    this.logger.log('Redis Pub/Sub teklif kanalı hazır (JWT doğrulamalı)');
  }

  async handleConnection(client: WebSocket, request?: IncomingMessage): Promise<void> {
    // Token: query (?token=) veya Sec-WebSocket-Protocol header'dan.
    const url = new URL(request?.url ?? '/', 'http://localhost');
    const token = url.searchParams.get('token') ?? this.tokenFromProtocol(request);

    if (!token) {
      this.logger.warn('ws bağlantı reddedildi: token yok');
      client.close(4001, 'token gerekli');
      return;
    }

    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: `${KC_URL}/realms/${KC_REALM}`,
      });
      // Personel (TENANT_ADMIN/ENCUMEN) tenant_groups'tan çözülür. Vatandaş/yatırımcı
      // hiçbir tenant grubuna bağlı DEĞİLDİR (bilerek) — bu yüzden query'den gelen
      // ?tenant= ile fallback yapılır. Teklif verisi zaten tenant başına public'tir
      // (GET /teklif/kalem/:kalemId @Unprotected — bkz. teklif.controller.ts), o yüzden
      // bu kanala hangi tenant'ın yayınına abone olunacağını client belirtebilir;
      // asıl yetkilendirme (teklif verme) ayrıca ve her zaman backend'de doğrulanır.
      const tenant = tenantFromGroups(payload['tenant_groups'] as string[] | undefined) ?? url.searchParams.get('tenant');
      const userId = payload['sub'] as string;
      if (!tenant || !userId) {
        client.close(4003, 'tenant/user çözümlenemedi');
        return;
      }
      this.clients.set(client, { tenant, userId });
      this.logger.log(`ws istemci bağlandı: tenant=${tenant} user=${userId.slice(0, 8)}`);
    } catch (e) {
      this.logger.warn('ws bağlantı reddedildi: geçersiz token (' + (e as Error).message + ')');
      client.close(4001, 'geçersiz token');
    }
  }

  handleDisconnect(client: WebSocket): void {
    this.clients.delete(client);
    this.logger.log('ws istemci ayrıldı');
  }

  /** Teklif → Redis'e publish (tenant dahil; tüm instance'lara ulaşır). `kalemId`: KK-25, ilan içindeki hangi varlık. */
  broadcastTeklif(
    tenantSlug: string,
    ilanId: string,
    kalemId: string,
    teklif: { id: string; kullanici_id: string; kullanici_ad?: string | null; tutar: string },
  ): void {
    const msg = JSON.stringify({ event: 'teklif', tenant: tenantSlug, ilanId, kalemId, teklif });
    this.pubRedis?.publish(CHANNEL, msg);
    this.logger.log(`teklif yayınlandı: tenant=${tenantSlug} kalem=${kalemId} tutar=${teklif.tutar}`);
  }

  private tokenFromProtocol(request?: IncomingMessage): string | null {
    // keycloak-js alternatifi: Sec-WebSocket-Protocol header'ında token.
    const proto = request?.headers['sec-websocket-protocol'];
    if (typeof proto === 'string' && proto.startsWith('bearer.')) {
      return proto.slice('bearer.'.length);
    }
    return null;
  }
}

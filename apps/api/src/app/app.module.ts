import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthGuard, KeycloakConnectModule, TokenValidation } from 'nest-keycloak-connect';
import { sharedDataSourceOptions } from '@belediyesinden/db';
import { KeycloakAuthModule } from '@belediyesinden/auth';
import { TenancyInterceptor, TenancyModule } from '@belediyesinden/tenancy';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TenantGuard } from './tenant.guard';
import { RollerGuard } from './roller.guard';
import { DuyuruModule } from '../duyuru/duyuru.module';
import { TenantThemeModule } from '../tenants/tenant-theme.module';
import { TenantThrottlerGuard } from '../throttle/tenant-throttler.guard';
import { TenantMigrationBootstrap } from '../tenancy-bootstrap/tenant-migration-bootstrap';
import { VarlikModule } from '../varlik/varlik.module';
import { IlanModule } from '../ilan/ilan.module';
import { EvrakModule } from '../evrak/evrak.module';
import { BasvuruModule } from '../basvuru/basvuru.module';
import { TeminatModule } from '../teminat/teminat.module';
import { TeklifModule } from '../teklif/teklif.module';
import { AuctionGatewayModule } from '../auction/auction-gateway.module';
import { RaporModule } from '../rapor/rapor.module';
import { AuditModule } from '../audit/audit.module';
import { SearchModule } from '../search/search.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', 'apps/api/.env'] }),
    // Per-tenant rate-limit (key=tenant slug, env-driven limit/ttl). İlk guard → taşkınları erken keser.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            name: 'default',
            limit: Number(config.get<string>('THROTTLE_LIMIT') ?? 60),
            ttl: Number(config.get<string>('THROTTLE_TTL') ?? 60000),
          },
        ],
      }),
    }),
    // TypeORM: shared schema. migrationsRun=true → startup'ta shared tabloları kurar.
    TypeOrmModule.forRoot({
      ...sharedDataSourceOptions,
      migrationsRun: true,
    }),
    // Keycloak: JWT doğrulama (bearer-only api client, realm public key ile).
    KeycloakConnectModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        serverUrl: config.get<string>('KEYCLOAK_URL') ?? 'http://localhost:8080',
        realm: config.get<string>('KEYCLOAK_REALM') ?? 'belediyesinden',
        clientId: config.get<string>('KEYCLOAK_API_CLIENT_ID') ?? 'api',
        secret: config.get<string>('KEYCLOAK_API_SECRET') ?? '',
        bearerOnly: true,
        // Bearer-only kaynak sunucusu: introspection (online) yerine JWKS ile
        // offline doğrulama (secret gerektirmez).
        tokenValidation: TokenValidation.OFFLINE,
      }),
    }),
    KeycloakAuthModule, // KeycloakAdminService + UserSyncService
    TenancyModule, // TenancyInterceptor (sağlayıcı)
    DuyuruModule, // demo tenant-scoped kaynak
    TenantThemeModule, // herkese açık tenant tema endpoint'i
    VarlikModule, // belediye varlık CRUD (tenant-scoped)
    IlanModule, // ihale ilanı + durum makinesi (tenant-scoped)
    EvrakModule, // şartname/evrak (MinIO + tenant-scoped)
    SearchModule, // OpenSearch ilan arama (global)
    BasvuruModule, // başvuru + KVKK (tenant-scoped)
    TeminatModule, // teminat simülasyon (e-dekont + onay/iade)
    TeklifModule, // server-authoritative teklif + anti-snicking
    AuctionGatewayModule, // ws gerçek zamanlı teklif yayını
    RaporModule, // tenant dashboard (raporlama)
    AuditModule, // audit hash-chain doğrulama
  ],
  controllers: [AppController],
  providers: [
    AppService,
    TenantGuard,
    TenantMigrationBootstrap, // startup'ta tüm tenant'ların pending migration'ları
    // Global guard sırası: auth → rol → tenant-uyum, sonra interceptor search_path kurar.
    { provide: APP_GUARD, useClass: TenantThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RollerGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
    { provide: APP_INTERCEPTOR, useClass: TenancyInterceptor },
  ],
})
export class AppModule {}

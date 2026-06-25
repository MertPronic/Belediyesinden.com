import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthGuard, KeycloakConnectModule, RoleGuard, TokenValidation } from 'nest-keycloak-connect';
import { sharedDataSourceOptions } from '@belediyesinden/db';
import { KeycloakAuthModule } from '@belediyesinden/auth';
import { TenancyInterceptor, TenancyModule } from '@belediyesinden/tenancy';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TenantGuard } from './tenant.guard';
import { DuyuruModule } from '../duyuru/duyuru.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', 'apps/api/.env'] }),
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
  ],
  controllers: [AppController],
  providers: [
    AppService,
    TenantGuard,
    // Global guard sırası: auth → rol → tenant-uyum, sonra interceptor search_path kurar.
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RoleGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
    { provide: APP_INTERCEPTOR, useClass: TenancyInterceptor },
  ],
})
export class AppModule {}

import { Global, Module } from '@nestjs/common';
import { KeycloakAdminService } from './keycloak-admin.service';
import { UserSyncService } from './user-sync.service';

/**
 * Keycloak auth altyapısı module'ü.
 * `KeycloakAdminService` (provisioning) + `UserSyncService` (kullanıcı senkronu) sağlar.
 *
 * Not: nest-keycloak-connect'in `KeycloakConnectModule.forRootAsync` ve global guard'lar
 * (AuthGuard/RoleGuard) uygulama (apps/api) AppModule'ünde, ConfigService ile yapılandırılır.
 */
@Global()
@Module({
  providers: [KeycloakAdminService, UserSyncService],
  exports: [KeycloakAdminService, UserSyncService],
})
export class KeycloakAuthModule {}

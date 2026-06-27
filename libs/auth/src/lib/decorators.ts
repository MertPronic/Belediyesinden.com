import { type ExecutionContext, SetMetadata, createParamDecorator } from '@nestjs/common';
import { KullaniciRolu } from '@belediyesinden/shared';
import { extractUser, type AuthenticatedUser } from './token-extractor';

// nest-keycloak-connect'in koruma decorator'ünü yeniden dışa aktar:
export { Unprotected } from 'nest-keycloak-connect';

/** Rol gereksinimi metadata anahtarı. */
export const ROLLER_KEY = 'roller';

/**
 * Endpoint'e rol gereksinimi koyar. SUPERADMIN her zaman geçer.
 * Kullanım: `@Roller(KullaniciRolu.TenantAdmin)` veya `@Roller(KullaniciRolu.Vatandas, KullaniciRolu.Yatirimci)`
 */
export const Roller = (...roles: KullaniciRolu[]) => SetMetadata(ROLLER_KEY, roles);

/**
 * Doğrulanmış kullanıcıyı (AuthenticatedUser) parametre olarak enjekte eder.
 * Kullanım: `create(@CurrentUser() user: AuthenticatedUser) {}`
 * Public/unprotected isteklerde `null` döner.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser | null => {
    const req = ctx.switchToHttp().getRequest();
    return extractUser(req);
  },
);

/** Kullanıcının JWT'sindeki tenant_id claim'ini döndürür (public isteklerde null). */
export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | null => {
    const req = ctx.switchToHttp().getRequest();
    return extractUser(req)?.tenantId ?? null;
  },
);

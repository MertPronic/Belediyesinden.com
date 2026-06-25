import { type ExecutionContext, createParamDecorator } from '@nestjs/common';
import { extractUser, type AuthenticatedUser } from './token-extractor';

// nest-keycloak-connect'in rol/koruma decorator'lerini yeniden dışa aktar:
export { Roles, Unprotected } from 'nest-keycloak-connect';

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

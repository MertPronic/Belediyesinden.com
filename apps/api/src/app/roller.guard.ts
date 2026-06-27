import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { KullaniciRolu } from '@belediyesinden/shared';
import { ROLLER_KEY, extractUser } from '@belediyesinden/auth';

/**
 * Özel RBAC guard — nest-keycloak-connect'in RoleGuard'ı rol çıkarımında
 * sorun çıkarıyordu. Bu guard extractUser().roles (KullaniciRolu) ile çalışır.
 *
 * @Roller(...) yoksa her kimliği doğrulanmış kullanıcı geçer.
 * SUPERADMIN her rolü geçer.
 */
@Injectable()
export class RollerGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<KullaniciRolu[]>(ROLLER_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) {
      return true;
    }
    const user = extractUser(context.switchToHttp().getRequest());
    if (!user) {
      return true; // AuthGuard yakalar (public route)
    }
    if (user.roles.includes(KullaniciRolu.Superadmin)) {
      return true;
    }
    return required.some((r) => user.roles.includes(r));
  }
}

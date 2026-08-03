import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Tenant } from '@belediyesinden/db';
import { extractUser } from '@belediyesinden/auth';
import { resolveTenantSlugFromHeaders } from '@belediyesinden/tenancy';

type HttpRequest = {
  headers: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
  tenant?: Tenant;
};

/**
 * TenantGuard — izolasyonun güvenlik çekirdeği.
 *
 * 1) Host'tan tenant slug çözer. Merkezi portal (tenant yok) ise izin verir.
 * 2) Tenant kaydını `shared.tenants`'tan yükler; yoksa 404, aktif değilse 403.
 *    Yüklenen tenant'ı `req.tenant`'a koyar (handler/theming için).
 * 3) JWT'de `tenant_id` varsa subdomain tenant'ıyla eşleşmelidir — eşleşmezse 403
 *    (cross-tenant erişim engeli). SUPERADMIN (tenant_id yok) her tenant'a erişebilir.
 *
 * Sıra: Keycloak AuthGuard (auth) → RoleGuard → **TenantGuard** → TenancyInterceptor (search_path).
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly ds: DataSource) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<HttpRequest>();
    const slug = resolveTenantSlugFromHeaders(req.headers, req.query);
    if (!slug) {
      return true; // merkezi portal — tenant kısıtı yok
    }

    const tenant = await this.ds.getRepository(Tenant).findOne({ where: { slug } });
    if (!tenant) {
      throw new NotFoundException(`Tenant bulunamadı: ${slug}`);
    }
    if (tenant.durum !== 'AKTIF') {
      throw new ForbiddenException(`Tenant aktif değil: ${slug}`);
    }
    req.tenant = tenant;

    // JWT tenant_id ↔ subdomain uyumu (SUPERADMIN muaf).
    const user = extractUser(req);
    if (user?.tenantId && user.tenantId !== slug) {
      throw new ForbiddenException('Bu tenant için erişim yetkiniz yok');
    }

    return true;
  }
}

import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common';
import { from, switchMap } from 'rxjs';
import { getCurrentTenant } from '@belediyesinden/tenancy';
import { extractUser, type AuthenticatedUser, UserSyncService } from '@belediyesinden/auth';

/**
 * Her kimlikli istekte kullanıcıyı `shared.users`e senkronlar (handler çağrılmadan ÖNCE
 * beklenir — fire-and-forget olsaydı örn. "Hesabım" sayfasının ilk ziyarette satır henüz
 * yokken 404 dönme riski olurdu). `UserSyncService` daha önce tanımlıydı ama hiçbir
 * yerden çağrılmıyordu — bu, ihale hatırlatma bildirimlerinin (e-posta/SMS) admin/katılımcı
 * adresi bulabilmesi ve "Hesabım" sayfasının telefon alanının çalışabilmesi için önkoşul.
 * Senkron hatası isteği düşürmez (sessizce yutulur). `TenancyInterceptor`'dan SONRA
 * çalışacak şekilde kayıtlı olmalı (tenant bağlamına ihtiyaç duyuyor, izolasyon
 * mantığına dokunmuyor).
 */
@Injectable()
export class UserSyncInterceptor implements NestInterceptor {
  constructor(private readonly userSync: UserSyncService) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const user = extractUser(context.switchToHttp().getRequest());
    if (!user) return next.handle();
    return from(this.senkronla(user).catch(() => {})).pipe(switchMap(() => next.handle()));
  }

  private async senkronla(user: AuthenticatedUser): Promise<void> {
    const tenant = getCurrentTenant();
    let tenantId: string | null = null;
    if (tenant) {
      // Unqualified `tenants` → search_path'teki `shared` şemasına düşer (tenant
      // şemalarında aynı adda tablo yok). `slug` zaten TenancyInterceptor'da
      // regex-doğrulanmış (KK-07); yine de parametreli sorgulanıyor.
      const rows = await tenant.queryRunner.query('SELECT id FROM tenants WHERE slug = $1', [tenant.slug]);
      tenantId = rows[0]?.id ?? null;
    }
    await this.userSync.sync(user, tenantId);
  }
}

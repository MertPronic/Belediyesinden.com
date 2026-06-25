import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common';
import { from, lastValueFrom } from 'rxjs';
import { DataSource } from 'typeorm';
import { resolveTenantSlugFromHeaders, tenantSchema } from './tenant-resolver';
import { tenantContext } from './tenancy.context';

/**
 * Her HTTP isteğini tenant'a göre izole eder:
 *   1) Host header'ından tenant slug çözer.
 *   2) Bir QueryRunner + transaction açar.
 *   3) `SET LOCAL search_path TO tenant_<slug>, shared` çalıştırır → o istekteki tüm
 *      sorgular tenant schema'sına (öncelikli) + shared schema'ya (fallback) düşer.
 *   4) Tenant bağlamını AsyncLocalStorage'a koyar (servisler erişir).
 *   5) Handler başarıyla bitince commit, hata olursa rollback; sonra QueryRunner release.
 *
 * Merkezi portal istekleri (tenant yok) izolasyonsuz geçer.
 *
 * Not: Uygulama, bu interceptor'u kullanmak için `TypeOrmModule.forRoot` ile DataSource
 * sağlamalı ve interceptor'u global (APP_INTERCEPTOR) veya controller bazında kaydetmelidir.
 */
@Injectable()
export class TenancyInterceptor implements NestInterceptor {
  constructor(private readonly dataSource: DataSource) {}

  intercept(_context: ExecutionContext, next: CallHandler) {
    return from(this.handleTenant(_context, next));
  }

  private async handleTenant(context: ExecutionContext, next: CallHandler): Promise<unknown> {
    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
    }>();
    const slug = resolveTenantSlugFromHeaders(req.headers);
    if (!slug) {
      // Merkezi portal — tenant izolasyonu yok.
      return lastValueFrom(next.handle());
    }

    const schema = tenantSchema(slug);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    await queryRunner.query(`SET LOCAL search_path TO ${schema}, shared`);

    try {
      const result = await tenantContext.run({ slug, schema, queryRunner }, () =>
        lastValueFrom(next.handle()),
      );
      await queryRunner.commitTransaction();
      return result;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}

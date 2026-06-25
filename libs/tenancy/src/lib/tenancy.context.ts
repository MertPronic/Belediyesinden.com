import { AsyncLocalStorage } from 'node:async_hooks';
import type { QueryRunner } from 'typeorm';

/**
 * Bir HTTP isteği boyunca aktif tenant bağlamı.
 * AsyncLocalStorage sayesinde promise zinciri boyunca (servis katmanı dahil) erişilebilir.
 */
export interface TenantRequest {
  /** Tenant slug (örn. `talas`). */
  slug: string;
  /** PostgreSQL schema adı (örn. `tenant_talas`). */
  schema: string;
  /** İstek boyunca kullanılan TypeORM QueryRunner (search_path bu transaction'da ayarlı). */
  queryRunner: QueryRunner;
}

/** İstek-özel tenant bağlamını tutan depo. */
export const tenantContext = new AsyncLocalStorage<TenantRequest>();

/**
 * Aktif tenant bağlamını döndürür (TenancyInterceptor dışında `undefined`).
 * Servisler DB işlemi için buradaki `queryRunner.manager` kullanır.
 */
export function getCurrentTenant(): TenantRequest | undefined {
  return tenantContext.getStore();
}

import { Module } from '@nestjs/common';
import { TenancyInterceptor } from './tenancy.interceptor';

/**
 * TenancyModule — tenant çözümleme + istek-bazlı izolasyon altyapısını sağlar.
 *
 * `TenancyInterceptor`'a `DataSource` enjekte edilir; bu nedenle uygulamada
 * `TypeOrmModule.forRoot(...)` ile DataSource'un DI konteynerine kayıtlı olması gerekir.
 *
 * Kullanım (api uygulamasında, ileriki PR):
 *   @Module({ imports: [TypeOrmModule.forRoot(...), TenancyModule], providers: [
 *     { provide: APP_INTERCEPTOR, useClass: TenancyInterceptor }
 *   ] })
 */
@Module({
  providers: [TenancyInterceptor],
  exports: [TenancyInterceptor],
})
export class TenancyModule {}

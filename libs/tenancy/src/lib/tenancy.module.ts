import { Module } from '@nestjs/common';

/**
 * TenancyModule — tenant çözümleme + izolasyon servisleri için modül.
 *
 * `TenancyInterceptor`, uygulamada global interceptor olarak KULLANILACAKSA
 * `{ provide: APP_INTERCEPTOR, useClass: TenancyInterceptor }` ile uygulama modülünde
 * kaydedilir — böylece DataSource enjeksiyonu uygulama modülü kapsamında çözülür
 * (TenantGuard ile aynı pattern). Burada tekrar provider olarak bildirilmez: çift
 * bildirim (burada + APP_INTERCEPTOR) NestJS'in interceptor'ı yanlış kapsamda
 * örnekleyip DataSource'u bulamamasına yol açıyordu (DI hatası).
 *
 * `TenancyInterceptor` sınıfı `index.ts` barrel'inden export edilir; uygulama onu
 * import edip APP_INTERCEPTOR ile kaydeder.
 */
@Module({})
export class TenancyModule {}

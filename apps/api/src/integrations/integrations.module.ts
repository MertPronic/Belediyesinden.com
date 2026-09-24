import { Module } from '@nestjs/common';
import { StubEmailProvider, StubSmsProvider } from './notification-providers';

export const EMAIL_PROVIDER = Symbol('EMAIL_PROVIDER');
export const SMS_PROVIDER = Symbol('SMS_PROVIDER');

/**
 * Dış bildirim sağlayıcılarını DI'a bağlar. Gerçek sağlayıcı bağlanınca yalnızca
 * `useClass` değişir — tüketen servis kodu (`@Inject(EMAIL_PROVIDER)` vb.) aynı kalır.
 */
@Module({
  providers: [
    { provide: EMAIL_PROVIDER, useClass: StubEmailProvider },
    { provide: SMS_PROVIDER, useClass: StubSmsProvider },
  ],
  exports: [EMAIL_PROVIDER, SMS_PROVIDER],
})
export class IntegrationsModule {}

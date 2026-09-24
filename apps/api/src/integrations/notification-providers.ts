/**
 * Bildirim gönderim sağlayıcıları (stub) — `provider-interfaces.ts` ile aynı desen
 * (arayüz + Stub sınıfı). Gerçek SMTP/SMS sağlayıcı bağlanınca yalnızca bu iki sınıf
 * değişir (`integrations.module.ts`'te DI token'ı aynı kalır, servis kodu değişmez).
 */

// ---- E-posta ----

export interface EmailProvider {
  gonder(to: string, subject: string, body: string): Promise<void>;
}

/** Stub: gerçek SMTP yerine konsola yazar. */
export class StubEmailProvider implements EmailProvider {
  async gonder(to: string, subject: string, _body: string): Promise<void> {
    console.log(`[StubEmailProvider] -> ${to}: ${subject}`);
  }
}

// ---- SMS ----

export interface SmsProvider {
  gonder(to: string, mesaj: string): Promise<void>;
}

/** Stub: gerçek SMS gateway'i yerine konsola yazar. */
export class StubSmsProvider implements SmsProvider {
  async gonder(to: string, mesaj: string): Promise<void> {
    console.log(`[StubSmsProvider] -> ${to}: ${mesaj}`);
  }
}

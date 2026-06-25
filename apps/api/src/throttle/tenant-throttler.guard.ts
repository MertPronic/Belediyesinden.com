import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { resolveTenantSlugFromHeaders } from '@belediyesinden/tenancy';

/**
 * Per-tenant rate-limit guard. Throttler'ın tracker anahtarını tenant slug yapar
 * → her belediyenin ayrı kotası olur; bir tenant'ın aşırı yükü diğerini etkilemez
 * (performans izolasyonu). Merkezi istekler 'central' bucket'ına düşer.
 *
 * Not: storage in-memory (tek instance). Üretimde Redis storage
 * (@nest-lab/throttler-storage-redis) ile çok-instance ölçeklenir.
 */
@Injectable()
export class TenantThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    const headers =
      (req as { headers?: Record<string, string | string[] | undefined> }).headers ?? {};
    return resolveTenantSlugFromHeaders(headers) ?? 'central';
  }
}

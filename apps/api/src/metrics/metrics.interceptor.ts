import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common';
import { type Response } from 'express';
import { tap } from 'rxjs';
import { httpRequestDuration, httpRequestTotal } from './registry';

/**
 * Her HTTP isteğini Prometheus metriklerine yazar (method/route/status + süre).
 * Global interceptor olarak kaydedilir.
 */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const req = context.switchToHttp().getRequest<{ method: string; url: string }>();
    const start = Date.now();
    const route = (req.url ?? '/').split('?')[0];

    return next.handle().pipe(
      tap(() => {
        const res = context.switchToHttp().getResponse<Response>();
        const status = String(res.statusCode ?? 200);
        const method = req.method ?? 'GET';
        httpRequestTotal.labels(method, route, status).inc();
        httpRequestDuration.labels(method, route).observe((Date.now() - start) / 1000);
      }),
    );
  }
}

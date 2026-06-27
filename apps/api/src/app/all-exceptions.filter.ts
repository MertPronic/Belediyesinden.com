import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Global exception filter — tutarlı hata yanıtı: {statusCode, error, message, path}.
 * Doğrulama hataları (ValidationPipe) → 400 + alan bazlı mesaj dizisi.
 * Tenant bağlamı (varsa) log'a eklenir.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const httpEx = isHttp ? exception.getResponse() : undefined;

    // Doğrulama hatası: { message: string[] } veya string.
    let message: unknown = httpEx ?? 'Beklenmeyen sunucu hatası';
    if (typeof httpEx === 'object' && httpEx !== null && 'message' in httpEx) {
      message = (httpEx as { message: unknown }).message;
    }

    const body = {
      statusCode: status,
      error: typeof message === 'string' ? message : HttpStatus[status] ?? 'Error',
      message,
      timestamp: new Date().toISOString(),
      path: req?.url,
    };

    if (status >= 500) {
      this.logger.error(
        `${req?.method} ${req?.url} → ${status}: ${exception instanceof Error ? exception.message : exception}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    if (typeof res?.status === 'function') {
      res.status(status).json(body);
    }
  }
}

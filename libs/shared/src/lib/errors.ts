/**
 * Belediyesinden · Standart uygulama hatası
 * Tüm domain/runtime hataları AppError ile fırlatılır; global exception filter
 * bunu HTTP yanıtına çevirir.
 */

export enum ErrorCode {
  NotFound = 'NOT_FOUND',
  Unauthorized = 'UNAUTHORIZED',
  Forbidden = 'FORBIDDEN',
  Validation = 'VALIDATION',
  Conflict = 'CONFLICT',
  TenantNotFound = 'TENANT_NOT_FOUND',
  TenantSuspended = 'TENANT_SUSPENDED',
  Internal = 'INTERNAL',
}

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode | string,
    message: string,
    public readonly statusCode = 500,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }

  static notFound(message: string, details?: unknown): AppError {
    return new AppError(ErrorCode.NotFound, message, 404, details);
  }

  static unauthorized(message = 'Yetkisiz erişim'): AppError {
    return new AppError(ErrorCode.Unauthorized, message, 401);
  }

  static forbidden(message = 'Bu işlem için yetkiniz yok'): AppError {
    return new AppError(ErrorCode.Forbidden, message, 403);
  }

  static validation(message: string, details?: unknown): AppError {
    return new AppError(ErrorCode.Validation, message, 400, details);
  }

  static conflict(message: string, details?: unknown): AppError {
    return new AppError(ErrorCode.Conflict, message, 409, details);
  }

  static tenantNotFound(slug: string): AppError {
    return new AppError(ErrorCode.TenantNotFound, `Tenant bulunamadı: ${slug}`, 404);
  }
}

/**
 * Belediyesinden · Standart API zarfları (response envelopes)
 * Tüm servisler aynı şekli döner → tutarlı frontend/api sözleşmesi.
 */

/** Sayfalama istek parametreleri. */
export interface PaginationParams {
  page: number;
  pageSize: number;
}

/** Sayfalı sonuç zarfı. */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Standart hata şekli (Result'in başarısız kolundaki error). */
export interface ResultError {
  code: string;
  message: string;
  details?: unknown;
}

/**
 * Ayrıştırılmış (discriminated) sonuç tipi.
 * Başarı: { success: true, data }
 * Başarısız: { success: false, error }
 */
export type Result<T, E extends ResultError = ResultError> =
  | { success: true; data: T }
  | { success: false; error: E };

/** Yardımcı: başarılı Result sarıcı. */
export const ok = <T>(data: T): Result<T> => ({ success: true, data });

/** Yardımcı: başarısız Result sarıcı. */
export const fail = (error: ResultError): Result<never> => ({ success: false, error });

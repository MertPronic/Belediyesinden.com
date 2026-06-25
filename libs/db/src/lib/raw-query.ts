import type { QueryRunner } from 'typeorm';

/**
 * TypeORM 1.0 raw sorgu yardımcısı.
 *
 * `queryRunner.query` bazı komutlarda (UPDATE...RETURNING, INSERT...RETURNING)
 * `[rowsArray, meta]` şeklinde bir tuple döndürür; bu yardımcı her iki durumu da
 * (tuple veya doğrudan rowsArray) ele alıp **gerçek satır dizisini** verir.
 */
export async function rawQuery<T = unknown>(
  qr: QueryRunner,
  sql: string,
  params?: unknown[],
): Promise<T[]> {
  const result = await qr.query(sql, params);
  if (Array.isArray(result) && result.length > 0 && Array.isArray(result[0])) {
    return result[0] as T[];
  }
  return result as T[];
}

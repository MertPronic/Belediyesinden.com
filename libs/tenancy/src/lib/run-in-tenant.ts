import type { DataSource } from 'typeorm';
import { tenantContext } from './tenancy.context';
import { tenantSchema } from './tenant-resolver';

/**
 * HTTP isteği dışında (zamanlanmış görev, süper admin'in başka bir tenant
 * adına yazması gibi) belirli bir tenant bağlamında kod çalıştırır —
 * `TenancyInterceptor`'ın istek başına yaptığı QueryRunner + transaction +
 * `SET LOCAL search_path` + ALS kurulumunu elle tekrarlar. Böylece
 * tenant-scoped servisler (`getCurrentTenant()`/`this.qr()` kullanan)
 * normal request akışındaki gibi, değişmeden çağrılabilir.
 */
export async function runInTenant<T>(ds: DataSource, tenantSlug: string, fn: () => Promise<T>): Promise<T> {
  const schema = tenantSchema(tenantSlug);
  const queryRunner = ds.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();
  await queryRunner.query(`SET LOCAL search_path TO ${schema}, shared`);
  try {
    const result = await tenantContext.run({ slug: tenantSlug, schema, queryRunner }, fn);
    await queryRunner.commitTransaction();
    return result;
  } catch (e) {
    await queryRunner.rollbackTransaction();
    throw e;
  } finally {
    await queryRunner.release();
  }
}

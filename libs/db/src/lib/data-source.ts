import { DataSource } from 'typeorm';
import type { PostgresDataSourceOptions } from 'typeorm/driver/postgres/PostgresDataSourceOptions';
import { AuditLog, Tenant, User } from './entities';
import { sharedMigrations } from './migrations/shared-migrations';

/** `shared` şemasındaki tüm entity'ler (migration ve CLI için). */
export const sharedEntities = [Tenant, User, AuditLog];

/**
 * `shared` şemasına bağlı DataSource seçenekleri (merkezi kayıtlar).
 * NestJS `TypeOrmModule.forRoot` ve bağımsız DataSource'lar ortak bu seçenekleri kullanır.
 *
 * Tenant verisi için `libs/tenancy` (PR-4) istek bazında `search_path` ayarlar;
 * `createDataSource({ schema: 'tenant_xxx' })` ile tenant schema'sına da bağlanılabilir.
 */
export const sharedDataSourceOptions: PostgresDataSourceOptions = {
  type: 'postgres',
  host: process.env['POSTGRES_HOST'] ?? 'localhost',
  port: Number(process.env['POSTGRES_PORT'] ?? 5432),
  username: process.env['POSTGRES_USER'] ?? 'belediyesinden',
  password: process.env['POSTGRES_PASSWORD'] ?? 'belediyesinden_dev',
  database: process.env['POSTGRES_DB'] ?? 'belediyesinden',
  schema: 'shared',
  entities: sharedEntities,
  migrations: sharedMigrations,
  synchronize: false, // üretimde asla true; şema migration ile yönetilir
  logging: process.env['DB_LOGGING'] === 'true',
};

/**
 * TypeORM DataSource fabrikası. Varsayılan `shared` schema;
 * `overrides` ile farklı şemaya (örn. tenant) bağlanılır.
 *
 * @param overrides  — örn. `{ schema: 'tenant_talas', migrations: tenantMigrations }`.
 */
export function createDataSource(overrides: Partial<PostgresDataSourceOptions> = {}): DataSource {
  return new DataSource({ ...sharedDataSourceOptions, ...overrides });
}

/** Varsayılan (shared schema) DataSource — CLI/migration ve bootstrap için. */
export const AppDataSource: DataSource = createDataSource();

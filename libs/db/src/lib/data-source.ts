import { DataSource } from 'typeorm';
import type { PostgresDataSourceOptions } from 'typeorm/driver/postgres/PostgresDataSourceOptions';
import { Tenant, User } from './entities';

/** `shared` şemasındaki tüm entity'ler (migration ve CLI için). */
export const sharedEntities = [Tenant, User];

/**
 * TypeORM DataSource fabrikası.
 * Varsayılan olarak `shared` şemasına bağlanır (merkezi kayıtlar).
 * Tenant verisi için `libs/tenancy` (PR-4) istek bazında `search_path` ayarlar.
 *
 * Not: `overrides` parametresi `Partial<PostgresConnectionOptions>` (union değil)
 * tipindedir; bu sayede spread edildiğinde diğer driver tipleriyle kirlenip
 * `password` gibi alanların tipi genişlemez.
 *
 * @param overrides  — örn. `{ schema: 'tenant_xxx' }` ile farklı şemaya bağlan.
 */
export function createDataSource(
  overrides: Partial<PostgresDataSourceOptions> = {},
): DataSource {
  return new DataSource({
    type: 'postgres',
    host: process.env['POSTGRES_HOST'] ?? 'localhost',
    port: Number(process.env['POSTGRES_PORT'] ?? 5432),
    username: process.env['POSTGRES_USER'] ?? 'belediyesinden',
    password: process.env['POSTGRES_PASSWORD'] ?? 'belediyesinden_dev',
    database: process.env['POSTGRES_DB'] ?? 'belediyesinden',
    schema: 'shared',
    entities: sharedEntities,
    migrations: [],
    synchronize: false, // üretimde asla true; şema migration ile yönetilir
    logging: process.env['DB_LOGGING'] === 'true',
    ...overrides,
  });
}

/** Varsayılan (shared schema) DataSource — CLI/migration ve bootstrap için. */
export const AppDataSource: DataSource = createDataSource();

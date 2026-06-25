import type { DataSource } from 'typeorm';
import { AuditLog } from '@belediyesinden/db';
import { computeAuditHash, GENESIS_HASH } from './audit-hash';

/** appendAuditLog'a giren denetim kaydı (hash/prevHash/ts hesaplanarak eklenir). */
export interface AuditLogEntry {
  tenantId: string | null;
  actorId: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  payload: Record<string, unknown>;
}

/**
 * Yeni bir denetim kaydını hash-chain'e ekler:
 *   1) En son kaydın hash'ini okur (yoksa GENESIS).
 *   2) hash = sha256(prevHash | canonical(payload) | createdAt) hesaplar.
 *   3) Kaydı insert eder (append-only; trigger UPDATE/DELETE'yi engeller).
 *
 * @param ds   Aktif DataSource (istek içinde: tenant QueryRunner'ın manager'ı).
 *
 * Not: Eşzamanlı append'ler aynı prevHash'i görüp zincirde çatal yapabilir.
 * Üretimde bu, satır kilidi (SELECT ... FOR UPDATE) veya sıra numarası ile
 * sağlamlaştırılmalıdır; bu scaffold bilinen bir sınırdır.
 */
export async function appendAuditLog(ds: DataSource, entry: AuditLogEntry): Promise<AuditLog> {
  const repo = ds.getRepository(AuditLog);

  const prev = await repo
    .createQueryBuilder('a')
    .orderBy('a.createdAt', 'DESC')
    .addOrderBy('a.id', 'DESC')
    .limit(1)
    .getOne();

  const prevHash = prev?.hash ?? GENESIS_HASH;
  const createdAt = new Date();
  const hash = computeAuditHash(prevHash, entry.payload, createdAt);

  const record = repo.create({ ...entry, prevHash, hash, createdAt });
  return repo.save(record);
}

/**
 * Hash-chain bütünlüğünü doğrular: her kaydın hash'i öncekiyle tutarlı mı?
 * Bozulma (manuel değişiklik) varsa ilk tutarsız kaydın indeksini döndürür.
 */
export async function verifyAuditChain(ds: DataSource): Promise<{ ok: boolean; brokenAt: number | null }> {
  const records = await ds
    .getRepository(AuditLog)
    .createQueryBuilder('a')
    .orderBy('a.createdAt', 'ASC')
    .addOrderBy('a.id', 'ASC')
    .getMany();

  let prevHash = GENESIS_HASH;
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    if (!r) continue;
    if (r.prevHash !== prevHash) {
      return { ok: false, brokenAt: i };
    }
    const expected = computeAuditHash(prevHash, r.payload, r.createdAt);
    if (expected !== r.hash) {
      return { ok: false, brokenAt: i };
    }
    prevHash = r.hash;
  }
  return { ok: true, brokenAt: null };
}

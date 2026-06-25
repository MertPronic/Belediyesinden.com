import { createHash } from 'node:crypto';

/** Zincirin ilk kaydı için genesis (64 hex sıfır). */
export const GENESIS_HASH = '0'.repeat(64);

/**
 * Bir değeri deterministik (anahtar-sıralı) JSON'a çevirir.
 * Aynı payload her zaman aynı string'i üretir → hash kararlılığı.
 */
export function canonicalStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalStringify).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const entries = Object.keys(obj)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonicalStringify(obj[k])}`);
  return `{${entries.join(',')}}`;
}

/**
 * Audit hash'ini hesaplar: sha256(prevHash | canonical(payload) | ts).
 * @param prevHash  Önceki kaydın hash'i (ilk kayıt için GENESIS_HASH).
 * @param payload   İşlem detayı.
 * @param ts        Kayıt zamanı (ISO string).
 */
export function computeAuditHash(
  prevHash: string,
  payload: unknown,
  ts: Date,
): string {
  const data = `${prevHash}|${canonicalStringify(payload)}|${ts.toISOString()}`;
  return createHash('sha256').update(data, 'utf8').digest('hex');
}

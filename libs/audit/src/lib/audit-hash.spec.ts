import { describe, it, expect } from 'vitest';
import { computeAuditHash, canonicalStringify } from './audit-hash';

describe('computeAuditHash', () => {
  it('64-karakter hex string üretir', () => {
    const hash = computeAuditHash('genesis', { test: true }, new Date('2026-01-01'));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('aynı girdi → aynı hash (deterministik)', () => {
    const date = new Date('2026-01-01T00:00:00Z');
    const h1 = computeAuditHash('abc123', { key: 'val' }, date);
    const h2 = computeAuditHash('abc123', { key: 'val' }, date);
    expect(h1).toBe(h2);
  });

  it('farklı payload → farklı hash', () => {
    const date = new Date('2026-01-01');
    const h1 = computeAuditHash('prev', { a: 1 }, date);
    const h2 = computeAuditHash('prev', { a: 2 }, date);
    expect(h1).not.toBe(h2);
  });

  it('farklı prevHash → farklı hash', () => {
    const date = new Date('2026-01-01');
    const h1 = computeAuditHash('aaa', { x: 1 }, date);
    const h2 = computeAuditHash('bbb', { x: 1 }, date);
    expect(h1).not.toBe(h2);
  });
});

describe('canonicalStringify', () => {
  it('anahtar sırasından bağımsız deterministic çıktı', () => {
    const a = canonicalStringify({ b: 2, a: 1 });
    const b = canonicalStringify({ a: 1, b: 2 });
    expect(a).toBe(b);
  });
});

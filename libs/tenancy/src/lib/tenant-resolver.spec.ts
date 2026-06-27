import { describe, it, expect } from 'vitest';
import { isValidSlug, tenantSchema } from './tenant-resolver';

describe('isValidSlug', () => {
  it('geçerli slug kabul edilir', () => {
    expect(isValidSlug('talas')).toBe(true);
    expect(isValidSlug('melikgazi')).toBe(true);
    expect(isValidSlug('belediye123')).toBe(true);
    expect(isValidSlug('abc')).toBe(true);
  });

  it('çok kısa slug reddedilir', () => {
    expect(isValidSlug('ab')).toBe(false);
  });

  it('çok uzun slug reddedilir', () => {
    expect(isValidSlug('a'.repeat(41))).toBe(false);
  });

  it('geçersiz karakterler reddedilir', () => {
    expect(isValidSlug('TALAS')).toBe(false); // büyük harf
    expect(isValidSlug('tal-as')).toBe(false); // tire (sadece a-z0-9)
    expect(isValidSlug('tal as')).toBe(false); // boşluk
    expect(isValidSlug('')).toBe(false);
  });
});

describe('tenantSchema', () => {
  it("slug → 'tenant_' prefix", () => {
    expect(tenantSchema('talas')).toBe('tenant_talas');
    expect(tenantSchema('melikgazi')).toBe('tenant_melikgazi');
  });
});

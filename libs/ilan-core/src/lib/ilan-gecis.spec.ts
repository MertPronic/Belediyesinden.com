import { describe, it, expect } from 'vitest';
import { IlanDurumu } from '@belediyesinden/shared';
import { ilanGecisGecerliMi } from './ilan-gecis';

describe('ilanGecisGecerliMi', () => {
  it('TASLAK → YAYINDA geçerli', () => {
    expect(ilanGecisGecerliMi(IlanDurumu.Taslak, IlanDurumu.Yayinda)).toBe(true);
  });

  it('TASLAK → IPTAL geçerli', () => {
    expect(ilanGecisGecerliMi(IlanDurumu.Taslak, IlanDurumu.Iptal)).toBe(true);
  });

  it('YAYINDA → CANLI_ARTIRMA geçerli', () => {
    expect(ilanGecisGecerliMi(IlanDurumu.Yayinda, IlanDurumu.CanliArtirma)).toBe(true);
  });

  it('YAYINDA → IPTAL geçerli', () => {
    expect(ilanGecisGecerliMi(IlanDurumu.Yayinda, IlanDurumu.Iptal)).toBe(true);
  });

  it('CANLI_ARTIRMA → SONUCLANDI geçerli', () => {
    expect(ilanGecisGecerliMi(IlanDurumu.CanliArtirma, IlanDurumu.Sonuclandi)).toBe(true);
  });

  it('CANLI_ARTIRMA → IPTAL geçerli', () => {
    expect(ilanGecisGecerliMi(IlanDurumu.CanliArtirma, IlanDurumu.Iptal)).toBe(true);
  });

  it('SONUCLANDI uç durumdur — hiçbir yere geçilemez', () => {
    expect(ilanGecisGecerliMi(IlanDurumu.Sonuclandi, IlanDurumu.Taslak)).toBe(false);
    expect(ilanGecisGecerliMi(IlanDurumu.Sonuclandi, IlanDurumu.Yayinda)).toBe(false);
    expect(ilanGecisGecerliMi(IlanDurumu.Sonuclandi, IlanDurumu.Iptal)).toBe(false);
  });

  it('IPTAL uç durumdur — hiçbir yere geçilemez', () => {
    expect(ilanGecisGecerliMi(IlanDurumu.Iptal, IlanDurumu.Taslak)).toBe(false);
    expect(ilanGecisGecerliMi(IlanDurumu.Iptal, IlanDurumu.CanliArtirma)).toBe(false);
  });

  it('adım atlayan geçiş reddedilir (TASLAK → SONUCLANDI)', () => {
    expect(ilanGecisGecerliMi(IlanDurumu.Taslak, IlanDurumu.Sonuclandi)).toBe(false);
  });

  it('adım atlayan geçiş reddedilir (TASLAK → CANLI_ARTIRMA)', () => {
    expect(ilanGecisGecerliMi(IlanDurumu.Taslak, IlanDurumu.CanliArtirma)).toBe(false);
  });

  it('geriye geçiş reddedilir (YAYINDA → TASLAK)', () => {
    expect(ilanGecisGecerliMi(IlanDurumu.Yayinda, IlanDurumu.Taslak)).toBe(false);
  });

  it('aynı duruma "geçiş" reddedilir (zaten YAYINDA iken YAYINDA)', () => {
    expect(ilanGecisGecerliMi(IlanDurumu.Yayinda, IlanDurumu.Yayinda)).toBe(false);
  });
});

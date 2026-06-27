/**
 * Dış entegrasyon sağlayıcı arayüzleri (stub/spike).
 *
 * Gerçek sağlayıcı bağlanana kadar bu arayüzler tanımlar. Üretimde
 * somut implementasyonlar (örn. Garanti VPOS, KamuSM e-imza, e-Devlet
 * gateway) bu arayüzleri gerçekleştirip DI ile enjekte edilir.
 */

// ---- Teminat (banka/POS) ----

export interface TeminatProvider {
  /** Teminat tutarını bloke et (gerçek banka provizyonu). */
  blokeEkle(hesapId: string, tutar: number): Promise<{ provizyonId: string }>;
  /** Blokeyi çöz ve iade et. */
  iadeEt(provizyonId: string): Promise<{ iadeTarihi: Date }>;
  /** Bloke durumunu sorgula. */
  durumSorgula(provizyonId: string): Promise<{ durum: 'BLOKE' | 'IADE' | 'HATA' }>;
}

/** Stub: gerçek banka yerine simülasyon (mevcut sistem). */
export class StubTeminatProvider implements TeminatProvider {
  async blokeEkle(_hesapId: string, _tutar: number) {
    return { provizyonId: `stub_${Date.now()}` };
  }
  async iadeEt(_provizyonId: string) {
    return { iadeTarihi: new Date() };
  }
  async durumSorgula(_provizyonId: string) {
    return { durum: 'BLOKE' as const };
  }
}

// ---- e-İmza ----

export interface EImzaProvider {
  /** Belgeyi elektronik imzala (mali mühür / e-imza). */
  imzala(veri: Buffer, sertifikaId: string): Promise<{ imzaliHash: string; imzaZamani: Date }>;
  /** İmza doğrula. */
  dogrula(imzaliVeri: Buffer): Promise<{ gecerli: boolean; imzalayan: string | null }>;
}

/** Stub: gerçek e-imza (KamuSM/mobil imza) yerine hash placeholder. */
export class StubEImzaProvider implements EImzaProvider {
  async imzala(veri: Buffer, _sertifikaId: string) {
    const { createHash } = await import('node:crypto');
    return {
      imzaliHash: createHash('sha256').update(veri).digest('hex'),
      imzaZamani: new Date(),
    };
  }
  async dogrula(_imzaliVeri: Buffer) {
    return { gecerli: true, imzalayan: 'STUB' };
  }
}

// ---- e-Devlet (kimlik doğrulama) ----

export interface EDevletProvider {
  /** e-Devlet üzerinden T.C. kimlik doğrula (SAML/OAuth). */
  dogrula(tcKimlikNo: string): Promise<{ dogrulandi: boolean; ad?: string; soyad?: string }>;
}

/** Stub: gerçek e-Devlet gateway yerine her zaman "dogrulandi". */
export class StubEDevletProvider implements EDevletProvider {
  async dogrula(_tcKimlikNo: string) {
    return { dogrulandi: true };
  }
}

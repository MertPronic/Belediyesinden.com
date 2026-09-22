import type { IlanKartiData } from '@belediyesinden/ui';

/**
 * "Son Gezdiklerin" — localStorage tabanlı, girişten bağımsız gezinti geçmişi.
 * Çıkış yapılsa/tarayıcı kapatılsa bile `SAKLAMA_GUN` süresince kalır (Harun/PO,
 * 2026-09-22). Kullanıcı bazlı DB kaydı (ilan_id + kullanici_id) ayrı, sonraki
 * bir adımda ele alınacak — bu sadece anonim/cihaz bazlı geçmiş.
 */

const ANAHTAR = 'belediyesinden:son-gezilenler';
const SAKLAMA_GUN = 30;
const MAKS_KAYIT = 20;

export interface SonGezilenIlan extends IlanKartiData {
  tenantSlug: string;
  gezilmeTarihi: string;
}

function suresiGecmisMi(gezilmeTarihi: string): boolean {
  const gecenGun = (Date.now() - new Date(gezilmeTarihi).getTime()) / (1000 * 60 * 60 * 24);
  return gecenGun > SAKLAMA_GUN;
}

function oku(): SonGezilenIlan[] {
  try {
    const ham = localStorage.getItem(ANAHTAR);
    if (!ham) return [];
    const liste = JSON.parse(ham) as SonGezilenIlan[];
    return Array.isArray(liste) ? liste.filter((k) => !suresiGecmisMi(k.gezilmeTarihi)) : [];
  } catch {
    return [];
  }
}

function yaz(liste: SonGezilenIlan[]): void {
  try {
    localStorage.setItem(ANAHTAR, JSON.stringify(liste.slice(0, MAKS_KAYIT)));
  } catch {
    /* localStorage dolu/erişilemez — sessizce yoksay, kritik bir işlev değil */
  }
}

/** Bir ilan görüntülenince en başa eklenir (zaten varsa öne taşınır). */
export function sonGezilenEkle(tenantSlug: string, ilan: IlanKartiData): void {
  const guncel = oku().filter((k) => k.id !== ilan.id);
  guncel.unshift({ ...ilan, tenantSlug, gezilmeTarihi: new Date().toISOString() });
  yaz(guncel);
}

/** Süresi geçmemiş son gezilenleri döner — `haricTutulacakId` varsa (mevcut ilan) listeden çıkarılır. */
export function sonGezilenleriGetir(haricTutulacakId?: string): SonGezilenIlan[] {
  const liste = oku();
  return haricTutulacakId ? liste.filter((k) => k.id !== haricTutulacakId) : liste;
}

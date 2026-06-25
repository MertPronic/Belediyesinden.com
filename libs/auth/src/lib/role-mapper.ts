import { KullaniciRolu } from '@belediyesinden/shared';

/** Keycloak realm rol adı → KullaniciRolu enum eşlemesi (realm-export'taki rollerle birebir). */
const REALM_ROLE_TO_ENUM: Record<string, KullaniciRolu> = {
  SUPERADMIN: KullaniciRolu.Superadmin,
  TENANT_ADMIN: KullaniciRolu.TenantAdmin,
  ENCUMEN: KullaniciRolu.Encumen,
  VATANDAS: KullaniciRolu.Vatandas,
  YATIRIMCI: KullaniciRolu.Yatirimci,
};

/** Keycloak realm rollerini KullaniciRolu enum dizisine çevirir (tanınmayanları atlar). */
export function mapRealmRoles(roles: string[]): KullaniciRolu[] {
  const mapped: KullaniciRolu[] = [];
  for (const r of roles) {
    const e = REALM_ROLE_TO_ENUM[r];
    if (e && !mapped.includes(e)) {
      mapped.push(e);
    }
  }
  return mapped;
}

/** Kullanıcının belirli bir role sahip olup olmadığını kontrol eder. */
export function hasRole(roles: KullaniciRolu[], required: KullaniciRolu): boolean {
  return roles.includes(required);
}

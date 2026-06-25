import type { KullaniciRolu } from '@belediyesinden/shared';
import { mapRealmRoles } from './role-mapper';

/**
 * Doğrulanmış Keycloak kullanıcısının normalize edilmiş hali.
 * nest-keycloak-connect'in req üzerinde bıraktığı token içeriğinden çıkarılır.
 */
export interface AuthenticatedUser {
  /** Keycloak kullanıcı kimliği (sub claim). */
  sub: string;
  email: string | null;
  preferredUsername: string | null;
  ad: string | null;
  soyad: string | null;
  /** Realm rolleri → KullaniciRolu eşlemesi. */
  roles: KullaniciRolu[];
  /** tenant_id claim (kullanıcının bağlı olduğu belediye). */
  tenantId: string | null;
}

/** Keycloak access token içeriği (ilgili alanlar). */
interface KeycloakTokenContent {
  sub?: string;
  email?: string;
  preferred_username?: string;
  given_name?: string;
  family_name?: string;
  realm_access?: { roles?: string[] };
  tenant_id?: string;
  /** Group-membership mapper'ın koyduğu tenant grupları (örn. ["tenant_talas"]). */
  tenant_groups?: string[];
  groups?: string[];
}

/**
 * İstek üstündeki doğrulanmış kullanıcıyı çıkarır.
 * nest-keycloak-connect token'ı `req.kauth.grant.access_token.content` altında bırakır.
 * Doğrulanmamış/public isteklerde `null` döner.
 */
export function extractUser(req: unknown): AuthenticatedUser | null {
  const kauth = (req as { kauth?: { grant?: { access_token?: { content?: KeycloakTokenContent } } } }).kauth;
  const token = kauth?.grant?.access_token?.content;
  if (!token?.sub) {
    return null;
  }
  const realmRoles = token.realm_access?.roles ?? [];
  // tenant kimliği: tenant_<slug> grubundan türe (group-membership mapper); attribute fallback.
  const groups = token.tenant_groups ?? token.groups ?? [];
  const tenantGroup = groups.find((g) => g.startsWith('tenant_'));
  return {
    sub: token.sub,
    email: token.email ?? null,
    preferredUsername: token.preferred_username ?? null,
    ad: token.given_name ?? null,
    soyad: token.family_name ?? null,
    roles: mapRealmRoles(realmRoles),
    tenantId: tenantGroup ? tenantGroup.slice('tenant_'.length) : (token.tenant_id ?? null),
  };
}

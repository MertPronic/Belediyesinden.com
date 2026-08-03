import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import KcAdminClient from '@keycloak/keycloak-admin-client';

export interface KeycloakAdminConfig {
  baseUrl: string; // örn. http://localhost:8080
  targetRealm: string; // operasyonların hedef realm'i (belediyesinden)
  /** Master realm'de admin girişi (admin-cli, direct access). */
  adminClientId: string; // admin-cli
  adminUsername: string; // admin
  adminPassword: string;
  /** Yeni tenant redirect URI şablonu — `{slug}` yer tutucusu değiştirilir (bkz. TENANT_WEB_REDIRECT_TEMPLATE). */
  redirectUriTemplate: string;
}

/**
 * Keycloak Admin REST API istemcisi — tenant provisioning (F1-PR3) için.
 *
 * Akış: master realm'de admin-cli ile password grant doğrulaması, sonra
 * `targetRealm`'e (belediyesinden) geçilir; grup/kullanıcı/mapper orada yönetilir.
 *
 * Tenant modeli: her tenant → `tenant_<slug>` grubu; kullanıcıya `tenant_id`
 * attribute'u + grup üyeliği verilir; `tenant_id` User-Attribute protocol mapper
 * token claim olarak yayınlanır (TenantGuard JWT'den okur).
 */
@Injectable()
export class KeycloakAdminService implements OnModuleInit {
  private readonly client = new KcAdminClient({ baseUrl: 'http://localhost:8080', realmName: 'master' });
  private readonly logger = new Logger(KeycloakAdminService.name);
  private config: KeycloakAdminConfig | null = null;

  /** Ortam değişkenlerinden kendini yapılandırır (bkz. infra/docker-compose.yml → api servisi). */
  onModuleInit(): void {
    this.configure({
      baseUrl: process.env['KEYCLOAK_ADMIN_BASE_URL'] ?? 'http://localhost:8080',
      targetRealm: process.env['KEYCLOAK_ADMIN_TARGET_REALM'] ?? 'belediyesinden',
      adminClientId: process.env['KEYCLOAK_ADMIN_CLIENT_ID'] ?? 'admin-cli',
      adminUsername: process.env['KEYCLOAK_ADMIN_USER'] ?? 'admin',
      adminPassword: process.env['KEYCLOAK_ADMIN_PASSWORD'] ?? 'admin',
      redirectUriTemplate: process.env['TENANT_WEB_REDIRECT_TEMPLATE'] ?? 'http://{slug}.localhost:4200/*',
    });
  }

  configure(config: KeycloakAdminConfig): void {
    this.config = config;
  }

  /**
   * Her çağrıda taze token alır (cache YOK). Bu servis nadiren, kısa ömürlü
   * admin işlemleri için (provisioning) çağrılır — önceki sürüm token'ı
   * process ömrü boyunca cache'liyordu, bu da uzun süre ayakta kalan
   * container'larda "refresh token has expired" hatasıyla sonuçlanıyordu.
   */
  private async ensureAuth(): Promise<void> {
    if (!this.config) {
      throw new Error('KeycloakAdminService configure() çağrılmamış');
    }
    // Master realm'de admin-cli ile doğrula.
    this.client.setConfig({ baseUrl: this.config.baseUrl, realmName: 'master' });
    await this.client.auth({
      username: this.config.adminUsername,
      password: this.config.adminPassword,
      grantType: 'password',
      clientId: this.config.adminClientId,
    });
    // Operasyonlar için hedef realm'e geç.
    this.client.setConfig({ realmName: this.config.targetRealm });
  }

  /** `tenant_<slug>` grubunu oluşturur (varsa id'sini döner). */
  async ensureTenantGroup(slug: string): Promise<string | null> {
    await this.ensureAuth();
    const name = `tenant_${slug}`;
    const groups = await this.client.groups.find({ search: name });
    const existing = groups.find((g) => g.name === name);
    if (existing?.id) {
      return existing.id;
    }
    const created = (await this.client.groups.create({ name })) as { id?: string };
    return created.id ?? null;
  }

  /**
   * Yeni tenant'ın subdomain'ini client'ın redirect URI / web origin allowlist'ine ekler.
   * İdempotent. Keycloak redirect URI'de subdomain'i wildcard'layamadığı için (yalnızca
   * sondaki `/*` desteklenir), her tenant'ın URI'si tek tek eklenmek zorunda — bu olmadan
   * yeni belediye login flow'una hiç giremez (redirect_uri invalid hatası).
   */
  async ensureTenantRedirectUri(clientId: string, slug: string): Promise<void> {
    await this.ensureAuth();
    if (!this.config) {
      throw new Error('KeycloakAdminService configure() çağrılmamış');
    }
    const uri = this.config.redirectUriTemplate.replace('{slug}', slug);
    const origin = uri.replace(/\/\*$/, '');

    const clients = await this.client.clients.find({ clientId });
    const kcClient = clients.find((c) => c.clientId === clientId);
    if (!kcClient?.id) {
      throw new Error(`Keycloak client bulunamadı: ${clientId}`);
    }
    const redirectUris = new Set(kcClient.redirectUris ?? []);
    const webOrigins = new Set(kcClient.webOrigins ?? []);
    if (redirectUris.has(uri) && webOrigins.has(origin)) {
      return; // zaten ekli
    }
    redirectUris.add(uri);
    webOrigins.add(origin);
    await this.client.clients.update(
      { id: kcClient.id },
      { redirectUris: [...redirectUris], webOrigins: [...webOrigins] },
    );
    this.logger.log(`Redirect URI eklendi: ${uri} (client=${clientId})`);
  }

  /**
   * Belirli bir client'a `tenant_groups` (Group Membership → claim) protocol mapper ekler.
   * İdempotent. Token'da kullanıcının grupları (`tenant_<slug>`) görünür; tenant kimliği
   * bunlardan türetilir.
   *
   * Not: User Attribute (tenant_id) mapper'ı da denendi ama Keycloak 26 admin API ile
   * kullanıcı attribute'u kalıcı olmuyor (sessizce yok sayılıyor). Grup üyeliği güvenilir
   * şekilde kalıcı olduğu için tenant kimliği için grup-tabanlı claim kullanıyoruz.
   */
  async ensureTenantGroupClaim(clientId: string): Promise<void> {
    await this.ensureAuth();
    const clients = await this.client.clients.find({ clientId });
    const kcClient = clients.find((c) => c.clientId === clientId);
    if (!kcClient?.id) {
      throw new Error(`Keycloak client bulunamadı: ${clientId}`);
    }
    const mappers = await this.client.clients.listProtocolMappers({ id: kcClient.id });
    if (mappers.some((m) => m.name === 'tenant_groups')) {
      return; // zaten var
    }
    await this.client.clients.addProtocolMapper(
      { id: kcClient.id },
      {
        protocol: 'openid-connect',
        protocolMapper: 'oidc-group-membership-mapper',
        name: 'tenant_groups',
        config: {
          'claim.name': 'tenant_groups',
          'full.path': 'false',
          'id.token.claim': 'true',
          'access.token.claim': 'true',
          'userinfo.token.claim': 'true',
        },
      },
    );
    this.logger.log(`tenant_groups mapper eklendi (client=${clientId})`);
  }

  /**
   * Tenant admin test kullanıcısı oluşturur (idempotent + sağlam):
   *   - mevcut kullanıcıyı sil (bozuksa), temiz create
   *   - tenant_id attribute'unu non-destructive set (create bazen kalıcı yapmaz;
   *     `users.update` kısmi veriyle yıkıcı olduğu için tam temsili alıp attributes ile güncelle)
   *   - tenant grubuna ata + TENANT_ADMIN realm rolü ver
   */
  async createTenantUser(opts: {
    username: string;
    email: string;
    firstName: string;
    lastName: string;
    tenantSlug: string;
    password: string;
  }): Promise<void> {
    await this.ensureAuth();
    const groupId = await this.ensureTenantGroup(opts.tenantSlug);
    const realmRole = await this.client.roles.findOneByName({ name: 'TENANT_ADMIN' }).catch(() => undefined);

    // Eski/bozuk kullanıcıyı temizle (idempotent yeniden oluşturma).
    const found = await this.client.users.find({ username: opts.username, exact: true });
    const existing = found.find((u) => u.username === opts.username);
    if (existing?.id) {
      await this.client.users.del({ id: existing.id });
    }

    const created = (await this.client.users.create({
      username: opts.username,
      email: opts.email,
      firstName: opts.firstName,
      lastName: opts.lastName,
      enabled: true,
      credentials: [{ type: 'password', value: opts.password, temporary: false }],
    })) as { id?: string };
    const userId = created.id;
    if (!userId) {
      throw new Error('Kullanıcı id alınamadı');
    }

    // tenant kimliği için kullanıcının tenant_<slug> grubu yeterli (group-membership
    // mapper token'a "tenant_groups" claim koyar). Kullanıcı attribute'u Keycloak 26
    // admin API ile kalıcı olmadığı için attribute kullanılmıyor.
    if (groupId) {
      await this.client.users.addToGroup({ id: userId, groupId });
    }
    if (realmRole?.id) {
      await this.client.users.addRealmRoleMappings({
        id: userId,
        roles: [{ id: realmRole.id, name: 'TENANT_ADMIN' }],
      });
    }
    this.logger.log(`Kullanıcı hazır: ${opts.username} (tenant=${opts.tenantSlug}, role=TENANT_ADMIN)`);
  }
}

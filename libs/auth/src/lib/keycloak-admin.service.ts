import { Injectable, Logger } from '@nestjs/common';
import KcAdminClient from '@keycloak/keycloak-admin-client';

export interface KeycloakAdminConfig {
  baseUrl: string; // örn. http://localhost:8080
  realmName: string; // hedef realm (belediyesinden)
  adminClientId: string; // admin-cli veya service-account client
  adminClientSecret?: string; // client_credentials için
  username?: string; // password grant için
  password?: string; // password grant için
  grantType: 'password' | 'client_credentials';
}

/**
 * Keycloak Admin REST API istemcisi — tenant provisioning (F1-PR3) için.
 * Her tenant için bir grup (`tenant_<slug>`) oluşturur; kullanıcıları gruba atayarak
 * `tenant_id` protocol mapper ile token claim'i elde edilir.
 *
 * Not: Keycloak 26'da admin-cli "direct access grants" varsayılan kapalı olabilir;
 * üretimde service-account (client_credentials) önerilir. Yapılandırma `configure()` ile.
 */
@Injectable()
export class KeycloakAdminService {
  private readonly client = new KcAdminClient({ baseUrl: 'http://localhost:8080', realmName: 'master' });
  private readonly logger = new Logger(KeycloakAdminService.name);
  private authed = false;
  private config: KeycloakAdminConfig | null = null;

  configure(config: KeycloakAdminConfig): void {
    this.config = config;
    this.client.setConfig({ baseUrl: config.baseUrl, realmName: config.realmName });
  }

  private async ensureAuth(): Promise<void> {
    if (!this.config) {
      throw new Error('KeycloakAdminService configure() çağrılmamış');
    }
    if (this.authed) return;
    const cfg = this.config;
    if (cfg.grantType === 'password') {
      await this.client.auth({
        username: cfg.username ?? '',
        password: cfg.password ?? '',
        grantType: 'password',
        clientId: cfg.adminClientId,
      });
    } else {
      await this.client.auth({
        grantType: 'client_credentials',
        clientId: cfg.adminClientId,
        clientSecret: cfg.adminClientSecret ?? '',
      });
    }
    this.authed = true;
    this.logger.log(`Keycloak admin baglantisi kuruldu (realm=${cfg.realmName})`);
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

  /** Kullanıcıyı tenant grubuna atar (F1-PR3 provisioning'te test kullanıcısı için). */
  async assignUserToTenantGroup(username: string, slug: string): Promise<void> {
    await this.ensureAuth();
    const users = await this.client.users.find({ username, exact: true });
    const user = users.find((u) => u.username === username);
    if (!user?.id) {
      throw new Error(`Keycloak kullanıcısı bulunamadı: ${username}`);
    }
    const groups = await this.client.groups.find({ search: `tenant_${slug}` });
    const group = groups.find((g) => g.name === `tenant_${slug}`);
    if (!group?.id) {
      throw new Error(`Keycloak grubu bulunamadı: tenant_${slug}`);
    }
    await this.client.users.addToGroup({ id: user.id, groupId: group.id });
  }
}

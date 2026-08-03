import { randomBytes } from 'node:crypto';
import { Body, Controller, Get, Post } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { KeycloakAdminService, Roller } from '@belediyesinden/auth';
import { KullaniciRolu } from '@belediyesinden/shared';
import { provisionTenant, tenantSchema } from '@belediyesinden/tenancy';
import { Tenant } from '@belediyesinden/db';

class ProvisionTenantDto {
  @IsString() @MinLength(3) @MaxLength(40)
  slug!: string;

  @IsString() @MaxLength(100)
  ad!: string;

  @IsString() @MaxLength(50)
  adminUsername!: string;

  @IsEmail()
  adminEmail!: string;

  @IsString() @MaxLength(50)
  adminAd!: string;

  @IsString() @MaxLength(50)
  adminSoyad!: string;
}

/** Kullanıcıya iletilecek, okunması kolay rastgele geçici şifre (12 karakter). */
function geciciSifreUret(): string {
  return randomBytes(9).toString('base64url');
}

/**
 * Tenant yönetim endpoint — `/api/tenants` (Superadmin).
 * Self-servis tenant provisioning (schema + tema + kural seed).
 */
@Roller(KullaniciRolu.Superadmin)
@Controller('tenants')
export class TenantProvisioningController {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly keycloakAdmin: KeycloakAdminService,
  ) {}

  /** Tüm tenant'ları listele. */
  @Get()
  list() {
    return this.ds.getRepository(Tenant).find({ order: { slug: 'ASC' } });
  }

  /**
   * Yeni tenant provision et: schema + kural seed (DB) + Keycloak tarafında
   * `tenant_<slug>` grubu + ilk TENANT_ADMIN kullanıcısı. Şifre yalnızca bu
   * yanıtta bir kereliğine döner — superadmin belediyeye iletir.
   */
  @Post()
  async provision(@Body() dto: ProvisionTenantDto) {
    const tenant = await provisionTenant(dto.slug, dto.ad, this.ds);

    await this.keycloakAdmin.ensureTenantGroup(dto.slug);
    await this.keycloakAdmin.ensureTenantGroupClaim('tenant-web');
    await this.keycloakAdmin.ensureTenantRedirectUri('tenant-web', dto.slug);
    const password = geciciSifreUret();
    await this.keycloakAdmin.createTenantUser({
      username: dto.adminUsername,
      email: dto.adminEmail,
      firstName: dto.adminAd,
      lastName: dto.adminSoyad,
      tenantSlug: dto.slug,
      password,
    });

    return {
      slug: tenant.slug,
      ad: tenant.ad,
      durum: tenant.durum,
      schema: tenantSchema(tenant.slug),
      tema: tenant.temaConfig,
      ilkYonetici: { username: dto.adminUsername, password },
    };
  }
}

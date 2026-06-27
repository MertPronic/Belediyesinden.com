import { Body, Controller, Get, Post } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { Roller } from '@belediyesinden/auth';
import { KullaniciRolu } from '@belediyesinden/shared';
import { provisionTenant, tenantSchema } from '@belediyesinden/tenancy';
import { Tenant } from '@belediyesinden/db';

class ProvisionTenantDto {
  @IsString() @MinLength(3) @MaxLength(40)
  slug!: string;

  @IsString() @MaxLength(100)
  ad!: string;
}

/**
 * Tenant yönetim endpoint — `/api/tenants` (Superadmin).
 * Self-servis tenant provisioning (schema + tema + kural seed).
 */
@Roller(KullaniciRolu.Superadmin)
@Controller('tenants')
export class TenantProvisioningController {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  /** Tüm tenant'ları listele. */
  @Get()
  list() {
    return this.ds.getRepository(Tenant).find({ order: { slug: 'ASC' } });
  }

  /** Yeni tenant provision et (schema + config + Keycloak grubu). */
  @Post()
  async provision(@Body() dto: ProvisionTenantDto) {
    const tenant = await provisionTenant(dto.slug, dto.ad, this.ds);
    return {
      slug: tenant.slug,
      ad: tenant.ad,
      durum: tenant.durum,
      schema: tenantSchema(tenant.slug),
      tema: tenant.temaConfig,
    };
  }
}

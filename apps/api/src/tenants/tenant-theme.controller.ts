import { Controller, Get, Req } from '@nestjs/common';
import { Unprotected } from 'nest-keycloak-connect';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Tenant } from '@belediyesinden/db';
import { resolveTenantSlugFromHeaders } from '@belediyesinden/tenancy';

export interface TenantThemeDto {
  slug: string;
  ad: string;
  tema: Record<string, unknown> | null;
}

/** Merkezi portal için varsayılan tema. */
const CENTRAL_THEME: TenantThemeDto = {
  slug: '',
  ad: 'Belediyesinden',
  tema: { renk: '#2563eb', siteName: 'Belediyesinden' },
};

/**
 * Tenant tema endpoint'i — herkese açık (auth'suz). Subdomain / x-tenant-slug'dan
 * tenant'ı çözüp ad + tema (renk, site adı) döner. Frontend (tenant-web) bunu
 * server-side fetch edip CSS değişkenleri/marka olarak uygular.
 */
@Controller('tenants')
export class TenantThemeController {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  @Get('current')
  @Unprotected()
  async current(
    @Req() req: { headers: Record<string, string | string[] | undefined> },
  ): Promise<TenantThemeDto> {
    const slug = resolveTenantSlugFromHeaders(req.headers);
    if (!slug) {
      return CENTRAL_THEME;
    }
    const tenant = await this.ds.getRepository(Tenant).findOne({ where: { slug } });
    if (!tenant) {
      return CENTRAL_THEME;
    }
    return { slug: tenant.slug, ad: tenant.ad, tema: tenant.temaConfig };
  }
}

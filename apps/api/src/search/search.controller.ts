import { Controller, Get, Query } from '@nestjs/common';
import { getCurrentTenant } from '@belediyesinden/tenancy';
import { CurrentUser, Unprotected, type AuthenticatedUser } from '@belediyesinden/auth';
import { KullaniciRolu } from '@belediyesinden/shared';
import { OpenSearchService } from './opensearch.service';

const PERSONEL_ROLLERI = new Set<string>([
  KullaniciRolu.TenantAdmin,
  KullaniciRolu.Encumen,
  KullaniciRolu.Superadmin,
]);

/** `/api/search/ilan` — ilan arama (tenant-filtreli, OpenSearch, public). */
@Controller('search')
export class SearchController {
  constructor(private readonly os: OpenSearchService) {}

  @Unprotected(false)
  @Get('ilan')
  async ilanAra(
    @Query('q') q: string | undefined,
    @Query('tip') tip: string | undefined,
    @CurrentUser() user: AuthenticatedUser | null,
  ) {
    const tenant = getCurrentTenant();
    const slug = tenant?.slug ?? 'central';
    const isPersonel = !!user?.roles?.some((r) => PERSONEL_ROLLERI.has(r));
    return this.os.searchIlan(slug, q ?? '', tip, isPersonel);
  }
}

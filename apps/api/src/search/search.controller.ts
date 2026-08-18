import { Controller, Get, Query } from '@nestjs/common';
import { getCurrentTenant } from '@belediyesinden/tenancy';
import { CurrentUser, Unprotected, type AuthenticatedUser } from '@belediyesinden/auth';
import { KullaniciRolu } from '@belediyesinden/shared';
import { sayfalamaCoz } from '@belediyesinden/db';
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
    @Query('il') il: string | undefined,
    @Query('ilce') ilce: string | undefined,
    @Query('page') page: string | undefined,
    @Query('pageSize') pageSize: string | undefined,
    @CurrentUser() user: AuthenticatedUser | null,
  ) {
    const tenant = getCurrentTenant();
    const slug = tenant?.slug ?? 'central';
    const isPersonel = !!user?.roles?.some((r) => PERSONEL_ROLLERI.has(r));
    const { limit, offset } = sayfalamaCoz({ page, pageSize });
    return this.os.searchIlan(slug, q ?? '', tip, isPersonel, il, ilce, limit, offset);
  }

  /** İl (ve seçiliyse ilçe) filtre seçenekleri — gerçek ilan verisinden türetilir. */
  @Unprotected(false)
  @Get('lokasyonlar')
  async lokasyonlar(@Query('il') il: string | undefined) {
    const tenant = getCurrentTenant();
    const slug = tenant?.slug ?? 'central';
    return this.os.aggLokasyonlar(slug, il);
  }
}

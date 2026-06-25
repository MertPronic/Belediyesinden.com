import { Controller, Get, Query } from '@nestjs/common';
import { getCurrentTenant } from '@belediyesinden/tenancy';
import { OpenSearchService } from './opensearch.service';

/** `/api/search/ilan` — ilan arama (tenant-filtreli, OpenSearch). */
@Controller('search')
export class SearchController {
  constructor(private readonly os: OpenSearchService) {}

  @Get('ilan')
  async ilanAra(@Query('q') q?: string, @Query('tip') tip?: string) {
    const tenant = getCurrentTenant();
    const slug = tenant?.slug ?? 'central';
    return this.os.searchIlan(slug, q ?? '', tip);
  }
}

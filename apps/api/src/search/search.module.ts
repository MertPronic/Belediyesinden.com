import { Global, Module } from '@nestjs/common';
import { OpenSearchService } from './opensearch.service';
import { SearchController } from './search.controller';

/** OpenSearch arama modülü (global — IlanService indeksleme için kullanır). */
@Global()
@Module({
  controllers: [SearchController],
  providers: [OpenSearchService],
  exports: [OpenSearchService],
})
export class SearchModule {}

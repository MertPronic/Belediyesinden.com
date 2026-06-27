import { Controller, Get } from '@nestjs/common';
import { RaporService } from './rapor.service';

/** Raporlama endpoint — `/api/rapor`. Tenant dashboard. */
@Controller('rapor')
export class RaporController {
  constructor(private readonly service: RaporService) {}

  /** Tenant özet raporu (ilan/teklif/başvuru/varlık sayıları). */
  @Get('ozet')
  ozet() {
    return this.service.ozet();
  }
}

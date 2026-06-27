import { Controller, Get } from '@nestjs/common';
import { Roller } from '@belediyesinden/auth';
import { KullaniciRolu } from '@belediyesinden/shared';
import { RaporService } from './rapor.service';

/** Raporlama endpoint — `/api/rapor`. Tenant dashboard (admin/encümen). */
@Roller(KullaniciRolu.TenantAdmin, KullaniciRolu.Encumen)
@Controller('rapor')
export class RaporController {
  constructor(private readonly service: RaporService) {}

  /** Tenant özet raporu (ilan/teklif/başvuru/varlık sayıları). */
  @Get('ozet')
  ozet() {
    return this.service.ozet();
  }
}

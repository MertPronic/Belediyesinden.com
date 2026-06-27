import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser, type AuthenticatedUser } from '@belediyesinden/auth';
import { TeklifService } from './teklif.service';

class SubmitTeklifDto {
  tutar!: number;
}

/** Teklif endpoint — `/api/teklif`. Katılımcı teklif verir, encümen listeler. */
@Controller('teklif')
export class TeklifController {
  constructor(private readonly service: TeklifService) {}

  /** Teklif ver (server-authoritative: teklifDogrula + anti-snipping). */
  @Post('ilan/:ilanId')
  submit(
    @Param('ilanId') ilanId: string,
    @CurrentUser() user: AuthenticatedUser | null,
    @Body() dto: SubmitTeklifDto,
  ) {
    if (!user) {
      throw new Error('Kimlik doğrulanmış kullanıcı yok');
    }
    return this.service.submit(ilanId, user.sub, dto.tutar);
  }

  /** İlan'ın tekliflerini listele (en yüksek ilk). */
  @Get('ilan/:ilanId')
  list(@Param('ilanId') ilanId: string) {
    return this.service.list(ilanId);
  }
}

import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { IsNumber, Min } from 'class-validator';
import { CurrentUser, Roller, type AuthenticatedUser } from '@belediyesinden/auth';
import { KullaniciRolu } from '@belediyesinden/shared';
import { TeklifService } from './teklif.service';

class SubmitTeklifDto {
  @IsNumber() @Min(0)
  tutar!: number;
}

/** Teklif endpoint — `/api/teklif`. Katılımcı teklif verir, encümen listeler. */
@Controller('teklif')
export class TeklifController {
  constructor(private readonly service: TeklifService) {}

  /** Teklif ver (server-authoritative: teklifDogrula + anti-snipping). */
  @Roller(KullaniciRolu.Vatandas, KullaniciRolu.Yatirimci)
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

  /** Kullanıcının kendi teklifleri (vatandaş). */
  @Roller(KullaniciRolu.Vatandas, KullaniciRolu.Yatirimci)
  @Get('my')
  listMy(@CurrentUser() user: AuthenticatedUser | null) {
    if (!user) throw new Error('Kimlik doğrulanmış kullanıcı yok');
    return this.service.listMy(user.sub);
  }
}

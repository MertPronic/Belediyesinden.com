import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { IsNumber, Min } from 'class-validator';
import { CurrentUser, Roller, Unprotected, type AuthenticatedUser } from '@belediyesinden/auth';
import { KullaniciRolu } from '@belediyesinden/shared';
import { sayfalamaCoz } from '@belediyesinden/db';
import { TeklifService } from './teklif.service';

class SubmitTeklifDto {
  @IsNumber() @Min(0)
  tutar!: number;
}

/** "Ahmet Yılmaz" → "Ahmet Y." — soyadın tamamı asla paylaşılmaz. */
function maskeliAd(ad: string | null, soyad: string | null): string | null {
  if (!ad) return null;
  return soyad ? `${ad} ${soyad[0]}.` : ad;
}

/** Teklif endpoint — `/api/teklif`. Katılımcı teklif verir, encümen listeler. */
@Controller('teklif')
export class TeklifController {
  constructor(private readonly service: TeklifService) {}

  /** Teklif ver (server-authoritative: teklifDogrula + anti-snipping). */
  @Roller(KullaniciRolu.Vatandas, KullaniciRolu.Yatirimci, KullaniciRolu.TenantAdmin)
  @Post('ilan/:ilanId')
  submit(
    @Param('ilanId') ilanId: string,
    @CurrentUser() user: AuthenticatedUser | null,
    @Body() dto: SubmitTeklifDto,
  ) {
    if (!user) {
      throw new Error('Kimlik doğrulanmış kullanıcı yok');
    }
    return this.service.submit(ilanId, user.sub, dto.tutar, maskeliAd(user.ad, user.soyad));
  }

  /** İlan'ın tekliflerini listele (public — ihale şeffaflığı, sadece tutar). */
  @Unprotected()
  @Get('ilan/:ilanId')
  list(
    @Param('ilanId') ilanId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const { limit, offset } = sayfalamaCoz({ page, pageSize });
    return this.service.list(ilanId, limit, offset);
  }

  /** Kullanıcının kendi teklifleri (vatandaş). */
  @Roller(KullaniciRolu.Vatandas, KullaniciRolu.Yatirimci)
  @Get('my')
  listMy(
    @CurrentUser() user: AuthenticatedUser | null,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    if (!user) throw new Error('Kimlik doğrulanmış kullanıcı yok');
    const { limit, offset } = sayfalamaCoz({ page, pageSize });
    return this.service.listMy(user.sub, limit, offset);
  }
}

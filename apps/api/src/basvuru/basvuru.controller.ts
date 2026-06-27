import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser, Roller, type AuthenticatedUser } from '@belediyesinden/auth';
import { KullaniciRolu } from '@belediyesinden/shared';
import { BasvuruService } from './basvuru.service';

class CreateBasvuruDto {
  kvkkOnay!: boolean;
  acikRiza?: boolean;
}

/**
 * Başvuru endpoint — `/api/basvuru`.
 * Katılımcı (VATANDAS/YATIRIMCI) yayındaki bir ilan'a KVKK onayı ile başvurur.
 */
@Controller('basvuru')
export class BasvuruController {
  constructor(private readonly service: BasvuruService) {}

  /** Bir ilan'a başvur (kullanıcı JWT'sinden sub). */
  @Roller(KullaniciRolu.Vatandas, KullaniciRolu.Yatirimci)
  @Post('ilan/:ilanId')
  create(
    @Param('ilanId') ilanId: string,
    @CurrentUser() user: AuthenticatedUser | null,
    @Body() dto: CreateBasvuruDto,
  ) {
    if (!user) {
      throw new Error('Kimlik doğrulanmış kullanıcı yok');
    }
    return this.service.create(ilanId, user.sub, dto.kvkkOnay, dto.acikRiza ?? false);
  }

  /** Bir ilan'ın başvurularını listele (encümen/admin). */
  @Roller(KullaniciRolu.TenantAdmin, KullaniciRolu.Encumen)
  @Get('ilan/:ilanId')
  list(@Param('ilanId') ilanId: string) {
    return this.service.list(ilanId);
  }
}

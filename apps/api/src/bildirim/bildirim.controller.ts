import { BadRequestException, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser, Roller, type AuthenticatedUser } from '@belediyesinden/auth';
import { KullaniciRolu } from '@belediyesinden/shared';
import { sayfalamaCoz } from '@belediyesinden/db';
import { BildirimService, TENANT_OPS_HEDEF_ROL } from './bildirim.service';

const TENANT_OPS_ROLLERI = [KullaniciRolu.TenantAdmin, KullaniciRolu.Encumen];

/** Kullanıcının rollerinden, hedeflenmiş olabileceği rol-yayın gruplarını çıkarır. */
function hedefGruplar(roles: KullaniciRolu[]): string[] {
  return roles.some((r) => TENANT_OPS_ROLLERI.includes(r)) ? [TENANT_OPS_HEDEF_ROL] : [];
}

const TUM_ROLLER = [
  KullaniciRolu.Vatandas,
  KullaniciRolu.Yatirimci,
  KullaniciRolu.TenantAdmin,
  KullaniciRolu.Encumen,
];

/** Bildirim endpoint — `/api/bildirim`. Herkese açık (login şart), kendi bildirimlerin + rol yayınları. */
@Controller('bildirim')
export class BildirimController {
  constructor(private readonly service: BildirimService) {}

  @Roller(...TUM_ROLLER)
  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser | null,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    if (!user) throw new BadRequestException('Kimlik doğrulanmış kullanıcı yok');
    const { limit, offset } = sayfalamaCoz({ page, pageSize });
    return this.service.list(user.sub, hedefGruplar(user.roles), limit, offset);
  }

  @Roller(...TUM_ROLLER)
  @Get('sayac')
  async sayac(@CurrentUser() user: AuthenticatedUser | null) {
    if (!user) throw new BadRequestException('Kimlik doğrulanmış kullanıcı yok');
    const adet = await this.service.sayac(user.sub, hedefGruplar(user.roles));
    return { adet };
  }

  @Roller(...TUM_ROLLER)
  @Post(':id/okundu')
  okunduIsaretle(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser | null) {
    if (!user) throw new BadRequestException('Kimlik doğrulanmış kullanıcı yok');
    return this.service.okunduIsaretle(id, user.sub, hedefGruplar(user.roles));
  }

  @Roller(...TUM_ROLLER)
  @Post('okundu-hepsi')
  hepsiniOkunduIsaretle(@CurrentUser() user: AuthenticatedUser | null) {
    if (!user) throw new BadRequestException('Kimlik doğrulanmış kullanıcı yok');
    return this.service.hepsiniOkunduIsaretle(user.sub, hedefGruplar(user.roles));
  }
}

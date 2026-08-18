import { BadRequestException, Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { IsBoolean, IsOptional } from 'class-validator';
import { CurrentUser, Roller, type AuthenticatedUser } from '@belediyesinden/auth';
import { KullaniciRolu } from '@belediyesinden/shared';
import { sayfalamaCoz } from '@belediyesinden/db';
import { BasvuruService } from './basvuru.service';

class CreateBasvuruDto {
  @IsBoolean()
  kvkkOnay!: boolean;

  @IsOptional() @IsBoolean()
  acikRiza?: boolean;
}

/**
 * Başvuru endpoint — `/api/basvuru`.
 * Katılımcı (VATANDAS/YATIRIMCI) yayındaki bir ilan'a KVKK onayı ile başvurur.
 */
@Controller('basvuru')
export class BasvuruController {
  constructor(private readonly service: BasvuruService) {}

  /** Bir varlığa (kaleme) başvur (kullanıcı JWT'sinden sub). KK-25: birim ilan değil varlık. */
  @Roller(KullaniciRolu.Vatandas, KullaniciRolu.Yatirimci)
  @Post('kalem/:kalemId')
  create(
    @Param('kalemId') kalemId: string,
    @CurrentUser() user: AuthenticatedUser | null,
    @Body() dto: CreateBasvuruDto,
  ) {
    if (!user) {
      throw new Error('Kimlik doğrulanmış kullanıcı yok');
    }
    return this.service.create(kalemId, user.sub, dto.kvkkOnay, dto.acikRiza ?? false);
  }

  /** Bir varlığın başvurularını listele (encümen/admin). */
  @Roller(KullaniciRolu.TenantAdmin, KullaniciRolu.Encumen)
  @Get('kalem/:kalemId')
  list(
    @Param('kalemId') kalemId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const { limit, offset } = sayfalamaCoz({ page, pageSize });
    return this.service.list(kalemId, limit, offset);
  }

  /** Kullanıcının bu varlığa yaptığı başvuru (varsa) — varlık detay sayfasındaki "Başvur" CTA durumu için. */
  @Roller(KullaniciRolu.Vatandas, KullaniciRolu.Yatirimci)
  @Get('kalem/:kalemId/benim')
  findMyForKalem(@Param('kalemId') kalemId: string, @CurrentUser() user: AuthenticatedUser | null) {
    if (!user) throw new BadRequestException('Kimlik doğrulanmış kullanıcı yok');
    return this.service.findMyForKalem(kalemId, user.sub);
  }

  /** Kullanıcının kendi başvuruları (vatandaş). */
  @Roller(KullaniciRolu.Vatandas, KullaniciRolu.Yatirimci)
  @Get('my')
  listMy(
    @CurrentUser() user: AuthenticatedUser | null,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    if (!user) throw new BadRequestException('Kimlik doğrulanmış kullanıcı yok');
    const { limit, offset } = sayfalamaCoz({ page, pageSize });
    return this.service.listMy(user.sub, limit, offset);
  }

  /** Kullanıcının katılabileceği ihaleler (onaylı başvuru + ilan durumu) — "İhalelerim" sayfası. */
  @Roller(KullaniciRolu.Vatandas, KullaniciRolu.Yatirimci)
  @Get('ihalelerim')
  ihalelerim(@CurrentUser() user: AuthenticatedUser | null) {
    if (!user) throw new BadRequestException('Kimlik doğrulanmış kullanıcı yok');
    return this.service.ihalelerim(user.sub);
  }

  /** Başvuruyu geri çek (vatandaş, kendi başvurusu, onaylanMAMış). */
  @Roller(KullaniciRolu.Vatandas, KullaniciRolu.Yatirimci)
  @Post(':id/withdraw')
  withdraw(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser | null) {
    if (!user) throw new BadRequestException('Kimlik doğrulanmış kullanıcı yok');
    return this.service.withdraw(id, user.sub);
  }

  /** KVKK: açık rızayı geri çek (vatandaş, kendi başvurusu). */
  @Roller(KullaniciRolu.Vatandas, KullaniciRolu.Yatirimci)
  @Post(':id/ruzsa-cek')
  rizaCek(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser | null) {
    if (!user) throw new BadRequestException('Kimlik doğrulanmış kullanıcı yok');
    return this.service.rizaCek(id, user.sub);
  }
}

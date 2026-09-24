import { BadRequestException, Body, Controller, Get, Patch } from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser, Roller, type AuthenticatedUser } from '@belediyesinden/auth';
import { KullaniciRolu } from '@belediyesinden/shared';
import { KullaniciProfiliService } from './kullanici-profili.service';

const TUM_ROLLER = [
  KullaniciRolu.Vatandas,
  KullaniciRolu.Yatirimci,
  KullaniciRolu.TenantAdmin,
  KullaniciRolu.Encumen,
];

class UpdateTelefonDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefon?: string;
}

/** Kullanıcının kendi profili — `/api/kullanici-profili`. Şu an sadece telefon (SMS bildirimleri için). */
@Controller('kullanici-profili')
export class KullaniciProfiliController {
  constructor(private readonly service: KullaniciProfiliService) {}

  @Roller(...TUM_ROLLER)
  @Get('me')
  getir(@CurrentUser() user: AuthenticatedUser | null) {
    if (!user) throw new BadRequestException('Kimlik doğrulanmış kullanıcı yok');
    return this.service.getir(user.sub);
  }

  @Roller(...TUM_ROLLER)
  @Patch('me')
  guncelle(@CurrentUser() user: AuthenticatedUser | null, @Body() dto: UpdateTelefonDto) {
    if (!user) throw new BadRequestException('Kimlik doğrulanmış kullanıcı yok');
    return this.service.telefonGuncelle(user.sub, dto.telefon?.trim() || null);
  }
}

import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { IsEnum, IsNumber, IsOptional, Min } from 'class-validator';
import { CurrentUser, Roller, type AuthenticatedUser } from '@belediyesinden/auth';
import { IhaleTipi, KullaniciRolu } from '@belediyesinden/shared';
import { IlanKurallariService } from './ilan-kurallari.service';

class UpdateIlanKurallariDto {
  @IsOptional() @IsNumber() @Min(0)
  minArtirmaAdimi?: number;

  @IsOptional() @IsNumber()
  teminatOrani?: number;

  @IsOptional() @IsNumber() @Min(0)
  sureUzatmaDakika?: number;

  @IsOptional() @IsNumber() @Min(0)
  minIlanIhaleAraligiGun?: number;

  @IsOptional() @IsNumber() @Min(0)
  minSimdiIlanAraligiGun?: number;
}

class IhaleTipiParam {
  @IsEnum(IhaleTipi)
  ihaleTipi!: IhaleTipi;
}

/** İlan kuralları endpoint — `/api/ilan-kurallari`. Sadece belediye admini düzenler. */
@Controller('ilan-kurallari')
export class IlanKurallariController {
  constructor(private readonly service: IlanKurallariService) {}

  /** Üç ihale tipinin de güncel kurallarını döner. */
  @Roller(KullaniciRolu.TenantAdmin)
  @Get()
  listAll() {
    return this.service.listAll();
  }

  /** Bir ihale tipinin kurallarını kısmi günceller (floor + sınır doğrulamalı). */
  @Roller(KullaniciRolu.TenantAdmin)
  @Patch(':ihaleTipi')
  update(
    @Param() params: IhaleTipiParam,
    @Body() dto: UpdateIlanKurallariDto,
    @CurrentUser() user: AuthenticatedUser | null,
  ) {
    if (!user) {
      throw new Error('Kimlik doğrulanmış kullanıcı yok');
    }
    return this.service.update(params.ihaleTipi, dto, user.sub);
  }
}

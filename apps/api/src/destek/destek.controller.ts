import { BadRequestException, Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { IsEnum, IsString, MaxLength } from 'class-validator';
import { CurrentUser, Roller, type AuthenticatedUser } from '@belediyesinden/auth';
import { DestekKonusu, KullaniciRolu } from '@belediyesinden/shared';
import { DestekService } from './destek.service';

class AcDestekDto {
  @IsEnum(DestekKonusu, { message: 'Geçerli bir konu seçin (Muhasebe/Teknik/Diğer)' })
  konu!: DestekKonusu;

  @IsString() @MaxLength(200, { message: 'Başlık en fazla 200 karakter olabilir' })
  baslik!: string;

  @IsString({ message: 'Mesaj boş olamaz' })
  mesaj!: string;
}

class CevaplaDto {
  @IsString({ message: 'Cevap boş olamaz' })
  cevap!: string;
}

/** Destek talebi — `/api/destek`. Personel açar, süper admin görür/cevaplar. */
@Controller('destek')
export class DestekController {
  constructor(private readonly service: DestekService) {}

  @Roller(KullaniciRolu.TenantAdmin, KullaniciRolu.Encumen)
  @Post()
  ac(@CurrentUser() user: AuthenticatedUser | null, @Body() dto: AcDestekDto) {
    if (!user?.tenantId) throw new BadRequestException('Tenant bağlamı yok');
    return this.service.ac(user.tenantId, user.sub, dto.konu, dto.baslik, dto.mesaj);
  }

  /** Kendi belediyesinin talepleri (personel). :id'den ÖNCE tanımlı. */
  @Roller(KullaniciRolu.TenantAdmin, KullaniciRolu.Encumen)
  @Get('my')
  listMy(@CurrentUser() user: AuthenticatedUser | null) {
    if (!user?.tenantId) throw new BadRequestException('Tenant bağlamı yok');
    return this.service.listMy(user.tenantId);
  }

  /** Süper admin bildirim sayacı. :id'den ÖNCE tanımlı. */
  @Roller(KullaniciRolu.Superadmin)
  @Get('bildirim/sayac')
  async sayac() {
    const adet = await this.service.sayacSuperadmin();
    return { adet };
  }

  /** Süper admin bildirim listesi. :id'den ÖNCE tanımlı. */
  @Roller(KullaniciRolu.Superadmin)
  @Get('bildirim')
  listBildirim() {
    return this.service.listBildirimSuperadmin();
  }

  @Roller(KullaniciRolu.Superadmin)
  @Post('bildirim/:id/okundu')
  bildirimOkundu(@Param('id') id: string) {
    return this.service.bildirimOkunduSuperadmin(id);
  }

  @Roller(KullaniciRolu.Superadmin)
  @Post('bildirim/okundu-hepsi')
  bildirimHepsiOkundu() {
    return this.service.bildirimHepsiOkunduSuperadmin();
  }

  /** Tüm belediyelerin talepleri (süper admin). */
  @Roller(KullaniciRolu.Superadmin)
  @Get()
  listAll(@Query('durum') durum?: string) {
    return this.service.listAll(durum);
  }

  @Roller(KullaniciRolu.Superadmin)
  @Post(':id/cevapla')
  cevapla(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser | null, @Body() dto: CevaplaDto) {
    if (!user) throw new BadRequestException('Kimlik doğrulanmış kullanıcı yok');
    return this.service.cevapla(id, dto.cevap, user.sub);
  }
}

import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { Roller } from '@belediyesinden/auth';
import { KullaniciRolu } from '@belediyesinden/shared';
import { sayfalamaCoz } from '@belediyesinden/db';
import { DuyuruService } from './duyuru.service';

class CreateDuyuruDto {
  baslik!: string;
  icerik?: string;
}

/**
 * Demo tenant-scoped endpoint — `/api/duyuru`.
 * TenantGuard subdomain↔JWT uyumunu, TenancyInterceptor search_path izolasyonunu sağlar.
 * (Rol enforcement — TENANT_ADMIN — ileride özel bir RolesGuard ile eklenecek;
 * nest-keycloak-connect RoleGuard rol çıkarımında sorun çıkarıyor.)
 */
@Roller(KullaniciRolu.TenantAdmin)
@Controller('duyuru')
export class DuyuruController {
  constructor(private readonly service: DuyuruService) {}

  /** Tüm kimliği doğrulanmış tenant kullanıcıları duyuruları listeleyebilir. */
  @Get()
  list(@Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    const { limit, offset } = sayfalamaCoz({ page, pageSize });
    return this.service.list(limit, offset);
  }

  /** Duyuru oluştur (tenant-scoped — aktif tenant'ın şemasına yazar). */
  @Post()
  create(@Body() dto: CreateDuyuruDto) {
    return this.service.create(dto.baslik, dto.icerik ?? null);
  }
}

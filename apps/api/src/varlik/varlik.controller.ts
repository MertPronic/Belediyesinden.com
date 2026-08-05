import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { IsEnum, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { KullaniciRolu, VarlikTipi } from '@belediyesinden/shared';
import { Roller } from '@belediyesinden/auth';
import { sayfalamaCoz } from '@belediyesinden/db';
import { varlikDetayDogrula } from '@belediyesinden/varlik-core';
import { VarlikService } from './varlik.service';

class CreateVarlikDto {
  @IsEnum(VarlikTipi)
  tip!: VarlikTipi;

  @IsString() @MaxLength(200)
  ad!: string;

  @IsOptional() @IsString()
  aciklama?: string;

  @IsOptional() @IsObject()
  detay?: Record<string, unknown>;
}

class UpdateVarlikDto {
  @IsOptional() @IsString() @MaxLength(200)
  ad?: string;

  @IsOptional() @IsString()
  aciklama?: string | null;

  @IsOptional() @IsObject()
  detay?: Record<string, unknown>;
}

const GECERLI_TIP = new Set<string>(Object.values(VarlikTipi));

/** `/api/varlik` — tenant-scoped belediye varlık CRUD. */
@Controller('varlik')
export class VarlikController {
  constructor(private readonly service: VarlikService) {}

  @Get()
  list(
    @Query('tip') tip?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const { limit, offset } = sayfalamaCoz({ page, pageSize });
    return this.service.list(limit, offset, tip);
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const v = await this.service.get(id);
    if (!v) {
      throw new NotFoundException('Varlık bulunamadı');
    }
    return v;
  }

  @Roller(KullaniciRolu.TenantAdmin)
  @Post()
  create(@Body() dto: CreateVarlikDto) {
    if (!GECERLI_TIP.has(dto.tip)) {
      throw new BadRequestException('Geçersiz varlık tipi');
    }
    const detaySonuc = varlikDetayDogrula(dto.tip, dto.detay);
    if (!detaySonuc.gecerli) {
      throw new BadRequestException(detaySonuc.hata);
    }
    return this.service.create({
      tip: dto.tip,
      ad: dto.ad,
      aciklama: dto.aciklama,
      detay: dto.detay,
    });
  }

  /** Varlık güncelle (TenantAdmin). */
  @Roller(KullaniciRolu.TenantAdmin)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateVarlikDto) {
    return this.service.update(id, dto);
  }

  /** Varlık sil (TenantAdmin). */
  @Roller(KullaniciRolu.TenantAdmin)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.service.remove(id);
    return { id, silindi: true };
  }
}

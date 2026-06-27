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
import { KullaniciRolu, VarlikTipi } from '@belediyesinden/shared';
import { Roller } from '@belediyesinden/auth';
import { VarlikService } from './varlik.service';

class CreateVarlikDto {
  tip!: string;
  ad!: string;
  aciklama?: string;
  detay?: Record<string, unknown>;
}

class UpdateVarlikDto {
  ad?: string;
  aciklama?: string | null;
  detay?: Record<string, unknown>;
}

const GECERLI_TIP = new Set<string>(Object.values(VarlikTipi));

/** `/api/varlik` — tenant-scoped belediye varlık CRUD. */
@Controller('varlik')
export class VarlikController {
  constructor(private readonly service: VarlikService) {}

  @Get()
  list(@Query('tip') tip?: string) {
    return this.service.list(tip);
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

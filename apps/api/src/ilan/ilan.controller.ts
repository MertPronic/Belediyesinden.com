import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import { IsEnum, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { IlanService } from './ilan.service';
import { Roller, Unprotected } from '@belediyesinden/auth';
import { IhaleTipi, KullaniciRolu } from '@belediyesinden/shared';

class CreateIlanDto {
  @IsString() @MaxLength(300)
  baslik!: string;

  @IsOptional() @IsString()
  aciklama?: string;

  @IsString()
  varlikId!: string;

  @IsEnum(IhaleTipi)
  ihaleTipi!: IhaleTipi;

  @IsNumber() @Min(0) @Max(1_000_000_000)
  baslangicFiyati!: number;
}

class ChangeDurumDto {
  @IsString()
  durum!: string;
}

class UpdateIlanDto {
  @IsOptional() @IsString() @MaxLength(300)
  baslik?: string;

  @IsOptional() @IsString()
  aciklama?: string | null;

  @IsOptional() @IsNumber() @Min(0) @Max(1_000_000_000)
  baslangicFiyati?: number;
}

/** `/api/ilan` — tenant-scoped ilan CRUD + durum geçişleri. */
@Controller('ilan')
export class IlanController {
  constructor(private readonly service: IlanService) {}

  /** İlanları listele (public — vatandaş ilanları auth'suz görüntüler). */
  @Unprotected()
  @Get()
  list() {
    return this.service.list();
  }

  /** İlan detayı (public). */
  @Unprotected()
  @Get(':id')
  async get(@Param('id') id: string) {
    const ilan = await this.service.get(id);
    if (!ilan) {
      throw new NotFoundException('İlan bulunamadı');
    }
    return ilan;
  }

  /** İlan oluştur (TenantAdmin). */
  @Roller(KullaniciRolu.TenantAdmin)
  @Post()
  create(@Body() dto: CreateIlanDto) {
    return this.service.create({
      baslik: dto.baslik,
      aciklama: dto.aciklama,
      varlikId: dto.varlikId,
      ihaleTipi: dto.ihaleTipi,
      baslangicFiyati: dto.baslangicFiyati,
    });
  }

  /** Durum geçişi: { durum: 'YAYINDA' | 'IPTAL' | ... } */
  /** İlan güncelle (TASLAK, TenantAdmin). */
  @Roller(KullaniciRolu.TenantAdmin)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateIlanDto) {
    return this.service.update(id, dto);
  }

  /** İlan sil (TASLAK, TenantAdmin). */
  @Roller(KullaniciRolu.TenantAdmin)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.service.remove(id);
    return { id, silindi: true };
  }

  @Roller(KullaniciRolu.TenantAdmin, KullaniciRolu.Encumen)
  @Post(':id/durum')
  changeDurum(@Param('id') id: string, @Body() dto: ChangeDurumDto) {
    return this.service.changeDurum(id, dto.durum);
  }

  /** İhaleyi sonuçlandır (en yüksek teklif → kazanan). */
  @Roller(KullaniciRolu.TenantAdmin, KullaniciRolu.Encumen)
  @Post(':id/sonuclandir')
  sonuclandir(@Param('id') id: string) {
    return this.service.sonuclandir(id);
  }
}

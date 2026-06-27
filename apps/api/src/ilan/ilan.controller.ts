import { Body, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { IlanService } from './ilan.service';
import { Roller, Unprotected } from '@belediyesinden/auth';
import { KullaniciRolu } from '@belediyesinden/shared';

class CreateIlanDto {
  baslik!: string;
  aciklama?: string;
  varlikId!: string;
  ihaleTipi!: string;
  baslangicFiyati!: number;
}

class ChangeDurumDto {
  durum!: string;
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

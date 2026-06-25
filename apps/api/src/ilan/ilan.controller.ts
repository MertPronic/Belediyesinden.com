import { Body, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { IlanService } from './ilan.service';

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

  @Get()
  list() {
    return this.service.list();
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const ilan = await this.service.get(id);
    if (!ilan) {
      throw new NotFoundException('İlan bulunamadı');
    }
    return ilan;
  }

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
  @Post(':id/durum')
  changeDurum(@Param('id') id: string, @Body() dto: ChangeDurumDto) {
    return this.service.changeDurum(id, dto.durum);
  }
}

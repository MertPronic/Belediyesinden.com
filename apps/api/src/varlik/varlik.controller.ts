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
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express/multer';
import type { Response } from 'express';
import { IsEnum, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { KullaniciRolu, VarlikTipi } from '@belediyesinden/shared';
import { Roller, Unprotected } from '@belediyesinden/auth';
import { sayfalamaCoz } from '@belediyesinden/db';
import { varlikDetayDogrula } from '@belediyesinden/varlik-core';
import { VarlikService } from './varlik.service';
import { VarlikGorselService } from './varlik-gorsel.service';

/** Multer yüklenen dosya (Express.Multer.File global augmentasyonu yerine yerel tip). */
interface MulterFile {
  originalname: string;
  buffer: Buffer;
  mimetype: string;
  size: number;
}

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
  constructor(
    private readonly service: VarlikService,
    private readonly gorseller: VarlikGorselService,
  ) {}

  /** Görsel stream (galeri <img> proxy'si). :id'den ÖNCE tanımlı. */
  @Unprotected()
  @Get('gorsel/:gorselId')
  async gorsel(@Param('gorselId') gorselId: string, @Res() res: Response): Promise<void> {
    const { stream, gorsel } = await this.gorseller.stream(gorselId);
    res.setHeader('Content-Type', gorsel.content_type ?? 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    stream.pipe(res);
  }

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

  /** Varlığın görselleri (public galeri için id listesi). */
  @Unprotected()
  @Get(':id/gorsel')
  gorselleri(@Param('id') id: string) {
    return this.gorseller.listByVarlik(id);
  }

  /** Varlığa çoklu görsel yükle (TenantAdmin). */
  @Roller(KullaniciRolu.TenantAdmin)
  @Post(':id/gorsel')
  @UseInterceptors(FilesInterceptor('files', 15))
  gorselYukle(@Param('id') id: string, @UploadedFiles() files: MulterFile[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('Dosya bulunamadı (multipart "files" alanı)');
    }
    return this.gorseller.upload(
      id,
      files.map((f) => ({ originalname: f.originalname, buffer: f.buffer, mimetype: f.mimetype, size: f.size })),
    );
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

import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express/multer';
import type { Response } from 'express';
import { EvrakService } from './evrak.service';
import { Roller, Unprotected } from '@belediyesinden/auth';
import { KullaniciRolu } from '@belediyesinden/shared';

/** Multer yüklenen dosya (Express.Multer.File global augmentasyonu yerine yerel tip). */
interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

/**
 * `/api/evrak` — ilan şartname/ek evrak.
 *  POST   /api/evrak/:ilanId (multipart 'file') → upload (TenantAdmin)
 *  GET    /api/evrak/ilan/:ilanId → ilanın evrak listesi (public)
 *  GET    /api/evrak/:id → download/stream (public — şartname erişimi)
 */
@Controller('evrak')
export class EvrakController {
  constructor(private readonly service: EvrakService) {}

  @Roller(KullaniciRolu.TenantAdmin)
  @Post(':ilanId')
  @UseInterceptors(FileInterceptor('file'))
  upload(@Param('ilanId') ilanId: string, @UploadedFile() file: MulterFile) {
    if (!file) {
      throw new BadRequestException('Dosya bulunamadı (multipart "file" alanı)');
    }
    return this.service.upload(ilanId, {
      originalname: file.originalname,
      buffer: file.buffer,
      mimetype: file.mimetype,
      size: file.size,
    });
  }

  /** İlan'ın evraklarını listele (public — şartname herkese açık). */
  @Unprotected()
  @Get('ilan/:ilanId')
  listByIlan(@Param('ilanId') ilanId: string) {
    return this.service.listByIlan(ilanId);
  }

  /** Evrak indir (public — şartname erişimi). */
  @Unprotected()
  @Get(':id')
  async download(@Param('id') id: string, @Res() res: Response): Promise<void> {
    const { stream, evrak } = await this.service.download(id);
    res.setHeader('Content-Type', evrak.content_type ?? 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${evrak.dosya_adi}"`);
    stream.pipe(res);
  }
}

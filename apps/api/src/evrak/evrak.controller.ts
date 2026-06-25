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
 * `/api/evrak` — ilan şartname/ek evrak upload + download.
 *  POST /api/evrak/:ilanId (multipart 'file') → upload
 *  GET  /api/evrak/:id → download (stream)
 */
@Controller('evrak')
export class EvrakController {
  constructor(private readonly service: EvrakService) {}

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

  @Get(':id')
  async download(@Param('id') id: string, @Res() res: Response): Promise<void> {
    const { stream, evrak } = await this.service.download(id);
    res.setHeader('Content-Type', evrak.content_type ?? 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${evrak.dosya_adi}"`);
    stream.pipe(res);
  }
}

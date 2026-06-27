import { BadRequestException, Body, Controller, Param, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express/multer';
import { CurrentUser, type AuthenticatedUser } from '@belediyesinden/auth';
import { TeminatService } from './teminat.service';

interface MulterFile {
  originalname: string;
  buffer: Buffer;
  mimetype: string;
  size: number;
}

/**
 * Teminat endpoint — `/api/teminat`.
 *  - Katılımcı e-dekont yükler (basvuru'ya).
 *  - Encümen onaylar (bloke), reddeder veya iade eder.
 */
@Controller('teminat')
export class TeminatController {
  constructor(private readonly service: TeminatService) {}

  /** E-dekont yükle → teminat kaydı (BEKLEMEDE). */
  @Post('basvuru/:basvuruId')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @Param('basvuruId') basvuruId: string,
    @CurrentUser() user: AuthenticatedUser | null,
    @UploadedFile() file: MulterFile,
  ) {
    if (!user) {
      throw new Error('Kimlik doğrulanmış kullanıcı yok');
    }
    if (!file) {
      throw new BadRequestException('Dekont dosyası gerekli');
    }
    return this.service.upload(basvuruId, user.sub, {
      originalname: file.originalname,
      buffer: file.buffer,
      mimetype: file.mimetype,
      size: file.size,
    });
  }

  /** Encümen: teminat onayla (bloke). */
  @Post(':id/onayla')
  approve(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser | null) {
    return this.service.approve(id, user?.sub ?? 'unknown');
  }

  /** Encümen: teminat reddet. */
  @Post(':id/reddet')
  reject(@Param('id') id: string) {
    return this.service.reject(id);
  }

  /** Teminat iade et (BLOKE → IADE). */
  @Post(':id/iade')
  iade(@Param('id') id: string) {
    return this.service.iade(id);
  }
}

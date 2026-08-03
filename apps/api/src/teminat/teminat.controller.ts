import { BadRequestException, Body, Controller, Get, Param, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express/multer';
import { CurrentUser, Roller, type AuthenticatedUser } from '@belediyesinden/auth';
import { KullaniciRolu } from '@belediyesinden/shared';
import { sayfalamaCoz } from '@belediyesinden/db';
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

  /** Tenant'ın tüm teminatları (başvuru + ilan bağlamı ile). Encümen/admin. */
  @Roller(KullaniciRolu.TenantAdmin, KullaniciRolu.Encumen)
  @Get()
  list(@Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    const { limit, offset } = sayfalamaCoz({ page, pageSize });
    return this.service.list(limit, offset);
  }

  /** E-dekont yükle → teminat kaydı (BEKLEMEDE). */
  @Roller(KullaniciRolu.Vatandas, KullaniciRolu.Yatirimci)
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
  @Roller(KullaniciRolu.TenantAdmin, KullaniciRolu.Encumen)
  @Post(':id/onayla')
  approve(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser | null) {
    return this.service.approve(id, user?.sub ?? 'unknown');
  }

  /** Encümen: teminat reddet. */
  @Roller(KullaniciRolu.TenantAdmin, KullaniciRolu.Encumen)
  @Post(':id/reddet')
  reject(@Param('id') id: string) {
    return this.service.reject(id);
  }

  /** Teminat iade et (BLOKE → IADE). */
  @Roller(KullaniciRolu.TenantAdmin, KullaniciRolu.Encumen)
  @Post(':id/iade')
  iade(@Param('id') id: string) {
    return this.service.iade(id);
  }
}

import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Query, Res, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express/multer';
import type { Response } from 'express';
import { IsArray, IsBoolean, IsEnum, IsISO8601, IsNumber, IsOptional, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { IlanService } from './ilan.service';
import { GorselService } from './gorsel.service';

/** Multer yüklenen dosya (Express.Multer.File global augmentasyonu yerine yerel tip). */
interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}
import { CurrentUser, Roller, Unprotected, type AuthenticatedUser } from '@belediyesinden/auth';
import { IhaleTipi, IslemTuru, KatilimSarti, KullaniciRolu } from '@belediyesinden/shared';
import { sayfalamaCoz } from '@belediyesinden/db';
import { ilanCitizenGorunurMu } from '@belediyesinden/ilan-core';

const PERSONEL_ROLLERI = new Set<string>([
  KullaniciRolu.TenantAdmin,
  KullaniciRolu.Encumen,
  KullaniciRolu.Superadmin,
]);

/** İstek personelden mi (TenantAdmin/Encümen/Superadmin) geliyor — vatandaş görünürlük kapısını atlar. */
function isPersonel(user: AuthenticatedUser | null): boolean {
  return !!user?.roles?.some((r) => PERSONEL_ROLLERI.has(r));
}

class CreateIlanDto {
  @IsString() @MaxLength(300)
  baslik!: string;

  @IsOptional() @IsString()
  aciklama?: string;

  @IsString()
  varlikId!: string;

  @IsEnum(IhaleTipi)
  ihaleTipi!: IhaleTipi;

  @IsEnum(IslemTuru)
  islemTuru!: IslemTuru;

  @IsNumber() @Min(0) @Max(1_000_000_000)
  baslangicFiyati!: number;

  /** İlan (yayın) tarihi — zorunlu; oluşturma anında `publishDogrula` ile doğrulanır (KK-23). */
  @IsISO8601()
  ilanTarihi!: string;

  /** İhale tarihi — zorunlu; oluşturma anında `publishDogrula` ile doğrulanır (KK-23). */
  @IsISO8601()
  ihaleTarihi!: string;

  /** Şartname bedeli ücretli mi (ilan başına tek bedel). */
  @IsOptional() @IsBoolean()
  sartnameUcretli?: boolean;

  /** Ücretliyse zorunlu (aynı istekte `sartnameUcretli: true` ile birlikte gelmeli). */
  @ValidateIf((o: CreateIlanDto) => o.sartnameUcretli === true)
  @IsNumber() @Min(0.01) @Max(1_000_000_000)
  sartnameTutari?: number;

  @IsOptional() @IsArray() @IsEnum(KatilimSarti, { each: true })
  katilimSartlari?: KatilimSarti[];
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

  @IsOptional() @IsISO8601()
  ilanTarihi?: string;

  @IsOptional() @IsISO8601()
  ihaleTarihi?: string;

  @IsOptional() @IsBoolean()
  sartnameUcretli?: boolean;

  @ValidateIf((o: UpdateIlanDto) => o.sartnameUcretli === true)
  @IsNumber() @Min(0.01) @Max(1_000_000_000)
  sartnameTutari?: number;

  @IsOptional() @IsArray() @IsEnum(KatilimSarti, { each: true })
  katilimSartlari?: KatilimSarti[];

  /** Harita konumu — vatandaş sayfasında OpenStreetMap gömülü haritası için. */
  @IsOptional() @IsNumber() @Min(-90) @Max(90)
  lat?: number;

  @IsOptional() @IsNumber() @Min(-180) @Max(180)
  lng?: number;
}

class SonuclandirDto {
  @IsOptional() @IsString() @MaxLength(100)
  kararNo?: string;
}

/** `/api/ilan` — tenant-scoped ilan CRUD + durum geçişleri. */
@Controller('ilan')
export class IlanController {
  constructor(
    private readonly service: IlanService,
    private readonly gorseller: GorselService,
  ) {}

  /** İlanları listele (public — vatandaş ilanları auth'suz görüntüler). */
  @Unprotected()
  @Get()
  list(@Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    const { limit, offset } = sayfalamaCoz({ page, pageSize });
    return this.service.list(limit, offset);
  }

  /** Kullanıcının favori ilanları (vatandaş). :id'den ÖNCE tanımlı. */
  @Roller(KullaniciRolu.Vatandas, KullaniciRolu.Yatirimci)
  @Get('favoriler/my')
  favorilerim(
    @CurrentUser() user: AuthenticatedUser | null,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    if (!user) throw new NotFoundException('Kimlik doğrulanmış kullanıcı yok');
    const { limit, offset } = sayfalamaCoz({ page, pageSize });
    return this.service.listFavoriler(user.sub, limit, offset);
  }

  /** Görsel stream (galeri <img> proxy'si). :id'den ÖNCE tanımlı. */
  @Unprotected()
  @Get('gorsel/:gorselId')
  async gorsel(@Param('gorselId') gorselId: string, @Res() res: Response): Promise<void> {
    const { stream, gorsel } = await this.gorseller.stream(gorselId);
    res.setHeader('Content-Type', gorsel.content_type ?? 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    stream.pipe(res);
  }

  /** İlan'ın görselleri (public galeri için id listesi). */
  @Unprotected()
  @Get(':id/gorsel')
  gorselleri(@Param('id') id: string) {
    return this.gorseller.listByIlan(id);
  }

  /** İlan'a çoklu görsel yükle (TenantAdmin). */
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

  /**
   * İlan detayı (public). Vatandaş yalnızca YAYINDA/CANLI_ARTIRMA/SONUCLANDI VE
   * ilan tarihi gelmiş ilanları görür — personel (TenantAdmin/Encümen/Superadmin)
   * bu kapıyı atlar, her zaman tam veriyi görür.
   */
  @Unprotected(false)
  @Get(':id')
  async get(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser | null) {
    const ilan = await this.service.get(id);
    if (!ilan) {
      throw new NotFoundException('İlan bulunamadı');
    }
    if (!isPersonel(user) && !ilanCitizenGorunurMu(ilan.durum, ilan.baslangic_tarihi, new Date())) {
      throw new NotFoundException('İlan bulunamadı');
    }
    return ilan;
  }

  /** İlanı favorile/çıkar (toggle, vatandaş). */
  @Roller(KullaniciRolu.Vatandas, KullaniciRolu.Yatirimci)
  @Post(':id/favori')
  toggleFavori(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser | null) {
    if (!user) throw new NotFoundException('Kimlik doğrulanmış kullanıcı yok');
    return this.service.toggleFavori(id, user.sub);
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
      islemTuru: dto.islemTuru,
      baslangicFiyati: dto.baslangicFiyati,
      ilanTarihi: dto.ilanTarihi,
      ihaleTarihi: dto.ihaleTarihi,
      sartnameUcretli: dto.sartnameUcretli,
      sartnameTutari: dto.sartnameTutari,
      katilimSartlari: dto.katilimSartlari,
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
  sonuclandir(@Param('id') id: string, @Body() dto: SonuclandirDto) {
    return this.service.sonuclandir(id, dto?.kararNo);
  }
}

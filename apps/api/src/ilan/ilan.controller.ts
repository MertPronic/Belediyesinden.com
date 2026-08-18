import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Query, Res, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express/multer';
import type { Response } from 'express';
import { IsArray, IsBoolean, IsEnum, IsISO8601, IsNumber, IsOptional, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { IlanService } from './ilan.service';
import { IlanKalemiService } from './ilan-kalemi.service';
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

  @IsEnum(IhaleTipi)
  ihaleTipi!: IhaleTipi;

  @IsEnum(IslemTuru)
  islemTuru!: IslemTuru;

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

/** İlana varlık (kalem) ekleme — DECISIONS.md KK-25. */
class AddIlanKalemiDto {
  @IsString()
  varlikId!: string;

  @IsNumber() @Min(0.01) @Max(1_000_000_000)
  baslangicFiyati!: number;
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
    private readonly kalemler: IlanKalemiService,
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

  /**
   * Bu tenant'ın vatandaşa açık ilanlarını arama indeksiyle yeniden eşitler
   * (OpenSearch mapping alanı eklendiğinde mevcut kayıtları geriye dönük senkronlar).
   * :id'den ÖNCE tanımlı.
   */
  @Roller(KullaniciRolu.TenantAdmin, KullaniciRolu.Superadmin)
  @Post('search/resync')
  async searchResync(): Promise<{ senkronlanan: number }> {
    const senkronlanan = await this.service.resyncSearchIndex();
    return { senkronlanan };
  }

  /**
   * Tek kalem (varlık) + üst ilan bağlamı — vatandaş varlık detay sayfasının
   * veri kaynağı (KK-25, Faz 4). Görünürlük kapısı `get()` ile aynı: üst ilan
   * citizen-visible değilse (henüz yayınlanmadı/ilan tarihi gelmedi) personel
   * olmayan kullanıcıya 404. :id'den ÖNCE tanımlı.
   */
  @Unprotected(false)
  @Get('kalem/:kalemId')
  async kalemDetay(@Param('kalemId') kalemId: string, @CurrentUser() user: AuthenticatedUser | null) {
    const kalem = await this.kalemler.getWithContext(kalemId);
    if (!isPersonel(user) && !ilanCitizenGorunurMu(kalem.ilan_durum, kalem.ilan_baslangic_tarihi, new Date())) {
      throw new NotFoundException('Varlık bulunamadı');
    }
    return kalem;
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
  async gorselYukle(@Param('id') id: string, @UploadedFiles() files: MulterFile[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('Dosya bulunamadı (multipart "files" alanı)');
    }
    const yuklenen = await this.gorseller.upload(
      id,
      files.map((f) => ({ originalname: f.originalname, buffer: f.buffer, mimetype: f.mimetype, size: f.size })),
    );
    // İlk yüklenen görsel kapak olabilir — arama sonuçlarındaki kart bunu hemen yansıtsın.
    this.service.syncSearchIndexFor(id).catch(() => {});
    return yuklenen;
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

  /** İlan oluştur (TenantAdmin). Varlıksız/"boş" TASLAK olarak oluşur — varlıklar `/kalem` ile eklenir (KK-25). */
  @Roller(KullaniciRolu.TenantAdmin)
  @Post()
  create(@Body() dto: CreateIlanDto) {
    return this.service.create({
      baslik: dto.baslik,
      aciklama: dto.aciklama,
      ihaleTipi: dto.ihaleTipi,
      islemTuru: dto.islemTuru,
      ilanTarihi: dto.ilanTarihi,
      ihaleTarihi: dto.ihaleTarihi,
      sartnameUcretli: dto.sartnameUcretli,
      sartnameTutari: dto.sartnameTutari,
      katilimSartlari: dto.katilimSartlari,
    });
  }

  /** İlandaki kalemler (varlıklar) — public, ilan detayında listelemek için. */
  @Unprotected()
  @Get(':id/kalem')
  kalemleri(@Param('id') id: string) {
    return this.kalemler.list(id);
  }

  /** İlana varlık ekle (TenantAdmin). */
  @Roller(KullaniciRolu.TenantAdmin)
  @Post(':id/kalem')
  kalemEkle(@Param('id') id: string, @Body() dto: AddIlanKalemiDto) {
    return this.kalemler.add(id, dto.varlikId, dto.baslangicFiyati);
  }

  /** İlandan varlık çıkar (TenantAdmin, soft — ihalesi başlamış kalem çıkarılamaz). */
  @Roller(KullaniciRolu.TenantAdmin)
  @Delete(':id/kalem/:kalemId')
  async kalemCikar(@Param('id') id: string, @Param('kalemId') kalemId: string) {
    await this.kalemler.remove(id, kalemId);
    return { id: kalemId, silindi: true };
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

  /** Bir varlığı (kalemi) sonuçlandır — en yüksek teklif → kazanan (KK-25: kalemler bağımsız sonuçlanır). */
  @Roller(KullaniciRolu.TenantAdmin, KullaniciRolu.Encumen)
  @Post(':id/kalem/:kalemId/sonuclandir')
  sonuclandirKalem(
    @Param('id') id: string,
    @Param('kalemId') kalemId: string,
    @Body() dto: SonuclandirDto,
  ) {
    return this.service.sonuclandirKalem(id, kalemId, dto?.kararNo);
  }
}

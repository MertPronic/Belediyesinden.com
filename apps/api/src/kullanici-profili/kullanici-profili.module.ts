import { Module } from '@nestjs/common';
import { KullaniciProfiliController } from './kullanici-profili.controller';
import { KullaniciProfiliService } from './kullanici-profili.service';

/** Kullanıcının kendi profili (shared.users) — şu an sadece telefon numarası. */
@Module({
  controllers: [KullaniciProfiliController],
  providers: [KullaniciProfiliService],
})
export class KullaniciProfiliModule {}

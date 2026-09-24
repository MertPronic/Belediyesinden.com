import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { User } from '@belediyesinden/db';

/**
 * Kullanıcının kendi profili (`shared.users`) — şu an sadece telefon numarası
 * (SMS bildirimleri için, Keycloak/JWT'de telefon yok — Hesabım sayfasından girilir).
 * Tenant-scoped değil (shared şema), `UserSyncService` ile aynı erişim deseni.
 */
@Injectable()
export class KullaniciProfiliService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async getir(keycloakSub: string): Promise<Pick<User, 'email' | 'ad' | 'soyad' | 'telefon'>> {
    const user = await this.ds.getRepository(User).findOne({ where: { keycloakSub } });
    if (!user) {
      throw new NotFoundException('Kullanıcı kaydı bulunamadı — bir sayfa yüklenip giriş yapılması gerekir');
    }
    return { email: user.email, ad: user.ad, soyad: user.soyad, telefon: user.telefon };
  }

  async telefonGuncelle(keycloakSub: string, telefon: string | null): Promise<void> {
    const repo = this.ds.getRepository(User);
    const user = await repo.findOne({ where: { keycloakSub } });
    if (!user) {
      throw new NotFoundException('Kullanıcı kaydı bulunamadı — bir sayfa yüklenip giriş yapılması gerekir');
    }
    user.telefon = telefon;
    await repo.save(user);
  }
}

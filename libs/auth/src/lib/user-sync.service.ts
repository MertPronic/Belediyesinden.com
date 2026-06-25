import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { KullaniciRolu } from '@belediyesinden/shared';
import { User } from '@belediyesinden/db';
import type { AuthenticatedUser } from './token-extractor';

/**
 * Doğrulanmış Keycloak kullanıcısını `shared.users` tablosuna upsert eder.
 * İlk istekte (veya profil değişikliğinde) çağrılır — merkezi kullanıcı kaydını senkron tutar.
 * KVKK: kişisel veri işleme; tam aydınlatma/açık rıza akışı Faz 3'te, burada minimal sync.
 */
@Injectable()
export class UserSyncService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async sync(user: AuthenticatedUser, tenantId: string | null): Promise<User> {
    const repo = this.ds.getRepository(User);
    const existing = await repo.findOne({ where: { keycloakSub: user.sub } });

    if (existing) {
      existing.email = user.email ?? existing.email;
      existing.ad = user.ad ?? existing.ad;
      existing.soyad = user.soyad ?? existing.soyad;
      if (user.roles.length) existing.rol = user.roles[0];
      existing.tenantId = tenantId;
      return repo.save(existing);
    }

    return repo.save(
      repo.create({
        keycloakSub: user.sub,
        email: user.email ?? '',
        ad: user.ad ?? '',
        soyad: user.soyad ?? '',
        rol: user.roles[0] ?? KullaniciRolu.Vatandas,
        tenantId,
      }),
    );
  }
}

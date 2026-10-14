import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DestekTalebi, SuperadminBildirim, Tenant } from '@belediyesinden/db';
import { runInTenant } from '@belediyesinden/tenancy';
import { BildirimTipi, DestekDurumu, type DestekKonusu } from '@belediyesinden/shared';
import { BildirimService } from '../bildirim/bildirim.service';

const SUPERADMIN_BILDIRIM_LIMIT = 20;

/**
 * Destek talebi (Muhasebe/Teknik/Diğer) — `shared` şemada, tenant personeli
 * açar, süper admin TÜM belediyelerin taleplerini tek yerde görür ve cevaplar.
 * SUPERADMIN'in kendi tenant'ı olmadığı için (BildirimService tenant-scoped)
 * yeni talepler ayrı, basit bir `shared.superadmin_bildirim` tablosuna düşer.
 */
@Injectable()
export class DestekService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly bildirim: BildirimService,
  ) {}

  async ac(tenantSlug: string, kullaniciId: string, konu: DestekKonusu, baslik: string, mesaj: string): Promise<DestekTalebi> {
    const tenant = await this.ds.getRepository(Tenant).findOne({ where: { slug: tenantSlug } });
    const repo = this.ds.getRepository(DestekTalebi);
    const talep = await repo.save(
      repo.create({
        tenantSlug,
        tenantAd: tenant?.ad ?? null,
        acanKullaniciId: kullaniciId,
        konu,
        baslik,
        mesaj,
      }),
    );

    // Süper admin'e bildirim — fire-and-forget (CLAUDE.md: dokümante edilmiş yan etki).
    const bildirimRepo = this.ds.getRepository(SuperadminBildirim);
    bildirimRepo
      .save(
        bildirimRepo.create({
          tip: BildirimTipi.YeniDestekTalebi,
          baslik: `Yeni destek talebi — ${tenant?.ad ?? tenantSlug}`,
          mesaj: baslik,
          link: '/admin/destek',
        }),
      )
      .catch(() => {});

    return talep;
  }

  listMy(tenantSlug: string): Promise<DestekTalebi[]> {
    return this.ds.getRepository(DestekTalebi).find({ where: { tenantSlug }, order: { createdAt: 'DESC' } });
  }

  listAll(durum?: string): Promise<DestekTalebi[]> {
    return this.ds.getRepository(DestekTalebi).find({
      where: durum ? { durum } : {},
      order: { createdAt: 'DESC' },
    });
  }

  async cevapla(id: string, cevap: string, cevaplayanId: string): Promise<DestekTalebi> {
    const repo = this.ds.getRepository(DestekTalebi);
    const talep = await repo.findOne({ where: { id } });
    if (!talep) {
      throw new NotFoundException('Destek talebi bulunamadı');
    }
    talep.cevap = cevap;
    talep.cevaplayanId = cevaplayanId;
    talep.cevapTarihi = new Date();
    talep.durum = DestekDurumu.Cevaplandi;
    const guncel = await repo.save(talep);

    // Talebi açan personele bildirim — süper admin'in kendi tenant'ı yok, o
    // yüzden talebin AİT OLDUĞU tenant bağlamı elle kuruluyor (runInTenant).
    await runInTenant(this.ds, talep.tenantSlug, async () => {
      this.bildirim
        .olustur({
          kullaniciId: talep.acanKullaniciId,
          tip: BildirimTipi.DestekTalebiCevaplandi,
          baslik: 'Destek talebiniz cevaplandı',
          mesaj: cevap,
          link: '/admin/destek',
        })
        .catch(() => {});
    }).catch(() => {
      /* tenant şeması artık yoksa (silinmiş belediye) sessizce yut */
    });

    return guncel;
  }

  sayacSuperadmin(): Promise<number> {
    return this.ds.getRepository(SuperadminBildirim).count({ where: { okundu: false } });
  }

  listBildirimSuperadmin(): Promise<SuperadminBildirim[]> {
    return this.ds.getRepository(SuperadminBildirim).find({
      order: { createdAt: 'DESC' },
      take: SUPERADMIN_BILDIRIM_LIMIT,
    });
  }

  async bildirimOkunduSuperadmin(id: string): Promise<void> {
    await this.ds.getRepository(SuperadminBildirim).update({ id }, { okundu: true });
  }

  async bildirimHepsiOkunduSuperadmin(): Promise<void> {
    await this.ds.getRepository(SuperadminBildirim).update({ okundu: false }, { okundu: true });
  }
}

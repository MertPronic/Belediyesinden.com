import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Tenant } from '@belediyesinden/db';
import { getCurrentTenant, tenantContext, tenantSchema } from '@belediyesinden/tenancy';
import { BasvuruDurumu, BildirimTipi, IlanDurumu, TenantDurumu } from '@belediyesinden/shared';
import { IlanService } from '../ilan/ilan.service';
import { BildirimService, TENANT_OPS_HEDEF_ROL } from '../bildirim/bildirim.service';
import { EMAIL_PROVIDER, SMS_PROVIDER } from '../integrations/integrations.module';
import type { EmailProvider, SmsProvider } from '../integrations/notification-providers';

const POLL_MS = Number(process.env['IHALE_ZAMANLAYICI_POLL_MS'] ?? 60_000);

interface IlanAday {
  id: string;
  baslik: string;
  bitis_tarihi: Date;
}

/**
 * İhale tarihi/saati gelince ilanı otomatik CANLI_ARTIRMA'ya geçirir + 4 saat öncesinden
 * tenant admin'ine ve onaylı başvurusu olan katılımcılara bildirim/e-posta/SMS gönderir
 * (Harun/PO, 2026-09-23). `apps/worker` yerine burada — o app hiçbir yerde deploy edilmiyor
 * (Dockerfile/compose servisi yok), `apps/api` her zaman ayakta.
 *
 * Kesin zamanlı (BullMQ delayed job) değil, periyodik polling: ihale tarihi sonradan
 * değişebilir (admin düzenlemesi, ileride anti-sniping uzaması — KK-18); polling her
 * turda canlı `bitis_tarihi`'ni okuduğu için buna otomatik dayanıklı.
 */
@Injectable()
export class IhaleZamanlayiciService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IhaleZamanlayiciService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly ilanService: IlanService,
    private readonly bildirim: BildirimService,
    @Inject(EMAIL_PROVIDER) private readonly email: EmailProvider,
    @Inject(SMS_PROVIDER) private readonly sms: SmsProvider,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      this.tick().catch((e) => this.logger.error(`tick hatası: ${e instanceof Error ? e.message : e}`));
    }, POLL_MS);
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    const tenants = await this.ds.getRepository(Tenant).find({ where: { durum: TenantDurumu.Aktif } });
    for (const tenant of tenants) {
      const schema = tenantSchema(tenant.slug);
      await this.otoBaslat(tenant, schema).catch((e) =>
        this.logger.error(`${tenant.slug} oto-başlatma: ${e instanceof Error ? e.message : e}`),
      );
      await this.hatirlatmaGonder(tenant, schema).catch((e) =>
        this.logger.error(`${tenant.slug} hatırlatma: ${e instanceof Error ? e.message : e}`),
      );
    }
  }

  /**
   * `TenancyInterceptor`'ın normalde HTTP isteğinde yaptığı bağlam kurulumunu (transaction +
   * `SET LOCAL search_path` + ALS) elle tekrarlar — böylece `fn` içinde tenant-scoped
   * servisler (`IlanService`, `BildirimService`) normal haliyle, değişmeden çalışabilir.
   */
  private async tenantBaglaminda(tenant: Tenant, schema: string, fn: () => Promise<void>): Promise<void> {
    const queryRunner = this.ds.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    await queryRunner.query(`SET LOCAL search_path TO ${schema}, shared`);
    try {
      await tenantContext.run({ slug: tenant.slug, schema, queryRunner }, fn);
      await queryRunner.commitTransaction();
    } catch (e) {
      await queryRunner.rollbackTransaction();
      throw e;
    } finally {
      await queryRunner.release();
    }
  }

  /** İhale tarihi gelmiş (YAYINDA) ilanları bulur, her birini `IlanService.changeDurum` ile başlatır. */
  private async otoBaslat(tenant: Tenant, schema: string): Promise<void> {
    const adaylar: { id: string }[] = await this.ds.query(
      `SELECT id FROM ${schema}.ilan WHERE durum = $1 AND bitis_tarihi <= now() AND deleted_at IS NULL`,
      [IlanDurumu.Yayinda],
    );
    for (const { id } of adaylar) {
      try {
        await this.tenantBaglaminda(tenant, schema, async () => {
          await this.ilanService.changeDurum(id, IlanDurumu.CanliArtirma);
          this.bildirim
            .olustur({
              hedefRol: TENANT_OPS_HEDEF_ROL,
              tip: BildirimTipi.IhaleBasladi,
              baslik: 'İhale başladı',
              mesaj: 'Bir ilanın ihalesi otomatik olarak canlı artırmaya açıldı.',
              link: `/admin/ilanlar/${id}`,
            })
            .catch(() => {});
        });
        this.logger.log(`${tenant.slug}: ilan ${id} otomatik başlatıldı`);
      } catch (e) {
        this.logger.error(`${tenant.slug}: ilan ${id} oto-başlatma hatası: ${e instanceof Error ? e.message : e}`);
      }
    }
  }

  /** 4 saat içinde başlayacak, henüz hatırlatılmamış ilanlar için bildirim/e-posta/SMS gönderir. */
  private async hatirlatmaGonder(tenant: Tenant, schema: string): Promise<void> {
    const adaylar: IlanAday[] = await this.ds.query(
      `SELECT id, baslik, bitis_tarihi FROM ${schema}.ilan
       WHERE durum = $1 AND hatirlatma_gonderildi_at IS NULL
         AND bitis_tarihi <= now() + interval '4 hours' AND bitis_tarihi > now()
         AND deleted_at IS NULL`,
      [IlanDurumu.Yayinda],
    );
    for (const ilan of adaylar) {
      try {
        await this.tenantBaglaminda(tenant, schema, () => this.hatirlatmaTekIlan(tenant, ilan));
        this.logger.log(`${tenant.slug}: ilan ${ilan.id} için hatırlatma gönderildi`);
      } catch (e) {
        this.logger.error(`${tenant.slug}: ilan ${ilan.id} hatırlatma hatası: ${e instanceof Error ? e.message : e}`);
      }
    }
  }

  private async hatirlatmaTekIlan(tenant: Tenant, ilan: IlanAday): Promise<void> {
    const tenantBaglami = getCurrentTenant();
    if (!tenantBaglami) throw new Error('Tenant bağlamı yok');
    const qr = tenantBaglami.queryRunner;
    const tarihStr = new Date(ilan.bitis_tarihi).toLocaleString('tr-TR');
    const ozetMesaj = `"${ilan.baslik}" için ihale ${tarihStr} tarihinde başlayacak.`;

    const adminler: { email: string }[] = await qr.query(
      `SELECT email FROM shared.users
       WHERE tenant_id = $1 AND rol IN ('TENANT_ADMIN', 'ENCUMEN') AND email IS NOT NULL AND email <> ''`,
      [tenant.id],
    );

    const katilimciSatirlari: { kullanici_id: string }[] = await qr.query(
      `SELECT DISTINCT b.kullanici_id FROM basvuru b
       JOIN ilan_kalemi k ON k.id = b.ilan_kalemi_id
       WHERE k.ilan_id = $1 AND b.durum = $2`,
      [ilan.id, BasvuruDurumu.Onaylandi],
    );
    const katilimciIds = katilimciSatirlari.map((r) => r.kullanici_id);

    let katilimcilar: { keycloak_sub: string; email: string; telefon: string | null }[] = [];
    if (katilimciIds.length > 0) {
      katilimcilar = await qr.query(
        `SELECT keycloak_sub, email, telefon FROM shared.users WHERE keycloak_sub = ANY($1::varchar[])`,
        [katilimciIds],
      );
    }

    // Bildirim — admin (rol yayını) + her katılımcıya ayrı.
    if (adminler.length > 0) {
      this.bildirim
        .olustur({
          hedefRol: TENANT_OPS_HEDEF_ROL,
          tip: BildirimTipi.IhaleHatirlatma,
          baslik: 'İhale 4 saat içinde başlıyor',
          mesaj: ozetMesaj,
          link: `/admin/ilanlar/${ilan.id}`,
        })
        .catch(() => {});
    }
    for (const kullaniciId of katilimciIds) {
      this.bildirim
        .olustur({
          kullaniciId,
          tip: BildirimTipi.IhaleHatirlatma,
          baslik: 'Katıldığınız ihale 4 saat içinde başlıyor',
          mesaj: ozetMesaj,
          link: `/ilanlar/${ilan.id}`,
        })
        .catch(() => {});
    }

    // E-posta (admin + katılımcı) + SMS (yalnızca katılımcı) — hepsi en iyi çaba, ayrı ayrı hataları yutulur.
    const gonderimler: Promise<void>[] = [
      ...adminler.map((a) => this.email.gonder(a.email, 'İhale 4 saat içinde başlıyor', ozetMesaj)),
      ...katilimcilar
        .filter((k) => k.email)
        .map((k) => this.email.gonder(k.email, 'Katıldığınız ihale 4 saat içinde başlıyor', ozetMesaj)),
      ...katilimcilar
        .filter((k) => k.telefon)
        .map((k) => this.sms.gonder(k.telefon as string, ozetMesaj)),
    ];
    const sonuclar = await Promise.allSettled(gonderimler);
    for (const sonuc of sonuclar) {
      if (sonuc.status === 'rejected') {
        this.logger.error(`ihale hatırlatma gönderim hatası: ${sonuc.reason}`);
      }
    }

    await qr.query(`UPDATE ilan SET hatirlatma_gonderildi_at = now() WHERE id = $1`, [ilan.id]);
  }
}

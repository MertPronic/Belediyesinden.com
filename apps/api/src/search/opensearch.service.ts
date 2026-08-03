import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Client } from '@opensearch-project/opensearch';
import { ilanCitizenGorunurMu } from '@belediyesinden/ilan-core';

const INDEX = 'ilanlar';
/** Halka açık arama sonuçlarında gösterilebilecek durumlar (bkz. tenant-web/portal PUBLIC_DURUMLAR). */
const PUBLIC_DURUMLAR = ['YAYINDA', 'CANLI_ARTIRMA', 'SONUCLANDI'];

/** OpenSearch (ilan arama/filtreleme) servisi. İndeks: `ilanlar`, tenant_slug ile izole. */
@Injectable()
export class OpenSearchService implements OnModuleInit {
  private readonly logger = new Logger(OpenSearchService.name);
  private client!: Client;

  async onModuleInit(): Promise<void> {
    this.client = new Client({ node: process.env['OPENSEARCH_NODE'] ?? 'http://localhost:9200' });
    try {
      const exists = await this.client.indices.exists({ index: INDEX });
      if (!exists.body) {
        await this.client.indices.create({
          index: INDEX,
          body: {
            mappings: {
              properties: {
                tenant_slug: { type: 'keyword' },
                ihale_tipi: { type: 'keyword' },
                durum: { type: 'keyword' },
                baslik: { type: 'text', analyzer: 'standard' },
                aciklama: { type: 'text', analyzer: 'standard' },
                baslangic_fiyati: { type: 'double' },
                baslangic_tarihi: { type: 'date' },
              },
            },
          },
        });
        this.logger.log(`OpenSearch indeks oluşturuldu (explicit mapping): ${INDEX}`);
      }
    } catch (e) {
      this.logger.warn('OpenSearch init atlandı: ' + (e instanceof Error ? e.message : e));
    }
  }

  /** İlanı indeksle (yayında). tenant_slug dokümanda → arama izolasyonu. */
  async indexIlan(
    tenantSlug: string,
    ilan: {
      id: string;
      baslik: string;
      aciklama: string | null;
      ihale_tipi: string;
      baslangic_fiyati: string;
      durum: string;
      baslangic_tarihi?: Date | string | null;
    },
  ): Promise<void> {
    await this.client.index({
      index: INDEX,
      id: `${tenantSlug}:${ilan.id}`,
      body: { tenant_slug: tenantSlug, ...ilan },
      refresh: true,
    });
  }

  /**
   * Arama. tenantSlug='central' (veya boş) ise tüm tenant'lar (merkezi portal);
   * aksi halde sadece o tenant'un ilanları. Her doküman tenant_slug taşır.
   *
   * `isPersonel=false` (vatandaş/kimliksiz — arama endpoint'inin gerçek çağıranı
   * her zaman budur) ilan tarihi henüz gelmemiş sonuçları eler; personel bu
   * kapıyı atlar (şu an arama personel tarafından kullanılmıyor ama tutarlılık
   * için destekleniyor).
   */
  async searchIlan(tenantSlug: string, query: string, tip?: string, isPersonel = false): Promise<unknown[]> {
    const must: Record<string, unknown>[] = [{ terms: { durum: PUBLIC_DURUMLAR } }];
    if (tenantSlug && tenantSlug !== 'central') {
      must.push({ term: { tenant_slug: tenantSlug } });
    }
    if (query) {
      must.push({ multi_match: { query, fields: ['baslik', 'aciklama'] } });
    }
    if (tip) {
      must.push({ term: { ihale_tipi: tip } });
    }
    const result = await this.client.search({
      index: INDEX,
      body: { query: { bool: { must } } },
    });
    const hits = (result.body as { hits: { hits: Array<{ _source: unknown }> } }).hits.hits;
    const kaynaklar = hits.map((h) => h._source as { durum: string; baslangic_tarihi?: string | null });
    if (isPersonel) {
      return kaynaklar;
    }
    const now = new Date();
    return kaynaklar.filter((k) => ilanCitizenGorunurMu(k.durum, k.baslangic_tarihi ?? null, now));
  }
}

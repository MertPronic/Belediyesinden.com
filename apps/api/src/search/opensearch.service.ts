import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Client } from '@opensearch-project/opensearch';

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
    const properties = {
      tenant_slug: { type: 'keyword' },
      tenant_ad: { type: 'keyword' },
      ihale_tipi: { type: 'keyword' },
      durum: { type: 'keyword' },
      baslik: { type: 'text', analyzer: 'standard' },
      aciklama: { type: 'text', analyzer: 'standard' },
      baslangic_fiyati: { type: 'double' },
      fiyat_min: { type: 'double' },
      fiyat_max: { type: 'double' },
      baslangic_tarihi: { type: 'date' },
      bitis_tarihi: { type: 'date' },
      il: { type: 'keyword' },
      ilce: { type: 'keyword' },
      kapak_gorsel_id: { type: 'keyword' },
    } as const;
    try {
      const exists = await this.client.indices.exists({ index: INDEX });
      if (!exists.body) {
        await this.client.indices.create({ index: INDEX, body: { mappings: { properties } } });
        this.logger.log(`OpenSearch indeks oluşturuldu (explicit mapping): ${INDEX}`);
      } else {
        // Index zaten vardı (önceki sürümden) — yeni alanları mapping'e ekle. OpenSearch
        // sadece YENİ alan eklemeye izin verir; halihazırda (yanlış tipte) yazılmış bir
        // alanı değiştiremez — o durumda index'in silinip yeniden oluşturulması gerekir.
        await this.client.indices.putMapping({ index: INDEX, body: { properties } });
        this.logger.log(`OpenSearch mapping güncellendi: ${INDEX}`);
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
      /** Tek-varlık dönemden kalma (KK-25 öncesi) — çoklu kalemli ilanlarda null olabilir. */
      baslangic_fiyati: string | null;
      /** Çoklu-varlık ilanlarda kalemlerin fiyat aralığı — tek-varlık ilanlarda null. */
      fiyat_min?: number | null;
      fiyat_max?: number | null;
      durum: string;
      baslangic_tarihi?: Date | string | null;
      bitis_tarihi?: Date | string | null;
      il?: string | null;
      ilce?: string | null;
      tenant_ad?: string | null;
      kapak_gorsel_id?: string | null;
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
   * her zaman budur) ilan tarihi gelmemiş sonuçları ES seviyesinde eler (`baslangic_tarihi`
   * range filtresi — `ilanCitizenGorunurMu` ile aynı kural, ama sayfalama doğru
   * `total` verebilsin diye post-fetch filtre yerine sorguya taşındı); personel bu
   * kapıyı atlar (şu an arama personel tarafından kullanılmıyor ama tutarlılık için
   * destekleniyor).
   */
  async searchIlan(
    tenantSlug: string,
    query: string,
    tip?: string,
    isPersonel = false,
    il?: string,
    ilce?: string,
    limit = 24,
    offset = 0,
  ): Promise<{ data: unknown[]; total: number }> {
    const must: Record<string, unknown>[] = [{ terms: { durum: PUBLIC_DURUMLAR } }];
    const mustNot: Record<string, unknown>[] = [];
    if (tenantSlug && tenantSlug !== 'central') {
      must.push({ term: { tenant_slug: tenantSlug } });
    }
    if (query) {
      // 'phrase_prefix' — canlı arama (yazdıkça filtrele) için: son kelime tamamlanmamış
      // olsa bile ("mer" → "Merkez") eşleşir. Düz multi_match yalnızca tam kelime eşleştirir.
      must.push({ multi_match: { query, fields: ['baslik', 'aciklama'], type: 'phrase_prefix' } });
    }
    if (tip) {
      must.push({ term: { ihale_tipi: tip } });
    }
    if (il) {
      must.push({ term: { il } });
    }
    if (ilce) {
      must.push({ term: { ilce } });
    }
    if (!isPersonel) {
      mustNot.push({ range: { baslangic_tarihi: { gt: 'now' } } });
    }
    const result = await this.client.search({
      index: INDEX,
      track_total_hits: true,
      body: { query: { bool: { must, must_not: mustNot } }, from: offset, size: limit },
    });
    const body = result.body as {
      hits: { hits: Array<{ _source: unknown }>; total: { value: number } };
    };
    return {
      data: body.hits.hits.map((h) => h._source),
      total: body.hits.total.value,
    };
  }

  /**
   * İl/ilçe filtre seçenekleri — gerçekte ilanı olan yerlerden (statik referans
   * veri seti yerine, POC kapsamı). İl listesi artık `TURKIYE_ILLERI` sabitinden
   * (frontend) geliyor — burası sadece seçilen ile ait ilçeleri ve belediye sayısını
   * döner.
   */
  async aggLokasyonlar(
    tenantSlug: string,
    il?: string,
  ): Promise<{ ilceler: string[]; belediyeSayisi: number }> {
    const must: Record<string, unknown>[] = [{ terms: { durum: PUBLIC_DURUMLAR } }];
    if (tenantSlug && tenantSlug !== 'central') {
      must.push({ term: { tenant_slug: tenantSlug } });
    }
    if (il) {
      must.push({ term: { il } });
    }
    const aggs = {
      belediyeSayisi: { cardinality: { field: 'tenant_slug' } },
      ...(il ? { ilceler: { terms: { field: 'ilce', size: 200 } } } : {}),
    };
    const result = await this.client.search({
      index: INDEX,
      body: { query: { bool: { must } }, size: 0, aggs },
    });
    const body = result.body as {
      aggregations?: {
        ilceler?: { buckets: Array<{ key: string }> };
        belediyeSayisi?: { value: number };
      };
    };
    const siralaTr = (a: string, b: string) => a.localeCompare(b, 'tr');
    return {
      ilceler: (body.aggregations?.ilceler?.buckets ?? []).map((b) => b.key).sort(siralaTr),
      belediyeSayisi: body.aggregations?.belediyeSayisi?.value ?? 0,
    };
  }
}

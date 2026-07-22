# DECISIONS.md — Mimari Karar Günlüğü

> Her karar: **bağlam → karar → gerekçe → durum**. Kararlar silinmez, üstüne eklenir.
> Bir karar değişirse eski madde kalır, yeni madde "KK-XX'i geçersiz kılar" notuyla eklenir.
>
> **Durum kodları:**
> ✅ kodda doğrulandı / kapandı · 🟡 kodda görüldü, gözden geçirme bekliyor · ⬜ açık, karar bekliyor
>
> Sürüm: v0.2 · Kod incelemesi sonrası (tenant-resolver, AuctionGateway, TeklifService, package.json okundu)

---

## KK-01 · Çok kiracılılık: şema-başına-tenant · ✅
- **Bağlam:** Yüzlerce belediye tek altyapıda, tamamen izole veriyle çalışacak.
- **Karar:** Her belediye için `tenant_<slug>` şeması + tüm tenant'ları aşan `shared` şeması. İstek başına `SET LOCAL search_path TO tenant_<slug>, shared`.
- **Gerekçe:** DB-başına-tenant'tan hafif, satır-bazlı (RLS) izolasyondan güvenli ve uygulama kodu şema-farkında olmadan yazıyor.
- **Durum:** ✅ `TenancyInterceptor` çalışıyor; DDL büyük ölçüde `libs/tenancy/tenant-migrations.ts`'te (14 KB). SQLi yüzeyi KK-07 ile kapandı.

## KK-02 · Tenant erişim kontrolü guard katmanında · ✅
- **Karar:** `TenantGuard` slug'ı host'tan çözer, `shared.tenants`'tan yükler; yoksa 404, `durum != AKTIF` ise 403; JWT `tenant_id` ↔ subdomain uyumunu doğrular (SUPERADMIN muaf).
- **Gerekçe:** Guard'lar interceptor'lardan **önce** çalışır → var-olmayan/pasif tenant, `search_path` daha kurulmadan reddedilir. İzolasyonun ilk kapısı burası.
- **Durum:** ✅ Kodda görüldü ve zincir sırası doğru.

## KK-03 · ORM stratejisi — KAPANDI: hibrit (tip=TypeORM, sorgu=raw pg) · ✅
- **Bağlam:** Faz-0 planı TypeORM seçmişti; kod incelemesi farklı gerçeği gösterdi.
- **Karar:** **Hibrit ve bilinçli.** Kalıcılık = **parametrize raw SQL** (`rawQuery(qr, sql, $params)`, `pg` sürücüsü). TypeORM entity'leri yalnızca **tip** için (`import type`) — runtime'da ORM yok (`package.json`'da `typeorm ^1.0.0` zaten geçersiz sürüm). **Standart budur.**
- **Gerekçe:** `search_path` tabanlı çok kiracılılıkta TypeORM repository katmanı sürekli sürtüşür; raw SQL daha dürüst. Tüm sorgular `$1,$2` parametreli → enjeksiyon yüzeyi yok.
- **Durum:** ✅ `TeklifService`'te doğrulandı. Kural: **string birleştirmeyle SQL yasak**, her sorgu parametreli.

## KK-04 · Kimlik: tek realm + tenant grup-claim · 🟡
- **Karar:** Tek Keycloak realm `belediyesinden`; tenant ayrımı `tenant_<slug>` grubu + group-membership-mapper → `tenant_groups` claim.
- **Gerekçe:** KC26'da user-attribute (`tenant_id`) admin API ile kalıcı olmuyor. Grup-üyeliği bu bug'a workaround.
- **Durum:** 🟡 Kodda var (`AuctionGateway` de `tenant_groups` claim'inden slug çözüyor). KC sürümü değişirse gözden geçirilecek. **Bağlı not (KK-19):** iki auth mekanizması sadeleşecek.

## KK-05 · Arama: OpenSearch (Elasticsearch değil) · ✅
- **Gerekçe:** Apache 2.0 lisans, Elastic'in değişen lisansından bağımsız, tek-node dev'de daha hafif.
- **Durum:** ✅ (Resmî metinlerde OpenSearch'e sabitlenmeli; pilotta zaten Postgres FTS — KK-11.)

## KK-06 · Dış entegrasyonlar STUB, DI arkasında · 🟡
- **Karar:** Teminat / e-imza / e-Devlet için arayüzler `apps/api/src/integrations/` altında; implementasyonlar stub.
- **Uyarı:** `EDevletProvider` stub'ı şu an **"her zaman doğrulandı"** dönüyor, e-imza sha256 placeholder. Canlıdan önce **zorunlu** değişecek — teknik borçtan öte hukuki/mevzuat riski.
- **Durum:** 🟡 Stub. Port/adapter deseni (Clean Architecture) zaten doğru kurulmuş.

## KK-07 · search_path SQLi hattı — KAPANDI (regex savunması yeterli) · ✅
- **Bağlam:** `SET search_path TO ${schema}` slug'ı interpolate ediyor; `SET` bind parametre kabul etmez.
- **Bulgu:** `tenant-resolver.ts`'te slug regex `^[a-z0-9]{3,40}$` — tire/alt çizgi/tırnak/`;`/boşluk YOK. Her giriş noktasında doğrulanıyor; `tenantSchema()` geçersizse **throw** ediyor. Bu karakter kümesiyle interpolasyon enjekte edilemez.
- **Karar:** SQLi hattı pratikte **kapalı**. `set_config('search_path',$1,true)` artık acil değil, opsiyonel kemer-üstüne-askı iyileştirme.
- **Artık risk (⚠):** `resolveTenantSlugFromHeaders` önce `x-tenant-slug` header'ına güveniyor. Kimlikli isteklerde TenantGuard (KK-02) yakalar; ama **public/portal yolları için bu header ingress'te dış isteklerden STRIP edilmeli** — yoksa tenant kaydırma denenebilir.
- **Durum:** ✅ SQLi kapandı · ⬜ ingress header-strip yapılacak.

## KK-08 · teminat-iade akışı: outbox yok · ⬜
- **Bağlam:** İade job'ı doğrudan publish; transactional outbox yok. DB commit olur, kuyruğa job düşmezse iade kaybolur.
- **Durum:** ⬜ Simülasyonda acil değil; **gerçek banka öncesi kapanmalı** (para akışı). Bkz. KK-15 (ortak desen).

## KK-09 · Tek Redis, üç sorumluluk · 🟡
- **Bağlam:** Aynı Redis instance'ı throttle + BullMQ kuyruğu + WS pub/sub taşıyor.
- **Durum:** 🟡 Şimdilik pragmatik. "Ne zaman ayrışır" eşiği (yük/instance) tanımlı tutulmalı.

## KK-10 · WebSocket tenant izolasyonu — KAPANDI (relay güvenli) · ✅
- **Bulgu:** `AuctionGateway` **veritabanına dokunmuyor** — saf pub/sub relay. Her bağlantıda JWT doğruluyor (JWKS offline), tenant'ı `tenant_groups` claim'inden alıyor, Redis'ten gelen teklifi **yalnız aynı tenant'a bağlı istemcilere** yayınlıyor. `search_path`'e ihtiyacı yok (sorgu yapmıyor).
- **Karar:** Yayın yolunda izolasyon var, sızıntı yok — güvenli desen. Yazma yolu ayrı: `TeklifService` doğrular + yazar, sonra `broadcastTeklif` ile relay tetiklenir.
- **Durum:** ✅ Güvenli. (İlgili açık: anti-sniping uzaması yayınlanmıyor — KK-18.)

## KK-11 · Pilotta arama: PostgreSQL FTS (OpenSearch ertelendi) · ⬜ önerildi
- **Karar:** Pilotta OpenSearch çalıştırılmaz; arama Postgres FTS (`tsvector` + GIN, gerekirse `pg_trgm`). `Search` modülü arayüzü arkasında → backing store sonradan değişir.
- **Durum:** ⬜ Düşük riskli teknik öneri; teyit bekliyor.

## KK-12 · Pilot k8s'siz, tek host · ⬜ sorulacak
- **Karar:** Pilot tek sunucuda; k8s manifestleri gelecek için repoda kalır.
- **Açık soru:** k8s bir grant/teslim taahhüdü mü? → Murat / PO. (ACIK-SORULAR S5)
- **Durum:** ⬜ Sorulacak.

## KK-13 · Keycloak bilinçli korunuyor · 🟡
- **Karar:** Şimdilik korunur (GovTech + KVKK + veri yerelliği → self-hosted kimlik muhtemelen zaten istenen). Alternatif değerlendirmesi ölçeğe ertelendi.
- **Durum:** 🟡 Korunuyor, maliyeti izleniyor.

## KK-14 · Read replica ertelendi, tasarım replica-hazır · ⬜
- **Karar:** Pilotta tek PostgreSQL. Kod replica-hazır yazılır (okumalar ayrı "read DataSource" soyutlamasından). **Açık artırma / teklif okumaları HER ZAMAN master'dan** (replication lag → adaletsizlik).
- **Durum:** ⬜ Ertelendi. (Açık: pilotta ayrı read-DataSource soyutlaması baştan mı? — ACIK-SORULAR S6.)

## KK-15 · OpenSearch beslemesi: outbox-indexer (KK-08 ile ortak desen) · ⬜
- **Karar:** Senkron çift-yazma yerine **transactional outbox + asenkron indexer**. Reindex replica'dan. Model: **tek ortak index + `tenant_slug` + zorunlu filtre** (index-per-tenant → shard patlaması); filtre atlanamayan sarmalayıcı repo'da.
- **KK-08 bağı:** Teminat-iade outbox'ıyla **birebir aynı desen** — tek desenle iki dert.
- **Durum:** ⬜ OpenSearch geldiğinde uygulanır.

## KK-16 · Mimari stil: functional-core / imperative-shell (seçici) — DDD/Clean rewrite YOK · ✅
- **Bağlam:** "DDD veya Clean Architecture'a geçelim mi?" sorusu. Kod incelemesi projenin zaten doğru deseni kullandığını gösterdi.
- **Karar:** Tümden DDD/Clean rewrite'ına **geçilmez**. Bunun yerine mevcut desen resmileştirilir: ağır domain kuralları saf + testli `libs/*-core`'da (`auction-core`: `teklif-validator.ts`, `sure-uzatma.ts` + `.spec` testleri); `service.ts` = ince kabuk (yükle → çekirdeği çağır → yaz → yan etki: audit/WS/outbox); `controller.ts` = HTTP adaptörü; dış sistemler port/adapter (`integrations/`).
- **Gerekçe:** Clean/DDD'nin faydasının %80'i (test edilebilirlik, domain izolasyonu, değiştirilebilir dış sistem), ceremony'nin %20'siyle. Aggregate/value-object/CQRS ceremony'si solo pilotta net zarar. Ubiquitous language = kodun Türkçe domain terimleri; bounded context = api modül sınırları.
- **Referans şablon:** `TeklifService`. Yeni modüller bunu izler.
- **Durum:** ✅ Sabit.

## KK-17 · Eşzamanlı teklif kilidi — AÇIK (gerçek bug) · ⬜
- **Bağlam:** `TeklifService.submit` içinde `SELECT MAX(tutar)` ile `INSERT` arasında satır kilidi yok. İki kişi aynı anda teklif verirse ikisi de aynı "en yüksek"i okuyup ikisi de kabul edilebilir (çift kabul).
- **Karar (öneri):** İlan satırına `SELECT ... FOR UPDATE` ile kilit, veya teklif tablosunda koşullu insert (`WHERE tutar > mevcut`). Request-transaction zaten var (ALS), sadece kilit ekleniyor.
- **Durum:** ⬜ Açık artırma pilot-sağlamlaştırmasının ilk maddesi. Düşük efor, yüksek önem.

## KK-18 · Anti-sniping süre uzaması WS'e yayınlanmıyor · ⬜
- **Bağlam:** `submit`'te süre uzayınca `bitis_tarihi` DB'de güncelleniyor ama WS'ten haber gitmiyor → istemci geri sayımı yanlış kalıyor ("bitti" sanıp çekilme).
- **Karar (öneri):** `broadcastTeklif`'in yanına `sure_uzadi` event'i (yeni bitiş zamanıyla). Anti-sniping'in amacı şeffaflık; bu olmadan eksik.
- **Durum:** ⬜ Açık artırma sağlamlaştırmasıyla birlikte.

## KK-19 · İki auth mekanizması sadeleşecek · ⬜
- **Bağlam:** `package.json`'da hem `nest-keycloak-connect` hem elle `jose` doğrulaması var; gateway `jose`, HTTP tarafı muhtemelen connect.
- **Karar (öneri):** Tek mekanizmada sadeleş (WS'de `jose` zorunlu; HTTP'de de aynı JWKS doğrulamasına yaslanmak tutarlılık verir). Karar kodun tamamı görülünce netleşir.
- **Durum:** ⬜ Düşük öncelik; teknik borç notu.

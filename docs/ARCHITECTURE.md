# ARCHITECTURE.md — belediyesinden.com Sistem Mimarisi

> Bu belge **nasıl olması gerektiğini** anlatır (normatif). Mevcut kodu tarif eden
> `Belediyesinden_Mimari_Diyagram_v1.html`'den farkı budur: v1 var olanı çizer, bu
> belge bizim aldığımız kararlara göre hedefi tanımlar. Kararların gerekçeleri
> `DECISIONS.md`'de (KK-XX), pilota giden sıra `YOL-HARITASI.md`'de.
>
> Canlı belge · v0.2 (kod incelemesi sonrası) · PO ve sahip ile evrilecek.

---

## 0. Kılavuz İlke — Hedef Mimari vs Pilot Kesiti

Bu projenin en önemli mimari kararı bir teknoloji seçimi değil, bir **ayrımdır**: her alt sistemin iki hali var.

- **Hedef mimari:** 1.300+ belediye, on binlerce eş zamanlı vatandaş, çoklu-instance ölçek için tasarlanan tam hâl. Vizyon dökümanının resmettiği yer.
- **Pilot kesiti:** Tek belediyeyi, tek gerçek açık artırmayı uçtan uca çalıştıran en küçük dikey kesit. Bugün inşa ettiğimiz yer.

Kural: **hedef mimariyi tasarla, pilot kesitini inşa et.** Bir bileşeni ertelemek onu reddetmek değildir; arayüzü bugün kur, ağır implementasyonu yük gerçekten geldiğinde bağla. Bu belge her bölümde ikisini ayırır.

---

## 1. Sistem Genel Bakış

**Topoloji:** Nx + pnpm monorepo. NestJS 11 **modüler monolit** (`api`) çekirdek; bağımsız `worker` (BullMQ tüketicisi); iskelet `auction-service` (bidding'i ileride ayırma opsiyonu, henüz katlanmış tutulur — bkz. §13). İki Next.js 16 / React 19 uygulaması: `tenant-web` ({slug}.belediyesinden.com — vatandaş + belediye admin) ve `portal` (merkezi, ağırlıklı public, tüm ilanları tek noktada toplar).

**Veri altyapısı:** PostgreSQL 16 (kaynak-of-truth), Redis 7 (kuyruk + cache + pub/sub), MinIO (S3-uyumlu nesne depolama), OpenSearch (hedef mimari; pilotta yerine Postgres FTS).

**İlke:** Monolit bilinçli tercih. Solo ekip için mikroservis erken bir vergidir; modüler monolit iyi sınırlarla aynı ayrıştırmayı operasyon yükü olmadan verir. Servis ayrımı ancak bir modül gerçekten bağımsız ölçek/dağıtım gerektirdiğinde yapılır.

---

## 2. Çok Kiracılılık — Sistemin Kalbi

Mimarinin en kritik ve en riskli parçası. Model: **şema-başına-tenant** (KK-01). Tek PostgreSQL veritabanı; her belediye ayrı bir şema (`tenant_<slug>`), tüm tenant'ları aşan ortak veri `shared` şemasında (tenants, users, audit_log, lookup tabloları). Belediye = veritabanı değil, veritabanı içindeki şema.

**İstek başına izolasyon akışı:**
1. `TenantResolver` host header'ından slug çözer (`talas.belediyesinden.com` → `talas`). Merkezi portal (slug yok) izolasyonsuz geçer.
2. `TenantGuard` (KK-02) slug'ı `shared.tenants`'tan yükler → yoksa 404, `durum != AKTIF` ise 403; JWT `tenant_id` ↔ subdomain uyumunu doğrular (SUPERADMIN muaf). İzolasyonun ilk kapısı; guard'lar interceptor'lardan önce çalışır, yani geçersiz tenant `search_path` daha kurulmadan reddedilir.
3. `TenancyInterceptor` istek başına bir transaction açar, `search_path`'i tenant şemasına + `shared` fallback'e çeker. İstek boyunca tüm sorgular bu bağlam üzerinde çalışır; transaction bitince LOCAL scope reset olur.

**Savunma derinliği (üç bağımsız kat):**
- **Var olma denetimi** — Guard, tenant'ın gerçekten aktif olduğunu doğrular (allowlist, `shared.tenants`).
- **Enjeksiyona kapalı slug (KK-07 ✅)** — Slug regex `^[a-z0-9]{3,40}$`; tire/tırnak/`;`/boşluk yok, her giriş noktasında doğrulanır, `tenantSchema()` geçersizse throw eder. Bu karakter kümesiyle `SET search_path TO ${schema}` interpolasyonu enjekte edilemez → SQLi hattı pratikte kapalı. `set_config('search_path',$1,true)` opsiyonel kemer-üstüne-askı iyileştirmesi.
- **ALS disiplini (kırmızı çizgi) — kodda tutturulmuş** — Her sorgu `getCurrentTenant().queryRunner` üzerinden (`TeklifService.qr()` deseni; tenant yoksa throw). `dataSource.query(...)` ile taze bağlantı = varsayılan `search_path` = sessiz cross-tenant sızıntı → **yasak**. Kalıcılık standardı **parametrize raw `pg`** (`rawQuery(qr, sql, $params)`); TypeORM sadece tip için (KK-03).

**Artık risk (⚠):** `resolveTenantSlugFromHeaders` önce `x-tenant-slug` header'ına güvenir. Kimlikli isteklerde TenantGuard (JWT↔slug) yakalar; ama **public/portal yolları için bu header ingress'te dış isteklerden strip edilmeli** (KK-07 artık-risk).

**Tenant provisioning:** `scripts/create-tenant.ts <slug>` tek komutta: `shared.tenants` kaydı → `CREATE SCHEMA tenant_<slug>` → tenant migration seti → varsayılan kural + tema seed → Keycloak grup/mapper/kullanıcı otomasyonu → `durum = AKTIF`.

**Ölçek notu (hedef):** Şema-başına-tenant binlerce şemada `pg_catalog` şişmesi riski taşır. Hedefte izlenmeli; pilotta önemsiz.

---

## 3. Kimlik ve Yetki

**Keycloak 26**, tek realm `belediyesinden` (KK-04). Roller: SUPERADMIN · TENANT_ADMIN · ENCUMEN · VATANDAS · YATIRIMCI. Client'lar: `portal`/`tenant-web` (public, PKCE), `api` (bearer-only, offline JWKS doğrulama).

**Tenant claim:** KC26'da user-attribute (`tenant_id`) admin API ile kalıcı olmadığından, tenant ayrımı `tenant_<slug>` **grup üyeliği** + group-membership-mapper → `tenant_groups` claim ile taşınır. Bu bir platform bug'ına workaround'dur; KC sürümü değişirse gözden geçirilir.

**Guard zinciri (sıra):** TenantThrottler → AuthGuard (Keycloak JWT) → RollerGuard (@Roller) → TenantGuard → TenancyInterceptor (search_path) → MetricsInterceptor.

**İlke:** Güvenlik **backend-otoriter**. İstemci yalnızca UX tahmini yapar; yetki, teklif geçerliliği ve teminat her zaman backend'de doğrulanır.

---

## 4. Domain Modülleri

`api` içinde modüler (`apps/api/src/<modül>/`); her biri kendi sınırında, audit'e fire-and-forget bağlı. Modüller **mevcut ve kısmen inşa edilmiş**; olgunluk sütunu tek tek teyit edilecek.

| Modül | Sorumluluk | Durum |
|-------|-----------|:---:|
| Varlık | Polimorfik CRUD (tip + jsonb detay → yeni tip migration'sız), tenant-scoped | 🟡 var |
| İlan | Durum makinesi; ihale tipi (açık artırma / açık teklif / kapalı teklif — 2886) | 🟡 var |
| Evrak | Şartname/belge — MinIO pre-signed URL, tenant-scoped path | 🟡 var |
| Başvuru | KVKK açık rıza kaydı, ilana başvuru + belge ekleri, teminata bağlı akış | 🟡 var |
| Teminat | Depozito — pilotta **simülasyon** (stub); onay/iade akışı, iade → BullMQ | 🟡 sim |
| Teklif | Server-authoritative, `teklifDogrula()`, anti-sniping, WS yayın, kural + audit | ✅ çalışıyor |
| Tenants (Tema) | `/tenants/current` → renk+ad; `layout.tsx` SSR'de çağırır | 🟡 var |
| Audit | Hash-chain, tamper-evident log; `appendAuditLog()` | ✅ (ince) |
| Duyuru / Rapor | CRUD / dashboard | ⬜ sonrası |

**İlan durum makinesi:** `TASLAK → YAYINDA → CANLI_ARTIRMA → SONUÇLANDI`; her noktadan `→ İPTAL`. Geçerli geçişler backend'de zorlanır.

**Mimari stil (KK-16):** functional-core / imperative-shell. Ağır domain kuralları saf + testli `libs/*-core`'da (`auction-core`); `service.ts` = ince kabuk (yükle → çekirdek → yaz → yan etki); `controller.ts` = HTTP adaptörü; dış sistemler port/adapter (`integrations/`). **`TeklifService` referans şablondur** — yeni modüller bunu izler. Tümden DDD/Clean rewrite'ına gidilmez.

---

## 5. Gerçek Zamanlı Açık Artırma Motoru

Vizyonun en kritik Ar-Ge bileşeni — ve **çalışıyor**. İki parça: yazma yolu (`TeklifService`) + yayın (`AuctionGateway`).

**Yazma zinciri (`TeklifService.submit`, doğrulandı):** ilan doğrula → mevcut en yüksek teklif → `getIlanKurallari` (kural motoru) → `teklifDogrula` (auction-core saf çekirdeği) → `rawQuery` INSERT → `broadcastTeklif` (WS) → `appendAuditLog` (fire-and-forget) → anti-sniping süre kontrolü. Server-authoritative; istemci sadece tahmin gösterir.

- **Anti-sniping:** Bitişe yakın geçerli teklif → `bitis_tarihi` uzar (`sureUzatmaDakika`, DB'den `ilan_kurallari`, kod değişmeden).
- **Yayın izolasyonu (KK-10 ✅):** `AuctionGateway` **DB'ye dokunmaz** — saf pub/sub relay. JWT doğrular (JWKS offline), tenant'ı `tenant_groups` claim'inden alır, Redis'ten geleni **yalnız aynı tenant istemcilerine** yayınlar. `search_path` gerekmez. Çok-instance: Redis pub/sub tüm gateway'lere ulaştırır.
- **Replica kuralı (KK-14):** Teklif/açık artırma okumaları **her zaman master'dan** (lag → adaletsizlik).

**Açık pürüzler (pilot-sağlamlaştırma):**
- **KK-17 (gerçek bug):** `SELECT MAX` ↔ `INSERT` arasında satır kilidi yok → eşzamanlı iki teklif çift kabul edilebilir. `FOR UPDATE` / koşullu insert gerekli.
- **KK-18:** Süre uzayınca WS'e `sure_uzadi` event'i gitmiyor → istemci geri sayımı yanlış. Broadcast'e eklenmeli.
- **S7 (mevzuat):** Teklif anında `kabul_edildi=true`; encümen onayı/itiraz için ara durum gerekir mi? → Harun.

---

## 6. Asenkron İşleme ve Outbox Deseni

Redis 7 + BullMQ. Producer `api`, consumer bağımsız `worker` süreci (`NestFactory.createApplicationContext`, HTTP listener yok, graceful shutdown).

**Ortak desen — transactional outbox:** İki ayrı ihtiyaç aslında tek problem sınıfı:
- **Teminat iadesi (KK-08):** İade job'ı doğrudan publish edilirse, DB commit olup kuyruğa job düşmediğinde iade kaybolur (para!).
- **Arama indeksi (KK-15):** İlan Postgres + OpenSearch'e çift-yazılırsa, biri patlayınca iki sistem ayrışır.

Çözüm ikisinde de aynı: **iş kaydı aynı transaction içinde bir `outbox` satırıyla yazılır**; worker outbox'ı okuyup hedefe (banka provider / OpenSearch) iter. Tutarlılık transaction garantisiyle sağlanır, iş retry edilebilir. **Tek desen, iki dert.** Pilotta teminat sim olduğu için aciliyeti düşük ama gerçek banka/OpenSearch bağlanmadan önce zorunlu.

**Redis'in üç rolü (KK-09):** Aynı instance throttle deposu + kuyruk + WS pub/sub taşır. Pilotta pragmatik; ayrışma eşiği (yük/instance sayısı) tanımlı tutulur.

---

## 7. Arama

- **Pilot (KK-11):** PostgreSQL FTS — `tsvector` + GIN, gerekirse `pg_trgm`. Tek belediye/birkaç bin ilan için yeter, ekstra sunucu yok.
- **Hedef:** OpenSearch. Kaynak-of-truth değil, `ilanlar`'ın türetilmiş index'i. Besleme: **outbox-indexer** (§6, KK-15). Tam-reindex replica'dan (soğuk okuma). Model: **tek ortak index + `tenant_slug` + zorunlu filtre** (index-per-tenant → shard patlaması). Tenant filtresi atlanamayan sarmalayıcı repo'da — arama katmanının `search_path` disiplini.
- **Soyutlama:** `Search` modülü arayüz arkasında; backing store (Postgres FTS ↔ OpenSearch) değişince üst kod değişmez.

---

## 8. Veri Katmanı ve Depolama

- **PostgreSQL 16:** Pilotta tek master (yazma + tüm okuma). Kod **replica-hazır** (KK-14): okumalar ayrı bir "read DataSource" soyutlamasından geçer; replica geldiğinde soğuk okumalar oraya yönlenir, sıcak (açık artırma) okumalar master'da kalır.
- **Kalıcılık (KK-03 ✅ hibrit):** Erişim **parametrize raw `pg`** — `rawQuery(qr, sql, $params)`, `qr` ALS'den (`getCurrentTenant().queryRunner`). TypeORM entity'leri yalnız **tip** için (`import type`), runtime'da ORM yok (`typeorm ^1.0.0` geçersiz sürüm). Migration/DDL ise `libs/tenancy` runner'ında. Kural: string birleştirmeyle SQL yasak; her sorgu parametreli — izolasyon (§2) bu desenle yapısal olarak korunur.
- **MinIO:** Evrak, ilan görseli, teminat dekontu. Pre-signed URL ile yükleme/indirme, tenant-scoped path. Pilotta tek-node; hedefte S3-uyumlu servis.

---

## 9. Dış Entegrasyonlar — Stub → Gerçek

Hepsi `provider-interfaces.ts` arkasında, DI ile enjekte (KK-06). Gerçek sağlayıcı bağlanınca **yalnız DI implementasyonu değişir, servis kodu değişmez** (kırmızı çizgi).

| Provider | Arayüz | Pilot durumu | Hedef |
|----------|--------|--------------|-------|
| TeminatProvider | blokeEkle / iadeEt / durumSorgula | Stub (provizyon yok) | Banka / Sanal POS (örn. VPOS) |
| EImzaProvider | imzala / dogrula | sha256 placeholder | KamuSM / mobil imza |
| EDevletProvider | tcDogrula | **"her zaman doğrulandı"** | e-Devlet SAML/OAuth |

**Uyarı:** e-Devlet ve e-imza stub'ları teknik borçtan öte **hukuki risk** — gerçek bir belediye açık artırması hukuki sonuç doğurur. Canlıya çıkmadan önce zorunlu değişecekler; bu, mevzuat uyumu iş kaleminin (§12) parçasıdır.

---

## 10. Gözlemlenebilirlik

Prometheus (`prom-client` + MetricsInterceptor, `/api/metrics`) · Grafana (provisioning + dashboard repoda) · Pino yapılandırılmış JSON log (`/health`, `/metrics` gürültüden hariç) · `/api/health` (DB ping + uptime, compose healthcheck).

---

## 11. Dağıtım ve CI/CD

- **Dev:** Docker Compose — tek host tam stack (postgres/redis/keycloak/minio + api/tenant-web/portal + prometheus/grafana; OpenSearch pilotta kapalı).
- **Pilot (KK-12):** Tek sunucu (prod docker-compose / basit container host). k8s manifestleri gelecek için repoda kalır ama **çalıştırılmaz** — solo ekip için operasyon vergisi. k8s'in bir teslim taahhüdü olup olmadığı sorulacak.
- **CI:** GitLab, `nx affected` (sadece değişen projeler); `verify` (lint/test/build) geçmeden `docker-build` çalışmaz.

---

## 12. Güvenlik ve Uyum

- **Cross-tenant savunma derinliği:** §2'deki üç kat + §7'deki arama filtresi. Tek disiplin kaybı = sızıntı; bu yüzden izolasyon otomatik (repository/wrapper) olmalı, elle değil.
- **Backend-otoriter yetki + audit hash-chain** (tamper-evident, `UPDATE`/`DELETE` trigger ile engelli).
- **KVKK:** Başvuruda açık rıza kaydı; tam aydınlatma akışı ileri faz.
- **Mevzuat (2886 sayılı Devlet İhale Kanunu):** İhale tipleri ve süreç kanuna göre; e-imza/e-Devlet'in hukuki geçerliliği pilotun önündeki asıl kapı. **Ayrı iş kalemi olarak izlenmeli** — döküman bunu sadece teknik (audit) tarafıyla ele almış.

---

## 13. Bilinçli Ertelenenler (gerekçeli)

Hepsi hedef mimaride var; pilotta çalıştırılmaz. Erteleme = kapıyı açık bırakıp yükü sonraya koymak.

| Bileşen | Neden ertelendi | Ne zaman açılır | Karar |
|---------|-----------------|-----------------|:---:|
| OpenSearch | Pilotta Postgres FTS yeter, bir hareketli parça eksilir | Yüksek hacimli/fasetli arama | KK-11 |
| Kubernetes | Solo ekip için operasyon vergisi | Çoklu-instance ölçek | KK-12 |
| Read replica | Pilotta okuma yükü yok | Ağır public okuma trafiği | KK-14 |
| Gerçek providerlar | Pilotta sim yeter (teminat); hukuki hazırlık gerek | Canlı öncesi zorunlu | KK-06 |
| auction-service ayrımı | Erken servis ayrımı yük | Bidding bağımsız ölçek isteyince | — |
| CDC (Debezium) | Outbox yeter, Kafka fazla | Çok kaynaklı senkron gerekince | KK-15 |

---

## 14. İş Paketi Eşlemesi ve Pilot Omurga

Vizyon İş Paketleri (İP1–İP8) ↔ mimari, `YOL-HARITASI.md`'de. Özet omurga:

**Kuzey yıldızı:** tek belediye → tek gerçek açık artırma → başvurudan sonuçlanmaya, izole ve denetlenebilir.

0. git init + ilk commit (kapsamdan bağımsız, önce)
1. Ground truth — İP2–İP6 modülleri kodda iskelet mi gerçek mi teyit
2. Tenancy sağlamlaştırma — KK-03 (ORM), KK-07 (set_config), KK-10 (WS izolasyonu)
3. Uçtan uca: demo tenant → ilan → başvuru → teminat(sim) → canlı açık artırma → sonuçlan → audit
4. e2e test — izolasyon + anti-sniping
5. Pilot uyarlaması — aday belediye ihtiyacına göre (PO ile)

---

*Kararların gerekçeleri `DECISIONS.md` · sıra ve durum `YOL-HARITASI.md` · kırmızı çizgiler ve çalışma ritmi `CLAUDE.md`.*

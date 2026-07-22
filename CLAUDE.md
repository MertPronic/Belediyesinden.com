# CLAUDE.md — belediyesinden.com Proje Anayasası

> Her Claude Code / Claude oturumunun başında eksiksiz yapıştırılır.
> Buradan bir şey **çıkarılmaz**, sadece eklenir. Değişiklik gerektiren her
> mimari karar `DECISIONS.md`'de gerekçelendirilerek yapılır.
>
> Sürüm: v0.2 · Kod incelemesi sonrası · Canlı belge (PO ile evrilecek)

---

## Proje Kimliği

- **Proje:** belediyesinden.com — Çok Kiracılı Belediye Varlık Yönetimi & Elektronik Açık Artırma Platformu (GovTech SaaS)
- **İş modeli:** Belediyeler `{slug}.belediyesinden.com` alt alan adı üzerinden satış / kiralama / işletme hakkı / reklam alanı ilanları yayınlar. Vatandaş ve yatırımcılar elektronik başvurur, teminat yatırır, canlı açık artırmaya katılır. Merkezi `portal` tüm belediye ilanlarını tek noktada toplar.
- **Ekip:** Murat (şirket sahibi, kurucu geliştirici) · Mert (teknik lider / geliştirici — mimari sorumluluk bende) · Harun (Product Owner)
- **Statü:** Devralınmış, kısmen inşa edilmiş kod tabanı. Kesişen katmanlar (tenancy izolasyonu, guard zinciri, auth, audit hash-chain, WS gateway relay, worker, tenant provisioning) **gerçek ve çalışıyor**. Açık artırma çekirdeği (teklif doğrulama, anti-sniping) `auction-core`'da testli. Domain modülleri (`ilan`, `teklif`, `teminat`, `basvuru`, `evrak`, `varlik`…) `apps/api/src/` altında mevcut, olgunlukları değişken. Hedef: pilot belediyeye giden omurgayı sağlamlaştırıp tamamlamak.

> **Ar-Ge / grant notu:** Vizyon dökümanı (`Belediyesinden.com.docx`) İş Paketi / Ar-Ge dilinde yazılmış. Bunun bir TÜBİTAK/KOSGEB/Teknopark başvurusuna bağlı olup olmadığı **DOĞRULANACAK**. Grant'e bağlıysa İş Paketi teslimleri ve belgeleme yükümlülüğü bağlayıcıdır ve her adımda kanıt/karar kaydı tutmak zorunludur.

---

## Kırmızı Çizgiler — Hiç Sapılmaz

Tartışmaya kapalı. Değiştirmek için `DECISIONS.md`'de gerekçeli karar şart.

- **Tenant izolasyonu kutsaldır.** Hiçbir sorgu, istek bağlamındaki ALS `queryRunner`'ı dışında bir bağlantı üzerinden koşmaz. `dataSource.query(...)` ile taze bağlantı çekmek varsayılan `search_path`'e düşer = sessiz cross-tenant sızıntı → **yasak**. (Kodda `TeklifService.qr()` deseniyle yapısal olarak tutturulmuş — her servis bu deseni izler.)
- **Mimari stil sabit: functional-core / imperative-shell** (KK-16). Ağır domain kuralları saf + testli `libs/*-core`'da; servis = ince kabuk (yükle → çekirdeği çağır → yaz → yan etki). Tümden DDD/Clean rewrite'ına **geçilmez**; ceremony eklenmez.
- **Kalıcılık standardı: parametrize raw `pg`** (KK-03). Sorgular `rawQuery(qr, sql, $params)` ile; TypeORM sadece tip için (`import type`). String birleştirme yasak.
- **Sürüm kontrolü zorunlu.** Kod git'te yaşar. "Sadece yerelde çalışıyor" diye commit'siz iş yok.
- **Güvenlik backend-otoriterdir.** İstemci yalnızca UX tahmini yapar; teklif doğrulama, yetki ve teminat her zaman backend'de doğrulanır.
- **Kararlar kayıtlıdır.** Bir mimari sapma, `DECISIONS.md`'ye "planlanan → gerçekleşen → neden" olarak yazılmadan yapılmaz.
- **Stub'lar sözleşmeye sadıktır.** Gerçek sağlayıcı (banka/POS, e-Devlet, e-imza) bağlanınca yalnızca DI implementasyonu değişir; servis kodu değişmez.

---

## Çalışma Ritmi

- **Modül geliştirme sırası:** (1) arayüz/imza + sözleşme → (2) test senaryoları → (3) failing test → (4) implementasyon → (5) refactor. Arayüz onaylanmadan implementasyona geçilmez.
- **Küçük, gözden geçirilebilir PR'lar.** Bir seferde her şey yazılmaz; her adımda dur, ne yapacağını söyle, onay bekle.
- **Her oturum açılışı:** `CLAUDE.md` + `DECISIONS.md` + `YOL-HARITASI.md` okunur → "neredeyiz + sıradaki adım" tespiti yapılır → sonra iş.

---

## Teknik Stack (mevcut — kodda/dokümanda görülen)

- **Backend:** NestJS 11 — modüler monolit `api` + iskelet `auction-service` (main.js ~4KB, katlanmış) + bağımsız `worker`
- **Frontend:** Next.js 16 / React 19 — `tenant-web` (vatandaş + admin back-office) & `portal` (merkezi, ağırlıklı public)
- **Kalıcılık:** PostgreSQL 16 (şema-başına-tenant, `search_path` izolasyonu). Erişim **parametrize raw `pg`** (`pg` sürücüsü); TypeORM sadece tip için (`package.json`'da `typeorm ^1.0.0` geçersiz sürüm — runtime'da kullanılmıyor).
- **Diğer veri:** Redis 7 + BullMQ · MinIO (S3-uyumlu) · **Arama:** pilotta Postgres FTS (KK-11), OpenSearch ertelendi.
- **Kimlik:** Keycloak 26 — tek realm `belediyesinden`, roller: SUPERADMIN · TENANT_ADMIN · ENCUMEN · VATANDAS · YATIRIMCI. *Not:* hem `nest-keycloak-connect` hem elle `jose` doğrulaması var → tek mekanizmada sadeleşilecek (bkz. DECISIONS notları).
- **Guard zinciri:** TenantThrottler → AuthGuard(JWT) → RollerGuard → TenantGuard → TenancyInterceptor(search_path) → MetricsInterceptor
- **Standart modül deseni:** `TeklifService` referanstır (controller + service[ince kabuk, `qr()`, audit] + entity[tip] + module). Yeni modüller bunu izler.
- **Monorepo:** Nx 23 + pnpm 11 · **CI:** GitLab (`nx affected`) · **Prod:** pilotta tek-host; Kubernetes ertelendi (KK-12, manifestler repo'da)

---

## Kapsam Disiplini

Vizyon dökümanı geniş: 11 yazılım sistemi, banka/POS + e-Devlet + e-imza entegrasyonu, k8s prod, load & penetrasyon testleri. Solo ekip için bunu **harfiyen almak projeyi boğar.**

**Kuzey yıldızı:** tek belediye → tek gerçek açık artırma → başvurudan sonuçlanmaya kadar, izole ve denetlenebilir. Bunu çalıştıran en kısa dikey kesit = **omurga**. Geri kalan her şey bu omurgadan sonra sıraya girer.

Kapsam değişiklikleri Harun (PO) ile netleşir; bu dosyaya ve `YOL-HARITASI.md`'ye yansıtılır.

# Parça 1 — Temel Altyapı: Tenancy İzolasyonu & Kimlik/Roller

> Proje 6 parçaya bölündü (bkz. `YOL-HARITASI.md`); bu doküman 1. parçayı kapsar.
> Durum: ✅ Tamamlandı, test edildi, üretim öncesi bilinen riskler aşağıda listeli.
>
> Sürüm: v1.0 · Son güncelleme: 2026-08-04

---

## 1. Amaç ve Kapsam

Bu parça, platformun üzerine oturduğu iki temel garantiyi kapsar:

1. **Tenancy izolasyonu** — bir belediyenin verisi başka bir belediyeden hiçbir koşulda görünmez/erişilmez olmalı.
2. **Kimlik & roller** — bir kullanıcının kim olduğu ve hangi belediyede hangi yetkiye sahip olduğu, her istekte güvenilir şekilde doğrulanmalı.

Diğer 5 parçanın (varlık/ilan, başvuru/teminat, canlı ihale, sonuç sonrası, portal) tümü bu iki garantinin üzerine inşa edilir — burada bir sızıntı, tüm platformu etkiler. Bu yüzden CLAUDE.md'de "kırmızı çizgi" olarak tanımlanmıştır.

---

## 2. Mimari — Tenancy İzolasyonu

### 2.1 Model: Şema-başına-tenant

Her belediye, aynı PostgreSQL veritabanında kendi şemasına sahiptir (`tenant_<slug>`, örn. `tenant_melikgazi`). Tüm tenant'lara ait ortak veri (`shared.tenants` kayıt listesi, audit log vb.) `shared` şemasında tutulur.

### 2.2 İstek yaşam döngüsü

Her HTTP isteği, sırayla şu 6 katmandan geçer (`apps/api/src/app/app.module.ts`):

```
TenantThrottlerGuard   → tenant bazlı rate limit
AuthGuard               → Keycloak JWT doğrulama (imza + issuer)
RollerGuard             → @Roller(...) decorator kontrolü (RBAC)
TenantGuard             → subdomain ↔ tenant kaydı ↔ JWT tenant_id eşleşmesi
TenancyInterceptor      → PostgreSQL transaction açar, search_path'i tenant şemasına kilitler
MetricsInterceptor      → Prometheus metrik
```

**`TenancyInterceptor`** (`libs/tenancy/src/lib/tenancy.interceptor.ts`) izolasyonun teknik çekirdeğidir:

1. İstek başında bir `QueryRunner` açar ve **transaction başlatır**.
2. `SET LOCAL search_path TO tenant_<slug>, shared` çalıştırır — bu oturumdaki (transaction'daki) her sorgu artık öncelikle o tenant'ın şemasına düşer.
3. Bu bağlamı (`slug`, `schema`, `queryRunner`) **AsyncLocalStorage** üzerinden tüm servislere yayar — servisler `getCurrentTenant()` ile erişir, parametre olarak taşımaya gerek yok.
4. Handler başarıyla biterse **commit**, hata olursa **rollback**; sonra `QueryRunner` serbest bırakılır.

**Neden önemli:** Her istek kendi izole bağlantısını/transaction'ını alır. Bir serviste `dataSource.query(...)` ile taze bir bağlantı çekmek (bu ALS bağlamının dışına çıkmak) varsayılan `search_path`'e düşer — bu, sessiz cross-tenant sızıntı anlamına gelir ve kod tabanında **yasaktır** (CLAUDE.md kırmızı çizgisi). Bütün servisler `this.qr()` deseniyle her zaman aktif tenant'ın `queryRunner`'ını kullanır.

### 2.3 Tenant slug çözümleme

`resolveTenantSlugFromHeaders()` (`libs/tenancy/src/lib/tenant-resolver.ts`), sırayla:
1. `x-tenant-slug` header'ı (SSR/proxy istekleri),
2. Host subdomain'i (`melikgazi.belediyesinden.com` → `melikgazi`),
3. `?tenant=` query param (yalnızca doğrudan kaynak URL'lerinde — görsel/dosya indirme gibi header taşıyamayan isteklerde fallback).

Merkezi portal istekleri (tenant yok) izolasyonsuz geçer — bilerek, çünkü portal tüm belediyelerin genel/public verisini toplar.

### 2.4 Cross-tenant erişim engeli (`TenantGuard`)

`apps/api/src/app/tenant.guard.ts` — subdomain'den çözülen tenant ile JWT'deki `tenant_id` (personel kullanıcılarda dolu) eşleşmiyorsa **403** döner. SUPERADMIN (JWT'de `tenant_id` yok) tüm tenant'lara erişebilir; diğer personel rolleri sadece kendi belediyesine.

---

## 3. Mimari — Kimlik & Roller

### 3.1 Keycloak

Tek realm: `belediyesinden`. Beş rol:

| Rol | Kapsam |
|---|---|
| `SUPERADMIN` | Platform geneli, tüm tenant'lara erişir |
| `TENANT_ADMIN` | Tek belediye yönetimi |
| `ENCUMEN` | Tek belediye, ihale/teminat onay yetkisi |
| `VATANDAS` | Vatandaş — **bilerek** hiçbir tenant grubuna bağlı değil |
| `YATIRIMCI` | Yatırımcı — aynı şekilde tenant-bağımsız |

### 3.2 JWT'den kullanıcı çıkarımı

`extractUser()` (`libs/auth/src/lib/token-extractor.ts`), doğrulanmış JWT'den normalize edilmiş bir `AuthenticatedUser` üretir: `sub`, `email`, `ad`/`soyad` (`given_name`/`family_name`), `roles` (realm rollerinden `KullaniciRolu`'na eşlenir), `tenantId` (`tenant_<slug>` grup üyeliğinden türetilir).

**Önemli ayrım:** `TENANT_ADMIN`/`ENCUMEN` gibi personel rolleri Keycloak'ta bir `tenant_<slug>` grubuna üyedir (JWT'de `tenant_groups` claim'i dolu) — bu, `TenantGuard`'ın subdomain eşleşmesini yapabilmesinin temelidir. `VATANDAS`/`YATIRIMCI` ise **hiçbir tenant grubuna bağlı değildir** — bir vatandaş prensipte herhangi bir belediyenin ilanına başvurabilir/teklif verebilir, tek bir belediyeye "ait" değildir. Bu ayrım bilinçli bir tasarım kararıdır, ama aşağıda (bkz. §5) bir üretim hatasına yol açtığı için ayrıca not edildi.

### 3.3 Yetkilendirme (`@Roller(...)`)

Her endpoint ya `@Roller(KullaniciRolu.X, ...)` ile açık rol listesi taşır, ya da `@Unprotected()` ile bilerek public bırakılır — decorator'suz bırakılmaz (CLAUDE.md kural). `RollerGuard` (`apps/api/src/app/roller.guard.ts`) bunu `extractUser().roles` üzerinden değerlendirir; SUPERADMIN her zaman geçer.

`@Unprotected()`'ın gizli tuzağı: `nest-keycloak-connect`'in varsayılan `skipAuth=true` davranışı, JWT mevcut olsa bile onu **hiç ayrıştırmaz**. "Route açık ama giriş yapmışsa kullanıcıyı da tanı" (örn. personel önizleme) istenen yerlerde `@Unprotected(false)` kullanılmalı — bu proje boyunca bir kez atlanıp debug edilerek bulundu.

---

## 4. Güvenlik Garantileri — Nasıl Doğrulandı

- **Cross-tenant izolasyon:** `apps/api/src/ilan/ilan.integration.spec.ts` — iki ayrı tenant provision edilip, B tenant'ının A tenant'ının ilanını göremediği gerçek Postgres'e karşı doğrulandı.
- **JWT imza doğrulama:** `jose` + Keycloak JWKS (uzaktan, offline doğrulama) — hem REST (`nest-keycloak-connect`) hem WebSocket (`AuctionGateway`, elle `jwtVerify`) katmanında.
- **Rol/tenant eşleşmesi:** `TenantGuard` + `RollerGuard` her istekte; manuel + otomatik testlerle (bu oturumdaki çok-kullanıcılı senaryolar dahil) defalarca doğrulandı.

---

## 5. Bilinen Sınırlamalar / Açık Riskler

- **KK-07 (artık-risk):** Ingress/proxy seviyesinde public yollarda `x-tenant-slug` header'ının dışarıdan taklit edilmesine karşı ayrıca bir strip kuralı henüz yok — düşük öncelik, ele alınmadı.
- **KK-19:** Hem `nest-keycloak-connect` hem elle `jose` doğrulaması var (WS için); iki mekanizma yerine tek mekanizmaya sadeleştirme yapılmadı — düşük öncelik.
- **WS tenant çözümleme bug'ı (düzeltildi, ders çıkarıldı):** `AuctionGateway`, tenant'ı yalnızca JWT'nin `tenant_groups` claim'inden çözüyordu. §3.2'de anlatılan "vatandaş hiçbir tenant grubuna bağlı değil" tasarımı yüzünden, **hiçbir sıradan vatandaş canlı teklif WS'ine bağlanamıyordu** — bu, üretime çıkmadan önce fark edilip düzeltildi (`?tenant=` query fallback). Bu parçanın (kimlik/tenancy) diğer parçaları (canlı ihale) nasıl sessizce kırabileceğinin somut bir örneği; benzer varsayımlar yeni özelliklerde tekrar kontrol edilmeli.
- **`gh`/`git` çoklu hesap kurulumu** bu parçanın kapsamı dışında ama ilgili: geliştirme ortamında iki farklı GitHub kimliği (SSH host alias ile) ayrıştırıldı — kod tabanını etkilemiyor, sadece not düşülüyor.

---

## 6. Durum Özeti

| Alt bileşen | Durum |
|---|---|
| Şema-başına-tenant izolasyon | ✅ Test edildi |
| Guard zinciri (6 katman) | ✅ Çalışıyor |
| Keycloak realm + 5 rol | ✅ Kuruldu |
| JWT → kullanıcı çıkarımı | ✅ Çalışıyor |
| WS katmanında kimlik/tenant doğrulama | ✅ Düzeltildi (bkz. §5) |
| Ingress seviyesi header strip (KK-07) | ⬜ Yapılmadı |
| Auth mekanizması sadeleştirme (KK-19) | ⬜ Yapılmadı |

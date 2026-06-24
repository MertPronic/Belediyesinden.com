# Faz 0 — Temel & İskelet (İP1) · Detaylı Uygulama Planı

> Üst düzey yol haritası: `docs/plans/` içindeki ana plan (`.claude/plans/docs-dizini-alt-nda-bi-binary-rose.md`).
> Bu doküman, yol haritasının **ilk somut adımı** olan Faz 0'ın dosya-düzeyinde uygulama planıdır.

## Amaç & Kapsam

Faz 0, tüm fazların (ilan, açık artırma, teminat, kural motoru…) kurulacağı **zeminidir**. Faz 0 sonunda:

- `docker compose up -d` → 5 altyapı servisi (postgres, redis, keycloak, minio, elasticsearch) **healthy** ayakta.
- `nx serve api` → NestJS boot olur, `/health` 200 döner.
- `pnpm ts-node scripts/create-tenant.ts demo` → `tenant_demo` schema + varsayılan seed + Keycloak realm oluşur.
- `nx run-many -t lint test build` → yeşil; CI pipeline affected modda çalışır.

Faz 0 **business özellik üretmez** — sadece iskelet + çok-kiracılı çekirdek + CI.

---

## 0. Önkoşullar (makine hazırlığı)

| Araç | Durum | Aksiyon |
|---|---|---|
| Node 24.15 | ✓ kurulu | — |
| git 2.45 | ✓ kurulu | — |
| **pnpm** | ✗ yok | `corepack enable && corepack prepare pnpm@latest --activate` |
| **Docker Desktop** | daemon kapalı | Uygulamayı başlatın |
| Bash tool (msys) | çoklu fork'ta çöküyor | Tüm komutları **PowerShell** üzerinden çalıştır |

> Not: Bu makinede Git Bash `fork() failed` hatası veriyor. Scaffolding komutları PowerShell terminalinden (`! <cmd>` veya doğrudan) koşulmalı.

---

## 1. Monorepo İskeleti (Nx + pnpm)

```powershell
# 1. pnpm'i aktive et
corepack enable
corepack prepare pnpm@latest --activate

# 2. Nx workspace (root: C:\Antigravity\belediyesinden)
pnpm create nx-workspace@latest belediyesinden-tmp --preset=ts --nxCloud=skip
#   → içeriğini mevcut repo root'una taşı, ardından tmp'yi sil

# 3. Eklentiler
pnpm add -D @nx/nest @nx/next @nx/js @nx/workspace

# 4. Uygulamalar
pnpm nx g @nx/nest:application  api              # Ana API/BFF
pnpm nx g @nx/nest:application  auction-service  # Gerçek zamanlı açık artırma (ws)
pnpm nx g @nx/nest:application  worker           # BullMQ worker'lar
pnpm nx g @nx/next:application portal           # belediyesinden.com (merkezi portal)
pnpm nx g @nx/next:application tenant-web        # {tenant}.belediyesinden.com

# 5. Paylaşılan kütüphaneler
pnpm nx g @nx/js:library shared       # tipler, DTO, enum, sabitler
pnpm nx g @nx/js:library db           # TypeORM entity + migration + tenant runner
pnpm nx g @nx/js:library tenancy      # tenant resolution + search_path interceptor
pnpm nx g @nx/js:library audit        # append-only hash-chain
pnpm nx g @nx/js:library auth         # Keycloak adapter (Faz 1'de dolacak)
pnpm nx g @nx/js:library ui           # React/Tailwind bileşenleri + tenant theming
```

**Hedef yapı** (yol haritası §3 ile aynı): `apps/{api,auction-service,worker,portal,tenant-web}` + `libs/{shared,db,tenancy,audit,auth,ui}` + `infra/`.

`nx.json`: `nx affected` + cache etkin; `pnpm-workspace.yaml` Nx workspace'i package manager'a tanıtır.

---

## 2. `libs/shared` — Tip & Sabit Çekirdeği

- `enums/`: `IlanDurumu` (taslak/yayin/canli/sonuç/iptal), `IhaleTipi` (acikArtirma/acikTeklif/kapaliTeklif), `TenantDurumu`, `VarlikTipi` (tasinir/tasinmaz/isletmeHakki/reklamAlani).
- `dto/`: temel pagination/响应 zarfları (`Result<T>`, `Paginated<T>`).
- `errors/`: `AppError` sınıfı + standart hata kodları.
- i18n anahtar şablonları (TR-first).

---

## 3. `libs/db` — TypeORM + `shared` Schema

**Tek DataSource** (multi-tenant için connection-per-tenant değil, `search_path` patternı kullanılacak — bkz. §4).

- `data-source.ts`: root bağlantı (migrasyon/DDL için).
- `shared` schema entity'leri (tüm tenant'ları aşan):
  - `tenants` (id, slug, ad, durum, keycloakRealm, temaConfig, createdAt)
  - `users` (id, keycloakSub, tenantId?, rol, ...) — merkezi kullanıcı kaydı
  - `audit_log` (append-only; `libs/audit` kullanır)
  - lookup tabloları (il, ilçe, para birimi, kategori)
- `migrations/shared/`: shared schema migration'ları.
- `infra/postgres/init.sql`: `CREATE SCHEMA IF NOT EXISTS shared; CREATE EXTENSION IF NOT EXISTS pgcrypto;`

---

## 4. `libs/tenancy` — Schema-per-Tenant Çekirdeği ★ (Faz 0'ın teknik kalbi)

### 4.1 Tenant resolution
- `TenantResolver`: istek subdomain'inden tenant slug çözer (`talas.belediyesinden.com` → `talas`). `localhost`/`portal` → merkezi.
- NestJS `TenantMiddleware` → `req.tenant` üzerine yazar; bulunamazsa 404.

### 4.2 `search_path` patternı (TypeORM)
Her tenant isteği için, o işlem boyunca PostgreSQL `search_path`'i tenant schema'sına çekilir; `shared` fallback olarak eklenir:

```
SET LOCAL search_path TO tenant_demo, shared;
```

- `TenancyInterceptor`: her HTTP isteğinde bir **transaction** açar, içine `SET LOCAL search_path` koşturur, request sonuna kadar tüm sorgular `tenant_<slug>` + `shared` üzerinde çalışır. Transaction bitince `search_path` otomatik reset (LOCAL scope).
- Böylece: tenant tabloları öncelikli; `shared` lookup tabloları fallback erişilebilir; **uygulama kodu schema farkında olmadan** yazar.
- WS (auction-service) için: bağlantı kurulurken tenant resolve edilir, her mesaj işleyici kendi transaction + search_path kurar.

### 4.3 Tenant Migration Runner
`scripts/create-tenant.ts <slug>`:
1. `shared.tenants` kaydını oluştur (durum=provisioning).
2. `CREATE SCHEMA tenant_<slug>` (root DataSource ile).
3. `migrations/tenant/` kümesini **o schema'da** koştur (TypeORM migration runner'a `--schema tenant_<slug>` / `search_path` set).
4. Varsayılan **kural seti** + **tema** seed'lerini ekle.
5. Keycloak realm + client oluştur (admin API, `libs/auth` üzerinden).
6. `tenants.durum = active`.

**Deploy-time migration:** `scripts/migrate-all-tenants.ts` → `shared.tenants` üzerinden döngüyle her tenant schema'sında bekleyen yeni migration'ları koşturur (Faz 0'da iskelet; CI'da opsiyonel dry-run).

> pg_catalog şişmesi riski (yol haritası §6): Faz 0'da `tenants` sayısı + `pg_catalog` boyutunu loglayan basit bir sağlık betiği ekle (izleme altyapısı Faz 6'da).

---

## 5. `libs/audit` — Append-Only + Hash-Chain (iskelet)

- `AuditLog` entity (`shared.audit_log`): `id, tenantId, actorId, action, entityType, entityId, payload jsonb, prevHash, hash, ts`.
- `hash = sha256(prevHash || canonicalJson(payload) || ts)` → **değiştirilemez zincir**.
- `UPDATE`/`DELETE`'i **trigger** ile engelle (DDL migration'da).
- Faz 0'da sadece entity + servis arayüzü; interceptor'lara bağlanma Faz 1'de.

---

## 6. `infra/docker-compose.yml` (yerel dev)

Servisler (tek ağ, healthcheck'li, volume'lı):

| Servis | İmaj | Not |
|---|---|---|
| postgres | `postgres:16` | init.sql (`shared` schema + pgcrypto), healthcheck |
| redis | `redis:7-alpine` | Streams + BullMQ için, AOF kapalı (dev) |
| keycloak | `quay.io/keycloak/keycloak:26.0` | Postgres backend, `KC_IMPORT` ile realm, admin: admin/admin |
| minio | `minio/minio` | S3-uyumlu, root şifre dev |
| **opensearch** | `opensearchproject/opensearch:2` *(ES yerine)* | Tek node, `discovery.type=single-node`, 512m heap |

> **OpenSearch tercih gerekçesi:** Apache 2.0 lisans, Elastic'in değişen lisansından bağımsız, daha hafif tek-node dev. (Yol haritasındaki "ES/OpenSearch" açık kararını OpenSearch lehine kapatır.)

`.env.example`: tüm bağlantı/şifre değişkenleri tek yerde.

---

## 7. Keycloak (`infra/keycloak/realm-export.json`)

- Realm: `belediyesinden`.
- Client'lar: `portal` (public, PKCE), `tenant-web` (public, PKCE), `api` (confidential).
- Roller: `superadmin`, `tenant-admin`, `encumen`, `vatandas`, `yatirimci`.
- docker-compose'ta `KEYCLOAK_IMPORT` ile otomatik içe aktarım.
- **Realm-per-tenant mı, tek realm + tenant-claim mi?** → Faz 0'da tek realm + `tenant_id` claim; realm-per-tenant stratejisi Faz 1'de değerlendirilir (açık karar).

---

## 8. CI İskeleti (`.gitlab-ci.yml`)

```yaml
stages: [install, verify, docker]
install:
  image: node:24
  cache: { key: pnpm, paths: [.pnpm-store] }
  script: [corepack enable, pnpm install --frozen-lockfile]
verify:
  script: [pnpm nx affected -t lint test build]
docker:
  script: [pnpm nx affected -t docker-build]   # affected app'ler için
```

- `nx affected` sayesinde sadece değişen paketler test/build edilir.
- Deploy stage Faz 6'ya kadar placeholder.

---

## 9. Faz 0 Açık Alt-Kararları (uygulama sırasında netleşecek)

1. **ORM:** TypeORM (önerilen, schema-per-tenant `search_path` desteği) — MikroORM/Prisma alternatif.
2. **Arama:** OpenSearch (önerilen) — ES alternatif.
3. **Tenant auth modeli:** tek-realm + claim (Faz 0) vs realm-per-tenant (Faz 1'de karar).
4. **pnpm store** konumu / Docker base image.
5. **NestJS monorepo vs Nx app:** Nx app (tutarlı codegen için).

---

## 10. Doğrulama (Faz 0 çıkış kapıları)

1. `docker compose up -d --wait` → 5 servis `healthy`.
2. `pnpm nx serve api` → `GET /health` → 200.
3. `pnpm ts-node scripts/create-tenant.ts demo` → psql'de `\dn` → `tenant_demo` schema; Keycloak'ta realm görünür; `shared.tenants`'da kayıt `active`.
4. İki farklı tenant context'inde API isteği → cross-tenant veri sızıntısı **yok** (otomatize izolasyon testi).
5. `audit_log`'a manuel `UPDATE` → trigger ile reddedilir; hash zinciri tutarlı.
6. `pnpm nx run-many -t lint test build` → yeşil.
7. GitLab CI (mock commit) → `nx affected` doğru alt-kümede çalışır.

---

## Teslimat Sırası (PR'lar)

1. **PR-1:** Nx+pnpm workspace iskeleti + `nx.json`/`pnpm-workspace.yaml` + tsconfig/ESLint/Prettier + `.gitignore`.
2. **PR-2:** `infra/docker-compose.yml` + `.env.example` + `postgres/init.sql` → `docker compose up` çalışır.
3. **PR-3:** `libs/shared` + `libs/db` (TypeORM DataSource + `shared` entity/migration).
4. **PR-4:** `libs/tenancy` (resolver + `TenancyInterceptor`/search_path) + `scripts/create-tenant.ts` + izolasyon testi.
5. **PR-5:** `libs/audit` (entity + hash-chain + trigger).
6. **PR-6:** Keycloak realm-export + `apps/api` `/health` + `.gitlab-ci.yml`.

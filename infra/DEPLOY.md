# Deployment — Docker Compose (tek host tam stack)

Tek `docker compose up` ile tüm platform ayağa kalkar: PostgreSQL, Redis, Keycloak,
MinIO, OpenSearch (infra) + api, tenant-web, portal (uygulama).

## Hızlı başlangıç

```bash
# 1) API artifact'ini host'ta üret (webpack-cli NxAppWebpackPlugin container içinde
#    spawn sorunu yaşıyor; lib'ler main.js'e inline, bu yüzden pre-build güvenli).
pnpm nx build api

# 2) Tüm stack'i kur + çalıştır (frontend container içinde build olur, Linux OK).
cd infra
docker compose up -d --build
```

Container'lar:

| Servis      | Port | Not                                       |
|-------------|------|-------------------------------------------|
| api         | 3000 | NestJS (pre-built dist + prod deps)       |
| tenant-web  | 4200 | Next.js standalone (container build)      |
| portal      | 4201 | Next.js standalone (container build)      |
| keycloak    | 8080 | realm import (admin/admin)                |
| postgres    | 5432 | shared + tenant_* schema'ları             |
| redis       | 6379 | pub/sub + rate-limit                      |
| minio       | 9000 | evrak/dekont (console :9001)              |
| opensearch  | 9200 | ilan indeks                               |

## Mimar notlar

- **API**: dist host'ta build edilir, image sadece prod bağımlılıkları + main.js paketler
  (lib'ler webpack ile inline → runtime'da external node_modules yeterli). `tslib`
  dependencies'te (TS bundle runtime dep'u).
- **Frontend**: container içinde `next build` (standalone output). Build-time
  `NEXT_PUBLIC_*` browser'a inline; SSR fetch'leri runtime `API_INTERNAL_URL`
  (compose service adı: `http://api:3000/api`) ile container→container.
- **Tenant migration bootstrap**: API açılışında tüm tenant'ların pending
  migration'larını koşar (schema evrimi restart ile yayılır).

## Bilinen sınır

`webpack-cli build` (api:build) container içinde `spawn /bin/sh ENOENT` veriyor
(çevresel). API dist'i host'ta üretip image'a kopyalayarak aşılır. Frontend
(Next.js) container içinde sorunsuz build olur.

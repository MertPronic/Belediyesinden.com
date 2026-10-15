#!/usr/bin/env bash
# Test sunucusuna deploy: main'i çek → API'yi host'ta build et → stack'i güncelle.
# Sunucuda repo kökünden çalıştırılır: ./scripts/deploy-test.sh
#
# Prometheus/Grafana bilerek dahil DEĞİL — sunucu RAM'i (≈4 GB) tam stack'e yetmiyor.
set -euo pipefail
cd "$(dirname "$0")/.."

SERVISLER="postgres redis keycloak minio opensearch api tenant-web portal"

echo ">> git pull"
git pull --ff-only

echo ">> pnpm install"
pnpm install --frozen-lockfile

# API Dockerfile container içinde build etmiyor, host'taki dist'i kopyalıyor (infra/DEPLOY.md).
echo ">> nx build api"
pnpm nx build api

# Footer'daki sürüm bilgisi (NEXT_PUBLIC_BUILD_* build arg'ları).
export BUILD_SHA=$(git rev-parse --short HEAD)
export BUILD_TIME=$(TZ=Europe/Istanbul date '+%d.%m.%Y %H:%M')

cd infra

# Caddy (HTTPS, infra/docker-compose.test.yml) varsa önce o: API, Caddy'nin yerel CA kök
# sertifikasına (NODE_EXTRA_CA_CERTS) açılışta ihtiyaç duyuyor — ilk kurulumda henüz yok.
if docker compose config --services | grep -qx caddy; then
  SERVISLER="$SERVISLER caddy"
  echo ">> caddy"
  docker compose up -d caddy
  for i in $(seq 1 30); do
    docker compose exec -T caddy test -f /data/caddy/pki/authorities/local/root.crt && break
    sleep 2
  done
fi

echo ">> docker compose up ($SERVISLER)"
docker compose up -d --build $SERVISLER

echo ">> API sağlık kontrolü"
for i in $(seq 1 30); do
  if curl -fs http://localhost:3000/api/health >/dev/null 2>&1; then
    echo "API ayakta ($(git rev-parse --short HEAD))"
    exit 0
  fi
  sleep 5
done
echo "API 150 sn içinde ayağa kalkmadı — 'docker compose logs api' ile bakın" >&2
exit 1

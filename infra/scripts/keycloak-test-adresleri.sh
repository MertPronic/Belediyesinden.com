#!/usr/bin/env bash
# Keycloak `portal` + `tenant-web` client'larına test sunucusu adreslerini ekler
# (realm-export.json sadece localhost içerir; dosyaya dokunmadan, çalışan Keycloak'a
# kcadm ile yazılır). İdempotent — tekrar çalıştırmak zararsız.
#
# Adresler .env'den türetilir: PORTAL_PUBLIC_URL ve TENANT_WEB_REDIRECT_TEMPLATE
# ({slug} → admin + shared.tenants'taki her belediye). Yeni açılan belediyeler zaten
# TENANT_WEB_REDIRECT_TEMPLATE ile otomatik eklenir; bu script mevcutları kapsar.
#
# Kullanım (infra/ dizininde, stack ayaktayken): ./scripts/keycloak-test-adresleri.sh
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env; set +a

PORTAL="${PORTAL_PUBLIC_URL:?PORTAL_PUBLIC_URL tanımlı değil}"
SABLON="${TENANT_WEB_REDIRECT_TEMPLATE:?TENANT_WEB_REDIRECT_TEMPLATE tanımlı değil}"
REALM="${KEYCLOAK_REALM:-belediyesinden}"
KC="docker exec bldys-keycloak /opt/keycloak/bin/kcadm.sh"

$KC config credentials --server http://localhost:8080 --realm master \
  --user "$KEYCLOAK_ADMIN" --password "$KEYCLOAK_ADMIN_PASSWORD" >/dev/null

SLUGS=$(docker exec bldys-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc \
  "SELECT slug FROM shared.tenants" | tr '\n' ' ')

PORTAL_URIS="${PORTAL}/*"
TENANT_URIS="${PORTAL}/* ${SABLON//\{slug\}/admin}"
for s in $SLUGS; do TENANT_URIS="$TENANT_URIS ${SABLON//\{slug\}/$s}"; done

ekle() { # $1 = clientId, $2.. = eklenecek URI'ler
  local client="$1"; shift
  local id mevcut yeni
  id=$($KC get clients -r "$REALM" -q clientId="$client" --fields id --format csv --noquotes)
  mevcut=$($KC get "clients/$id" -r "$REALM" --fields redirectUris)
  yeni=$(python3 -c '
import json, sys
m = json.loads(sys.argv[1]).get("redirectUris", [])
for u in sys.argv[2:]:
    if u not in m: m.append(u)
print(json.dumps(m))' "$mevcut" "$@")
  $KC update "clients/$id" -r "$REALM" -s "redirectUris=$yeni"
  echo "$client → $yeni"
}

ekle portal $PORTAL_URIS
ekle tenant-web $TENANT_URIS

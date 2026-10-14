#!/usr/bin/env bash
# Keycloak `portal` + `tenant-web` client'larına test sunucusu adreslerini ekler
# (realm-export.json sadece localhost içerir; dosyaya dokunmadan, çalışan Keycloak'a
# kcadm ile yazılır). İdempotent — tekrar çalıştırmak zararsız.
#
# Eklenenler: portal kök adresi, admin.<base> (süper admin paneli) ve shared.tenants'taki
# her belediye için <slug>.<base>. Yeni açılan belediyeler zaten
# TENANT_WEB_REDIRECT_TEMPLATE ile otomatik eklenir; bu script mevcutları kapsar.
#
# Kullanım (infra/ dizininde, stack ayaktayken): ./scripts/keycloak-test-adresleri.sh
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env; set +a

BASE="${TENANT_BASE_DOMAIN:?TENANT_BASE_DOMAIN tanımlı değil}"
REALM="${KEYCLOAK_REALM:-belediyesinden}"
KC="docker exec bldys-keycloak /opt/keycloak/bin/kcadm.sh"

$KC config credentials --server http://localhost:8080 --realm master \
  --user "$KEYCLOAK_ADMIN" --password "$KEYCLOAK_ADMIN_PASSWORD" >/dev/null

SLUGS=$(docker exec bldys-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc \
  "SELECT slug FROM shared.tenants" | tr '\n' ' ')

PORTAL_URIS="http://${BASE}:4201/*"
TENANT_URIS="http://admin.${BASE}:4200/* http://${BASE}:4201/*"
for s in $SLUGS; do TENANT_URIS="$TENANT_URIS http://${s}.${BASE}:4200/*"; done

ekle() { # $1 = clientId, $2.. = eklenecek URI'ler
  local client="$1"; shift
  local id
  id=$($KC get clients -r "$REALM" -q clientId="$client" --fields id --format csv --noquotes)
  local mevcut
  mevcut=$($KC get "clients/$id" -r "$REALM" --fields redirectUris)
  local yeni
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

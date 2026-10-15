#!/usr/bin/env bash
# Test sunucusunda demo verisi (scripts/seed-demo.ts). Stack ayaktayken repo kökünden:
#   ./scripts/seed-demo.sh [slug]     (varsayılan: melikgazi)
# Servislere host'tan yayınlanan portlarla (localhost) bağlanır; şifreler infra/.env'den.
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; . infra/.env; set +a
export POSTGRES_HOST=localhost POSTGRES_PORT=5432
export MINIO_ENDPOINT=localhost MINIO_PORT=9000
export OPENSEARCH_NODE=http://localhost:9200
export TENANT_BASE_DOMAIN
# Nest DI decorator metadata ister → tsx değil swc-node (tsconfig paths + emitDecoratorMetadata).
export SWC_NODE_PROJECT=tsconfig.base.json
exec node -r @swc-node/register scripts/seed-demo.ts "$@"

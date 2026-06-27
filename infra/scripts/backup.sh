#!/usr/bin/env bash
# Belediyesinden — PostgreSQL yedekleme (full + per-tenant schema dump).
# Schema-per-tenant avantajı: tek tenant'ı seçici geri yükleme.
#
# Kullanım: ./infra/scripts/backup.sh [output_dir]
# Cron: 0 2 * * * /path/to/backup.sh /backups >> /var/log/backup.log 2>&1
set -euo pipefail

OUTPUT_DIR="${1:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_HOST="${POSTGRES_HOST:-localhost}"
DB_PORT="${POSTGRES_PORT:-5432}"
DB_USER="${POSTGRES_USER:-belediyesinden}"
DB_NAME="${POSTGRES_DB:-belediyesinden}"

mkdir -p "$OUTPUT_DIR"
echo "[$(date)] Yedekleme başladı → $OUTPUT_DIR/$TIMESTAMP"

# 1) Full dump (tüm schema'lar + shared).
FULL_FILE="$OUTPUT_DIR/${TIMESTAMP}_full.sql.gz"
PGPASSWORD="${POSTGRES_PASSWORD:-belediyesinden_dev}" \
  pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    --format=plain --no-owner --no-privileges \
  | gzip > "$FULL_FILE"
echo "  ✓ Full dump: $FULL_FILE ($(du -h "$FULL_FILE" | cut -f1))"

# 2) Per-tenant dump (her tenant_xxx schema'sı ayrı).
TENANTS=$(PGPASSWORD="${POSTGRES_PASSWORD:-belediyesinden_dev}" \
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c \
  "SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'tenant_%' ORDER BY schema_name;" \
  2>/dev/null || echo "")

for SCHEMA in $TENANTS; do
  SCHEMA_FILE="$OUTPUT_DIR/${TIMESTAMP}_${SCHEMA}.sql.gz"
  PGPASSWORD="${POSTGRES_PASSWORD:-belediyesinden_dev}" \
    pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
      --schema="$SCHEMA" --format=plain --no-owner --no-privileges \
    | gzip > "$SCHEMA_FILE"
  echo "  ✓ Tenant dump: $SCHEMA ($(du -h "$SCHEMA_FILE" | cut -f1))"
done

# 3) Retention: 30 günden eski yedekleri sil.
find "$OUTPUT_DIR" -name "*.sql.gz" -mtime +30 -delete 2>/dev/null || true
echo "[$(date)] Yedekleme tamam. Eski yedekler temizlendi (30 gün retention)."

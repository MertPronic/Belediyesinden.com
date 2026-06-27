#!/usr/bin/env bash
# Belediyesinden — PostgreSQL geri yükleme (full veya tek tenant).
#
# Kullanım:
#   Tam geri yükleme:  ./infra/scripts/restore.sh backups/20260628_020000_full.sql.gz
#   Tek tenant:        ./infra/scripts/restore.sh backups/20260628_020000_tenant_talas.sql.gz
set -euo pipefail

BACKUP_FILE="${1:?Kullanım: restore.sh <backup.sql.gz>}"
DB_HOST="${POSTGRES_HOST:-localhost}"
DB_PORT="${POSTGRES_PORT:-5432}"
DB_USER="${POSTGRES_USER:-belediyesinden}"
DB_NAME="${POSTGRES_DB:-belediyesinden}"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "HATA: $BACKUP_FILE bulunamadı."
  exit 1
fi

echo "[$(date)] Geri yükleme: $BACKUP_FILE → $DB_NAME@$DB_HOST"

if [[ "$BACKUP_FILE" == *"_full"* ]]; then
  echo "  Tam geri yükleme (tüm schema'lar)..."
  gunzip -c "$BACKUP_FILE" | \
    PGPASSWORD="${POSTGRES_PASSWORD:-belediyesinden_dev}" \
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" --quiet
else
  SCHEMA=$(basename "$BACKUP_FILE" | sed 's/.*_tenant_/tenant_/' | sed 's/\.sql\.gz//')
  echo "  Tek tenant geri yükleme: $SCHEMA"
  gunzip -c "$BACKUP_FILE" | \
    PGPASSWORD="${POSTGRES_PASSWORD:-belediyesinden_dev}" \
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" --quiet
fi

echo "[$(date)] Geri yükleme tamam: $BACKUP_FILE"

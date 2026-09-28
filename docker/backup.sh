#!/bin/sh
# Günlük şifreli pg_dump (AES-256, PBKDF2). BACKUP_KEEP_DAYS günden eski yedekler silinir.
# Geri yükleme:  openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_PASSPHRASE -in X.sql.gz.enc | gunzip | psql
set -eu
apk add --no-cache openssl >/dev/null 2>&1 || true
while true; do
  stamp=$(date -u +%Y%m%dT%H%M%SZ)
  out="/backups/glukoz-${stamp}.sql.gz.enc"
  if pg_dump --no-owner --format=plain | gzip -9 | openssl enc -aes-256-cbc -pbkdf2 -salt -pass env:BACKUP_PASSPHRASE -out "${out}.tmp"; then
    mv "${out}.tmp" "${out}"
    echo "yedek alındı: ${out}"
  else
    rm -f "${out}.tmp"
    echo "YEDEK BAŞARISIZ" >&2
  fi
  find /backups -name 'glukoz-*.sql.gz.enc' -mtime "+${BACKUP_KEEP_DAYS:-14}" -delete
  sleep 86400
done

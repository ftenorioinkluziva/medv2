#!/bin/sh
set -eu

mkdir -p /app/data /app/uploads

for source_file in /app/seed-data/*.json; do
  cp "$source_file" "/app/data/$(basename "$source_file")"
done

npm run db:migrate

exec "$@"

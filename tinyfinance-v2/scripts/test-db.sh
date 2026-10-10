#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
test_container="tinyfinance-rls-"$RANDOM"-"$RANDOM
trap 'docker rm -f "$test_container" >/dev/null 2>&1 || true' EXIT
docker run -d --name "$test_container" --network none -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17-alpine >/dev/null
ready=false
for attempt in $(seq 1 30); do
  if docker exec "$test_container" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then ready=true; break; fi
  sleep 1
done
if [ "$ready" != true ]; then echo "PostgreSQL did not become ready"; exit 1; fi
docker exec -i "$test_container" psql -U postgres -v ON_ERROR_STOP=1 < tests/database/bootstrap.sql >/dev/null
for migration in supabase/0*.sql; do
  case "$migration" in *002_setup_example.sql) continue ;; esac
  echo "Applying $migration"
  docker exec -i "$test_container" psql -U postgres -v ON_ERROR_STOP=1 < "$migration" >/dev/null
done
docker exec -i "$test_container" psql -U postgres -v ON_ERROR_STOP=1 < tests/database/rls.sql

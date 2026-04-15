#!/usr/bin/env sh
set -eu

docker compose up -d postgres postgres-pages postgres-comment postgres-notify >/dev/null

reset_db() {
  service="$1"
  user="$2"
  db="$3"

  echo "Resetting database '$db' in service '$service'..."
  docker compose exec -T "$service" psql -U "$user" -d "$db" -v ON_ERROR_STOP=1 -c "
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO $user;
GRANT ALL ON SCHEMA public TO public;
"
}

reset_db postgres postgres auth
reset_db postgres-pages postgres pages
reset_db postgres-comment comment commentdb
reset_db postgres-notify notify notifydb

echo "All application databases have been reset."

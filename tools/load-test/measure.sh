#!/usr/bin/env bash
#
# The whole measurement, from an empty volume to a number (NFR 12, AP 10 of
# phase 5).
#
# A load test whose setup lives in somebody's shell history is a number nobody
# can check. This is the setup: a throwaway five-container stack on its own
# Compose project and its own port, an administrator from the environment, one
# series and one event, as many registrations as asked for, the six read
# scenarios, and the `pg_trgm` comparison — then `down -v`.
#
#   tools/load-test/measure.sh
#
# The one thing it does that no shipped instance should: it raises
# GLOBAL_REQUESTS_PER_MINUTE, because at the shipped 300 a minute every
# scenario would be measuring the rate limiter (E60). It raises it in the
# stack's `.env`, which is where a relaxation belongs, and the stack is gone at
# the end.
#
# Environment:
#   LOAD_PROJECT      Compose project name (default: trefaro-load)
#   LOAD_PORT         the port the proxy publishes (default: 8090)
#   COUNT             registrations to write on the event (default: 20000)
#   LOAD_CONCURRENCY  concurrent readers per scenario (default: 20)
#   LOAD_SECONDS      seconds per scenario (default: 10)
#   LOAD_KEEP         set to 1 to leave the stack running afterwards
set -euo pipefail

cd "$(dirname "$0")/../.."

PROJECT="${LOAD_PROJECT:-trefaro-load}"
PORT="${LOAD_PORT:-8090}"
BASE="http://localhost:${PORT}"
COUNT="${COUNT:-20000}"
ENV_FILE="$(mktemp)"
STARTED_AT=$(date +%s)

# The bootstrap administrator, because this instance exists for twenty minutes
# and nobody is going to walk through a wizard for it. A shipped instance
# leaves both empty (E28).
ADMIN_EMAIL="load@example.org"
ADMIN_PASSWORD="a-long-enough-passphrase"

compose() {
  docker compose --env-file "$ENV_FILE" -p "$PROJECT" \
    -f infra/docker-compose.yml "$@"
}

cleanup() {
  local status=$?
  if [ "${LOAD_KEEP:-0}" = '1' ]; then
    echo ""
    echo "--- LOAD_KEEP=1, leaving ${PROJECT} running at ${BASE} ---"
    echo "    tear it down with:"
    echo "      docker compose --env-file ${ENV_FILE} -p ${PROJECT} \\"
    echo "        -f infra/docker-compose.yml down -v"
    echo "    (and then: rm ${ENV_FILE})"
  else
    echo ""
    echo "--- tearing the stack down, volumes included ---"
    compose down -v --remove-orphans >/dev/null 2>&1 || true
    rm -f "$ENV_FILE"
  fi
  echo "--- total $(($(date +%s) - STARTED_AT))s ---"
  exit $status
}
trap cleanup EXIT

cat >"$ENV_FILE" <<ENV
DATABASE_NAME=trefaro
DATABASE_USER=trefaro
DATABASE_PASSWORD=$(head -c 24 /dev/urandom | base64 | tr -d '/+=')
AUTH_SECRET=$(head -c 32 /dev/urandom | base64 | tr -d '/+=')
PUBLIC_USER_CLIENT_URL=${BASE}
PUBLIC_ADMIN_CLIENT_URL=${BASE}/admin
HTTP_PORT=${PORT}
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_FROM=Trefaro Load Test <no-reply@load.invalid>
ADMIN_BOOTSTRAP_EMAIL=${ADMIN_EMAIL}
ADMIN_BOOTSTRAP_PASSWORD=${ADMIN_PASSWORD}
# The one relaxation, and the reason this file exists rather than a patch to
# the server: at the shipped 300 a minute, every scenario below would be
# measuring the limiter instead of the server (E60).
GLOBAL_REQUESTS_PER_MINUTE=1000000
ENV

echo "--- bringing ${PROJECT} up from an empty volume ---"
compose down -v --remove-orphans >/dev/null 2>&1 || true
compose up -d --build

echo ""
echo "--- waiting for the stack to answer at ${BASE} ---"
waiting_since=$(date +%s)
until curl -fsS "${BASE}/api/health" >/dev/null 2>&1; do
  if [ $(($(date +%s) - waiting_since)) -ge 300 ]; then
    echo "The stack did not answer within 300s. Recent server log:"
    compose logs --tail 60 server
    exit 1
  fi
  sleep 2
done
echo "up after $(($(date +%s) - waiting_since))s"

# The setup belongs beside the numbers, or the numbers mean nothing (AP 10).
echo ""
echo "--- what this was measured on ---"
echo "date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
compose exec -T postgres psql -U trefaro -d trefaro -At \
  -c "SELECT 'postgres: ' || current_setting('server_version')"
docker version --format 'docker: {{.Server.Version}} ({{.Server.Os}}/{{.Server.Arch}})'
echo "host: $(nproc) CPU(s), $(awk '/^MemTotal:/ {printf "%.0f GB", $2/1048576}' /proc/meminfo 2>/dev/null || echo '?') RAM, $(uname -sr)"
echo "node (driver): $(node --version)"

echo ""
echo "--- one series and one event ---"
eval "$(BASE="$BASE" ADMIN_EMAIL="$ADMIN_EMAIL" ADMIN_PASSWORD="$ADMIN_PASSWORD" \
  node tools/load-test/prepare.mjs)"
echo "series ${SERIES_SLUG}, event ${EVENT_SLUG} (${EVENT_ID})"

echo ""
echo "--- ${COUNT} registrations on that event ---"
POSTGRES_CONTAINER="${PROJECT}-postgres-1" EVENT_ID="$EVENT_ID" COUNT="$COUNT" \
  node tools/load-test/seed-registrations.mjs

echo ""
echo "--- the load test ---"
BASE="$BASE" \
  SERIES_SLUG="$SERIES_SLUG" EVENT_SLUG="$EVENT_SLUG" EVENT_ID="$EVENT_ID" \
  ADMIN_EMAIL="$ADMIN_EMAIL" ADMIN_PASSWORD="$ADMIN_PASSWORD" \
  LOAD_CONCURRENCY="${LOAD_CONCURRENCY:-20}" LOAD_SECONDS="${LOAD_SECONDS:-10}" \
  node tools/load-test/load.mjs

echo ""
echo "--- pg_trgm, measured rather than argued (F32) ---"
POSTGRES_CONTAINER="${PROJECT}-postgres-1" EVENT_ID="$EVENT_ID" \
  node tools/load-test/trigram-measure.mjs

echo ""
echo "--- the measurement is done ---"

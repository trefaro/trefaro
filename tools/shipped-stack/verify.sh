#!/usr/bin/env bash
#
# Brings the five-container stack up from an *empty* volume and checks it the
# way it is actually shipped: production builds, a real service worker, a real
# NGINX, a real database.
#
# This closes the hole in the test pyramid that let the defect of 28.08.2026
# through — a service worker misconfiguration that made the organizer client
# unreachable in the production stack while every suite in this repository was
# green. Unit tests run no worker, the API contract suite uses `fetch`, both
# browser suites run against `nx serve` (where Angular registers no worker at
# all), and the `images` job builds the three images without ever starting them
# together.
#
# Run it from the repository root:
#
#   tools/shipped-stack/verify.sh
#
# It uses its own Compose project name and its own volumes, so it never touches
# a development instance, and it removes both on the way out — including when it
# fails. Nothing it creates is meant to be kept: it sets the instance up through
# the first-run wizard, which means the instance afterwards belongs to an
# account printed below.
#
# Environment:
#   STACK_PROJECT   Compose project name (default: trefaro-shipped)
#   STACK_PORT      the port the proxy publishes (default: 8080)
#   STACK_KEEP      set to 1 to leave the stack running for inspection
set -euo pipefail

cd "$(dirname "$0")/../.."

PROJECT="${STACK_PROJECT:-trefaro-shipped}"
PORT="${STACK_PORT:-8080}"
BASE="http://localhost:${PORT}"
ENV_FILE="$(mktemp)"
STARTED_AT=$(date +%s)

compose() {
  docker compose --env-file "$ENV_FILE" -p "$PROJECT" \
    -f infra/docker-compose.yml "$@"
}

cleanup() {
  local status=$?
  if [ "${STACK_KEEP:-0}" = '1' ]; then
    echo ""
    echo "--- STACK_KEEP=1, leaving ${PROJECT} running at ${BASE} ---"
    # The environment file survives with it, and the hint names it: Compose
    # interpolates the required values when tearing down too, so `down` without
    # --env-file refuses with "DATABASE_PASSWORD must be set" and leaves five
    # containers standing.
    echo "    tear it down with:"
    echo "      docker compose --env-file ${ENV_FILE} -p ${PROJECT} \\"
    echo "        -f infra/docker-compose.yml down -v"
    echo "    (and then: rm ${ENV_FILE})"
  else
    echo ""
    echo "--- tearing the stack down, volumes included ---"
    # Order matters: the environment file goes only after Compose is done with
    # it, for the same reason.
    compose down -v --remove-orphans >/dev/null 2>&1 || true
    rm -f "$ENV_FILE"
  fi
  # The runtime belongs in the log: a job nobody can budget for is a job that
  # gets switched off the first time it is inconvenient.
  echo "--- total $(($(date +%s) - STARTED_AT))s ---"
  exit $status
}
trap cleanup EXIT

# A generated secret per run. AUTH_SECRET needs at least 32 characters or the
# server refuses to start (and a hand-written .env underruns that easily).
cat >"$ENV_FILE" <<ENV
DATABASE_NAME=trefaro
DATABASE_USER=trefaro
DATABASE_PASSWORD=$(head -c 24 /dev/urandom | base64 | tr -d '/+=')
AUTH_SECRET=$(head -c 32 /dev/urandom | base64 | tr -d '/+=')
PUBLIC_USER_CLIENT_URL=${BASE}
PUBLIC_ADMIN_CLIENT_URL=${BASE}/admin
HTTP_PORT=${PORT}
# Required, or the server refuses to boot under NODE_ENV=production — which is
# how this script found out that an .env without them produces a crash loop and
# not a warning. Nothing here sends mail: proving that a mail actually leaves
# the instance needs a server that demands authentication and TLS, and that is
# AP 3 of this phase, not this one.
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_FROM=Trefaro Shipped Stack <no-reply@shipped.invalid>
# Deliberately empty: this run proves the *guided* first-run setup, which is the
# path a real operator takes and the only one no suite in this repository can
# reach (the endpoints exist solely while `admin_user` is empty, and the last
# administrator cannot be deleted). verify-setup.mjs creates the account.
ADMIN_BOOTSTRAP_EMAIL=
ADMIN_BOOTSTRAP_PASSWORD=
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

# --- the guided first-run setup, against an instance that has never been set up
echo ""
echo "--- first-run setup (FR 1.1, NFR 15, E28) ---"
SETUP_TOKEN="$(compose logs server |
  grep -A 3 'no administrator yet' |
  grep -oE '[A-Za-z0-9_-]{40,}' |
  head -1)"

if [ -z "$SETUP_TOKEN" ]; then
  echo "FAIL  no setup token in the server log — a fresh instance must print one"
  compose logs --tail 40 server
  exit 1
fi

BASE="$BASE" TREFARO_BASE_URL="$BASE" TREFARO_SETUP_TOKEN="$SETUP_TOKEN" \
  node tools/spike-verification/verify-setup.mjs

# --- the proxy, the manifest and the service worker's own rules
echo ""
echo "--- reverse proxy, PWA and service worker manifest ---"
BASE="$BASE" PROXY_BASE="$BASE" \
  node tools/spike-verification/verify-proxy.mjs

# --- and a real browser, with the worker actually registered
echo ""
echo "--- a browser against the shipped stack ---"
STACK_BASE_URL="$BASE" npx nx run stack-e2e:e2e-stack

echo ""
echo "--- the shipped stack is good ---"

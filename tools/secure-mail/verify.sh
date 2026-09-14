#!/usr/bin/env bash
#
# Proves the two halves of E62 against a mail server that behaves like a real
# one: it refuses anonymous submission, it refuses unencrypted submission, and
# this application gets a confirmation mail through it anyway.
#
# Why this is a script and not a test suite: every automated suite in this
# repository talks to the open Mailpit of the development stack, which accepts
# everything. That is the right stand-in for "did a message with a working link
# leave the server" and a useless one for "can this server authenticate and
# encrypt" — and the second question is the one an organization's own mail
# server asks on the first day.
#
# What it does *not* prove is deliverability: SPF, DKIM, DMARC and whether a
# message lands in an inbox rather than in a spam folder hang on the DNS records
# of the organization's domain, and no test server can answer them (E63). That
# half is an operator checklist in `docs/INSTALL.md`.
#
# Run it from the repository root:
#
#   tools/secure-mail/verify.sh
#
# It needs the development PostgreSQL (`infra/docker-compose.dev.yml`), builds
# the server once, and runs it on its own port against its own mail server. It
# writes one newsletter sign-up into the development database, with a
# timestamped address that belongs to nobody.
#
# Environment:
#   SECURE_MAIL_PORT   the port the server under test listens on (default 3100)
#   STACK_KEEP=1       leave the strict mail server running afterwards
set -euo pipefail

cd "$(dirname "$0")/../.."

PORT="${SECURE_MAIL_PORT:-3100}"
BASE="http://127.0.0.1:${PORT}"
MAILPIT_URL='http://127.0.0.1:8026'
SMTP_USER="${MAILPIT_SMTP_USER:-trefaro}"
SMTP_PASSWORD="${MAILPIT_SMTP_PASSWORD:-mailpit-development-password}"
SERVER_PID=''
LOG="$(mktemp)"

compose() {
  docker compose -f infra/docker-compose.dev.yml --profile secure-mail "$@"
}

cleanup() {
  local status=$?
  if [ -n "$SERVER_PID" ]; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  if [ "$status" -ne 0 ]; then
    echo ""
    echo "--- the server's last lines ---"
    tail -n 40 "$LOG" || true
  fi
  if [ "${STACK_KEEP:-0}" = '1' ]; then
    echo ""
    echo "--- STACK_KEEP=1, leaving the strict mail server at ${MAILPIT_URL} ---"
  else
    compose stop mailpit-secure >/dev/null 2>&1 || true
    compose rm -f mailpit-secure >/dev/null 2>&1 || true
  fi
  rm -f "$LOG"
  exit "$status"
}
trap cleanup EXIT

echo "=== 1/5  certificate, key and password file ==="
tools/secure-mail/materials.sh

echo ""
echo "=== 2/5  the strict mail server, and the database it has nothing to do with ==="
compose up -d postgres mailpit-secure

echo ""
echo "=== 3/5  what that mail server refuses ==="
# Before the server is even built: if this step passes with an accepted
# unauthenticated message, everything after it would be meaningless.
NODE_EXTRA_CA_CERTS=infra/mailpit/tls/cert.pem \
  SMTP_HOST=127.0.0.1 SMTP_PORT=1026 \
  SMTP_USER="$SMTP_USER" SMTP_PASSWORD="$SMTP_PASSWORD" \
  node tools/secure-mail/probe.mjs

echo ""
echo "=== 4/5  the server, configured the way an organization would ==="
npx nx build server >/dev/null

# The certificate is named, never trusted blindly — this line is what E62 asks
# of a deployment, and there is no line anywhere in the source that would make
# it unnecessary.
NODE_EXTRA_CA_CERTS="$(pwd)/infra/mailpit/tls/cert.pem" \
  NODE_ENV=development \
  SERVER_PORT="$PORT" \
  DATABASE_HOST=localhost DATABASE_PASSWORD=trefaro_dev \
  SMTP_HOST=127.0.0.1 SMTP_PORT=1026 \
  SMTP_SECURE=false SMTP_REQUIRE_TLS=true \
  SMTP_USER="$SMTP_USER" SMTP_PASSWORD="$SMTP_PASSWORD" \
  SMTP_FROM='Trefaro <no-reply@trefaro.test>' \
  node dist/apps/server/main.js >"$LOG" 2>&1 &
SERVER_PID=$!

echo ""
echo "=== 5/5  a confirmation mail, through it ==="
BASE="$BASE" MAILPIT_URL="$MAILPIT_URL" node tools/secure-mail/check.mjs

echo ""
echo "--- what the server said about its mail setup while starting ---"
# Nothing, if all is well: a warning here would mean the instance is handing
# mail over in the clear or accepting any certificate (E62).
grep -E '\[Smtp\]' "$LOG" || echo "(no Smtp warnings — the silence is the result)"

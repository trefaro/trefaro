#!/usr/bin/env bash
#
# Writes what the strict mail server of `infra/docker-compose.dev.yml` needs:
# a certificate, its key, and a password file.
#
# None of it is checked in. A self-signed key is still a key, and a repository
# that contains one teaches the habit of committing keys — which is the habit
# this package exists to argue against (E62). Everything here is regenerated
# from nothing in a second, so there is nothing to lose.
#
# The certificate is its own authority: it is what `NODE_EXTRA_CA_CERTS` points
# at, and Node accepts a self-signed certificate as a trust anchor when it is in
# the store. That is the whole trick, and it is the same one an organization
# uses for an internal mail server with a private CA — name the certificate,
# never switch the check off.
#
#   tools/secure-mail/materials.sh
#
# Environment:
#   MAILPIT_SMTP_USER       (default: trefaro)
#   MAILPIT_SMTP_PASSWORD   (default: a development password, printed below)
#   FORCE=1                 regenerate even if the files are already there
set -euo pipefail

cd "$(dirname "$0")/../.."

DIR='infra/mailpit'
USER="${MAILPIT_SMTP_USER:-trefaro}"
PASSWORD="${MAILPIT_SMTP_PASSWORD:-mailpit-development-password}"

mkdir -p "${DIR}/tls"

if [ ! -f "${DIR}/tls/cert.pem" ] || [ "${FORCE:-0}" = '1' ]; then
  echo "--- generating a self-signed certificate for the strict mail server ---"
  # Both names and the address: the server reaches this from the host as
  # 127.0.0.1 and from inside the compose network as `mailpit-secure`, and a
  # certificate that matches only one of them fails in the other place with an
  # error that sounds like a bug in the code.
  openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
    -keyout "${DIR}/tls/key.pem" -out "${DIR}/tls/cert.pem" \
    -subj '/CN=trefaro-mailpit-secure' \
    -addext 'subjectAltName=DNS:localhost,DNS:mailpit-secure,IP:127.0.0.1' \
    -addext 'basicConstraints=critical,CA:TRUE' 2>/dev/null
  # Mailpit runs as a non-root user inside the container and reads both files.
  chmod 644 "${DIR}/tls/key.pem" "${DIR}/tls/cert.pem"
fi

printf '%s:%s\n' "$USER" "$PASSWORD" > "${DIR}/smtp-auth"
chmod 644 "${DIR}/smtp-auth"

echo "certificate : ${DIR}/tls/cert.pem"
echo "credentials : ${USER} / ${PASSWORD}"

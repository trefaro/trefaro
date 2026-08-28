# Installing Trefaro

Trefaro runs as five containers on one machine, and one instance serves one
organization. There is no multi-tenancy and no hosted version: the whole point is
that the organization's data stays on hardware the organization controls.

This document is for whoever installs and keeps it running. It assumes a Linux
server, a shell, and no prior knowledge of the code.

- [1. What you need](#1-what-you-need)
- [2. Get the code](#2-get-the-code)
- [3. Configure the instance](#3-configure-the-instance)
- [4. First start](#4-first-start)
- [5. The first administrator](#5-the-first-administrator)
- [6. TLS — not optional](#6-tls--not-optional)
- [7. Mail](#7-mail)
- [8. Push notifications (optional)](#8-push-notifications-optional)
- [9. Languages](#9-languages)
- [10. Backups](#10-backups)
- [11. Updating](#11-updating)
- [12. When something does not work](#12-when-something-does-not-work)
- [13. What runs where](#13-what-runs-where)

---

## 1. What you need

- A Linux server with **Docker Engine 24+** and the **Compose plugin 2.24+**
  (`docker compose version`). The `!override` tag in the TLS overlay needs 2.24.
- **2 GB of RAM** and a few gigabytes of disk. Uploaded registration attachments
  are the part that grows.
- A **DNS name** pointing at the server, and ports **80** and **443** reachable.
- A **TLS certificate** for that name, or the ability to get one — see
  [section 6](#6-tls--not-optional). This is not a nice-to-have: without HTTPS
  nobody can sign in to the administration except on the machine itself.
- An **SMTP account** on the organization's mail server. Registration works by
  double opt-in, so an instance that cannot send mail cannot collect
  registrations.

Nothing else. Trefaro talks to no third-party service — no CDN, no font service,
no map provider other than OpenStreetMap, no push service, no analytics.

## 2. Get the code

```bash
git clone https://github.com/trefaro/trefaro.git
cd trefaro
```

The images are built from this checkout; there is no registry to pull from yet.
Building needs no toolchain on the host — everything happens inside Docker.

## 3. Configure the instance

```bash
cp .env.example .env
```

Then edit `.env`. Every value is documented in place, and the server validates
all of them on startup: a misconfigured instance refuses to start and prints
**every** problem at once rather than failing on some later request.

### The values without which it will not start

| Value                     | Why                                                                                                  |
| ------------------------- | ---------------------------------------------------------------------------------------------------- |
| `NODE_ENV=production`     | Turns on the secure session cookie and refuses unsafe database settings.                             |
| `DATABASE_PASSWORD`       | Used by both the database and the server. Any long random string.                                    |
| `AUTH_SECRET`             | Signs sessions and the confirmation links in double opt-in mails. **At least 32 characters.**        |
| `PUBLIC_USER_CLIENT_URL`  | The public address of the participant client, e.g. `https://events.example.org`. Link base in mails. |
| `PUBLIC_ADMIN_CLIENT_URL` | The public address of the organizer client, e.g. `https://events.example.org/admin`.                 |
| `SMTP_HOST`, `SMTP_FROM`  | See [section 7](#7-mail).                                                                            |

Generate the secret with:

```bash
openssl rand -base64 48
```

Both public URLs are also the CORS and WebSocket allow-list, so they have to be
the addresses the outside world actually uses — including the scheme and any
non-standard port.

### The values that decide whether anybody can get in

Either leave `ADMIN_BOOTSTRAP_EMAIL` and `ADMIN_BOOTSTRAP_PASSWORD` **empty** and
use the guided setup, or set both for an unattended installation. Both paths are
described in [section 5](#5-the-first-administrator).

### Ports

`HTTP_PORT` and `HTTPS_PORT` are the ports the reverse proxy publishes on the
host. With TLS they should be the standard pair (80 and 443): the redirect from
HTTP to HTTPS cannot know a non-standard port to name.

## 4. First start

```bash
docker compose --env-file .env -f infra/docker-compose.yml up -d --build
```

Run it from the repository root and pass `--env-file` explicitly — Compose
otherwise looks for a `.env` beside the compose file, in `infra/`.

The first run builds three images and takes a few minutes. Then:

```bash
docker compose --env-file .env -f infra/docker-compose.yml ps
docker compose --env-file .env -f infra/docker-compose.yml logs -f server
```

The server applies its database migrations on startup, so there is no separate
migration step — ever, including after an update.

Two things to read in that log:

- **the startup findings.** The server prints a line for every value that is
  present but wrong for a real deployment: a public URL without TLS, a mail
  server still pointing at `localhost`, a database reached unencrypted over a
  network. None of them stops the instance; all of them cause a failure later, in
  a place that will not name the cause.
- **the setup token**, if you left `ADMIN_BOOTSTRAP_*` empty. See below.

## 5. The first administrator

Every route that could create an administrator needs an administrative session,
which a fresh instance has nobody to give. There are two ways past that, and the
instance is unusable until one of them has been taken.

### Guided setup (recommended)

Leave `ADMIN_BOOTSTRAP_EMAIL` and `ADMIN_BOOTSTRAP_PASSWORD` empty. While the
instance has no administrator, the server prints a **setup token** on every
start:

```bash
docker compose --env-file .env -f infra/docker-compose.yml logs server \
  | grep -A 2 'no administrator'
```

Open the organizer client — `https://events.example.org/admin/` — and it offers
the setup. Paste the token, then fill in one form: the first administrator, what
the organization is called, its language, and its two brand colours.

Why the token: a fresh instance answers on its port the moment `up -d` returns,
which is before you open a browser. Without it, the instance would belong to
whoever reached it first. The token lives in memory only — it changes on every
restart, and it stops working the moment an administrator exists. From then on
the setup address answers `404`.

### Unattended

Set both values before the first start:

```dotenv
ADMIN_BOOTSTRAP_EMAIL=you@example.org
ADMIN_BOOTSTRAP_PASSWORD=a-long-passphrase-you-will-change
```

The account is created on startup, but only while no administrator exists — so
leaving the values in place afterwards changes nothing. Sign in, create a
personal account under **Administrators**, and remove both lines from the `.env`.

A password must be **at least twelve characters**. Length only, no character
classes: a long passphrase is both stronger and easier to remember than
`Passwort1!`.

## 6. TLS — not optional

The administrative session cookie is marked `Secure` when `NODE_ENV=production`,
and browsers store such a cookie **only over HTTPS** — with the single exception
they make for `localhost`. So on a real host, without TLS:

- the login form accepts the password,
- the server answers correctly,
- and the browser silently discards the session.

Nobody can administer the instance. That is why TLS is part of installing
Trefaro and not of hardening it later, and why dropping `Secure` is not an
alternative.

### The overlay

```bash
docker compose --env-file .env \
               -f infra/docker-compose.yml \
               -f infra/docker-compose.tls.yml up -d
```

Nothing else changes: the overlay only replaces the reverse proxy's
configuration and mounts your certificate. Set in the `.env`:

```dotenv
TLS_CERT_FILE=/etc/letsencrypt/live/events.example.org/fullchain.pem
TLS_KEY_FILE=/etc/letsencrypt/live/events.example.org/privkey.pem
HTTP_PORT=80
HTTPS_PORT=443
```

`TLS_CERT_FILE` must be the **full chain**, not only the leaf certificate.
Without the intermediates, desktop browsers that happen to have cached them work
while Android and command line tools reject the connection — a confusing failure
to debug.

Port 80 stays open on purpose: it redirects to HTTPS and it answers ACME
challenges.

The proxy sends `Strict-Transport-Security: max-age=15552000` — six months. This
is a commitment: a browser that has seen it will refuse plain HTTP for that host
name until it expires. If an organization needs the other trade-off, remove that
one line from `infra/nginx/trefaro-tls.conf`.

### Getting a certificate

Trefaro deliberately ships no certificate automation. A certbot container would
be a sixth service, a renewal schedule and a competing claim on port 80 — and
many organizations terminate TLS centrally anyway. Three ways that work:

1. **Let's Encrypt on the host.** Install certbot, then use the webroot the proxy
   already serves, so renewal needs no downtime:

   ```bash
   certbot certonly --webroot -w infra/nginx/acme -d events.example.org
   ```

   Renewal is certbot's own timer. After each renewal the proxy has to re-read
   the files:

   ```bash
   docker compose --env-file .env -f infra/docker-compose.yml \
                  -f infra/docker-compose.tls.yml exec nginx nginx -s reload
   ```

   A `--deploy-hook` with that command makes it automatic.

2. **A certificate the organization already has.** Point `TLS_CERT_FILE` and
   `TLS_KEY_FILE` at it.

3. **A terminator in front of the stack** — a load balancer, or an existing
   NGINX or Caddy on the host. Then do **not** use the overlay: run the plain
   stack, publish it only on the loopback interface, and make sure the terminator
   sets `X-Forwarded-Proto: https`. The server trusts exactly one proxy hop, so
   that header decides whether it considers the connection secure.

## 7. Mail

Registration is double opt-in: somebody registers, gets a signed confirmation
link, and only a click on that link makes the registration real. It is also the
consent record. An instance that cannot send mail therefore cannot collect
registrations, which is why `SMTP_HOST` and `SMTP_FROM` are required in
production.

```dotenv
SMTP_HOST=mail.example.org
SMTP_PORT=587
SMTP_SECURE=true
SMTP_USER=trefaro
SMTP_PASSWORD=…
SMTP_FROM=Events <no-reply@example.org>
```

Use the organization's own mail server. The sender domain should be one the
server is allowed to send for — most receiving servers reject or silently drop a
message whose sender they cannot verify, and "silently" is the part that costs a
registration.

`SMTP_SECURE=true` means implicit TLS (port 465). For port 587 with STARTTLS,
leave it `false`; the connection is still upgraded.

The instance's language decides the language of every outgoing mail. It is asked
during the guided setup and can be changed later.

## 8. Push notifications (optional)

Push is self-hosted: the instance signs its own messages with a VAPID key pair
and talks to the browser vendors' push endpoints directly. No Firebase, no
third-party service.

```bash
npx web-push generate-vapid-keys
```

Put both keys in the `.env` (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`) and set
`VAPID_SUBJECT` to a contact address. The private key never leaves the server.

Then switch the **push** module on under **Modules** in the organizer client —
the key pair and the module are two separate decisions, one made by the
deployment and one by the organization.

## 9. Languages

The instance speaks English and German out of the box, and both clients carry a
switch in their header — a visitor's choice is remembered in their browser, and
someone who has never chosen gets whatever their browser asks for.

The text itself is **served by your instance**, not compiled into the clients:
`GET /api/i18n/en` answers the catalogue that shipped with the image, overlaid
with whatever your organization has changed. So a wording you disagree with is a
row in the database, not a rebuild — the screen that edits those rows arrives in
the next work package, and the mechanism is already in place under it.

Nothing here needs configuring. `I18N_CATALOGUE_DIR` belongs to the image and
points at the catalogues inside it.

## 10. Backups

Two named volumes and one file carry everything that cannot be rebuilt:

| What              | Where                     | Contains                                                         |
| ----------------- | ------------------------- | ---------------------------------------------------------------- |
| `trefaro_pgdata`  | PostgreSQL data directory | every event, registration, participant and configuration value   |
| `trefaro_uploads` | `/app/uploads`            | logos, the app icon, registration attachments such as visa scans |
| `.env`            | the repository root       | `AUTH_SECRET` — see below                                        |

A database dump, which is the form worth keeping:

```bash
docker compose --env-file .env -f infra/docker-compose.yml exec -T postgres \
  pg_dump -U trefaro trefaro | gzip > trefaro-$(date +%F).sql.gz
```

The uploads:

```bash
docker run --rm -v trefaro_uploads:/data -v "$PWD":/backup alpine \
  tar czf /backup/trefaro-uploads-$(date +%F).tar.gz -C /data .
```

**Keep `AUTH_SECRET`.** It signs the double opt-in links and the self-service
links participants already have in their inboxes; restoring a database with a
different secret invalidates every one of them.

Both backups contain personal data of participants. Encrypt them, and keep them
under the same retention rules as the instance itself.

## 11. Updating

```bash
git pull
docker compose --env-file .env -f infra/docker-compose.yml up -d --build
```

Database migrations run when the server starts, so there is no separate step and
no maintenance window beyond the restart. Take a dump first anyway — a migration
is the one change that cannot be undone by starting the old image again.

Adding the TLS overlay to the command is required every time; a `docker compose`
invocation without it would go back to plain HTTP.

## 12. When something does not work

| Symptom                                                          | Cause                                                                                                                                    |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| The server container exits immediately                           | Configuration. `logs server` lists every problem at once.                                                                                |
| The login accepts the password and lands on the login form again | No TLS. The session cookie is `Secure`. See [section 6](#6-tls--not-optional).                                                           |
| `/admin/` shows the participant client                           | A stale service worker from an earlier visit. Hard-reload once, or clear site data.                                                      |
| The organizer client offers a setup wizard                       | The instance has no administrator. Either use it, or set `ADMIN_BOOTSTRAP_*` and restart.                                                |
| The setup address answers `404`                                  | An administrator exists. That is the end of the setup, permanently — use the login.                                                      |
| Nobody receives a confirmation mail                              | SMTP. `logs server` records every send attempt and its error.                                                                            |
| `Too many attempts` on the login                                 | Twenty attempts per five minutes per address, then fifteen minutes of silence. Wait, or restart the server — the counters are in memory. |
| A registration with an attachment is refused                     | The file is larger than 20 MB, or its content does not match the type it claims.                                                         |
| An enabled plug-in does not appear                               | Its bundle failed to load. The **Modules** page shows the reason per plug-in.                                                            |

The verification scripts under [`tools/spike-verification/`](../tools/spike-verification/README.md)
check a running instance from the outside: the proxy routing, the API, the module
switches, TLS, the administrative boundary. They are the fastest way to find out
which half of a problem is which.

## 13. What runs where

```
                       ┌───────────────────────────────┐
   :443 / :80 ────────▶│ nginx (reverse proxy)         │
                       └──┬──────────┬─────────────┬───┘
                          │          │             │
              /           │  /admin/ │       /api/ │  /socket.io/
                          ▼          ▼             ▼
                 ┌────────────┐ ┌──────────────┐ ┌──────────────────┐
                 │ user-client│ │ admin-client │ │ server (NestJS)  │
                 │  (Angular) │ │  (Angular)   │ └───────┬──────────┘
                 └────────────┘ └──────────────┘         │
                                                         ▼
                                                 ┌──────────────────┐
                                                 │ postgres         │
                                                 └──────────────────┘
```

Only the reverse proxy publishes a port. The server and the database are on the
internal Docker network alone, so no endpoint of theirs can be reached from
outside except through the proxy.

The participant client is a mobile-first installable PWA served at the root; the
organizer client is desktop-first and served under `/admin/`. Both fetch their
configuration — colours, logo, font, enabled modules — from the server at
startup, which is why a design change reaches both without a rebuild.

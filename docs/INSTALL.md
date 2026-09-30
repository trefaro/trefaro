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

### The values that decide how often a stranger may knock

Trefaro refuses to do a handful of things too often, and it ships with numbers
you can leave alone: twenty login attempts per five minutes from one address
(then fifteen minutes of silence), sixty registrations, sixty confirmations,
twenty newsletter sign-ups, twenty requests for a forgotten-password link — and
five mails to any **one** recipient, however many different people ask for
them.

You will want to raise one of them in exactly one situation: your office, your
school or your venue shares a single public internet address, so twenty
colleagues signing up for the same event look to Trefaro like one very busy
visitor. Set the value in your `.env`, restart, and the server will say in its
log that it is running above the default — deliberately, because a limit that
has been raised is a limit nobody is testing any more.

```bash
# Only if you actually need it. Every one of these is already the default.
REGISTRATIONS_PER_WINDOW=60
CONFIRMATIONS_PER_WINDOW=60
LOGIN_ATTEMPTS_PER_WINDOW=20
NEWSLETTER_SIGNUPS_PER_WINDOW=20
MAILS_PER_RECIPIENT_PER_WINDOW=5
PASSWORD_RESETS_PER_WINDOW=20
# The budget every request counts against, per address per minute. Raise this
# one only to take a measurement, and put it back afterwards.
GLOBAL_REQUESTS_PER_MINUTE=300
```

The counters are kept in memory, so `docker compose -p trefaro restart server`
clears them — which is the quickest way to let somebody back in who locked
themselves out of the login while you decide whether to change a number.

### How much it writes to its log

```bash
# warn, log (the default), debug or verbose.
LOG_LEVEL=log
```

`debug` adds a line for every request that was refused as a matter of course —
every visitor who is not signed in, every address that does not exist — which
is what you want while chasing something and not what you want on a Tuesday.
There is nothing quieter than `warn`, and [section 12.1](#121-reading-the-log)
says why.

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
SMTP_REQUIRE_TLS=true
SMTP_USER=trefaro
SMTP_PASSWORD=…
SMTP_FROM=Events <no-reply@example.org>
```

Use the organization's own mail server. The sender domain should be one the
server is allowed to send for — most receiving servers reject or silently drop a
message whose sender they cannot verify, and "silently" is the part that costs a
registration. Which is also what section 7.3 below is about.

### 7.1 Encryption, and the one thing never to do

A mail server offers encryption in one of two shapes, and an instance uses one
of them:

| Port    | Setting                 | What happens                                        |
| ------- | ----------------------- | --------------------------------------------------- |
| 465     | `SMTP_SECURE=true`      | encrypted from the first byte (implicit TLS)        |
| 587, 25 | `SMTP_REQUIRE_TLS=true` | starts in the clear and **must** upgrade (STARTTLS) |

`SMTP_REQUIRE_TLS` defaults to `true` when `NODE_ENV=production`, so a normal
installation needs neither line — it gets encryption by not saying anything.
The word _must_ is what the setting adds: without it, a connection that is
supposed to upgrade simply does not when something in the way removes the
server's offer, and the mail goes out in the clear with nobody the wiser. The
password goes with it.

> **If you set `SMTP_SECURE=true` on port 587, nothing will be sent.** The two
> are different protocols on different ports, not a stronger and a weaker
> setting. Version 1.0 corrected the shipped default in
> `infra/docker-compose.yml`, which paired `587` with `SMTP_SECURE=true`.

If the mail server's certificate comes from the organization's own certificate
authority rather than a public one, **name the certificate**:

```dotenv
NODE_EXTRA_CA_CERTS=/etc/trefaro/ca/mail.pem
```

The file goes into `infra/ca/`, which the server container mounts read-only at
`/etc/trefaro/ca`. There is no setting anywhere in Trefaro that turns
certificate checking off, and there will not be one: such a switch applies to
every connection the process makes, for good, and nobody who finds it later can
tell which problem it once solved. A named certificate applies to one server
and is written where the next person looks.

The server says all of this out loud while it starts. **Silence means the
instance encrypts what it hands over.** A line beginning with `[Smtp]` means
something was switched off, and names it.

### 7.2 Invitations go out slowly, on purpose

Inviting former participants (FR 2.4) sends one message per person, one after
another, with a pause between them:

```dotenv
SMTP_PAUSE_BETWEEN_MAILS_MS=1000
```

At the default of one second, two hundred invitations take a little over three
minutes. That is the intended behaviour: a shared mail service that receives
two hundred messages in twenty seconds answers by throttling the sender, and in
the worse case by blacklisting the domain — the same domain the organization
receives its own mail on. Raise the number if the provider asks for less than
one message a second. Lowering it is written into the startup log.

A message the mail server refuses _for now_ — a full mailbox, a "slow down" —
is tried once more after a longer wait. A message it refuses outright is
recorded as failed with the server's own words next to it, where the organizer
can read them.

### 7.3 Deliverability is yours, not the software's

Everything above decides whether a message **leaves** this instance. Whether it
**arrives** — in an inbox rather than in a spam folder — is decided by DNS
records on the organization's domain, and no amount of testing inside Trefaro
can establish it. Work through this list before the first real event:

- [ ] **SPF.** A `TXT` record on the sender domain naming the servers allowed
      to send for it, ending in `-all` (hard fail) rather than `~all` once you
      are sure the list is complete. If mail leaves through a provider, use the
      `include:` they document.
- [ ] **DKIM.** The mail server signs outgoing messages, and the public key
      sits in a `TXT` record at `<selector>._domainkey.<domain>`. This is
      configured on the mail server, not in Trefaro. Without it, SPF alone
      breaks the moment a message is forwarded.
- [ ] **DMARC.** A `TXT` record at `_dmarc.<domain>`, starting at `p=none` with
      an `rua=` address so you receive reports, and moved to `p=quarantine` or
      `p=reject` once those reports are clean. Gmail and Microsoft both require
      a DMARC record from anybody sending in volume.
- [ ] **Reverse DNS.** The sending IP address resolves back to the name it
      announces in `HELO`. A mismatch is one of the cheapest reasons to be
      filtered.
- [ ] **The `From` domain matches.** `SMTP_FROM` must be on the domain SPF and
      DKIM are set up for. `no-reply@example.org` sent through a server that is
      only authorized for `example.net` fails alignment even when both records
      are perfect.
- [ ] **Send one real registration to an address at each of the two big
      providers** (a Gmail one and an Outlook one) and check where it lands.
      This is the only test that answers the question, and it has to be done by
      a person with two mailboxes.
- [ ] **Invitations carry a one-click unsubscribe**, which Trefaro sets by
      itself (`List-Unsubscribe`). Nothing to configure — but if a reverse
      proxy in front of the instance rewrites or blocks `POST` requests to
      `/api/user/invitations/opt-out/one-click`, the header points at a door
      that does not open, and providers notice.

The first five are one afternoon with whoever administers the domain. They are
the difference between a registration form that works and one that quietly
collects nothing.

### 7.4 Trying it out before an event

`tools/secure-mail/verify.sh` starts a mail server that refuses anonymous and
unencrypted submission, and shows a confirmation mail going through it anyway.
It answers "can this instance authenticate and encrypt", which is the half that
can be tested here. It says nothing about section 7.3.

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
row in the database, not a rebuild.

**Languages** in the administration is where that happens:

- Every language is listed with how far it is translated, counted against the
  English catalogue — English is the list of keys and the last resort, so a key
  nobody has translated shows its English text rather than a blank.
- **Editing** is per key, with the English original beside the field and a
  filter for the ones still missing. _Reset_ puts a key back to the text the
  image ships; it only ever removes your own row.
- **Adding a language** is typing its tag (`fr`, `pt-BR`, …) and translating it.
  Nothing has to be rebuilt and nothing has to be installed.
- **Offered** and **Default** are a separate decision from the translation:
  ticking _Offered_ puts a language in the switch both clients show, and _Save
  offered languages_ writes it. Taking the tick away hides the language again
  and **keeps every translation** — English cannot be removed, and the default
  has to be one of the offered ones.
- **Export JSON** and **Import JSON** are for translation work outside the
  application: the export has every key with your text (empty where there is
  none), and importing the file back writes what it recognises and tells you
  which keys it did not know — a file from an older version of Trefaro is
  imported, not refused.

A change is live on the next load of either client; nothing pushes it to a
browser that is already open.

**What is translated today**, so a half-finished language is not a surprise: the
**participant client** in full — every page a visitor sees, including the dates,
the clock and the file sizes, which follow the reader's language while the times
themselves stay in the event's own zone. The **organizer client** is still
English apart from a few labels; it follows in the next work package. So does
outgoing mail, which for now uses the templates the image ships and follows the
default language.

One thing no translation reaches: when the server refuses something, its reason
arrives in English — "This session is full" under a German sentence saying that
the seat could not be claimed. The half your organization can change is the
sentence; the reason comes from the application itself.

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

### 12.1 Reading the log

```bash
docker compose --env-file .env -f infra/docker-compose.yml logs -f server
```

Everything the instance writes goes there, in one format: the server's own
lines, and the database's. Two things it deliberately does **not** contain:

- **Nobody's address, name or password, and no token.** A line names a row by
  its id. That is not politeness — a log ends up in a mail to somebody helping
  you, and it should be sendable. A search term never appears either: the
  values in a web address are removed before anything is written, the keys
  stay, so `?search=…` says that a search failed without saying what was
  searched for.
- **The normal traffic of a day.** A visitor who is not signed in, a page that
  does not exist, a plug-in that is switched off — those answer 401 and 404 all
  day long, and they are written only at `LOG_LEVEL=debug`.

`LOG_LEVEL` takes `warn`, `log` (the default), `debug` or `verbose`. Quieter
than `warn` is not offered: the lines that say a rate limit was raised, or that
mail leaves this instance unencrypted, are warnings, and an instance that
cannot print them is one you cannot check from its own log.

### 12.2 "It said something went wrong" — the fault mark

When the server answers with a fault, the answer carries an eight-character
mark, and exactly one line in the log carries the same one:

```
[Nest] ERROR [AllExceptionsFilter] 500 a1b2c3d4 /api/admin/events/…/registrations?search=…
```

So the useful question to somebody reporting a problem is not _what did you
type_ but **what did it say** — the mark is in the answer the browser received
(developer tools, the Network tab, the failing request). With it,
`logs server | grep a1b2c3d4` finds the one entry that has the stack trace in
it. That is the whole design: a fault stays diagnosable without anything about
the person who hit it being written down.

### 12.3 How this instance has been

```
GET /api/admin/operations
```

Behind an organizer login, and it answers with numbers rather than rows: how
long the server has been up, how much memory it holds, whether the database
answers and how quickly, how many requests were answered and how many were
refused (rate limits counted apart), the mark and time of the last fault, and
how much mail went out and how much did not.

The mail counters are the ones worth a glance after every event: mail is the
part of an installation that stops working without anybody noticing, because an
organizer sees the registration arrive and never learns that its receipt did
not. Everything here is counted since the **process** started, so a restart
sets it back to zero — which is usually the very thing you wanted to know.

`/api/health` stays public and unchanged: two words for the proxy and the
container health check, which cannot sign in.

### 12.4 Two tools that ask the instance itself

Both of these exist because of one fact about this application: **what only
happens in a production build, or only inside a container, is invisible to every
test suite in the repository.** A green CI run says the code is right. It says
nothing about whether your proxy passes the WebSocket upgrade, whether your mail
server accepts what this one sends, or whether the plug-in switch really reaches
the browser on your machine.

**`tools/spike-verification/`** — ten scripts, against a running instance:

```bash
BASE=https://events.example.org node tools/spike-verification/verify-proxy.mjs
```

| Script                     | What it asks the instance                                                                      |
| -------------------------- | ---------------------------------------------------------------------------------------------- |
| `verify-proxy.mjs`         | Headers, both clients, the WebSocket upgrade, the PWA manifest and its icons                   |
| `verify-api.mjs`           | Health, the database behind it, the public endpoints, the plug-in bundle, the OpenAPI document |
| `verify-plugin-toggle.mjs` | That a plug-in switches on and off **without a restart**, and that its own tables hold         |
| `verify-admin-access.mjs`  | The login, the session cookie and the rate limit                                               |
| `verify-mail.mjs`          | That a confirmation mail is composed, sent and arrives                                         |
| `verify-i18n.mjs`          | That the catalogue is served and a second language really switches                             |
| `verify-push.mjs`          | That only the public VAPID key is published and a subscription is stored once                  |
| `verify-setup.mjs`         | The guided first-run setup, once, on a fresh instance                                          |
| `verify-chat.mjs`          | That the socket authenticates, joins its room and carries a message                            |
| `verify-contact.mjs`       | The contact form of an event, end to end                                                       |

Their README says which needs what. Two of them additionally read the database
directly and want `POSTGRES_CONTAINER`; everything else goes through the same
HTTP interface a browser uses. **Run them after an installation and after an
update** — the scripts are the reason several defects were found that no unit
test could see, including a database driver missing from the server image and a
service worker that served `/admin/` out of the participant client's cache.

The name is from phase 0, when they verified the architecture spikes. What they
verify now is a deployment — yours.

**`/spikes` in the participant client** — the same questions, in a browser:

```
https://events.example.org/spikes
```

One page, reachable without a login, deliberately not linked from anywhere. It
shows what **this** browser sees: which languages and modules the instance
serves, the colours and font it applies, which plug-in bundles actually loaded,
whether push works here, and whether the WebSocket survives your proxy. It reads
nothing that `/api/config` does not already serve publicly, so it is not a leak —
and it is the fastest answer to "it works for me but not for them", because the
person having the problem can open it.

The two overlap on purpose: the scripts are for you at a terminal, the page is
for whoever is sitting in front of the browser that misbehaves.

## 13. What runs where

```
                       ┌───────────────────────────────┐
   :443 / :80 ────────▶│ nginx (reverse proxy)         │
                       └──┬──────────┬─────────────┬───┘
                          │          │             │
              /           │  /admin/ │       /api/ │  /api/socket.io/
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

The WebSocket lives **inside** `/api` — at `/api/socket.io/`, not at the
socket.io default — because the participant session cookie carries `Path=/api`
and would not travel anywhere else, and that handshake is what authenticates the
socket. A proxy in front of this one has to pass the `Upgrade` and `Connection`
headers through for that location; `infra/nginx/trefaro-locations.conf` shows
what nginx needs, and `tools/spike-verification/verify-proxy.mjs` says whether
it arrived.

The participant client is a mobile-first installable PWA served at the root; the
organizer client is desktop-first and served under `/admin/`. Both fetch their
configuration — colours, logo, font, enabled modules — from the server at
startup, which is why a design change reaches both without a rebuild.

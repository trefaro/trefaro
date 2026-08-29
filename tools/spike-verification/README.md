# Spike verification scripts

Executable versions of the claims in `docs/spikes/`. Unit tests cover the logic;
these check the things only a running instance can answer — that migrations
applied, that a disabled plug-in really answers 404, that a WebSocket upgrade
really survives the proxy.

Every one of them found at least one defect that the unit tests did not:
a database driver missing from the server image, `@IsUrl` accepting a bare word,
a service worker cached forever, redirects pointing at the wrong port — and, in
phase 1, the two that only a running container stack can show: the bootstrap
credentials never reaching the server container, so a fresh instance had no
administrator, and a service worker that answered `/admin/` from the participant
client's cache, so the organizer client was unreachable.

Since AP 12 of phase 2, `verify-proxy.mjs` also checks the PWA manifest, which
only a running stack can answer for: the document is built by the _server_ from
this instance's configuration (E26) and linked by the _client_, so the two halves
never meet anywhere else. It checks that the link points at the served manifest,
that the manifest names the organization rather than Trefaro, that its splash
colour is the configured one, that every icon it declares is reachable through
the proxy, and that at least one of them is square and big enough for a browser
to install from.

| Script                     | Needs                                                                       |
| -------------------------- | --------------------------------------------------------------------------- |
| `verify-api.mjs`           | server + PostgreSQL                                                         |
| `verify-plugin-toggle.mjs` | server + PostgreSQL + `docker exec` into the database container             |
| `verify-socket.mjs`        | server                                                                      |
| `verify-push.mjs`          | server + PostgreSQL + a VAPID key pair in `.env`                            |
| `verify-i18n.mjs`          | server + PostgreSQL + `ADMIN_BOOTSTRAP_*` from `.env` (it signs in)         |
| `verify-mail.mjs`          | server + PostgreSQL + **Mailpit** + `ADMIN_BOOTSTRAP_*` (it signs in)       |
| `verify-proxy.mjs`         | the full five-container stack; over HTTPS when `PROXY_BASE` is an https URL |
| `verify-setup.mjs`         | a **fresh** stack with no administrator, and the token from its startup log |

## Against a local server

```bash
docker compose -f infra/docker-compose.dev.yml up -d
cp .env.example .env                    # the defaults match the dev stack
npx nx build plugin-room-planning
npx nx build server
node dist/apps/server/main.js           # in its own shell

node tools/spike-verification/verify-api.mjs
node tools/spike-verification/verify-socket.mjs
node tools/spike-verification/verify-plugin-toggle.mjs
node tools/spike-verification/verify-i18n.mjs

# The four mails, read out of the box they were actually sent to. It registers,
# confirms, cancels and invites, edits the confirmation subject to prove it takes
# effect with no rebuild, and puts the instance into a half-translated language
# to prove E24 — then puts everything back.
node tools/spike-verification/verify-mail.mjs

# For push, add a key pair to .env first and restart the server:
npx web-push generate-vapid-keys
node tools/spike-verification/verify-push.mjs
```

## Against the container stack

```bash
docker compose --env-file .env -f infra/docker-compose.yml up -d --build

# Routing, the WebSocket upgrade, the service worker's navigation rules — and
# since AP 12 the PWA manifest: that the participant client links the one the
# *server* builds, that it carries the organization's name and colour, and that
# every icon it names is reachable through the proxy. The manifest is the one
# document whose two halves live in different containers, so a running stack is
# the only place they meet.
node tools/spike-verification/verify-proxy.mjs

# The catalogues have to be *inside* the image, which is where the source tree
# stops being evidence — and the second half walks the whole language
# administration through the API:
BASE=http://localhost:8080 \
ADMIN_BOOTSTRAP_EMAIL=… ADMIN_BOOTSTRAP_PASSWORD=… \
  node tools/spike-verification/verify-i18n.mjs
```

## Against the TLS overlay

```bash
docker compose --env-file .env \
               -f infra/docker-compose.yml \
               -f infra/docker-compose.tls.yml up -d

PROXY_BASE=https://localhost PROXY_PLAIN_BASE=http://localhost \
NODE_TLS_REJECT_UNAUTHORIZED=0 \
  node tools/spike-verification/verify-proxy.mjs
```

`PROXY_BASE` pointing at the HTTPS address runs every check above over TLS rather
than duplicating them; `PROXY_PLAIN_BASE` adds the redirect from port 80. With
`ADMIN_BOOTSTRAP_EMAIL` and `ADMIN_BOOTSTRAP_PASSWORD` in the environment it also
signs in once — the check that actually decides whether an instance is
administrable, because the session cookie is `Secure` and a browser drops it over
plain HTTP.

`NODE_TLS_REJECT_UNAUTHORIZED=0` belongs to a self-signed trial certificate only.
With a real one, leave it out — otherwise the run says nothing about the chain,
which is the part that breaks in practice (a leaf without its intermediates
works in the browser that cached them and nowhere else).

## Against a fresh instance, once

```bash
# ADMIN_BOOTSTRAP_* empty in the .env, and an empty database volume:
docker compose --env-file .env -p trefaro-fresh \
               -f infra/docker-compose.yml up -d --build
docker compose -p trefaro-fresh logs server | grep -A 2 'no administrator'

TREFARO_BASE_URL=http://localhost:8080 TREFARO_SETUP_TOKEN=<the token> \
  node tools/spike-verification/verify-setup.mjs

docker compose -p trefaro-fresh down -v
```

This one really sets the instance up, so it is the only script here that must not
be pointed at anything worth keeping.

`PUBLIC_USER_CLIENT_URL` and `PUBLIC_ADMIN_CLIENT_URL` have to point at the
proxy — `http://localhost:8080` and `http://localhost:8080/admin` for the
default port — because they are the WebSocket origin allow-list.

## Notes

- `verify-plugin-toggle.mjs` changes `module_config` through
  `docker exec trefaro-postgres psql` — the operator's path, and the one with the
  timer in it: it takes up to 15 seconds for the change to be picked up, which is
  the server's configuration refresh interval. Since AP 4 of phase 2 the script
  also exercises the module administration endpoint
  (`PATCH /api/admin/modules/:key`), whose whole point is that the _next_ request
  already sees the change — so that section contains no waiting at all. Since
  AP 9 it needs `ADMIN_BOOTSTRAP_EMAIL` and `ADMIN_BOOTSTRAP_PASSWORD` in the
  environment: every `/api/admin/**` route needs a session (E16), and a room
  needs an event that exists (F46), so the script signs in and creates a series
  and an event of its own — and removes them again at the end.
- `verify-setup.mjs` is the only proof of the first-run setup's happy path that
  can exist. The endpoints are there only while `admin_user` is empty, every
  automated suite runs against an instance created from `ADMIN_BOOTSTRAP_*`, and
  the last administrator cannot be deleted — so no test in this repository can
  reach that state, which is exactly the property that makes the state safe. The
  suites assert the other half: that the route is closed
  (`apps/server-e2e/src/api/setup.spec.ts`, `verify-admin-access.mjs`).
- `verify-push.mjs` switches the `push` core module on for its own duration and
  puts the flag back: a fresh instance has it off (E21), and its endpoints then
  answer 404. `verify-api.mjs` meets the same endpoint from the other side and
  asserts exactly that.
- `verify-i18n.mjs` exists for one class of defect: a catalogue that never
  reaches the container. The shipped JSON lives in three places at once — the
  library, the webpack `assets` entry that copies it into
  `dist/apps/server/assets/i18n`, and the `COPY` plus `I18N_CATALOGUE_DIR` in
  the server Dockerfile — and a missing one of the three produces an instance
  that answers `200 {}`, after which both clients render their keys. Every suite
  stays green, because they all run `nx serve` from the workspace, where the
  default path is the library itself. Its second half signs in and walks the
  whole of AP 7 through the API: it creates a language nothing ships, translates
  one key, offers it to visitors, checks that the public catalogue follows, takes
  the offer back, checks that the translation survives, and resets it. That is
  the acceptance criterion of the language administration against a real
  deployment — and it is what shows the second half of E22, that a changed word
  is live on the next request with no rebuild and no restart. It restores what it
  found; without `ADMIN_BOOTSTRAP_*` it skips that half and still runs the rest.
- `verify-proxy.mjs` also checks what the service worker claims: it replays
  ngsw's own selection rule — one positive pattern matches, no negative one does —
  against the built `ngsw.json`, for `/admin/`, `/api/config` and `/socket.io/`.
  A unit test cannot see this and neither can a `fetch`-based check: only a real
  browser runs a service worker, and only a production build registers one.
- Every script exits non-zero on the first failed check, so they can be chained
  in a shell or a pipeline.
- These are deliberately plain Node scripts rather than an Nx target: they test a
  _deployment_, not a project, and should stay runnable against any instance by
  pointing `BASE` or `PROXY_BASE` at it.

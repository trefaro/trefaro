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

| Script                     | Needs                                                           |
| -------------------------- | --------------------------------------------------------------- |
| `verify-api.mjs`           | server + PostgreSQL                                             |
| `verify-plugin-toggle.mjs` | server + PostgreSQL + `docker exec` into the database container |
| `verify-socket.mjs`        | server                                                          |
| `verify-push.mjs`          | server + PostgreSQL + a VAPID key pair in `.env`                |
| `verify-proxy.mjs`         | the full five-container stack                                   |

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

# For push, add a key pair to .env first and restart the server:
npx web-push generate-vapid-keys
node tools/spike-verification/verify-push.mjs
```

## Against the container stack

```bash
docker compose --env-file .env -f infra/docker-compose.yml up -d --build
node tools/spike-verification/verify-proxy.mjs
```

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
- `verify-push.mjs` switches the `push` core module on for its own duration and
  puts the flag back: a fresh instance has it off (E21), and its endpoints then
  answer 404. `verify-api.mjs` meets the same endpoint from the other side and
  asserts exactly that.
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

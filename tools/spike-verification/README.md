# Spike verification scripts

Executable versions of the claims in `docs/spikes/`. Unit tests cover the logic;
these check the things only a running instance can answer — that migrations
applied, that a disabled plug-in really answers 404, that a WebSocket upgrade
really survives the proxy.

Every one of them found at least one defect that the unit tests did not:
a database driver missing from the server image, `@IsUrl` accepting a bare word,
a service worker cached forever, redirects pointing at the wrong port.

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
  `docker exec trefaro-postgres psql`, standing in for the module administration
  UI that arrives in phase 2. It takes up to 15 seconds for the change to be
  picked up, which is the server's configuration refresh interval. Since AP 9 it
  also needs `ADMIN_BOOTSTRAP_EMAIL` and `ADMIN_BOOTSTRAP_PASSWORD` in the
  environment: every `/api/admin/**` route needs a session (E16), and a room
  needs an event that exists (F46), so the script signs in and creates a series
  and an event of its own — and removes them again at the end.
- Every script exits non-zero on the first failed check, so they can be chained
  in a shell or a pipeline.
- These are deliberately plain Node scripts rather than an Nx target: they test a
  _deployment_, not a project, and should stay runnable against any instance by
  pointing `BASE` or `PROXY_BASE` at it.

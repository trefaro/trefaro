# Spike 4 — WebSockets through the NGINX reverse proxy

**Question.** Does a socket.io connection survive the reverse proxy of the
thesis' distribution view, from both clients — and does the rest of the proxy
routing hold up?

**Verdict: works,** verified against the full five-container stack.

## What was built

| Piece               | Where                                                          |
| ------------------- | -------------------------------------------------------------- |
| socket.io gateway   | `apps/server/src/app/business/chat/chat.gateway.ts`            |
| Origin allow-list   | `apps/server/src/app/core/websocket/configured-io.adapter.ts`  |
| Client              | `libs/shared-http/src/lib/realtime/realtime-client.service.ts` |
| Proxy configuration | `infra/nginx/trefaro.conf`                                     |
| Production stack    | `infra/docker-compose.yml`                                     |

The gateway carries only what the spike needs: the connection lifecycle and a
`chat:echo` probe. Conversations, groups and image exchange are phase 3 and
replace the echo handler.

## Verified behaviour

Five containers — participant client, organizer client, server, PostgreSQL,
NGINX — built and started with
`docker compose --env-file .env -f infra/docker-compose.yml up -d --build`, then
`node tools/spike-verification/verify-proxy.mjs`:

```
PASS  /api reaches the server — {"status":"ok","database":"up"}
PASS  plug-in bundles are reachable under /api/plugins
PASS  / serves the participant client
PASS  its base href is the root
PASS  the manifest is installable as Trefaro
PASS  the service worker is served, which push depends on
PASS  the service worker is not cached — no-cache, must-revalidate
PASS  a client-side route falls back to index.html rather than 404
PASS  /admin redirects to /admin/ — got 301 -> /admin/
PASS  the organizer client was built with base href /admin/
PASS  the WebSocket handshake survives the reverse proxy
PASS  it is a real upgrade, not long-polling — websocket
PASS  frames travel both ways through the proxy
PASS  the server also sees a websocket transport — websocket
```

The verification client connects with `transports: ['websocket']` on purpose. The
failure this spike is really about is a proxy that drops the upgrade and lets
socket.io fall back to long-polling — which looks like it works until a chat
needs to push. Both ends report the transport so a silent fallback cannot pass.

## Findings

**The proxy configuration is three lines and all three matter.**
`proxy_http_version 1.1`, `Upgrade $http_upgrade` and `Connection "upgrade"`.
Without them the handshake fails. The long `proxy_read_timeout` matters
separately: an idle chat connection would otherwise be cut mid-session.

**The allow-list cannot live on the gateway.** A `@WebSocketGateway` decorator is
evaluated before dependency injection exists, so it cannot read configuration.
`ConfiguredIoAdapter` sets the CORS origins from the configured client URLs
instead, applied in `main.ts`.

**Two container-only defects, found by running the stack.**

- **An immutably cached service worker.** `client.conf` matched
  `ngsw-worker.js` against its hashed-asset rule, because nginx takes the _first_
  matching regex `location`. The worker was served `immutable, max-age=1y`,
  which would leave an installed PWA permanently unable to update — the worst
  possible bug for an app distributed as a PWA, and invisible outside a
  container build. The no-cache block now comes first.
- **Redirects pointed at the wrong port.** `/admin` → `/admin/` was emitted as
  an absolute `http://localhost/admin/`, built from `$host` without the port, so
  it broke on any instance not published on port 80 — including the compose
  default of 8080. `absolute_redirect off` makes it relative.

**The organizer client needs its base href at build time.** It is served under
`/admin/`, so `nx build admin-client --base-href=/admin/` is passed as a Docker
build argument. Both clients share one Dockerfile that differs only in the Nx
project and this argument.

**Only the proxy publishes a port.** The server and PostgreSQL are reachable on
the internal network alone, which matters while the push subscribe endpoint is
still anonymous.

## Decisions taken here

- **The default socket.io path `/socket.io` is kept.** It is what the proxy
  configuration forwards, and changing it buys nothing.
- **Plug-in bundles are served by the server under `/api/plugins`.** One URL then
  works in development through the dev-server proxy and in production through
  NGINX, with no extra routing and no bundle duplicated into both client images.
- **TLS is deliberately absent from the committed configuration**, so a local
  `docker compose up` works without certificates. Terminating Let's Encrypt here
  is part of the deployment documentation (phase 5).

## Open items

- **Sockets are unauthenticated.** The gateway accepts any connection from an
  allowed origin. Phase 3 has to tie a socket to a logged-in participant before
  chat carries anything real.
- **Horizontal scaling needs a socket.io adapter.** More than one server
  container requires a shared adapter (Redis or Postgres) for rooms to work
  across instances. Not needed for the target audience — one instance per
  organization, under twenty staff — but it is the thing to reach for if
  scaling ever comes up.
- The echo handler is a spike artifact. Phase 3 replaces it; it should not
  survive into a release.

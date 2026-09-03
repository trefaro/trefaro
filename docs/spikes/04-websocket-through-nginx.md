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

The gateway carried only what the spike needed: the connection lifecycle and a
`chat:echo` probe. **AP 7 of phase 3 replaced all of it** — the handshake
authenticates against the session cookie, the `chat` module flag is asked at the
same moment, and there is a room per conversation (E41). The echo handler and
the `verify-socket.mjs` that used it are gone; `verify-chat.mjs` checks the
thing the echo stood in for, which is a message arriving at two people through
the proxy. What survives from here unchanged is the proxy configuration and the
reason it exists.

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

The last two lines read differently since AP 7 of phase 3, because there is
nothing to echo any more: the handshake without a cookie is now _supposed_ to
fail, and the server's own refusal coming back over the socket proves the same
two things the echo did — the upgrade reached the application, and a frame
travelled the other way.

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
  configuration forwards, and changing it buys nothing. — **Revised in AP 7 of
  phase 3:** it buys one thing, and it turned out to be the decisive one. The
  participant session cookie is issued with `Path=/api`, so a browser does not
  attach it to a handshake anywhere else, and a socket that authenticates on
  that cookie (E41) has to be reachable inside that path. The endpoint is
  `/api/socket.io` now, `REALTIME_PATH` in `libs/shared-models` is the single
  spelling of it, and the proxy has a `location /api/socket.io/` that wins over
  `/api/` by longest prefix.
- **Plug-in bundles are served by the server under `/api/plugins`.** One URL then
  works in development through the dev-server proxy and in production through
  NGINX, with no extra routing and no bundle duplicated into both client images.
- **TLS is deliberately absent from the committed configuration**, so a local
  `docker compose up` works without certificates. Terminating Let's Encrypt here
  is part of the deployment documentation (phase 5).

## Open items

Tracked in [`todo.md`](../../todo.md), which records the phase that makes each
of them checkable.

- ~~**Sockets are unauthenticated.**~~ Closed by AP 7 of phase 3: the handshake
  resolves the participant session cookie through the same service the HTTP
  guard uses, and refuses without one. The `chat` module flag is asked there
  too.
- **The handshake carries no rate limit.** `@nestjs/throttler` sees HTTP routes,
  and a socket.io handshake is handled by engine.io before Nest's router — so
  the one request that now costs a session lookup is the one request nothing
  counts. Hardening work (phase 5), together with the configurable throttling
  that phase already owns.
- **Horizontal scaling needs a socket.io adapter.** More than one server
  container requires a shared adapter (Redis or Postgres) for rooms to work
  across instances. Not needed for the target audience — one instance per
  organization, under twenty staff — but it is the thing to reach for if
  scaling ever comes up.
- ~~The echo handler is a spike artifact.~~ Removed in AP 7 of phase 3, together
  with `RealtimeClient.echo`, the button on the diagnostics page and the script
  that used it.

# Architecture spikes (phase 0)

The thesis names the plug-in mechanism as its own open point: it was designed but
never built. Phase 0 exists to answer whether the design survives contact with
Angular, NestJS and NGINX before phase 1 starts building features on top of it.

| #                                  | Spike                                                                               | Verdict                                                                      |
| ---------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| [1](01-client-plugin.md)           | Angular Elements plug-in loaded at runtime, themed through CSS custom properties    | works                                                                        |
| [2](02-server-plugin.md)           | NestJS dynamic module plug-in with its own entity and migration, toggled at runtime | works                                                                        |
| [3](03-web-push.md)                | Self-hosted Web Push end to end                                                     | works on the server; browser and device delivery still to be checked by hand |
| [4](04-websocket-through-nginx.md) | socket.io through the NGINX reverse proxy                                           | works                                                                        |

## Open items

Everything phase 0 deliberately left for later is collected in
[`todo.md`](../../todo.md), grouped by the phase that makes it checkable, with
links back to the protocol each item came from. Review it at the end of every
phase.

## Reproducing the results

The checks are scripts, not prose, so they can be re-run after any change:

```bash
# Infrastructure and a built server
docker compose -f infra/docker-compose.dev.yml up -d
cp .env.example .env            # fill in nothing; the defaults match the dev stack
npx nx build plugin-room-planning
npx nx build server
node dist/apps/server/main.js

# In a second shell
node tools/spike-verification/verify-api.mjs
node tools/spike-verification/verify-plugin-toggle.mjs   # needs the admin credentials
node tools/spike-verification/verify-socket.mjs
node tools/spike-verification/verify-push.mjs   # needs VAPID keys in .env
```

For the checks that only make sense against the full five-container stack — the
reverse proxy, and the organizer client under `/admin/` — see
[spike 4](04-websocket-through-nginx.md).

## A note on how this was recorded

`docs/BOOTSTRAP.md` asks for one small pull request per spike. All four were
built in a single pass instead, because they share the plug-in contract: the
server descriptor, the client loader and the bundle build had to exist together
before any of them could be judged. The findings are recorded per spike below,
which is what the protocol was for.

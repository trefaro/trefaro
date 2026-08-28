# Spike 3 — Self-hosted Web Push

**Question.** Can an instance send push notifications with its own VAPID key
pair, with no Firebase and no other third-party push service (F7, NFR 9)?

**Verdict: the server side works and is verified.** Delivery into a browser, and
the iOS case in particular, still needs a manual check on real devices — see
_Still to be checked by hand_ below.

## What was built

| Piece                       | Where                                                                  |
| --------------------------- | ---------------------------------------------------------------------- |
| VAPID configuration         | `apps/server/src/app/core/config/env.ts`                               |
| Send and subscription logic | `apps/server/src/app/business/push/push.service.ts`                    |
| Subscription endpoint       | `apps/server/src/app/business/push/push.controller.ts`                 |
| Storage                     | `apps/server/src/app/data-access/entities/push-subscription.entity.ts` |
| Client subscription         | `apps/user-client/src/app/features/push/push-subscription.service.ts`  |
| Service worker              | `@angular/pwa` on the participant client                               |

## Verified behaviour

`node tools/spike-verification/verify-push.mjs`, against a running server with a
generated key pair:

```
PASS  the instance publishes a VAPID public key once configured
PASS  the published key is a public key, not the pair
PASS  subscribing is 204 No Content
PASS  the subscription is stored
PASS  re-subscribing replaces the row instead of duplicating it
PASS  the rotated keys were written
PASS  unsubscribing is 204 No Content
PASS  unsubscribing twice is not an error
PASS  a malformed endpoint is rejected
PASS  a subscription without keys is rejected
```

Delivery logic — fan-out, pruning of endpoints the push service reports as gone,
and one endpoint failing without taking the rest down — is covered by unit tests
against a mocked `web-push` in `push.service.spec.ts`.

## Findings

**Push has to be optional.** An organization that has not generated a key pair
must still get a working instance. `webPush` is therefore `null` in the
configuration, `/api/config` reports `webPushPublicKey: null`, and the client
shows push as _not configured_ instead of offering a button that cannot work. The
server refuses a subscribe attempt with 503 rather than accepting one it can
never use.

**Two live validation defects, both invisible to unit tests.**

- `@IsUrl({ require_tld: false })` accepts `not-a-url`: with no TLD required, a
  bare word is a valid hostname. `require_protocol: true` was missing.
- `@ValidateNested()` on its own ignores a missing value. A request without
  `keys` passed validation and then failed reading `keys.p256dh` — a 500 where a
  400 belonged. It needs `@IsDefined()` and `@IsObject()` alongside it.

Both were found by running requests against the real server, not by testing the
service. Worth remembering: DTO validation is only real once a request goes
through the pipe.

**`PushSubscription.toJSON()` cannot be posted as-is.** It carries
`expirationTime`, and the API runs with `forbidNonWhitelisted: true`, so the
whole request would be rejected. The client sends `endpoint` and the two keys
field by field. Rejecting unknown fields is the right default — a configurable
registration field kit means a typo in a field key must not silently vanish — so
the client adapts, not the server.

**Endpoints are unique.** A browser may re-subscribe with rotated keys, so the
endpoint is an upsert conflict target rather than a reason to reject. Without
that, the table grows one row per page reload.

**Subscriptions carry no owner yet.** `push_subscription` has no `user_id`:
participant profiles arrive in phase 3, and the column belongs in that migration
together with its foreign key. The consequence is that `POST
/api/user/push/subscriptions` is currently open to anonymous callers.

**Payloads stay thin.** A notification says that something the participant
registered for changed, plus a path to open — not the change itself. The payload
travels through a browser vendor's push service, so it carries as little personal
data as possible (NFR 7).

## Still to be checked by hand

The service worker only registers in a production build, so this needs a built
client rather than `nx serve`:

```bash
npx nx build user-client --configuration=production
npx web-push generate-vapid-keys        # put both keys in .env
# serve dist/apps/user-client/browser over HTTPS or via http://localhost
```

Then, on `/spikes` in the participant client:

1. **Desktop Chrome and Firefox** — subscribe, confirm the row appears in
   `push_subscription`, send a notification and confirm it arrives and that
   clicking it navigates to the path in the payload.
2. **Android Chrome** — the same, over HTTPS.
3. **iOS Safari, PWA installed to the home screen** — this is the case the
   decision to use Web Push as the only channel depends on. Push does not work in
   a normal iOS Safari tab; it requires the installed PWA and iOS 16.4+.

There is no endpoint for triggering a test send: an unauthenticated one would be
a spam vector. Trigger `PushService.broadcast()` from a REPL, or wait for phase 3
to wire it to actual event changes.

## Open items

Tracked in [`todo.md`](../../todo.md), which records the phase that makes each
of them checkable.

- **Rate limiting before an instance goes public.** The subscribe endpoint is
  anonymous until phase 3 ties subscriptions to accounts.
- **Notification permission is asked for on a button press**, which is correct —
  but the participant client should explain why before asking (NFR 4). That is UI
  work for phase 3.
- The service worker's `navigationUrls` excludes `/api/**`, `/socket.io/**` and —
  **since 28.08.2026** — `/admin` and `/admin/**`. The last two were missing, and
  this sentence used to name only the first two, which is how the gap survived a
  whole phase: the worker is served from the root, so its scope is the entire
  origin, and it answered navigations to `/admin/` from the participant client's
  cache. That client has no route for `/admin/`, so its wildcard route redirected
  to `/` — **the organizer client was unreachable** in the container stack, in any
  browser that had once loaded the participant client. Only in a production build,
  because that is the only place Angular registers the worker at all, which is why
  every suite stayed green. `verify-proxy.mjs` now replays ngsw's own selection
  rule against the built `ngsw.json`. Still worth re-checking when the PWA is
  polished in phase 2 — and the lesson is the general one: a path added under this
  origin that does not belong to the participant client belongs in that list.

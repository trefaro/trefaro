# TODO — deferred items and open decisions

Phase 0 validated the architecture, which necessarily left things that cannot be
judged yet: a push notification cannot be tested on a device before there is
anything worth notifying about, and an authorization rule cannot be verified
before authentication exists.

Every entry below says **which phase makes it checkable** and **how to check it**.
Work the matching section at the end of each phase; an entry that turns out to
still be premature moves down rather than being ticked.

Entries link to the spike protocol they came from, so the reasoning stays
attached to the task.

---

## Known gaps in the current state

Not deferred verification — things that are genuinely missing and would matter if
an instance were exposed today.

- [ ] **Nothing is authenticated.** There is no login yet, so `/api/admin/**` has
      no guard: while the room planning plug-in is enabled, anyone who can reach
      the API can create rooms. Phase 1 brings the admin login (FR 1.3); the
      admin routes need a guard in the same step, not after it.
      → _checkable after phase 1_
- [ ] **`POST /api/user/push/subscriptions` is anonymous and unthrottled.** Fine
      while the endpoint is unreachable from outside — only the reverse proxy
      publishes a port — but it needs rate limiting before a public instance.
      → _checkable after phase 3_, see [`03-web-push.md`](docs/spikes/03-web-push.md#open-items)

---

## Checkable after phase 1 — core event management

- [ ] **Guard the admin API.** Every `/api/admin/**` route, including plug-in
      controllers, behind the admin login. Verify: an unauthenticated request to
      the room planning endpoints answers 401, not 201.
- [ ] **Overbooking check gets its data.** FR 3.10 programme item sign-ups exist
      from this phase on; the room planning plug-in needs to read their counts.
      The plug-in must not query core tables directly — this needs a read
      capability in `business/plugin-api`, which is a versioned contract change.
      → implement the check itself in phase 4
- [ ] **The uploads volume is finally used.** The registration field kit (F12)
      introduces file uploads. Verify: type and size validation, and that a
      stored file is only reachable by an authorized request.
- [ ] **Implement F21 — the room link as a plug-in-owned join table.** Decided
      26.08.2026; nothing is built yet. `program_item` gets **no** `room_id`
      column; the room planning plug-in creates
      `plugin_room_planning_program_item_room (program_item_id, room_id)` with a
      foreign key to each side and `ON DELETE CASCADE` on the programme item.
      Its migration has to be timestamped after the core migration that creates
      `program_item`. Verify: deleting a programme item removes its room
      assignment, and dropping the plug-in leaves the core schema untouched.
      → [`02-server-plugin.md`](docs/spikes/02-server-plugin.md#who-owns-the-link-between-a-programme-item-and-a-room--decided)

## Checkable after phase 2 — whitelabel, module administration, i18n, PWA

- [ ] **Module toggling from the admin UI must be instant.** The plug-in registry
      re-reads its flags every 15 s; the admin endpoint that flips a flag has to
      call `PluginRegistryService.refresh()` so its own change takes effect
      immediately. Verify: enable a plug-in in the UI, reload the client, the
      plug-in is there without waiting.
      → [`02-server-plugin.md`](docs/spikes/02-server-plugin.md)
- [ ] **The PWA manifest is still static.** `apps/user-client/public/manifest.webmanifest`
      hard-codes name, icons and `theme_color`. A whitelabel instance has to
      serve them per organization. Verify: change the primary colour and the
      logo, reinstall the PWA, the home screen icon and splash follow.
- [ ] **`index.html` hard-codes the theme colour and the language.**
      `<meta name="theme-color">` and `<html lang="en">` must follow the
      configured theme and default locale.
- [ ] **Re-check the service worker configuration.** `ngsw-config.json` excludes
      `/api/**` and `/socket.io/**` from navigation handling; confirm that still
      holds once the PWA is polished, and that a new deployment is actually
      picked up by an installed client.
      → [`03-web-push.md`](docs/spikes/03-web-push.md#open-items)
- [ ] **Translation keys need a catalogue.** The plug-in contract already carries
      `titleKey` and `labelKey`, and `CORE_MODULES` carries `titleKey`; Transloco
      is not installed yet, so nothing resolves them. Verify: switching language
      at runtime renames modules and plug-ins in both clients.
- [ ] **Self-host the fonts.** Nothing to host yet (`system-ui`), but as soon as
      the font is configurable it must be served from the instance — no Google
      Fonts CDN (NFR 9).

## Checkable after phase 3 — profiles, messaging, chat, push

- [ ] **Web Push on real devices.** The one part of spike 3 that could not be
      verified. Needs a production build, because Angular only registers the
      service worker there. Full procedure in
      [`03-web-push.md`](docs/spikes/03-web-push.md#still-to-be-checked-by-hand).
      Matrix:
  - [ ] desktop Chrome — subscribe, receive, click navigates to the payload path
  - [ ] desktop Firefox — same
  - [ ] Android Chrome over HTTPS — same
  - [ ] **iOS Safari with the PWA installed to the home screen** (iOS 16.4+) —
        this is the case the decision to make Web Push the only channel (F7)
        depends on. It does not work in a normal Safari tab.
- [ ] **Rate-limit the subscribe endpoint** (see _Known gaps_).
- [ ] **Add `push_subscription.user_id` with its foreign key** in the phase 3
      migration, once `user_profile` exists. It was deliberately left out of the
      phase 0 schema rather than added without a constraint.
- [ ] **Explain the notification permission before prompting.** Currently a bare
      button triggers the browser prompt; NFR 4 targets people with rudimentary
      IT skills.
- [ ] **Authenticate the WebSocket handshake.** The gateway accepts any
      connection from an allowed origin. A socket has to be tied to a logged-in
      participant before chat carries anything real.
      → [`04-websocket-through-nginx.md`](docs/spikes/04-websocket-through-nginx.md#open-items)
- [ ] **Gate the chat gateway on the `chat` module flag.** The flag currently
      only decides whether the clients offer chat; the handshake itself ignores
      it.
- [ ] **Delete the `chat:echo` spike handler.** It is a phase 0 artifact and must
      not reach a release. The socket verification script goes with it, or gets
      pointed at a real message.
- [ ] **Wire `PushService.broadcast()` to actual event changes** (FR 3.15). There
      is deliberately no test-send endpoint — an unauthenticated one would be a
      spam vector.

## Checkable after phase 4 — plug-ins

- [ ] **Build the three remaining curated plug-ins.**
      `apps/server/src/plugins/{forum,program-proposals,qr-checkin}` hold only a
      README; they are deliberately not registered as no-op plug-ins. Order from
      the plan: programme proposals, forum, room planning, QR check-in.
- [ ] **Implement the overbooking check** in the room planning plug-in: sign-ups
      per programme item against room capacity.
- [ ] **Room planning stays structured for now.** An OpenStreetMap/Leaflet floor
      plan is the later stage (F14) — and never a Google map (NFR 9).
- [ ] **Each new plug-in proves the contract.** Verify per plug-in: own tables
      only, prefixed `plugin_<key>_`; disabled means 404 and absent from
      `/api/config`; disabling keeps its data.

## Checkable after phase 5 — hardening and release

- [ ] **Plug-in SDK documentation.** Three things phase 0 learned that a
      third-party plug-in author has to be told:
  - bundles are loaded same-origin and run with full page access, so plug-in
    review stays a human step
  - inputs are passed as element _properties_, not attributes
  - a plug-in migration must be timestamped after any core migration it depends
    on
    → [`01-client-plugin.md`](docs/spikes/01-client-plugin.md#open-items)
- [ ] **TLS.** Deliberately absent from `infra/nginx/trefaro.conf` so a local
      `docker compose up` works without certificates. Terminating Let's Encrypt
      belongs in the deployment documentation and an optional compose overlay.
- [ ] **Decide the fate of `/spikes`.** The participant client's diagnostics page
      is reachable without a login. It exposes nothing `/api/config` does not
      already expose publicly, so it is not a leak — but decide whether it stays
      as an operator tool or goes.
- [ ] **Decide the fate of `tools/spike-verification/`.** The scripts test a
      _deployment_ and are useful against a live instance; `*-e2e` covers CI. If
      they stay, they belong in the operations documentation.
- [ ] **Security review.** Auth, upload validation, plug-in isolation, and
      whether the OpenAPI description should keep being served publicly (it is
      today, on the grounds that the source is AGPL anyway).
- [ ] **GDPR functions.** Data export and deletion, which the schema was designed
      for but which nothing implements.
- [ ] **Load tests** (NFR 12).
- [ ] **socket.io shared adapter** — only if more than one server container is
      ever run. Not needed for one instance per organization.
- [ ] **Usability test with Democracy International**: the thesis' seven tasks
      repeated, plus the use cases it never tested.

---

## Decided

Decisions only — the work they imply stays in the phase sections above.

- [x] **F21, the room link** — decided 2026-08-26: a plug-in-owned join table,
      not a `room_id` column in `program_item`. Recorded as F21 in the
      requirements document, whose §5.3 schema draft is corrected; reasoning and
      the rejected alternatives in
      [`02-server-plugin.md`](docs/spikes/02-server-plugin.md#who-owns-the-link-between-a-programme-item-and-a-room--decided).
      Implementation is listed under phase 1.
- [x] **Thesis material in a public repository** — decided 2026-08-26: diagrams
      and mockups stay (they document where the architecture comes from), the
      full thesis PDF does not.

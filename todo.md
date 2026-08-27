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

- [x] **Nothing is authenticated.** ~~There is no login yet, so `/api/admin/**`
      has no guard.~~ Closed in phase 1, AP 1: every route below `/api/admin` —
      plug-in controllers included — needs an administrative session. The guard
      is keyed on the route path rather than on a decorator, so a plug-in author
      cannot forget it. Asserted in `apps/server-e2e/src/api/admin-access.spec.ts`.
- [x] **`POST /api/user/push/subscriptions` is anonymous and unthrottled.**
      Rate limiting arrived early: AP 1 needed it for the login and registered
      `ThrottlerGuard` globally (300 requests per minute per address by
      default), so every endpoint including this one is covered. It stays
      anonymous by design until phase 3 ties a subscription to a profile.
      → see [`03-web-push.md`](docs/spikes/03-web-push.md#open-items)

---

## Checkable after phase 1 — core event management

The plan for that phase is [`docs/PHASE1.md`](docs/PHASE1.md); every entry below
is assigned to one of its work packages.

- [x] **Guard the admin API.** Done in AP 1. An unauthenticated request to the
      room planning endpoints answers 401; a _disabled_ plug-in answers 404 only
      once a session proves the caller may know that much. Deleting an
      administrator ends their sessions through the foreign key, which is why
      sessions are rows rather than signed tokens (F22).
- [ ] **Overbooking check gets its data.** FR 3.10 programme item sign-ups exist
      from this phase on; the room planning plug-in needs to read their counts.
      The plug-in must not query core tables directly — this needs a read
      capability in `business/plugin-api`, which is a versioned contract change.
      → implement the check itself in phase 4
- [x] **Look a registration up without decoding its token.** ~~AP 4 creates rows
      that the API can delete but not list, so both e2e suites read the id out of
      the confirmation token's payload.~~ Closed in AP 5: both suites use
      `GET /api/admin/events/:id/registrations?search=<address>`, and the helpers
      `registrationIdFromPath` and `idFromToken` are gone. The organizer client's
      teardown now removes an event's registrations before its series, which is
      what E14 requires of anything that seeds a confirmed one.
- [ ] **Mail against the pilot partner's real SMTP server.** AP 4 proves the
      double opt-in against Mailpit, in unit tests, in the API contract suite and
      in three browsers — but Mailpit accepts everything. What it cannot show:
      authentication, TLS, SPF/DKIM alignment and whether the mail lands in an
      inbox rather than in spam. The phase plan assigned this to AP 4; it needs
      credentials for a server this project does not have. Verify when it
      happens: `SMTP_SECURE=true` with real credentials, and a confirmation mail
      that arrives without being filed as junk.
      **Deliberately deferred, no date yet** (Marius, 27.08.2026). It is not tied
      to the M1 feedback round any more and does not block a work package —
      but it must happen before a release: an instance whose mail lands in spam
      cannot register anyone, and no test in this repository can find that out.
      Latest point is the hardening of phase 5, together with TLS.
- [ ] **Tell a participant when an organizer cancels their registration.** AP 5
      lets an organizer cancel and reinstate (F31), and the person concerned
      learns nothing — a silent cancellation is the kind of thing that turns into
      somebody standing at a door. AP 11 builds the follow-up mail on top of the
      same participant list; the message belongs there rather than in a fourth
      mail template written in isolation. Verify: cancelling produces one mail,
      reinstating does not produce a second one that contradicts it.
- [x] **The uploads volume is finally used.** Done in AP 7: the `file` field
      type, the `attachment` table, and `GET /api/admin/attachments/:id` as the
      only way to the bytes. Both things that were easy to lose happened — the
      check constraint was widened by the migration, and the validation branch
      for a file is in `validateSubmission` rather than beside it. Verified in
      `apps/server-e2e/src/api/attachments.spec.ts`, including the file count in
      the volume before and after a deletion.
- [ ] **Throttle registration attempts per e-mail address, not only per client.**
      `REGISTRATIONS_PER_WINDOW` counts per client address, which is what the
      guard can see — so one address can be mailed as often as a single client is
      allowed to submit at all (60 per five minutes since AP 7, raised because an
      office shares one public address). The endpoint sends a mail to whatever
      address it is given, so the number that matters is per recipient. Needs a
      second counter with its own key; belongs with the hardening of phase 5,
      together with the SMTP work.
- [ ] **A sweep over the upload volume.** `AttachmentsService` compensates where
      the database and the volume can disagree, and it compensates towards
      keeping bytes rather than losing them — so a crash between two steps can
      leave a file that no row references. It is logged when it happens by
      compensation, but nothing finds one left by a crash. A sweep that lists the
      volume, joins it against `attachment.file_path` and reports (not deletes)
      what nothing points at would close it. Phase 5: right now it would be
      stock-keeping against a problem no instance has yet.
- [ ] **Three questions about the field kit for the M1 feedback round.** All were
      decided deliberately, and all are cheap to change if Democracy
      International says otherwise. First: there is **no multi-line text type** —
      a text field holds 500 characters, which is a paragraph, but it renders as
      a single line. Second: the answers appear in the **detail panel only, not
      as table columns**, because the overview has to stay readable and fast at
      two thousand rows (AP 5). Third (AP 7): the accepted file types are a
      **fixed catalogue of five** (PDF, JPEG, PNG, WebP, DOCX), and a form asks
      for at most five files. If the pilot partner collects something else —
      scanned forms as TIFF, a spreadsheet — the catalogue in
      `libs/shared-models/src/lib/registrations/upload.ts` is where it goes, and
      it needs a signature in `file-signature.ts` to go with it. Ask before
      building any of the three.
- [ ] **The participant search does not look into the answers.** It covers first
      name, last name and e-mail (F32). Searching `custom_fields_json` means a
      JSONB predicate that no index of ours covers, so it is not a small
      addition — and nobody has asked for it yet. Revisit if the pilot partner
      does.
- [ ] **Constrain `plugin_room_planning_room.event_id`.** It has been an
      unconstrained `uuid` since phase 0, because the core `event` table did not
      exist yet — the very integrity gap that decided F21 against a `room_id`
      column. That precondition is met: `event` exists since AP 3. Deliberately
      still open, and assigned to AP 9 rather than AP 3, because every room
      fixture in the spike scripts and the API contract suite currently points at
      an invented event id; the foreign key has to arrive together with pointing
      them at real events. A plug-in migration adds it with `ON DELETE CASCADE`,
      timestamped after the core migration. Verify: inserting a room for an
      unknown event fails, and deleting an event removes its rooms.
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

- [ ] **Mail in the participant's own language.** AP 4 sends every mail in the
      locale the instance is configured with (`app_config.default_locale`),
      because phase 1 has nowhere to ask a participant for a preference. Once
      profiles exist, the choice belongs to the person; the template registry in
      `business/mail/templates` already resolves per locale, so this is a lookup
      change and not a rebuild.

- [ ] **The participant overview gains its profile-status column.** FR 3.3 asks
      for it, and phase 1 left it out rather than shipping a column that always
      says "no profile" (E13 of [`docs/PHASE1.md`](docs/PHASE1.md)). Verify: a
      participant who created a profile is marked as such in the table.

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

- [ ] **Re-measure the participant overview at a size no pilot event reaches.**
      AP 5 proved the acceptance criterion at 2 000 registrations per event, in
      the API contract suite, with the numbers in the build log — worst case
      13 ms for a substring search that matches every row. What that measurement
      does _not_ cover is an organization whose events run an order of magnitude
      larger. If one ever appears, the answer is `pg_trgm` (deliberately avoided
      in F32 because the extension needs rights a managed PostgreSQL may not
      grant), and the decision has to be made with a real database in front of
      it, not from the plan.
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
- [ ] **Confirm the login rate limit.** Twenty attempts per five minutes per
      address, then a fifteen-minute block (`LOGIN_ATTEMPTS_PER_WINDOW` in
      `auth.controller.ts`). Chosen so the whole test suite, which logs in from
      one address, can survive it — the alternative was a limit that gets
      relaxed for tests and therefore never tested. The block itself is only
      verified by hand, via
      `tools/spike-verification/verify-admin-access.mjs`, because exercising it
      locks the route for fifteen minutes.
- [ ] **Confirm the registration rate limit.** Thirty attempts per five minutes
      per address (`REGISTRATIONS_PER_WINDOW` in
      `public-registrations.controller.ts`), and the same for the confirmation
      endpoint. Deliberately without a block period, unlike the login: this
      endpoint sends mail to an address the caller chooses, but a participant who
      mistypes their own address a few times has to be able to fix it. Not
      covered by an automatic test for the same reason as the login block — the
      window is five minutes, and a suite that trips it cannot repeat.
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

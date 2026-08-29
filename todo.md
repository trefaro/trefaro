# TODO — deferred items and open decisions

Phase 0 validated the architecture, which necessarily left things that cannot be
judged yet: a push notification cannot be tested on a device before there is
anything worth notifying about, and an authorization rule cannot be verified
before authentication exists.

Every entry below says **which phase makes it checkable** and **how to check it**.
Work the matching section at the end of each phase; an entry that turns out to
still be premature moves down rather than being ticked.

One section is not keyed to a phase: _Questions for the pilot partner_ collects
what no phase can decide because it needs an answer from Democracy International.
Those entries wait for the feedback round, not for a milestone.

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
- [x] **A fresh production instance had no administrator.** Found and closed in
      AP 13, while bringing the five-container stack up from an empty volume:
      `infra/docker-compose.yml` never passed `ADMIN_BOOTSTRAP_EMAIL` and
      `ADMIN_BOOTSTRAP_PASSWORD` to the server container. They are in
      `.env.example`, the server reads them, E3 depends on them — and the only
      supported deployment dropped them, so the instance came up with no account
      and no way to make one (every route that could requires a session, E16).
      Fixed together with `ADMIN_SESSION_TTL_HOURS`, and the two install
      documents now name the values a fresh instance cannot start or log in
      without. **The class of problem stays:** a key in `env.ts` plus
      `.env.example` is not configuration until compose passes it on, and nothing
      in the test suite can see that — the e2e suites run `nx serve`, and CI
      builds the images without ever starting them together.

---

## Checkable after phase 1 — core event management

The plan for that phase is [`docs/PHASE1.md`](docs/PHASE1.md); every entry below
is assigned to one of its work packages.

- [x] **Guard the admin API.** Done in AP 1. An unauthenticated request to the
      room planning endpoints answers 401; a _disabled_ plug-in answers 404 only
      once a session proves the caller may know that much. Deleting an
      administrator ends their sessions through the foreign key, which is why
      sessions are rows rather than signed tokens (F22).
- [x] **Overbooking check gets its data.** Done in AP 9. Programme item sign-ups
      exist (FR 3.10), and the room planning plug-in reads their counts through
      `PluginProgramReads` (E12, F45): five fields per programme item and counts
      for a list of ids, provided by the global `PluginHostModule` — so a plug-in
      still imports nothing but `plugin-api` and still queries no core table.
      `PLUGIN_API_VERSION` went to **1.1.0**, with a case in the compatibility
      test. What is deliberately not built is the **judgement** — see the phase 4
      entry and the question under _Questions for the pilot partner_.
- [x] **Look a registration up without decoding its token.** ~~AP 4 creates rows
      that the API can delete but not list, so both e2e suites read the id out of
      the confirmation token's payload.~~ Closed in AP 5: both suites use
      `GET /api/admin/events/:id/registrations?search=<address>`, and the helpers
      `registrationIdFromPath` and `idFromToken` are gone. The organizer client's
      teardown now removes an event's registrations before its series, which is
      what E14 requires of anything that seeds a confirmed one.
- [x] **Tell a participant when an organizer cancels their registration.** Done
      in AP 12 (F59). `ParticipantsService.setStatus` takes an `actor`, and the
      notice goes out only when the **organizer** cancels a **confirmed**
      registration — not when the participant cancels on their own page (they
      just read the answer) and not on reinstating (a second mail would
      contradict the first without saying which one is current). It is
      transactional, so `contact_opt_out` does not stop it: somebody who does not
      want invitations still has to learn that they are not expected at the door.
      Verified in `participants.service.spec.ts` (five tests) and in
      `apps/server-e2e/src/api/participants.spec.ts` against Mailpit, including
      that reinstating sends nothing.
- [x] **The uploads volume is finally used.** Done in AP 7: the `file` field
      type, the `attachment` table, and `GET /api/admin/attachments/:id` as the
      only way to the bytes. Both things that were easy to lose happened — the
      check constraint was widened by the migration, and the validation branch
      for a file is in `validateSubmission` rather than beside it. Verified in
      `apps/server-e2e/src/api/attachments.spec.ts`, including the file count in
      the volume before and after a deletion.
- [x] **The browser suites still log in five times per run.** Done in AP 12,
      and not a moment too early: the new participant-client suite pushed the
      count past the twenty attempts the login allows in five minutes, and the
      run failed with a 429 **in the seed** — a message that says nothing about
      what is being tested. `asAdmin` in `user-client-e2e` now signs in once per
      run, saves the session to a file in the temporary directory and hands every
      later caller a context built from it; the global teardown deletes the file
      last, after the teardown that needs it. Same shape as `admin-client-e2e`
      has had since AP 1. What is left of the original entry: nothing — the API
      contract suite already shared one session, and both browser suites now do.

**Worked through in AP 13 on 28.08.2026 — nothing open is left here.** Six
entries are closed above; everything else that stood in this section moved, with
its reasoning, to the phase that can actually decide it: the real SMTP server,
the per-recipient throttle, the volume sweep, the shared e2e limits, the
invitation sender's pause and retry and the `List-Unsubscribe` header to
phase 5, where the confirmation rate limit joined the registration one in a
single entry with the numbers that actually hold; the `newsletter` module key to
phase 2; the overbooking rule and the double booking to phase 4; and the
questions nobody in this repository can answer to _Questions for the pilot
partner_ below.

---

## Questions for the pilot partner — asked later, deliberately

Neither gaps nor deferred work: decisions that were made deliberately, that are
cheap to change, and that this repository cannot settle on its own. Each entry
says what was decided, what changing it would cost, and where the change would go.

**When they get asked is decided: later, at a further-developed state of the
application** (Marius, 28.08.2026). None of them blocks a phase — that is why the
feedback round could stay open at the end of phase 1 without holding anything up,
and why asking five questions about a version the pilot partner has not used yet
would produce weaker answers than asking them about one they have. If something
here turns out to block after all, Marius clarifies that single point beforehand
rather than waiting for the whole round.

Consequence for anyone working on this list: **do not build any of them on a
guess.** The decision on the table is the current behaviour; changing it needs an
answer, not an opinion.

- [ ] **Three questions about the field kit.** First: there is **no multi-line text type** —
      a text field holds 500 characters, which is a paragraph, but it renders as
      a single line. Second: the answers appear in the **detail panel only, not
      as table columns**, because the overview has to stay readable and fast at
      two thousand rows (AP 5). Third (AP 7): the accepted file types are a
      **fixed catalogue of five** (PDF, JPEG, PNG, WebP, DOCX), and a form asks
      for at most five files. If the pilot partner collects something else —
      scanned forms as TIFF, a spreadsheet — the catalogue in
      `libs/shared-models/src/lib/registrations/upload.ts` is where it goes, and
      it needs a signature in `file-signature.ts` to go with it.
- [ ] **The participant search does not look into the answers.** It covers first
      name, last name and e-mail (F32). Searching `custom_fields_json` means a
      JSONB predicate that no index of ours covers, so it is not a small
      addition — and nobody has asked for it yet. Revisit if the pilot partner
      does.
- [ ] **Decide what a participant may change about their own registration.**
      "My registration" (E11) currently shows the answers to the event's own
      questions read-only and offers cancelling; changing a name or an answer is
      a mail to the organizer. That is deliberate for phase 1 — the endpoint is
      unauthenticated apart from the link — but worth asking the pilot partner
      about before phase 3 puts a login in front of it.
- [ ] **A participant may hold seats in two parallel sessions.** Nothing refuses
      it: overlapping sessions are legitimate (F41), and only the person knows
      whether they mean to split their morning. If the pilot partner wants it
      refused, the check belongs in `ProgramSignupsService` and needs the
      programme of the event, not just the one session.
- [ ] **What should a room plan refuse?** Two questions in one, both phase 4 work
      whose _rule_ is a product decision: more sign-ups than chairs (FR 3.11), and
      two sessions in the same room at the same time. The numbers are all there
      since AP 9 — capacity, the sessions assigned to a room, their sign-up counts
      through the plug-in's read port — and `GET …/rooms/:id/schedule` reports them
      side by side and decides nothing. Whether an organizer wants a warning, a
      refusal or a hint, and where they should see it, is what the answer decides.

---

## Checkable after phase 2 — whitelabel, modules, i18n, PWA, installation

- [x] **TLS — and it is not optional in practice.** Deliberately absent from
      `infra/nginx/trefaro.conf` so a local `docker compose up` works without
      certificates. What AP 13 of phase 1 made concrete while checking the stack:
      the session cookie carries `Secure` as soon as `NODE_ENV=production` (E2),
      and a browser stores a `Secure` cookie only over HTTPS — `localhost` being
      the usual exception. So the published stack is loginnable on the operator's
      own machine and **nowhere else** until TLS terminates in front of it. That
      makes it part of the installation story rather than of the hardening, which
      is why this entry moved out of phase 5: **claimed by phase 2, AP 5** as an
      optional compose overlay plus documentation (E29). Acquiring the
      certificate stays outside the stack, and the alternative — dropping
      `Secure` — is not one.
      **Done in AP 5 of phase 2** (28.08.2026): `infra/docker-compose.tls.yml`
      plus `infra/nginx/trefaro-tls.conf`, with the routing itself moved into
      `trefaro-locations.conf` so both variants include one copy of it; HSTS,
      TLS 1.2 as the floor, a 301 from port 80 and an ACME webroot so renewal
      needs no downtime. `docs/INSTALL.md` has the three ways to get a
      certificate. Verified against the stack with a self-signed certificate:
      `verify-proxy.mjs` over `https://…` passes every check, including the
      WebSocket upgrade and a login whose cookie is `Secure` — and a browser
      login over HTTPS whose session survives a reload.

- [ ] **A series and an event can have a logo in the schema, and no way to
      upload one.** `event_series.logo_path` and `event.logo_path` exist, the
      participant client already renders `logoUrl` on the start page, the series
      page and the event landing page — and nothing has ever written those
      columns. AP 2 removed the placeholder that turned a stored path into a URL
      (`/api/media/<path>`), because that shape is exactly what E19 forbids, so
      both services now answer `logoUrl: null` on purpose. Deciding this is
      cheap now that the mechanism exists: either a per-series and per-event
      upload with a path-free route of its own
      (`GET /api/media/series/:id/logo`, resolved through the row like the
      instance logo), or the columns and the two payload fields go. What must
      **not** happen is a third shape — a route that takes a stored path would
      put registration attachments one guess away (E9). Verify: upload a logo on
      a series, see it on the start page; or, if it goes, no payload field
      promises something no screen can set.

- [ ] **The page titles still say "Trefaro".** Both `app.routes.ts` files carry
      their titles as literal strings, and every one of them ends in the product
      name rather than the organization's. AP 3 changed the headers of both
      clients and the sign-in page; these it left alone. AP 6 has since brought
      the catalogue, so the first of the two reasons to wait is gone: what is
      left is that doing it properly means a `TitleStrategy` which resolves a
      key and appends `AppConfigService.organizationName()`, instead of every
      route repeating both — a small piece of work with a single owner, and it
      belongs with the rest of each client's text (AP 8 for the participant
      client, AP 9 for the organizer's).
      Verify: a browser tab of a branded instance names the organization, in both
      clients, in every language.

- [x] **A programme tile in the participant's event detail view** — done in
      AP 4 of phase 2, as jump links rather than routes (F68): everything a tile
      can lead to renders on the landing page itself, so the programme tile
      points at the timeline instead of a second rendering of it. Not one tile
      per enabled module either — one per section that actually has something in
      it, plus one per loaded plug-in at the `event-detail` hook point.
- [ ] **"My registration" is not linked from anywhere.** The page exists (E11)
      and is only reachable through the personal link in the receipt, which is
      correct as long as there is no participant login: a link in the navigation
      would lead to a page that asks for a token. Once phase 3 has the login, the
      navigation gets the entry and the link keeps working.
- [ ] **No content translations for programme items.** `program_item_translation`
      is in the schema draft and not built: FR 3.12 is phase 2, and AP 8 would
      have had to invent the translation mechanism for one table. Whatever
      phase 2 decides for `event_translation` applies here unchanged — the shape
      of the two tables is the same.
- [x] **Module toggling from the admin UI must be instant** — done in AP 4 of
      phase 2: `PATCH /api/admin/modules/:key` writes the flag and refreshes
      **both** registries before answering, so the next request already sees it.
      Asserted without a sleep in `apps/server-e2e/src/api/modules.spec.ts` and
      against a running stack in `verify-plugin-toggle.mjs`.
      → [`02-server-plugin.md`](docs/spikes/02-server-plugin.md)

- [ ] **The plug-in contract names an icon nobody draws.**
      `PluginClientContribution.icon` carries a Material Symbols glyph name
      (`meeting_room` for the room plan), and neither client loads an icon font —
      fetching one from Google is out (NFR 9), so it would have to be
      self-hosted like the fonts of AP 1. The tiles of AP 4 are text-only
      because of it. Either an instance ships an icon set and the tiles and the
      navigation use it, or the field goes: a value nothing reads looks like a
      feature (E21's rule, applied to the contract). Verify: a tile shows the
      glyph its plug-in names, from this instance's own files — or no descriptor
      promises one.
- [ ] **The PWA manifest is still static.** `apps/user-client/public/manifest.webmanifest`
      hard-codes name, icons and `theme_color`. A whitelabel instance has to
      serve them per organization. Verify: change the primary colour and the
      logo, reinstall the PWA, the home screen icon and splash follow.
- [ ] **`index.html` hard-codes the theme colour and the language.**
      `<meta name="theme-color">` and `<html lang="en">` must follow the
      configured theme and default locale.
- [ ] **Re-check the service worker configuration.** `ngsw-config.json` now
      excludes `/admin`, `/admin/**`, `/api/**` and `/socket.io/**` from
      navigation handling — `/admin` was **missing until 28.08.2026**, and the
      consequence was as bad as it gets: the worker is served from the root, so
      its scope is the whole origin, and it answered navigations to `/admin/` from
      the participant client's cache. That client has no route for `/admin/`, so
      its wildcard route redirected to `/` — **an organizer could not reach the
      organizer client at all**, in the container stack, in any browser that had
      once loaded the participant client. `verify-proxy.mjs` now replays ngsw's
      own selection rule against the built `ngsw.json` and would have caught it.
      What is still open here: that a new deployment is actually picked up by an
      **installed** client, which needs a device and an installed PWA.
      → [`03-web-push.md`](docs/spikes/03-web-push.md#open-items)
      → see also the entry about a CI job that starts the stack, phase 5
- [x] **The module administration has to refresh both registries** — done in
      AP 4: `ModuleAdminService.setEnabled` writes the flag and awaits
      `CoreModuleRegistryService.refresh()` **and**
      `PluginRegistryService.refresh()` before answering, so the request that
      follows already sees the change. Both, not only the family the key belongs
      to: they read the same table, and picking one is a question that can be got
      wrong.
- [ ] **The names of the media link kinds are English strings in the clients.**
      `MEDIA_LINK_KIND_LABELS` in `shared-models` holds "Live stream",
      "Recording" and "Material" in one place so the switch to Transloco is one
      change; the same holds for the section heading "Watch and read" and the
      organizer's "After the event". The catalogue exists since AP 6; these
      strings move into it with the rest of each client's text, in AP 8.
- [x] **Translation keys need a catalogue.** Done in AP 6 of phase 2 (F70):
      `GET /api/i18n/:locale` answers the catalogue this image ships, overlaid
      with the instance's own rows from `translation_override` (E22), and both
      call sites resolve their key instead of humanising it — the organizer's
      module list through `titleKey`, the participant's event detail tiles through
      `labelKey`. `moduleDisplayName` is gone rather than left as a fallback.
      Two things the browser walk found on the way: a label assembled in
      TypeScript needs to read `TranslationService.locale()` in its `computed()`,
      or a language change repaints nothing (F72); and a fresh instance offered
      only English, so the switcher had nothing to switch (F71).
      Verified: switching language at runtime renames modules and plug-ins in both
      clients, in all three browsers.
- [x] **Self-host the fonts.** Done in phase 2, AP 1: four OFL families plus
      `system-ui` ship in `libs/shared-theming/assets/fonts/`, are declared in
      `fonts.css` and are emitted as hashed build assets by both client builds.
      Nothing is fetched from a foreign origin, which is what NFR 9 asked for.
      A test in `shared-models` keeps the catalogue and the stylesheet in step.
- [ ] **Decide whether an organization may upload its own font.** E18 ships a
      catalogue of four self-hosted OFL families plus `system-ui`, and Marius
      confirmed it on 28.08.2026 as a starting point — "erstmal ein
      mitgelieferter Katalog, das kann im Zweifelsfall noch ausgebaut werden".
      So this is deferred, not refused. What it would cost: a `woff2` upload is
      four bytes of signature check and a `@font-face` served per instance —
      cheap. What it would cost the operator is the licence question, which the
      product cannot answer for them, and that is the reason it is not in
      phase 2. Where it goes: `FONT_FAMILIES` in `shared-models` keeps the
      choice, `font_family` keeps its meaning, and a `font_source` column names
      the served file. Revisit when an organization actually misses its house
      typeface — an NGO whose brand font is commercial cannot match its own
      branding today, and that is worth knowing before the pilot round.
- [ ] **The organizer client cannot link to the public page.** AP 10 shows an
      event's public address as text (`/series/…/events/…`) rather than as a
      link, because the participant client is a different origin and nothing
      tells this client which one: in production NGINX serves both, in
      development they are two ports. The server knows it
      (`PUBLIC_USER_CLIENT_URL`, used for the mail links); phase 2 is where the
      configuration surface is worked on anyway, so that is where it belongs.
      Verify: the dashboard offers a "view the public page" link that works in
      development and in the container stack, and the address stays visible for
      copying.
- [ ] **`CORE_MODULES` still lists `newsletter`, and nothing reads it.** The
      descriptor is from phase 0 and appears in `/api/config` as a module that is
      switched off. Nothing checks the flag, because there is no newsletter
      module in v1 and there will not be one (F8) — and inviting former
      participants is deliberately _not_ it (F55), so AP 12 did not give the flag
      a meaning either. Same smell as the fields AP 6 and AP 9 refused to add: a
      flag nothing reads looks like a feature that exists. Decide in phase 2,
      when the module administration makes the list visible to an organizer:
      either the key goes, or it is renamed to what the opt-in management it
      would actually gate is called.
- [ ] **A new mail language is a code change.** The templates are TypeScript, one
      file per locale behind an interface every locale must satisfy in full
      (`business/mail/templates/{en,de}.ts`). That is what makes a missing
      translation a compile error instead of a mail that quietly goes out in the
      wrong language — and exactly what stands in the way of the promise that an
      organization maintains its own languages (chapter 4, "Mehrsprachigkeit").
      Four mails are affected: confirmation request, receipt, cancellation notice
      and invitation. Phase 2 brings Transloco for the UI, and the same catalogue
      has to reach the mails: texts in files the instance loads at runtime, with
      the completeness check kept in some form — a language that is 80 % done must
      be visible as such, not as English mixed into German. Verify: an
      organization adds a locale without rebuilding the image, and the double
      opt-in mail arrives in it.

- [ ] **The server refuses in English, whatever language the page is in.** Since
      AP 8 of phase 2 the participant client says its own half from the catalogue
      and puts the server's reason beside it (F77) — "Die Anmeldung konnte nicht
      gesendet werden." followed by `"Passport scan" takes files up to 5 MB`.
      That is the honest arrangement and not the right one: the reason is the
      half a person actually reads. Making it translatable is a different piece
      of work, and a large one — every `BadRequestException` in the business
      layer would carry a **code** and its placeholder values instead of a
      sentence, the catalogue would hold the sentences, and each client would
      resolve them. Worth doing when there is a second language nobody on the
      team speaks; not worth doing inside a text extraction. Verify: a German
      browser gets a German reason for a refused registration, and the API
      contract suite still asserts something stable — which is the second
      argument for codes.

## Checkable after phase 3 — profiles, messaging, chat, push

- [ ] **Put the participant login in front of "my registration"** (E11's second
      half). The signed link stays valid — that is what was promised — and the
      login becomes a second way to resolve the same registration.
      `SelfServiceService.require` is the one place that has to learn it, and
      nothing below it changes. Verify: an old link from an inbox still works
      after the login exists, and a logged-in participant needs no link.
- [ ] **A sign-up belongs to a registration, not to a person** (`program_item_signup.registration_id`).
      Once `user_profile` exists, decide whether a participant sees their seats
      across events — that needs a join over `registration`, not a second column
      here.

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
      per programme item against room capacity. Everything it needs exists since
      AP 9 — the room's capacity, the sessions assigned to it, and their sign-up
      counts through the plug-in's read port (F45), which is why the plug-in still
      touches no core table. What is deliberately _not_ built is the judgement:
      whether more sign-ups than chairs is a warning, a refusal or a hint, and
      where an organizer should see it. `GET …/rooms/:id/schedule` reports the
      numbers side by side and decides nothing. Ask the pilot partner first — the
      question is under _Questions for the pilot partner_.
- [ ] **Two sessions in one room at the same time** is not refused either, for
      the same reason: the schedule carries `startsAt`/`endsAt` per booking, and
      what a double booking should _do_ is a product decision, not a phase-4
      implementation detail.
- [ ] **Room planning stays structured for now.** An OpenStreetMap/Leaflet floor
      plan is the later stage (F14) — and never a Google map (NFR 9).
- [ ] **Each new plug-in proves the contract.** Verify per plug-in: own tables
      only, prefixed `plugin_<key>_`; disabled means 404 and absent from
      `/api/config`; disabling keeps its data.
- [ ] **The dashboard needs a hook point for plug-in tiles** (F47). The mockups
      put programme proposals and forum posts on KPI tiles of the event
      dashboard; both are plug-ins, and both arrive in this phase. AP 10
      deliberately did not add an `event-dashboard` mount point to the plug-in
      contract, because a mount point nothing fills is a capability that only
      looks like one. Adding it is a minor version of `PLUGIN_API_VERSION` plus a
      case in the compatibility test — the same step F45 took for the read port.
      Verify: enabling the forum plug-in makes its tile appear on the dashboard
      of every event, disabling it removes the tile and nothing else.
      (The messages tile of phase 3 is a core tile and needs no hook point: it is
      added to `EventDashboard` and to the tile grid.)

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
- [ ] **There are no contribution guidelines, and phase 0 said there would be.**
      Chapter 6 of the reference document names "Contribution-Guidelines" among
      the phase 0 deliverables, next to the licence and the README; the licence and
      the README exist, `CONTRIBUTING.md` does not. Noticed in the documentation
      pass after phase 1. Most of the content is already decided and only needs
      collecting — AGPL-3.0-or-later, Conventional Commits, a unit test with every
      feature and Playwright for the interface, the layer boundaries as lint rules,
      plug-in contract changes only with a version bump. What is **not** decided,
      and cannot be decided here, is the policy: whether pull requests are accepted
      at all before v1.0, DCO or CLA, who reviews, and how a plug-in gets into the
      curated set. **Scheduled: after all phases are through** (Marius,
      28.08.2026) — written once, against the finished v1.0, rather than kept in
      step with a moving target for five phases. A contribution guide for a
      project nobody can contribute to yet would be the wrong kind of promise
      anyway. This entry is the reminder; it is the last documentation item of
      phase 5 and must not leave this list until the file exists.
- [ ] **Plug-in SDK documentation.** Three things phase 0 learned that a
      third-party plug-in author has to be told:
  - bundles are loaded same-origin and run with full page access, so plug-in
    review stays a human step
  - inputs are passed as element _properties_, not attributes
  - a plug-in migration must be timestamped after any core migration it depends
    on
    → [`01-client-plugin.md`](docs/spikes/01-client-plugin.md#open-items)
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
- [ ] **Confirm the registration and confirmation rate limits.** **Sixty**
      attempts per five minutes per client address, for the public registration
      form (`REGISTRATIONS_PER_WINDOW`) and for the confirmation endpoint
      (`CONFIRMATIONS_PER_WINDOW`) alike. Both started at thirty and were raised
      during phase 1 — the registration form in AP 7, the confirmation in AP 9 —
      because an office behind one public address, and the test suites, both hit
      the tighter number. Deliberately without a block period, unlike the login:
      this endpoint sends mail to an address the caller chooses, but a participant
      who mistypes their own address a few times has to be able to fix it. The
      confirmation endpoint is idempotent and changes nothing after the first
      call, and against guessing an HMAC thirty and sixty are equally hopeless.
      Not covered by an automatic test for the same reason as the login block —
      the window is five minutes, and a suite that trips it cannot repeat.
      **Confirmed at sixty by Marius on 28.08.2026** ("ok fürs erste"), so this is
      no longer a question waiting for an answer — it is a number to re-examine
      with the rest of the hardening, next to the second counter per recipient
      address.
- [ ] **Make the rate limits configurable, with the strict values as defaults.**
      Decided for phase 5 on 28.08.2026, after weighing the alternative: taking
      the limits out for now and putting them back once the application is stable.
      Rejected, because a missing throttle has **no symptom** — no test fails, no
      page looks different, nothing appears in a log — and the two defects phase 1
      shipped (bootstrap credentials, service worker) were both of exactly that
      kind: silently fine until somebody happened to look. On top of that, a limit
      that is relaxed for tests stops being tested, which is why the current
      numbers were picked to be survivable by the full suite in the first place
      (E4). The shape when it gets built: `LOGIN_ATTEMPTS_PER_WINDOW`,
      `REGISTRATIONS_PER_WINDOW` and `CONFIRMATIONS_PER_WINDOW` read from the
      environment, defaults exactly today's values, and the server logs loudly at
      startup when a limit sits above its default — a relaxation should be visible
      in an `.env`, never invisible in the code. Belongs with the second counter
      per recipient address and the SMTP work of this phase. Until then the
      workaround is one command: `docker compose -p trefaro restart server` clears
      the counters, which live in memory.
- [ ] **Security review.** Auth, upload validation, plug-in isolation, and
      whether the OpenAPI description should keep being served publicly (it is
      today, on the grounds that the source is AGPL anyway).
- [ ] **GDPR functions.** Data export and deletion, which the schema was designed
      for but which nothing implements.
- [ ] **Load tests** (NFR 12).
- [ ] **socket.io shared adapter** — only if more than one server container is
      ever run. Not needed for one instance per organization.
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
- [ ] **The three e2e projects share one server's rate limits.** CI runs them
      with `--parallel=1` against a single instance, so every limit that counts
      per client address is a budget for the whole run: sixty public
      registrations per five minutes (`REGISTRATIONS_PER_WINDOW`) and twenty
      logins (`LOGIN_ATTEMPTS_PER_WINDOW`). The API contract suite spends most of
      the registrations, deliberately — the double opt-in through the real form
      _is_ its subject. The first CI run of AP 12 failed because the new
      participant-client suite added six more and pushed the total over sixty;
      the fix was to seed that fixture instead (`support/registration-seed.ts`).
      What is left is the margin, and it is thin. Before a suite adds
      registrations through the form again, either count what the run already
      makes or seed. Worth a proper answer in phase 5, when the throttle gets a
      second counter per recipient anyway: a test profile that raises the limits
      would work, but only if it cannot be the one an instance ships with. That is
      now decided — see the entry about making the limits configurable.
- [ ] **The invitation sender has no pause and no retry.** AP 12 sends one mail
      after another as fast as the mail server accepts them, and a refused
      address is recorded as failed and never tried again. Against Mailpit and
      against a well-behaved server that is right; against a shared mail service
      with a per-minute limit, two hundred invitations in twenty seconds is how
      an instance gets itself throttled or blacklisted — and a mailbox that was
      briefly full stays "failed" for good. Both wants the same seam: a
      configurable pause between mails, and a second attempt for a delivery that
      failed with a temporary code. The rows already carry what a retry needs
      (`status`, `failure`), so this is the sender's own loop and no schema
      change. Belongs with the SMTP work of phase 5, where a real server is
      available to measure against.
- [ ] **No `List-Unsubscribe` header on invitations.** The objection link is in
      the body (F58), which is where a person looks. Mail clients look for the
      header, and Gmail and Outlook weigh its absence when they decide whether a
      bulk message is spam — so the feature that works may still not arrive. It
      needs `List-Unsubscribe` plus `List-Unsubscribe-Post: List-Unsubscribe=One-Click`,
      which in turn needs an endpoint that accepts a bare POST without the page
      in front of it, and the `Mailer` port to carry headers. Deliberately not in
      AP 12: one-click unsubscribe from a header is exactly the request E5b says
      a link previewer must not be able to make, so the endpoint needs its own
      reasoning rather than a copy of this one. Phase 5, with the SMTP work.
- [ ] **Nothing in CI starts the containers and drives a browser.** The
      test pyramid has a hole exactly the shape of the bug found on 28.08.2026: a
      service worker misconfiguration that made the organizer client unreachable
      in the production stack. Unit tests do not see it, the API contract suite
      uses `fetch` (which runs no service worker), the Playwright suites run
      against `nx serve` (where Angular registers no service worker at all), and
      the `images` job builds the three images without ever starting them
      together. Every one of them was green. What would close it: a CI job that
      brings `infra/docker-compose.yml` up from an empty volume and runs
      `tools/spike-verification/verify-proxy.mjs` plus a handful of Playwright
      tests against port 8080 — production builds, real service worker, real
      NGINX. Cost is one more job of a few minutes; the class of bug it catches is
      "works in development, broken as shipped", which is the worst class this
      project can produce. Phase 5, with the rest of the hardening — but it is the
      first item there, not the last.
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

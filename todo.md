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

- [ ] **The API contract suites leave rows behind, and the development database
      has 94 event series to prove it.** `invitations.spec.ts` creates two
      series per run and removes neither, so every run adds two. Nothing fails
      because of it today, but it hides the failures that matter: a suite whose
      fixture collides with a leftover row reports a wrong slug or a wrong count
      and looks like a regression (AP 1 of phase 3 lost a round to exactly
      that). Either every suite tears down what it created — `event-series.spec.ts`
      does — or the run starts from a known state. Worth deciding before the
      suites grow again in phase 3.

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

- [x] **A series and an event have no logo, and FR 2.1 and FR 3.1 name one.**
      ~~`event_series.logo_path` and `event.logo_path` exist, the participant
      client already renders `logoUrl` on the start page, the series page and the
      event landing page — and nothing has ever written those columns.~~ Built on
      01.09.2026 as a work package of its own, before phase 3, the way Marius
      scheduled it on 31.08.2026. The shape is the one AP 13 decided and nobody
      had to improvise: per-row routes without a caller-supplied path
      (`GET /api/media/series/:id/logo`, `…/events/:id/logo`), `PUT`/`DELETE`
      under `/api/admin/…`, an own `logos/` subtree in the upload volume, a
      `CHECK` on both path columns and the type read from the first bytes (F38).
      Two things were decided against while building it: an event does **not**
      inherit the logo of its series (F114 — the fallback is the header, which
      carries the organization logo on every page anyway), and the media route
      checks **no** status (F115 — the address needs the row's uuid, the bytes
      are a brand, and the other direction would break the organizer's own
      preview while a row is a draft). The logo is not part of either form: it is
      written the moment it is uploaded, so the field appears only when editing
      (F116). Decisions F113–F117, protocol in
      [`docs/PHASE2.md`](docs/PHASE2.md) under _Nachtrag_. **Verified as asked:**
      a logo uploaded on a series shows up on the start page —
      `apps/user-client-e2e/src/event-series.spec.ts`.

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
- [ ] **There is no installation hint on iOS, on purpose — and maybe that is
      wrong for this pilot partner.** The hint hangs on `beforeinstallprompt`
      (F109), which Safari does not fire: on an iPhone the only way in is Share
      → "Add to Home Screen", and a page that says so cannot make it happen. A
      short explanatory hint would be honest as long as it is shown only on iOS
      and never claims a button. Whether it is worth it depends on what the
      people around Democracy International actually carry — one of the things
      to look at with them rather than to guess (see _Questions for the pilot
      partner_).
      **Moved into this section in AP 13 of phase 2**, where it always belonged:
      the decision on the table is the current behaviour, and what changes it is
      an answer about the devices these people carry, not an opinion.

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
      **Moved into this section in AP 13 of phase 2.** It is not deferred work
      waiting on a phase — the code side is small and settled — it is a question
      only the organization can answer, and it belongs beside the other four.

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

- [x] **The page titles said "Trefaro".** Both `app.routes.ts` files carried
      their titles as literal strings, and every one of them ended in the product
      name rather than the organization's. AP 3 changed the headers of both
      clients and the sign-in page; these it left alone, and AP 8 and AP 9 left
      them alone too — a route title is the one label of a client that is not in
      a template, so a text extraction walks straight past it.
      **Done in AP 13** (29.08.2026): `TrefaroTitleStrategy` in
      `libs/shared-i18n` resolves the route's catalogue key and appends
      `AppConfigService.organizationName()`; every route now names a key, and the
      participant client's start page names none at all, so its tab is the
      organization's name on its own. It re-titles outside navigation as well —
      the key sits in a signal and an `effect` reads the locale and the name
      beside it, which is F72 applied to the one label that lives outside the
      document. Verified in both browser suites: the tab of a branded instance
      names the organization, and follows a language switch with no navigation
      in between.

- [x] **A programme tile in the participant's event detail view** — done in
      AP 4 of phase 2, as jump links rather than routes (F68): everything a tile
      can lead to renders on the landing page itself, so the programme tile
      points at the timeline instead of a second rendering of it. Not one tile
      per enabled module either — one per section that actually has something in
      it, plus one per loaded plug-in at the `event-detail` hook point.
- [x] **No content translations for programme items.**
      `program_item_translation` was in the schema draft and not built: FR 3.12
      is phase 2, and AP 8 of phase 1 would have had to invent the translation
      mechanism for one table.
      **Done in AP 11 of phase 2**, as the third of three tables with the same
      shape (F93) — `(program_item_id, locale)`, every text column nullable, a
      real foreign key with `ON DELETE CASCADE`. The organizer writes them in the
      event's translation screen, which brings the event and its whole programme
      in one request (F97), and a participant reads them through `?locale=` on
      every public endpoint including the self-service page.

- [x] **Module toggling from the admin UI must be instant** — done in AP 4 of
      phase 2: `PATCH /api/admin/modules/:key` writes the flag and refreshes
      **both** registries before answering, so the next request already sees it.
      Asserted without a sleep in `apps/server-e2e/src/api/modules.spec.ts` and
      against a running stack in `verify-plugin-toggle.mjs`.
      → [`02-server-plugin.md`](docs/spikes/02-server-plugin.md)

- [x] **The PWA manifest is still static.** `apps/user-client/public/manifest.webmanifest`
      hard-codes name, icons and `theme_color`. A whitelabel instance has to
      serve them per organization.
      **Done in AP 12 of phase 2** (29.08.2026): the file is gone and
      `GET /api/config/manifest.webmanifest` builds the document from
      `app_config` (F103). An uploaded app icon replaces the shipped set when a
      browser can install from it — square and at least 144 pixels, read out of
      the file's own header — and is never declared `maskable` (F105, F106).
      Verified against the contract suite and by `verify-proxy.mjs`, which now
      checks the name, the colour and every icon through the proxy. What still
      needs a device: that a **reinstall** picks the new icon up, which is the
      half of the acceptance criterion below.
- [x] **`index.html` hard-codes the theme colour and the language.**
      `<meta name="theme-color">` and `<html lang="en">` must follow the
      configured theme and default locale.
      **Done**: the language since AP 6 (`TranslationService` sets
      `<html lang>` on every activation), the colour in AP 12 — `ThemeService`
      writes the `<meta>` tag and creates it when it is missing (F108). Both
      literals stay in the document as the value _before_ the configuration has
      arrived.
- [x] **Re-check the service worker configuration.** `ngsw-config.json` now
      excludes `/admin`, `/admin/**`, `/api/**` and `/socket.io/**` from
      navigation handling — `/admin` was **missing until 28.08.2026**, and the
      consequence was as bad as it gets: the worker is served from the root, so
      its scope is the whole origin, and it answered navigations to `/admin/`
      from the participant client's cache. That client has no route for
      `/admin/`, so its wildcard route redirected to `/` — **an organizer could
      not reach the organizer client at all**, in the container stack, in any
      browser that had once loaded the participant client.
      **Re-checked in AP 12 and again in AP 13 of phase 2** against the built
      `ngsw.json`, with ngsw's own selection rule replayed by
      `verify-proxy.mjs`: the four exclusions are there, the manifest address is
      among the ones the rule is replayed against, and the static manifest left
      the prefetch list together with the file. No `dataGroups` (E27).
      What is left needs a device and an installed PWA — that a _new deployment_
      is picked up by an already installed client — and it is the same missing
      net as the entry about a CI job that starts the stack, under phase 5.
      → [`03-web-push.md`](docs/spikes/03-web-push.md#open-items)

- [x] **The module administration has to refresh both registries** — done in
      AP 4: `ModuleAdminService.setEnabled` writes the flag and awaits
      `CoreModuleRegistryService.refresh()` **and**
      `PluginRegistryService.refresh()` before answering, so the request that
      follows already sees the change. Both, not only the family the key belongs
      to: they read the same table, and picking one is a question that can be got
      wrong.
- [x] **The names of the media link kinds were English strings in the clients.**
      `MEDIA_LINK_KIND_LABELS` in `shared-models` held "Live stream",
      "Recording" and "Material" in one place so the switch to Transloco would be
      one change; the same held for the section heading "Watch and read" and the
      organizer's "After the event".
      **Done in AP 8 and AP 9 of phase 2.** The constant answers _keys_ now
      (`mediaLinkKindKey()`, beside `uploadTypeLabelKey()` and
      `registrationStatusKey()`): `shared-models` is imported by the server too,
      and a server that owns interface words owns them in one language.

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
- [x] **The organizer client could not link to the public page.** AP 10 showed
      an event's public address as text (`/series/…/events/…`) rather than as a
      link, because the participant client is a different origin and nothing told
      this client which one: in production NGINX serves both, in development they
      are two ports.
      **Done in AP 13** (29.08.2026). The server already answered
      `publicUserClientUrl` in `/api/config` — it is the configuration surface
      phase 2 built — so the whole of it was client-side: `PublicSite` in the
      organizer client joins that origin to `publicEventPath`/`publicSeriesPath`
      (`publicUrl` in `shared-models`, which the mail module now shares), and the
      event dashboard and the series list offer the link beside the address,
      which stays visible for copying. Only for a **published** series or event:
      a draft has no public page, and a link answering "not found" would read as
      a wrong address rather than as an unpublished thing. `target="_blank"` with
      `rel="noopener noreferrer"`, like every link that leaves this origin (F51).

- [x] **`CORE_MODULES` listed `newsletter`, and nothing read it.** The
      descriptor was from phase 0 and appeared in `/api/config` as a module that
      is switched off. Nothing checked the flag, because there is no newsletter
      module in v1 and there will not be one (F8) — and inviting former
      participants is deliberately _not_ it (F55).
      **Done in AP 4 of phase 2** (E21, F63): `CORE_MODULES` lists the two
      modules that exist, `media-links` and `push`. `newsletter` is gone for
      good; `chat`, `profiles` and `profile-search` come back with phase 3, each
      with a guard, because a switch that gates nothing is a decoy. Rows of
      dropped keys are **not** deleted — `ModuleFlagCache` ignores what no
      descriptor claims, so an organization that switched something off keeps
      that answer if the key ever returns.

- [x] **A new mail language is a code change.** ~~The templates are TypeScript,
      one file per locale behind an interface every locale must satisfy in
      full.~~ Closed in phase 2, AP 10. The four mails read 21 keys under `mail.`
      from the catalogue the organization maintains, `templates/{en,de}.ts` are
      gone, and the completeness check that the interface used to give is now two
      things: a CI test that the shipped English catalogue covers every key the
      four mails declare, and E24 at runtime — a language missing one piece of a
      letter sends that whole letter in English rather than a German one with
      English paragraphs in it (F87: the unit is one mail, so the other three can
      still go out in German). The verification asked for here is
      `tools/spike-verification/verify-mail.mjs`: it edits the confirmation
      subject through the API and reads the changed subject out of Mailpit on the
      next registration, with no rebuild and no restart.

## Checkable after phase 3 — profiles, messaging, chat, push

- [x] **Put the participant login in front of "my registration" — done in AP 4**
      (E11's second half). `SelfServiceService.require` takes a
      `SelfServiceClaim` now: the signed token, or a session plus registration
      id resolved by address equality (E31). From the status check down it is the
      same code, and the endpoints under `/api/participant/registrations` answer
      with the same view the link opens (F148). Both halves are proven in
      `apps/server-e2e/src/api/my-registrations.spec.ts` — an old link still
      works, and a logged-in participant needs none. **Cancelling** is the one
      operation the session cannot do yet; see the entry below.
- [x] **"My registration" is linked from the navigation — done in AP 4.** The
      condition was the participant login, and it fell away in AP 3. The entry
      points at `registrations`, the list a token cannot open (a token speaks for
      one registration, a person is not a registration); `registrations/:id`
      opens one of them with the same component the mailed link uses, and the
      link keeps working.

- [ ] **A sign-up belongs to a registration, not to a person** (`program_item_signup.registration_id`).
      Once `user_profile` exists, decide whether a participant sees their seats
      across events — that needs a join over `registration`, not a second column
      here.

- [x] **Mail in the participant's own language — done in AP 4** (F125). It was
      not quite one line: `MailCatalogue.strings(keys, to)` asks
      `ProfileDirectory.localeFor` (a narrow port, because `MailModule` cannot
      import the module that owns accounts — that module sends mail), and the
      chain is recipient → instance default → English. Unconfirmed accounts
      count: the one mail they ever get is their own confirmation request, and
      the language was picked on the form a moment earlier.

- [x] **The event's name in a mail follows the mail's language — done in AP 4**
      (F125). Both halves move together, and the order matters: E24 can still
      flip the language, so the sender must not build its context beforehand.
      `MailService` therefore takes `MailContent<T>` — a context **or** a
      function called with the language the letter turned out to be in. Four of
      the six mails name an event and translate it that way; the invitation
      resolves once per language rather than once per recipient. Verified against
      Mailpit: a German profile gets a German letter naming the German title,
      and an address without an account gets the instance's language and the
      original.

- [x] **The participant overview has its profile-status column — done in AP 4**
      (F149). A yes/no over a **confirmed** account (an outstanding double
      opt-in issues no session, so "yes" would promise what E32 withholds),
      asked once per page through `ProfileDirectory.withAccount`, and
      deliberately without an id or a name — handing out a profile id hands out
      the picture with it (F124). In the table and in the detail panel.

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
- [x] **Authenticate the WebSocket handshake — done in AP 7** (F132, E41). In a
      socket.io namespace middleware, so it runs _while_ the handshake happens:
      a connection without a valid session never comes into being, and the
      client gets the server's own sentence as `connect_error`. The session is
      resolved by `UserSessionService` — the same service the global participant
      guard uses, which is why `ChatModule` now imports `ProfilesModule` and
      imports it for nothing else. A Nest `@UseGuards` on a gateway would have
      been the late check E41 rules out: it runs per **message**.
- [x] **Gate the chat gateway on the `chat` module flag — done in AP 7.** Asked
      at the same door, from the same registry the endpoints' guard reads (F53),
      and asked **after** the session so that an anonymous socket hears about
      the session first — the order the HTTP side has. Only at the door: a
      socket that connected before the switch flipped stays connected and stays
      inert, because nothing can happen behind endpoints that answer 404.
- [x] **Delete the `chat:echo` spike handler — done in AP 7.** The handler,
      `ChatEchoReply`, `RealtimeClient.echo`, the button on the diagnostics page
      and `verify-socket.mjs` are all gone. What replaced the script is
      `verify-chat.mjs`, which asks the sentence the acceptance criterion is
      written in: two accounts, two sockets, one message that has to arrive at
      both **through the proxy**. `verify-proxy.mjs` kept a socket check and got
      a better probe out of it — the refusal without a cookie is the server's
      own sentence arriving over the socket, which proves the upgrade and the
      way back without a handler that exists for the test.
- [ ] **The WebSocket handshake carries no rate limit.** `@nestjs/throttler`
      sees HTTP routes, and a socket.io handshake is served by engine.io before
      Nest's router ever sees it — so the one request that now costs a session
      lookup is the one request nothing counts. Belongs with the configurable
      throttling phase 5 already owes (E4); until then the cheapest mitigation
      is that a refused handshake does no database work beyond one indexed
      lookup on `token_hash`.
- [ ] **Purge a conversation's pictures when the conversation goes — belongs to
      AP 10.** Deleting an **event** cascades through `conversation` to
      `message`, and a cascade removes rows but no files (E9). AP 6 built the
      schema that makes it possible and creates no row it could hit: only a
      `group` conversation hangs off an event, and nothing creates one until AP
      10 assembles groups. That package extends
      `AttachmentsService.purgeForEvent` — and holds the order F158 spells out:
      remember the attachment ids, delete the conversation, then the
      attachments. The reverse fails on `CHK_message_content`.
- [ ] **A deleted profile leaves its conversations standing** —
      `conversation_member.member_id` carries no foreign key (E39), on purpose.
      Nothing can delete a profile today (there is no endpoint, by design), so
      this is erasure work for **phase 5**, together with the rest of it: what a
      person may have removed, what stays because somebody else wrote it, and
      what a conversation looks like when one side is gone.
- [ ] **Eight copies of `isUniqueViolation` in `data-access/repositories/`** —
      `typeorm-{admin-user,event,event-series,profile-field,
program-item-signup,user-profile,registration,registration-field}`. The
      same six lines each. F138 says the third caller is where something moves
      out; AP 6 avoided adding a ninth (its insert uses `ON CONFLICT DO NOTHING`
      instead of an exception as control flow) rather than doing the extraction
      inside a package that had no business touching eight files. Small and
      mechanical — and worth checking for drift while doing it, which is what
      `searchTerms` (AP 5) and `pageWindow` (AP 6) both turned out to have.
- [ ] **Wire `PushService.broadcast()` to actual event changes** (FR 3.15). There
      is deliberately no test-send endpoint — an unauthenticated one would be a
      spam vector.
- [x] **The organizer's screen for the profile field kit — built in AP 3.**
      AP 2 built `GET/POST /api/admin/profile-fields`, `PUT …/order` and
      `PATCH/DELETE …/:id`, and they worked; the plan assigned the _interface_ for
      them to no work package. Raised at the end of AP 2, **assigned by Marius on
      2026-09-02 to AP 3**, and delivered there as
      `pages/profile-fields/profile-fields-page.ts` behind `/profile-form`, with
      its own navigation entry and an eight-test browser suite. Its neighbour is
      the registration form's editor and the two stayed two pages; what they
      share is `features/fields/field-editing.ts` and `fieldTypeKey()` (F144).
- [ ] **Cancelling one's own registration still needs the mailed link** (F148).
      AP 4 gave `SelfServiceService.require` its second claim, and the session
      uses it for reading and for programme seats — but `cancel` has no
      participant route, because the phase plan assigns that half of FR 4.7 to
      **AP 12** (`DELETE /api/participant/registrations/:id`). The detail page
      therefore hides the button when it was opened through the account rather
      than offering one that cannot work. Nothing below `require` has to change
      for it; if AP 12 is dropped, this is the one line of it worth keeping.
- [x] **The opt-in for being findable — on the profile screen since AP 5**
      (F142, closed by F151). It waited for the search it governs: a box
      promising "other participants can find you and write to you" while nobody
      can search is a switch nothing reads, and for a promise about visibility
      that is the wrong direction to be wrong in (E37). It is now at the end of
      the form, under the answers it publishes, and only where
      `profile-search` is switched on — the same argument applies to an instance
      that runs accounts without a directory. The half that was not in the
      original entry: the form sends `searchable` **only** when it asked for it,
      because a control whose box is hidden still carries its default and would
      have quietly withdrawn somebody's visibility.
- [ ] **Should there be a shared library for interface components?** (F145) The
      participant client's `avatar-field.ts` and the organizer client's
      `ImageUploadField` do the same four things to an uploaded image — choose,
      check locally, preview, write — and cannot share code, because Nx keeps the
      two applications apart and the list of shared libraries comes from the
      thesis' architecture (HTTP, configuration, models, plug-ins, i18n) rather
      than from a work package. Two callers in two applications is not yet an
      argument; a third would be. **Marius decides**: it is a change to the fixed
      stack, and the vocabularies differ as much as the code overlaps
      (`admin.design.*` versus `profile.avatar.*`, F82).
- [ ] **A `select` profile question whose choices shrink leaves answers behind
      that are no longer offered.** The same situation as a deleted question
      (F34) and deliberately not refused — but nothing tells the organizer that
      four people answered "Bonn" before "Bonn" was removed from the list. Still
      open, and now only for the **organizer**: that is where the information is
      missing, and the participant search of AP 5 turned out to be the wrong
      place to put it. Its profile view shows an answer to a question that is
      still asked whatever the option list now says — so a shrunk `select` is
      visible there — but it deliberately does **not** show answers whose
      question is gone under their bare key (F150): the organizer's panel is an
      audit of a form, a participant is reading a person, and `local-group:
Bonn` is diagnostics rather than a fact about anybody.

- [ ] **The navigation carries no unread counter.** The conversation list has
      one per conversation (E38) and it moves live, but somebody who is reading
      an event page learns about a new message only when they go to `/messages`
      — or, from AP 11 on, by push, which is what E44 is for and what F166 (a
      socket that belongs to the session rather than to a screen) makes
      possible. A badge in the bar would need the **sum** without the screen,
      so a request for every logged-in participant at every sign-in, refreshed
      on every `chat:conversation`. Cheap to build and easy to get wrong in the
      annoying direction. **Marius decides / a question for the pilot partner**:
      whether a chat that only notifies by push and by its own screen is the
      one an activist community wants.

- [ ] **`formatAnswer` answers in English, and the organizer client shows it.**
      The helper in `shared-models` turns a tick into `yes` / `no` — words from a
      library that knows no catalogue — and the participant overview's detail
      panel renders them as they come, in a screen an organization reads in its
      own language (NFR 4). Found in AP 5, while drawing the answers of somebody
      else's profile; the participant client therefore does **not** use it and
      spells the tick itself (`common.yes` / `common.no`, both catalogued). The
      organizer's panel is a screen AP 5 does not touch, so it was left alone
      rather than fixed in passing: two keys and two lines, whenever that page is
      open anyway.

## Checkable after phase 4 — plug-ins

- [ ] **A plug-in reads the originals, not the translations.** `PluginProgramReads`
      (E12, F45) hands a plug-in five fields of a programme item, and since AP 11
      of phase 2 those are the untranslated ones. Right for the room planning
      plug-in, which an organizer uses in the instance's own language; wrong for
      anything a _participant_ reads — the individual programme plan is the
      candidate. The fix is a locale on the port and a minor bump of
      `PLUGIN_API_VERSION`, not a second port. Decide it when the first
      participant-facing plug-in exists, not before.

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
      **Decided in AP 13 of phase 2: not now, and here is why.** Removing the
      field is a _breaking_ change to the plug-in contract and would cost a major
      bump of `PLUGIN_API_VERSION`; shipping an icon set is a design decision
      about both clients. Phase 4 is where plug-ins are the subject and where the
      room planning plug-in gets a real interface, so both halves of the question
      get answered there, in one contract change instead of two. Until then the
      field is invisible to an organizer — no client reads it — so it is a decoy
      in a contract whose only implementer is this repository.

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

- [ ] **Resetting a forgotten participant password.** Deliberately left out of
      phase 3 (AP 1): FR 4.3 asks for changing the password _in_ the profile,
      which needs the old one, and that is what exists. A reset is its own
      route — a signed token with its own purpose and lifetime, a rate limit of
      its own, and an answer that must not disclose whether the address has an
      account (E10, E32). Until then the mail sent for a repeated registration
      says an account exists and nothing about recovery, because there is none
      to promise. This is the one dead end a participant can walk into, so it
      belongs early in phase 5 rather than late.

- [ ] **Decide whether the registration form and the media links are content
      too.** E25 lists what is translated, and the labels an organizer writes on
      the registration form (`registration_field_def.label`, `help_text`,
      `options_json`) and the titles of media links are not on it. Both are text
      an organization writes, both appear on a translated page, and both were
      left out of AP 11 to keep it to what FR 3.12 names. The shape is settled
      if it is wanted — a table per parent, exactly like the three that exist —
      but the field labels have a wrinkle the others do not: an _answer_ is
      stored under a field key (F35), so a translated label must not become a
      second key. Verify with the pilot partner first: a form with three
      questions in two languages may or may not be something anybody asks for.

- [ ] **The design page could now say when an app icon is unusable.** Since
      AP 12 the server can read an image's dimensions out of its own header
      (F106) — which is exactly what the manifest uses to decide whether an
      uploaded icon may replace the shipped set (F105). The design page still
      says "square" in words and shows a preview, so an organizer who uploads a
      wide logo or a 64-pixel favicon gets a manifest that quietly keeps the
      Trefaro icons beside theirs and no sentence saying why. The upload answer
      would only have to carry the two numbers. Deliberately not done in AP 12:
      it is a screen decision, and AP 3 is the package that owns that screen.
      Verify: upload a 500×120 logo as an app icon and be told that it will not
      be used on a home screen.
      **Moved to phase 5 in AP 13**: it is a usability improvement on a screen
      that works, and phase 5 is the usability round with the pilot partner —
      whose first upload is also the best evidence for what the sentence should
      say. Nothing about it got harder to do in the meantime: `imageDimensions`
      is there, and the upload answer is the only thing that has to grow.

- [ ] **The server refuses in English, whatever language the page is in.** Since
      AP 8 and AP 9 of phase 2 both clients say their own half from the catalogue
      and put the server's reason beside it (F77) — "Die Anmeldung konnte nicht
      gesendet werden." followed by `"Passport scan" takes files up to 5 MB`. It
      is the more visible arrangement in the organizer client, which refuses more
      often: a programme item outside its event, a selection field with no
      choices, a colour that is not hexadecimal.
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
      **Moved to phase 5 in AP 13 of phase 2.** It is the last piece of chapter 4
      that phase 2 did not deliver, and it is deliberately not a text extraction:
      it is an error-code contract through the whole business layer, which is
      hardening work and wants the API contract suite settled around it.

- [ ] **A shared link into the participant client does not carry its language.**
      The reader's language lives in `localStorage` (AP 6), so a link somebody
      sends shows the recipient's language rather than the sender's. That is
      arguably right, and it is also not a decision anybody made. If it should
      be shareable, the client route needs its own parameter — the API already
      has one (`?locale=`, F94) — and the two must agree about which wins.

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

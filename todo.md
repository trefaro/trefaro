# TODO — deferred items and open decisions

Phase 0 validated the architecture, which necessarily left things that cannot be
judged yet: a push notification cannot be tested on a device before there is
anything worth notifying about, and an authorization rule cannot be verified
before authentication exists.

Every entry below says **which phase makes it checkable** and **how to check it**.
Work the matching section at the end of each phase; an entry that turns out to
still be premature moves down rather than being ticked.

Two sections are not keyed to a phase. _Questions for the pilot partner_
collects what no phase can decide because it needs an answer from Democracy
International; those entries wait for the feedback round, not for a milestone.
_On a device — waiting for Marius_ collects what no phase can **check**, because
it needs a production build and hardware in somebody's hand.

Entries link to the spike protocol they came from, so the reasoning stays
attached to the task.

---

## Known gaps in the current state

Not deferred verification — things that are genuinely missing and would matter if
an instance were exposed today.

- [x] **The API contract suites leave rows behind, and the development database
      has 94 event series to prove it.** `invitations.spec.ts` creates two
      series per run and removes neither, so every run adds two. Nothing fails
      because of it today, but it hides the failures that matter: a suite whose
      fixture collides with a leftover row reports a wrong slug or a wrong count
      and looks like a regression (AP 1 of phase 3 lost a round to exactly
      that). Either every suite tears down what it created — `event-series.spec.ts`
      does — or the run starts from a known state. Worth deciding before the
      suites grow again in phase 3.
      **Closed in AP 13 of phase 3.** The suite that leaked is the only one
      that leaked — `invitations.spec.ts` now removes both of its series in
      `afterAll`, by SQL rather than through the endpoint — which refuses a
      series with confirmed registrations (E14), and this suite seeds two
      hundred of them. One statement is enough:
      `event.series_id`, `registration.event_id` and `invitation.series_id` all
      cascade. The decision the entry asked for, for the record: **every suite
      tears down what it created**, rather than the run starting from a known
      state — a shared development instance is the thing being tested against,
      and a suite that can only run on an empty database cannot run on a real
      one. What the fix does **not** do is clean up: the ninety-four series had
      become 164, with 16,774 registrations under them, and deleting somebody's
      development data is not a work package's business — the statement is in
      the AP 13 protocol for whenever Marius wants it run.

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

- [ ] **The combined E2E run cannot be read any more.**
      `nx run-many -t e2e --parallel=1` — which is exactly what
      `.github/workflows/ci.yml` runs — starts **one** `server:serve` for all
      three projects, and the registration budget of E4 (60 per five minutes
      and client address) is shared across them. The two browser suites
      register through the public form; by the time `server-e2e` runs, the
      budget is gone and the contract suite gets **429** where it expects 202.
      Measured in AP 8 of phase 4, twice, with and without that package's new
      participant suite — the same route, the same status either way, so it is
      not one suite's doing. Each project on its own is green — 687 / 258 /
      317 after AP 9, and AP 10 confirmed the split is still exactly this:
      alone green, together unreadable. What it costs today is honesty about "green": nobody can read the
      combined run's result, and a real failure in it would be invisible among
      the 429s. Three ways out, none of them free: a fresh server per project,
      a `--parallel=1` that waits five minutes between projects, or a way to
      let a suite spend a registration without a mail. **Not** raising the
      limit — that is the one thing `docs/rules/decisions.md` rules out, and
      the budget is a feature. Decide it in phase 5, where the CI job that
      starts the whole stack already lives.

---

## On a device — waiting for Marius

Four checks cannot be run from this repository **at all**, and no future phase
changes that: they need a production build, HTTPS and hardware in somebody's
hand. Everything else in this file waits for a work package; these wait for a
person. They are collected here because inside a phase list they read like
deferred verification, and deferred verification is what eventually gets done
by a suite.

- [ ] **Web Push on real devices — the only part of AP 11 that is not done.**
      Needs a production build (Angular registers the service
      worker nowhere else), HTTPS and four devices. What AP 11 changed is that
      the walk is now the feature rather than a REPL call: switch `push` on,
      take a published future event with a confirmed registration, allow
      notifications on the device, **move the event**, and see what arrives.
      Full procedure, including the personal notification of E44, in
      [`03-web-push.md`](docs/spikes/03-web-push.md#the-procedure-since-ap-11-of-phase-3).
      **A failure is a result too** — record the date and the device either way.
      Matrix:
  - [ ] desktop Chrome — allow, receive, click navigates to the payload path
  - [ ] desktop Firefox — same
  - [ ] Android Chrome over HTTPS — same
  - [ ] **iOS Safari with the PWA installed to the home screen** (iOS 16.4+) —
        this is the case the decision to make Web Push the only channel (F7)
        depends on. It does not work in a normal Safari tab; the client says so
        rather than showing nothing (`push.installFirst`).

- [ ] **A camera reads a check-in code at a door.** AP 8 of phase 4 built the
      half a suite can prove — the field beside the camera and the button in
      every row of the admission list, which reach the same route with the same
      code (F199) — and that is the half a door depends on. The camera itself
      needs a lens, a permission dialog and a secure context, so no engine
      Playwright drives can decide it. The walk: switch `qr-checkin` on, open a
      participant's ticket page from the link in their receipt on one device,
      open the event dashboard on another, press **Use the camera**, allow it,
      and hold the first screen in front of the second. Then the same code
      again — it must say "already here since …" and not refuse.
      **A failure is a result too** — record the date and the device either
      way. Matrix:
  - [ ] desktop Chrome, built-in webcam — decodes, admits, names the person
  - [ ] desktop Firefox — same
  - [ ] Android Chrome over HTTPS, rear camera — same
  - [ ] iOS Safari over HTTPS — same; `playsinline` is set for this case, so
        the video must stay in the page rather than opening full screen
  - [ ] **A refused permission leaves the door working**: the sentence appears
        and the field beside it still admits somebody

- [ ] **A reinstall picks up a newly uploaded app icon.** The manifest is built
      from `app_config` since AP 12 of phase 2 and an uploaded icon replaces the
      shipped set (F105, F106) — `verify-proxy.mjs` checks the document and
      every icon through the proxy. What no script can see is the home screen:
      whether removing and re-adding the app really shows the organization's
      icon. See _Checkable after phase 2_, "`manifest.webmanifest` is a static
      file".
- [ ] **An already installed PWA picks up a new deployment.** The service
      worker's exclusions are asserted against the built `ngsw.json` with
      ngsw's own selection rule (AP 12 and AP 13 of phase 2), which is what
      caught the `/admin` gap that made the organizer client unreachable. That
      an installed client takes an update at all is the half a browser has to
      show. Same missing net as the CI job that starts the stack, under phase 5.
      See _Checkable after phase 2_, "Re-check the service worker
      configuration".

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
      **AP 6 of phase 4 built the shape the plan fixed (E50, F196):** both are
      **warnings**, computed when the plan is read, shown at the session and at
      the room, in both clients — and nothing is refused. What stays open for
      the pilot partner is the other half: whether an organizer wants a hard
      limit at all, and whether deleting a room should ask first.
      **AP 10 moved the deletion half in here, with what was built instead**
      (10.09.2026): deleting a room is **one click**, and what it costs stands
      beside the button rather than in front of it — "takes its assignments
      with it, not the sessions". No confirmation step, on purpose: the only
      one available inside a web component is the browser's own `confirm()`,
      which is an operating-system dialog in the middle of an application that
      carries an organization's colours and font, in the browser's language
      rather than the reader's. A dialog of the plug-in's own is a screen, and
      no screen was asked for. If the pilot partner says a room deletion needs
      a second beat, that is what it costs; nothing else about the plan
      changes.

- [ ] **A device without an account hears about every public event's changes.**
      The price E43 accepts: a browser has no address and has said nothing
      about what interests it, so "the events of this organization" is the only
      audience it can be in. Fine for an NGO with a handful of events.
      **Marius decides / a question for the pilot partner**: whether it stays
      that way — the alternative is a subscription per event, which is a table
      the phase plan does not have.
      **Moved to _Questions for the pilot partner_ in AP 13 of phase 3**, where
      every entry that needs an answer rather than a package lives. The
      decision on the table is the current behaviour, and what would change it
      is what an organization with thirty events thinks of it — not an opinion
      from here.

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
      **Moved to _Questions for the pilot partner_ in AP 13 of phase 3** — not
      because the pilot partner decides it (Marius does, it is a change to the
      fixed stack), but because that section is the one place in this file for
      a question that no package can settle. Two callers in two applications is
      still not an argument; the third one is the trigger, and phase 4 builds
      four plug-ins that may well bring it.
      **AP 1 of phase 4 did not answer it.** `trefaro-icon` went into
      `shared-theming` rather than into a new interface library, because that is
      where the brand already is (colours, fonts, `--trefaro-*`) and an icon
      that inherits `currentColor` needs no component library to be themed. The
      count for the question above is unchanged: two callers for the _upload
      field_, and the third one is still the trigger.

- [ ] **The navigation carries no unread counter.** The conversation list has
      one per conversation (E38) and it moves live, but somebody who is reading
      an event page learns about a new message only when they go to `/messages`
      — or **by push, which AP 11 built**: a message to a member with no socket
      in that conversation now goes out as a notification (E44), which is what
      F166 (a socket that belongs to the session rather than to a screen) made
      possible. So the gap is smaller than when this entry was written: somebody
      with notifications on hears about it, and somebody without them does not. A badge in the bar would need the **sum** without the screen,
      so a request for every logged-in participant at every sign-in, refreshed
      on every `chat:conversation`. Cheap to build and easy to get wrong in the
      annoying direction. **Marius decides / a question for the pilot partner**:
      whether a chat that only notifies by push and by its own screen is the
      one an activist community wants.
      **Moved to _Questions for the pilot partner_ in AP 13 of phase 3.** The
      entry has always ended in a question, and AP 11 made it a smaller one:
      whoever has notifications on already hears about a message. What is left
      is a preference about a badge, and building it on a guess is exactly what
      that section exists to prevent.

- [ ] **The event dashboard has no messages tile** (the parenthesis in the
      plug-in hook entry below said phase 3 would add one). It cannot be the
      tile the mockup draws: that one counts **new** messages, and the
      organization has no read marker to count them against (F133). What is
      available is "N conversations about this event", which is a different
      tile — so this is a **product question for Marius / the pilot partner**,
      not an implementation gap. Whatever it says, it is a field on
      `EventDashboard` plus a tile, and the endpoint that would answer it
      already exists.
      **Moved to _Questions for the pilot partner_ in AP 13 of phase 3.** The
      endpoint exists, the tile is an hour of work, and what it should say is
      the part nobody here can answer: "N conversations about this event" is
      not the number the mockup drew, and a number the organization cannot act
      on is worse than no tile.

- [ ] **The organizer's message overview does not refresh itself.** It loads
      when it is opened, and that is a decision rather than an omission: the
      socket handshake authenticates a **participant** session (F132), the
      organization has no membership to deliver to (F133), and the notification
      mail exists precisely so that nobody has to watch a screen (F172). Making
      it live would mean admitting administrative sessions to the gateway and
      inventing an "organization" room — AP 7-sized work for a screen that a
      mail already points at. **Marius decides / a question for the pilot
      partner**: whether an inbox that answers when you open it is enough.
      **Moved to _Questions for the pilot partner_ in AP 13 of phase 3.**
      Making it live is AP 7-sized work — administrative sessions at the
      gateway and a room for an organization that has no membership (F133) —
      for a screen a mail already points at. Whether an inbox that answers when
      you open it is enough is a question about how an organization works, not
      about this code.

- [ ] **A guest's answer to the answer arrives outside the application**, as
      ordinary mail in the mailbox the instance sends from — not in the
      overview. Receiving mail is not a goal of this application (F8 keeps even
      the sending small), and the alternative for somebody who wants to stay in
      the app is an account. Worth naming to the pilot partner, because it is
      the one place where a conversation started in Trefaro can continue
      somewhere else.
      **Moved to _Questions for the pilot partner_ in AP 13 of phase 3**,
      because that is what the entry always was: the one place where a
      conversation started in Trefaro continues somewhere else, and the
      alternative for somebody who wants to stay in the application is an
      account. Receiving mail is not a goal of this application (F8 keeps even
      the sending small), so the answer changes a sentence on a screen at most
      — unless it does not, and then it changes phase 5.

- [ ] **The newsletter list carries no language.** An organization that sends
      in two languages would want to know which address reads which — and the
      overview cannot say. Only the app source could store it (a sign-up knows
      the page it was made on); the registration form's half has no such column,
      so half the rows would read "unknown", which is not an answer. Decided
      that way in AP 12 (F181) rather than half-built: whoever needs it later
      adds the column **and** decides what the other source says.
      **Moved to _Questions for the pilot partner_ in AP 13 of phase 3**,
      together with the export below: both are questions about the tool an
      organization already sends with, and one answer settles both. Half the
      rows reading "unknown" is the reason this was not half-built (F181).

- [ ] **There is no export of the newsletter list.** The overview pages through
      the consents, and moving a hundred addresses into another tool means
      copying them by hand. A CSV route would be small — one endpoint, no new
      rule — but FR 4.8 is P3 and asked for the opt-in administration, not for
      an export. **Question for the pilot partner**, together with the language
      above: what does the tool you send with want to be fed?
      **Moved to _Questions for the pilot partner_ in AP 13 of phase 3.** One
      endpoint, no new rule — and no requirement: FR 4.8 asked for the opt-in
      administration. What the receiving tool wants to be fed decides the
      format, so asking costs less than guessing a CSV twice.

- [ ] **A newsletter address cannot unsubscribe itself.** Nothing is sent from
      Trefaro (F8), so there is no letter to put an unsubscribe link in; whoever
      wants off writes to the organization (the contact form of AP 9 needs no
      account) and an organizer removes the row (F183). The objection link of an
      invitation does work across both sources (F24). Whether an instance whose
      organization sends from its own tool needs a self-service link here is a
      **question for the pilot partner**.
      **Moved to _Questions for the pilot partner_ in AP 13 of phase 3.**
      Nothing goes out from here (F8), so there is no letter to put a link in;
      the objection link of an invitation already works across both sources
      (F24) and the contact form needs no account. Whether an instance whose
      organization sends from its own tool needs a self-service link is the
      question, and it is theirs.

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
      works, and a logged-in participant needs none. **Cancelling** followed in
      AP 12, on the same rules; see the entry below.
- [x] **"My registration" is linked from the navigation — done in AP 4.** The
      condition was the participant login, and it fell away in AP 3. The entry
      points at `registrations`, the list a token cannot open (a token speaks for
      one registration, a person is not a registration); `registrations/:id`
      opens one of them with the same component the mailed link uses, and the
      link keeps working.

- [x] **A sign-up belongs to a registration, not to a person** (`program_item_signup.registration_id`).
      Once `user_profile` exists, decide whether a participant sees their seats
      across events — that needs a join over `registration`, not a second column
      here.
      **Decided in AP 13 of phase 3, and the answer is no.** A participant sees
      the seats of one registration, on the page that registration opens —
      which is what FR 4.7 asks for and what
      `program_item_signup.registration_id` already answers. One list across
      events would be a join over `registration` by address (E31), so the
      column stays as it is either way: the question was never where the row
      hangs, it was whether a screen wants the other cut. Nothing asks for that
      screen today. If the pilot partner does, it is a read and a page, not a
      migration — recorded under _Questions for the pilot partner_ with the
      rest of what a community might want and nobody has asked for.

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

- [ ] **Web Push on real devices** — the four-row device matrix. Moved to
      _On a device — waiting for Marius_ at the top of this file, because no
      phase makes it checkable: only somebody with four devices does.
- [x] **Rate-limit the subscribe endpoint** — closed long ago and only now
      crossed off: `ThrottlerGuard` has been global since AP 1 of phase 1. The
      endpoint stays anonymous **by decision** rather than by omission (E43,
      F134): a subscription may belong to nobody, and a session on the same
      request binds it to that account.
- [x] **Add `push_subscription.user_id` with its foreign key — done in AP 11**
      (F134, E43). Nullable, `ON DELETE CASCADE`, and two partial indexes, one
      per half of the audience. The endpoint stays the identity of the row, so
      signing in and out **rebinds** it rather than duplicating it — which is
      what stops a shared tablet from carrying whoever used it last.
- [x] **Explain the notification permission before prompting — done in AP 11**
      (F178). The offer says what will be sent, that the browser will ask next
      and that it can be withdrawn; only a click reaches the dialogue. The
      permission is **read** (`Notification.permission`) rather than found out
      by asking a question that was already answered no, and a "not now" is
      remembered. Two places, because E43 has two audiences: the banner in the
      shell, and the switch on `/profile`.
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
- [x] **Purge a conversation's pictures when the conversation goes — belongs to
      AP 10.** Deleting an **event** cascades through `conversation` to
      `message`, and a cascade removes rows but no files (E9). ~~That package
      extends `AttachmentsService.purgeForEvent`~~ — done in AP 10 of phase 3,
      but **not** by extending that method: the deletes of the attachment port
      are deliberately scoped to rows that _have_ a registration, so that
      nobody there can reach a picture inside a conversation. So a narrow port
      of its own (`ConversationPurgeRepository`, owned by the attachments
      module, which depends on nothing and is already called before both
      deletions) plus `purgeConversationsForEvent` / `…ForSeries`. The order
      F158 spells out holds: remember the ids, delete the conversations
      (cascading their messages), then the `attachment` rows, then the files.
      The reverse fails on `CHK_message_content`. Reachable narrowly but for
      real: an event with confirmed registrations cannot be deleted (E14), so
      this catches the one whose registrations were cancelled again — asserted
      against a real database in the contract suite.
- [x] **Eight copies of `isUniqueViolation` in `data-access/repositories/`** —
      `typeorm-{admin-user,event,event-series,profile-field,
program-item-signup,user-profile,registration,registration-field}`. The
      same six lines each. F138 says the third caller is where something moves
      out; AP 6 avoided adding a ninth (its insert uses `ON CONFLICT DO NOTHING`
      instead of an exception as control flow) rather than doing the extraction
      inside a package that had no business touching eight files. Small and
      mechanical — and worth checking for drift while doing it, which is what
      `searchTerms` (AP 5) and `pageWindow` (AP 6) both turned out to have.
      **Done in AP 13 of phase 3.** One `unique-violation.ts` next to the eight
      repositories that asked the question, and it stays inside the data access
      layer: a SQLSTATE is a fact about PostgreSQL, and what travels upwards is
      a `ConflictException` or a `null`, decided per caller. The drift this
      entry predicted was there — seven copies recognised a driver error
      whether TypeORM had wrapped it or not, the eighth only the wrapped one.
      The wider reading is the one that stayed (it is a superset, so no caller
      changed behaviour), and it has a unit test now, because three callers use
      the answer as control flow and a helper that stopped recognising a
      violation would turn three friendly answers into a 500 at once.
- [x] **Wire `PushService.broadcast()` to actual event changes — done in AP 11**
      (FR 3.15). `broadcast()` itself is gone with `findAll()`: there was one
      notification ("everybody") and no way to say anything narrower. There are
      now two audiences, each a statement of the port (F134) —
      `notifyEventChange` for a moved, relocated or withdrawn event and
      `notifyParticipant` for a new message (E44). What counts as a change is
      F176: published, not over, and time, place or "not taking place". There is
      still **deliberately no test-send endpoint** — an unauthenticated one
      would be a spam vector, and since AP 11 the event change _is_ the send.
- [x] **The organizer's screen for the profile field kit — built in AP 3.**
      AP 2 built `GET/POST /api/admin/profile-fields`, `PUT …/order` and
      `PATCH/DELETE …/:id`, and they worked; the plan assigned the _interface_ for
      them to no work package. Raised at the end of AP 2, **assigned by Marius on
      2026-09-02 to AP 3**, and delivered there as
      `pages/profile-fields/profile-fields-page.ts` behind `/profile-form`, with
      its own navigation entry and an eight-test browser suite. Its neighbour is
      the registration form's editor and the two stayed two pages; what they
      share is `features/fields/field-editing.ts` and `fieldTypeKey()` (F144).
- [x] **Cancelling one's own registration works without the mailed link — done
      in AP 12** (F148, F179). It needed no new rule, only a second route to the
      one `SelfServiceService.cancel` has had since AP 4 —
      `POST /api/participant/registrations/:id/cancellation`. A `POST` and not the
      `DELETE` the phase plan named, because `DELETE /api/admin/registrations/:id`
      erases a registration for good — one verb cannot mean "gone" in one prefix
      and "cancelled but kept" in the next (F179, F23). The detail page offers
      the button through either credential now, asks first, and the seats in
      individual sessions go with the cancellation.
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
- [x] **`profile-fields.spec.ts` "moves a question" is flaky.** It failed once
      in AP 10 and once in three runs of AP 11, in both cases while everything
      else was green. The cause is in the fixture rather than in the feature:
      the profile field kit is **instance-wide** (E35) and three browser engines
      reorder the same list at once, so one engine's `PUT …/order` can land
      between another's move and its assertion. Either the writing part of that
      spec runs in one engine only — the way the design and module suites
      already do it, and for the same reason — or the assertion compares only
      positions within one engine's own questions. Worth doing before phase 5
      hardens the suites, not worth a package of its own.
      **Done in AP 13 of phase 3 — and the cause named in this entry was not
      the cause.** The suite has been Chromium-only and serial since it was
      written, so no second engine was ever writing that list. The race was
      inside the one engine: `page.reload()` came straight after the click that
      moves a question, and a click resolves when it is _dispatched_, not when
      the `PUT …/order` it starts has answered — and the page redraws from that
      answer. The order is now polled twice, once on the page's own redraw and
      once after the reload, which is the assertion the test was always trying
      to make. The lesson is general enough to have gone into
      `docs/rules/e2e-tests.md`: a click that starts a request is not a request
      that has finished.
- [x] **The contact notification links to the organizer client, not to the
      request** (F172, AP 9). ~~`ANSWER_PATH = '/'`, because the overview
      arrives with AP 10 and a deep link into a screen that does not exist yet
      would be a promise rather than a shortcut.~~ Closed in AP 10: the mail
      leads to the request itself, and the address is spelled once —
      `organizerConversationPath` in `shared-models`, read by the organizer
      client's route and by the mail, so a rename cannot leave the letter
      pointing at nothing. Nothing else about the notification changed.

- [x] **`formatAnswer` answers in English, and the organizer client shows it.**
      The helper in `shared-models` turns a tick into `yes` / `no` — words from a
      library that knows no catalogue — and the participant overview's detail
      panel renders them as they come, in a screen an organization reads in its
      own language (NFR 4). Found in AP 5, while drawing the answers of somebody
      else's profile; the participant client therefore does **not** use it and
      spells the tick itself (`common.yes` / `common.no`, both catalogued). The
      organizer's panel is a screen AP 5 does not touch, so it was left alone
      rather than fixed in passing: two keys and two lines, whenever that page is
      open anyway.
      **Done in AP 13 of phase 3, and it was one screen worse than this entry
      said:** the participant client's own "my registration" page uses
      `formatAnswer` as well, so somebody reading their own answers in German
      read `yes` under a ticked box. `formatAnswer` now takes the two words as
      a **required** argument — a default would have kept the bug available —
      so the library still decides the one thing that is not a word (the dash
      for a question nobody answered) and both clients say the rest in the
      reader's language. Three call sites, two catalogue keys that already
      existed (`common.yes`, `common.no`), and the organizer's panel reads the
      locale in the same `computed()` so that a language switch redraws it
      (F72). `person-page.ts` still spells the tick itself, for the one reason
      that is left: an unanswered question is dropped there rather than dashed,
      because a reader is looking at a person, not at a form.

## Checkable after phase 4 — plug-ins

**Every entry in this section is assigned to a work package in
[`docs/PHASE4.md`](docs/PHASE4.md)** (the plan, written 04.09.2026 — five
plug-ins, ten packages, decisions E46–E59). Where the plan already answers an
entry, the answer is noted below rather than repeated.

- [x] **A plug-in reads the originals, not the translations.** `PluginProgramReads`
      (E12, F45) hands a plug-in five fields of a programme item, and since AP 11
      of phase 2 those are the untranslated ones. Right for the room planning
      plug-in, which an organizer uses in the instance's own language; wrong for
      anything a _participant_ reads — the individual programme plan is the
      candidate. The fix is a locale on the port and a minor bump of
      `PLUGIN_API_VERSION`, not a second port. Decide it when the first
      participant-facing plug-in exists, not before.
      **It exists in this phase** — the individual programme plan (FR 3.17) is
      the fifth plug-in. Answered as predicted: a locale on the port plus
      `listForEvent`, not a second port (E56, F200, AP 9).
      **Closed in AP 9 (10.09.2026), with one correction to the prediction.**
      `listForEvent(eventId, locale?)` came early, in AP 6, because the room
      plan needed the list; AP 9 used it for the participant's own plan and
      proved the other half — an organizer's read of the same port still gets
      the originals. The `locale` on `findItem` that the plan also promised was
      **not** built: when the package arrived, `findItem`'s only caller was a
      write that checks a session exists and answers 204, and a parameter
      nobody passes is the pretence E21 was written against (F200). No version
      bump either — 1.2.0 was already the step this phase spends.

- [x] **The plug-in contract names an icon nobody draws.**
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
      **Decided by Marius on 04.09.2026: the instance ships an icon set.** The
      glyphs the descriptors name go into the image as path data beside the
      self-hosted fonts, drawn by one component, with a closed catalogue of
      allowed names — so the field finally reads, and the contract stays 1.x
      (E49, F188, AP 1).
      **Done in AP 1 of phase 4, and verified as this entry asked.** Seven
      glyphs (Material Symbols, Apache-2.0, vendored like the fonts) as
      `ICON_PATHS` in `shared-theming`, the allowed names as `ICON_NAMES` in
      `shared-models`, drawn by `trefaro-icon` as inline SVG with
      `currentColor`. A tile of the participant's event page shows the glyph its
      plug-in names, from this instance's own files
      (`apps/user-client-e2e/src/plugin-slot.spec.ts`), and the organizer's
      module row shows it too. A name this version does not draw gets **no**
      icon and is named in the module administration. One half of the entry was
      not buildable and is not faked: there is no host-drawn navigation entry
      per plug-in — at that hook point the plug-in's own element _is_ the entry,
      and no plug-in of this phase mounts there. The reasoning is in
      `docs/PHASE4.md` under _Fortschritt_.

- [x] **Build the four remaining curated plug-ins.**
      `apps/server/src/plugins/{forum,qr-checkin}` hold only a README; they are
      deliberately not registered as no-op plug-ins. Order from the plan:
      programme proposals (AP 2/3), forum (AP 4/5), room planning (AP 6), QR
      check-in (AP 7/8) — and since 04.09.2026 a fourth directory to write,
      `personal-program`, for the individual programme plan Marius added to the
      phase (AP 9). `CURATED_PLUGINS` goes from one entry to five.
      **One of four is done, both halves: the programme proposals.** The server
      in AP 2 — `plugin_program_proposals_proposal`, two controllers (one per
      access level), `requires: ['profiles']` — and the clients in AP 3: a
      second bundle under `apps/plugins/program-proposals`, mounted at
      `event-detail` in the participant client and at the new `event-dashboard`
      hook point in the organizer client, plus the sixth route (`…/summary`) for
      the counts the section draws. `CURATED_PLUGINS` has two entries, proposals
      above room planning, in the order the plan fixes. **Milestone M9 is
      reached**: the first curated plug-in is complete and the 1.2.0 contract has
      a second implementer. Three plug-ins left.
      **Three of four are done: the room plan became real in AP 6
      (08.09.2026).** It was registered since phase 0 and had rooms and the
      session link since AP 9 of phase 1; AP 6 added changing and deleting a
      room, the plan of a whole event with both warnings (E50), the public
      plan for participants (E58), the editor at `event-dashboard` — the third
      tile there — and, on the contract, `listForEvent` with a title (E56,
      pulled forward from AP 9). **Milestone M10 is reached.** `CURATED_PLUGINS`
      is unchanged at three entries; `qr-checkin` and `personal-program` are
      left.
      **Two of four are done, both halves: the forum followed (AP 4 and AP 5,
      08.09.2026).** `apps/server/src/plugins/forum` — two tables
      (`plugin_forum_thread`, `plugin_forum_post`), one migration, two
      controllers, `requires: ['profiles']`, a decision per post and no status
      on the thread (F195). It uses `PluginParticipantReads` exactly as the
      proposals do, and the port was not touched — which is what AP 4 was meant
      to prove. AP 5 added the bundle under `apps/plugins/forum` (threads, one
      thread with its posts, the two forms at `event-detail`; counts and queue
      at `event-dashboard`) and the eighth route, `…/summary`, once the section
      read it (E21). `CURATED_PLUGINS` has three entries, forum between
      proposals and room planning. Only `qr-checkin` still holds a README
      alone; two plug-ins left.
      **Three of four are done on the server, and the fourth is half done: the
      QR check-in server followed (AP 7, 09.09.2026).**
      `apps/server/src/plugins/qr-checkin` — one table
      (`plugin_qr_checkin_ticket`, the registration as its primary key), one
      migration, **three** controllers (one per access level, which is what
      makes this plug-in the example for E57), no `requires` (a door reads a
      registration, and a registration needs no account) and no `client` half
      until AP 8. On the contract it added `PluginRegistrationReads` — resolve
      a self-service claim, read an event's confirmed registrations, resolve an
      id it already stored — and two one-field extensions in the core
      (`ProfileDirectory.addressOf`, `RegistrationsOfAddress.status`).
      `CURATED_PLUGINS` has four entries; only `personal-program` is missing,
      and the check-in's screens (AP 8) are what is left of this one.
      **Four of five are done, both halves: the check-in's screens followed
      (AP 8, 09.09.2026).** `apps/plugins/qr-checkin` is the fourth bundle —
      one element, two halves, told apart by `mountPoint` (F202): the ticket at
      the **new** `my-registration` hook point, where it draws the code as an
      SVG in the browser, black on white (E54, F198), and the door at
      `event-dashboard`, which reaches one route three ways — camera, field,
      and a button in every row (F199). Two libraries in the bundle and none
      from a network: `qrcode` (MIT) draws, `jsqr` (Apache-2.0) reads, the
      second one loaded only when the camera is switched on. **Milestone M11 is
      reached.** Only `personal-program` is left (AP 9).
      **Five of five are done: the individual programme plan followed (AP 9,
      10.09.2026), server and bundle in one package** — the smallest of the
      five, and splitting it would have produced a route nobody called for the
      length of a package. `apps/server/src/plugins/personal-program` — one
      table (`plugin_personal_program_entry`, the pair as its primary key), one
      migration, **one** controller and one audience, `requires: ['profiles']`.
      `apps/plugins/personal-program` is the fifth bundle and the only one that
      is not a switch: it declares one hook point, `event-detail`, so a
      `mountPoint` input would be a value nothing reads. On the contract it
      added exactly one field, `PluginProgramItem.registrationEnabled` (E55,
      F201) — the mark that keeps a tick from reading like a booking — and left
      `findItem` as it was. `CURATED_PLUGINS` has all five entries.
- [x] **Implement the overbooking check** in the room planning plug-in: sign-ups
      per programme item against room capacity. Everything it needs exists since
      AP 9 — the room's capacity, the sessions assigned to it, and their sign-up
      counts through the plug-in's read port (F45), which is why the plug-in still
      touches no core table. What is deliberately _not_ built is the judgement:
      whether more sign-ups than chairs is a warning, a refusal or a hint, and
      where an organizer should see it. `GET …/rooms/:id/schedule` reports the
      numbers side by side and decides nothing. Ask the pilot partner first — the
      question is under _Questions for the pilot partner_.
      **The plan decides the shape, not the threshold** (E50, F196, AP 6): both
      numbers become **warnings** computed on read, at the room and at the
      session, and nothing is refused — F41's precedent, because a tool that
      refuses a room gets worked around ("Saal A (2)") and then the truth is no
      longer in it. Whether an organizer wants a hard limit stays the pilot
      partner's question.
      **Done in AP 6 (08.09.2026).** `GET …/events/:id/schedule` computes
      `overbooked` per session — more sign-ups than the chairs of **every** room
      the session uses, added up — and per room, on read, stored nowhere; the
      editor on the event dashboard shows it as a word at both, and nothing is
      refused. The sign-ups still reach the plug-in through the port alone
      (F45): the contract suite seeds them into the core tables and reads the
      warning off the plug-in's answer.
- [x] **Two sessions in one room at the same time** is not refused either, for
      the same reason: the schedule carries `startsAt`/`endsAt` per booking, and
      what a double booking should _do_ is a product decision, not a phase-4
      implementation detail.
      **Done in AP 6 as `double-booked`**, the second warning of E50: two
      sessions in one room whose times overlap, on both and on the room; two
      that merely touch are not. Still nothing refused.
- [x] **`shared-plugin-kit` is where a bundle's shared lines live** (F138,
      AP 6). The fourth and fifth bundle (AP 8, AP 9) import `wordsOf`,
      `when`/`day`/`clock` and `readJson`/`sendJson` from it; a helper copied
      into a bundle from now on is a regression, not a second copy. And the
      library is a new entry in the architecture's list of shared libs (F145
      said that list comes from the thesis) — noted for AP 10 to record in the
      reference document.
      **Held for the fourth bundle (AP 8):** the check-in imports `wordsOf`,
      `when` and `readJson`/`sendJson` from the kit and copied nothing. What it
      did **not** need was `day` or `statusWord` — a door has states, but they
      are two and they are not E51's three. Only the reference document's entry
      is left, which is AP 10's.
      **Closed in AP 10 (10.09.2026).** The fifth bundle imported `wordsOf`,
      `day` and `readJson`/`sendJson` and copied nothing either, so the rule
      held for two packages after it was written. The library is now in the
      reference document twice: in chapter 5 beside the six it joins — where
      the point worth keeping is that it is the **only** shared library no
      client uses — and in `docs/rules/infrastructure.md`, which said "a bundle
      may use exactly one of them" and was wrong from AP 6 onwards. It is two
      now, and the reason the rule survives the correction is that the second
      one holds no framework, no HTTP stack and no state: it holds the lines
      that would otherwise be in five places.
- [x] **F196 is missing from the reference document.** AP 6 recorded it as
      "filled" (E50, warnings show and refuse nothing) but wrote no row: the
      table jumps from F195 to F202, and the version line does not mention
      F196. Not written in AP 7, because it belongs to AP 6 and is that
      package's sentence to write — noted here because AP 10 checks that
      F186–F201 are all there, and it will find exactly this.
      **Written in AP 10 (10.09.2026), and it found it exactly there.** F196
      now answers what a room plan does when more people are signed up than
      there are chairs: it shows it and refuses nothing — two warnings computed
      on read, at the session and at the room, nothing stored, and the write
      route still has its two rules, neither about capacity. The hard limit
      stays the pilot partner's question. What this entry is really about is
      the bookkeeping: a **reserved** number is not a written one, and the only
      thing that tells the two apart is somebody counting at the end of a
      phase. F186–F202 are all there now.
- [ ] **The first run of the organizer browser suite was red once in AP 7**,
      the two after it green with the same count (311), and Nx itself marked
      the task flaky. The package touched no screen and no file of that suite;
      the run sat directly behind a `run-many -t build`, and the likely cause
      is the serve process between the two. Watch for it — if it comes back
      with an actual failing test name, that name goes here.
      **It did not come back in AP 8**: that suite ran twice in full, both
      times green (317). Left open, because two green runs are not a diagnosis.
      **AP 9 produced the diagnosis, by reproducing it much worse.** That
      package ran the same suite while a `nx run-many -t lint test build` was
      running beside it and got **146 failures** — none in Chromium, 54 in
      Firefox, 92 in WebKit, every page stuck at "Loading Trefaro…", 11.6
      minutes instead of 2.1. Run alone immediately afterwards, with nothing
      changed: 317 passed, 82 skipped, zero failures. So the cause is the one
      this entry guessed and could not prove: a build next to a browser suite
      starves the Angular dev server the suite is talking to, and the engines
      that start later pay for it — which is exactly why AP 7 saw it in the
      **first** run and not the two after. It is a scheduling fault, not a
      test, and there is no failing test name to write here because no test is
      wrong. It is a rule now instead (`docs/rules/e2e-tests.md`: never build
      next to a browser suite), which is the only form in which it can stop
      happening again.
      **And in AP 10 it came back with a name — so this entry closes only
      half.** The 146 failures are explained and will not recur under the rule
      above. The **single** sporadic failure this entry started with is a
      different animal, and AP 10 ran into it with nothing else running at
      all: three full runs of the organizer suite, one of them red with
      exactly one test, the other two green with 317.
      The name, which is what AP 7 asked for:
      `apps/admin-client-e2e/src/participants.spec.ts:224` — _participant
      overview › opens one registration, cancels it, and puts it back_, in
      **firefox**. It accepts the confirmation dialog, sees the detail switch
      to "cancelled", and then waits ten seconds for the status filter to read
      `Cancelled (2)`; the button never appears.
      What has been ruled out, so the next person does not re-derive it: it is
      **not** two tests racing over one fixture. The fixture seeds exactly one
      cancelled registration and this test makes the second; no other test in
      the file changes a status; each engine seeds its own event, and because
      `fixtureLabel` carries `process.pid`, each Playwright **worker** seeds
      its own too — which matters, because the suite runs `fullyParallel`, so
      `beforeAll` runs per worker and not per file. What is left is the one
      thing the assertion actually waits for: the count on that filter button
      is re-read from the server after the cancel, and under three engines on
      one development server it did not arrive inside ten seconds once in
      three runs. That is a suspicion, not a diagnosis — the next run that
      catches it should keep the trace (`trace: 'on-first-retry'` produces
      none at `retries: 0`), which is the cheapest next step.
      **A second, weaker sighting the same day, in the other suite:** the
      first of five runs of the participant suite failed and the four after it
      passed with 258. Its output was discarded before it was read — the
      command was tailed — so there is no test name for it, and two targeted
      attempts to reproduce the sequence that preceded it failed. It is
      recorded here as an observation rather than a finding, and the lesson is
      the mechanical one: **capture a suite's output to a file, then read it.**
      Tailing a run throws away the only evidence a flake ever produces.
- [x] **Each new plug-in proves the contract.** Verify per plug-in: own tables
      only, prefixed `plugin_<key>_`; disabled means 404 and absent from
      `/api/config`; disabling keeps its data.
      **Proven for the first one, and the proof is now mechanical for the next.**
      `apps/server-e2e/src/api/plugin-program-proposals.spec.ts` asserts all
      three of those for the programme proposals, and
      `apps/server/src/plugins/plugin-controllers.spec.ts` holds **every**
      controller of **every** mounted plug-in to E57 — path prefix with its own
      key, `@PluginController`, `PluginEnabledGuard`, and no session guard of its
      own. A plug-in written in AP 4, AP 7 or AP 9 cannot ship without them.
      Since AP 2 the rule "a plug-in imports from `plugin-api` and nothing else
      in the server" is an ESLint rule as well.
      **Proven for the second one, without touching the proof** (AP 4):
      `apps/server-e2e/src/api/plugin-forum.spec.ts` asserts the same three
      things for the forum, and `plugin-controllers.spec.ts` covered its two
      controllers the moment the descriptor was registered — no line of the
      test changed.
      **Proven for the fourth, and it was the hardest one to prove** (AP 7):
      `apps/server-e2e/src/api/plugin-qr-checkin.spec.ts` asserts the three for
      the check-in, and `plugin-controllers.spec.ts` again changed by no line
      while covering **three** controllers instead of two. What the suite has
      to show beyond that is that the registrations reached the plug-in
      **through the port**: they are written straight into `registration` by
      SQL, the plug-in queries no core table, and the admission list names
      them anyway.
      **Proven for the fifth, and then counted for all of them (AP 9, AP 10).**
      `apps/server-e2e/src/api/plugin-personal-program.spec.ts` asserts the
      three for the individual programme plan, and `plugin-controllers.spec.ts`
      again changed by no line. AP 10 closed it from the other end, against a
      running five-container stack rather than a suite: seven tables, every one
      of them prefixed `plugin_<key>_` and none of them a core table; all five
      plug-ins walked off → on → off through the administration endpoint, each
      answering 404 and appearing in no configuration while off; and the
      prerequisite three of them declare refused in both directions before
      writing (E47). That walk is in `verify-plugin-toggle.mjs` now, so it is
      re-run rather than re-argued — and writing it found two things the suites
      cannot see, both of them staleness: the script still expected the room
      plan to declare **one** mount point, which stopped being true in AP 6,
      and its list of what the image ships was missing `personal-program`.
- [x] **The dashboard needs a hook point for plug-in tiles** (F47). The mockups
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
      **The minor version step is already taken:** AP 1 of phase 4 put
      `PLUGIN_API_VERSION` on 1.2.0 with a compatibility case (E46 — one step
      for the whole phase). What is left for AP 3 is the value in
      `PluginMountPoint` together with the slot that serves it; it deliberately
      did **not** arrive in AP 1, because a value in the closed set that no host
      serves is the decoy F47 warns about. The tile's icon comes from AP 1
      (E49).
      **Done in AP 3 of phase 4, and verified as this entry asked.**
      `event-dashboard` is the third value of `PluginMountPoint`; the organizer's
      event dashboard mounts the slot below its table and puts one tile per
      mounted plug-in into its existing grid — label from `labelKey`, icon from
      `icon`, and a **jump mark** to the section rather than a route, with no
      number on it (E59, F193). Switching the plug-in on makes tile and section
      appear on every event's dashboard, switching it off removes both and
      nothing else, and no row is lost
      (`apps/admin-client-e2e/src/plugin-program-proposals.spec.ts`). One thing
      the entry did not anticipate: a bundle with two hook points has to be told
      **which one** is drawing it, so the slot hands over `mountPoint` as well
      (F202). **The second filler arrived in AP 5:** the forum's tile stands
      beside the proposals' on the same dashboard, each jumps to its own
      section, and the hook point mounts the two in the order the plug-ins are
      registered — asserted in a browser with both switched on
      (`apps/admin-client-e2e/src/plugin-forum.spec.ts`). Nothing in the host
      changed for it, which is what "verify" here meant.
      **Closed in AP 10**, with the third and fourth fillers on the board: the
      room plan's editor (AP 6) and the door (AP 8) mount at the same hook
      point, so four of the five plug-ins draw a tile there, in registration
      order, and the fifth deliberately does not — a personal plan is nobody's
      dashboard. The tile never grew a number (E59): label, icon, jump mark.

- [x] **A plug-in behind the login cannot tell whether there is a session.** The
      contract hands a mounted element `locale`, `strings` and `mountPoint` — not
      whether the reader is signed in. So the participant half of the programme
      proposals asks its own endpoint and reads the 401 (E58: no session is a
      state it renders, an invitation to log in). The cost is one failed request
      in the console of every anonymous visit to an event page — exactly what
      F143 taught the **host** to avoid, where a hint in `localStorage` decides
      whether the client asks at all. A plug-in cannot use that hint: it belongs
      to one of the two clients, and the same bundle runs in both. The fix would
      be a fourth promised property, and it has a catch worth deciding rather
      than assuming: only the **page** knows the answer, not the slot, so it
      would be the first context value a hook point can forget — which is the
      argument F187 and F202 use against exactly that shape. Decide it when the
      third filler exists: AP 5 (forum) and AP 9 (individual programme plan)
      mount participant-facing elements with the same question, which is E46's
      condition for extending the contract. **The second filler is there
      (AP 5):** the forum's participant half does exactly what the proposals'
      does — asks, reads the 401, draws the invitation — and one more failed
      request per anonymous visit went with it. Still one short of E46's
      condition; AP 9 decides.
      **The third filler arrived in AP 6:** the room plan's editor at
      `event-dashboard`, three plug-in tiles side by side in registration
      order. The condition is met three times over; what AP 9 decides is only
      whether the hint is worth a contract step.
      **AP 9 decided against it (10.09.2026).** The personal programme is the
      third participant-facing half that asks and reads the refusal, so the
      cost is now three failed requests in the console of an anonymous visit
      with all three switched on — and it stays. The reason is the catch the
      entry itself names: a property only the **page** can supply is one a hook
      point can forget, and a forgotten `signedIn` is `false`, so a plug-in
      would draw "please log in" **at somebody who is logged in**. A silent
      wrong answer is worse than a 401 that is right every time, and E58
      already says a refusal is a state rather than a failure. The slot cannot
      supply it either: the two clients have different session kinds, and the
      same bundle runs in both. What is left is console noise on a page that
      works, which is not worth the first context value that can be wrong.

## Checkable after phase 5 — hardening and release

- [ ] **A personal plan does not say where I hold a seat.** E55 has two halves:
      putting a session in a plan books nothing (built, F201) — and "the plan
      shows where I have a seat", which AP 9 did **not** build. The reason is
      structural rather than an oversight: a seat belongs to a **registration**
      (`program_item_signup.registration_id`, and somebody may register without
      an account), a plan belongs to an **account**
      (`plugin_personal_program_entry.user_id`). Joining the two would need two
      capabilities the contract does not have — resolving an account's
      registrations for one event, and asking which sessions one registration
      signed up for — and the second one is a participant list read one row at
      a time, which is exactly what `countSignups` gives a number for instead.
      What was built in its place is the mark on the **session**: where a seat
      is booked at all (`registrationEnabled`), so a tick cannot be mistaken
      for a booking. Decide in phase 5 whether the missing half is worth two
      port capabilities, or whether the programme's own timeline — where the
      seat is taken — is the right and only place to see it.

- [ ] **A plug-in draws its times in the reader's clock, not the event's**
      (moved out of phase 4 by AP 10, 10.09.2026). `PluginSlotContext` carries
      `locale`, `strings` and `mountPoint` and nothing about the event, and
      `PluginProgramReads` has no field for the event's zone, so the room plan
      and the personal programme render their slots in whatever zone the
      browser is in. For somebody at the venue that is the venue's clock and
      the bug is invisible; read from abroad, a plug-in's section disagrees
      with the programme **above it on the same page**, which the host renders
      in the event's zone (E8). AP 10 weighed it and did not build it, for one
      reason and with one answer.
      **Why not now:** it is a contract step, and E46 spends exactly one per
      phase — 1.2.0 was it. Adding a second in the package whose job is to
      check that the first one is honest would be the phase auditing itself
      into an extension.
      **Which carrier, so phase 5 does not re-derive it: the port, not the
      slot.** The slot looks cheaper — a fourth promised property beside
      `locale` — but it fails the same test the `signedIn` hint failed in AP 9:
      only the **page** can supply an event's zone, so a hook point could
      forget it, and `my-registration` and `navigation` have no event to
      forget. A property that is sometimes legitimately absent is one every
      plug-in must handle absent, and the fallback would be the browser's
      zone — which is the bug. The port already answers **per event** and
      already carries the times, so the zone belongs beside them: one field on
      `PluginProgramItem`, or one small read of the event. Cost: a minor step
      of `PLUGIN_API_VERSION` with its compatibility case, and one line in each
      of the two bundles that render a time.

- [ ] **A deleted account takes the threads it opened — replies of others
      included.** `plugin_forum_thread.created_by` cascades, as the plan’s
      schema says (AP 4 of phase 4), and for a **post** that is right: a post
      is attributed by nature (E58). A thread is different — it is a container
      for other people’s posts, and the cascade would delete their published
      replies along with the opener’s account. Nothing can delete an account
      yet, so AP 4 kept the plan; decide it when erasure is built: a nullable
      `created_by` with `SET NULL` keeps the thread (the first post cascades
      either way, and a thread with no published post is invisible), and the
      thread’s `author` is already nullable in the payload.

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
- [ ] **Two participant-client specs race under eight workers.** In the full
      local run of 04.09.2026 (`nx run-many -t e2e --parallel=1`, Playwright's
      own default of eight workers) `content-translations.spec.ts` did not find
      the German heading it had seeded and the browser newsletter suite did not
      see its success message — with **no** error from the server for either.
      Both files pass when they run alone, and both passed in CI, which runs one
      worker (`workers: process.env.CI ? 1 : undefined` in the Nx preset). So the
      assertions are sound and something instance-wide is shared between the two
      — which one is not established; the candidates are the interface language
      and the start page's first series link, and the development database's 164
      leftover fixture series make the second more likely here than on a fresh
      instance. Worth an hour when the browser suites are next touched: either
      the shared thing gets a per-file identity, or the two files get a serial
      lane. Until then a local red on these two is not news, and that is exactly
      the kind of sentence that hides a real defect one day.
      **It did — half of it (AP 5 of phase 4).** The translations test was
      **not** a shared-state race: it switches the language before the page
      has finished its first load, so two requests are in flight and the
      answers arrive in the network's order. The landing page wrote whichever
      came last — a slow English answer under a German page, once in Firefox
      in a full local run. Fixed in `event-landing-page.ts` with a load
      sequence (a late answer to a question nobody is asking any more is
      dropped) and a unit test that resolves the two answers out of order. The
      same shape — `load(…, i18n.locale())` in an `effect`, writes after an
      `await` without a guard — still stands in `series-detail-page.ts`,
      `start-page.ts`, `event-registration-page.ts` and
      `my-registration-page.ts`; nothing has caught them yet, and a quick
      switch on a slow connection would. Phase 5, together, with one test
      each. **The newsletter half followed in AP 6** and was not a race
      either: after the click on a series, the test found the newsletter
      region of the **start page** — the same component stands on both pages
      (F182) — filled it, and the navigation threw it away; the submit landed
      on the empty form of the series page. A `toHaveURL` on the series page
      before the locator; the rule is in `docs/rules/e2e-tests.md`.
- [ ] **The three e2e projects share one server's rate limits.** CI runs them
      with `--parallel=1` against a single instance, so every limit that counts
      per client address is a budget for the whole run: sixty public
      registrations per five minutes (`REGISTRATIONS_PER_WINDOW`), twenty logins
      (`LOGIN_ATTEMPTS_PER_WINDOW`) and twenty newsletter sign-ups
      (`NEWSLETTER_SIGNUPS_PER_WINDOW`). The API contract suite spends most of
      the registrations, deliberately — the double opt-in through the real form
      _is_ its subject. The first CI run of AP 12 failed because the new
      participant-client suite added six more and pushed the total over sixty;
      the fix was to seed that fixture instead (`support/registration-seed.ts`).
      **It happened a second time, on the closing commit of phase 3**, and this
      time on the newsletter: AP 12 had written two suites against that one
      budget of twenty without adding them up (sixteen plus four), so whether a
      run was green depended on how far apart the two suites happened to run.
      The fix was the same one — the fixtures are seeded now
      (`seedNewsletterSubscription`), which brings the run to ten plus four of
      twenty. What is left is the margin, and it is thin. Before a suite posts
      through one of these forms again, either count what the run already makes
      or seed. Worth a proper answer in phase 5, when the throttle gets a
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

- [ ] **The WebSocket handshake carries no rate limit.** `@nestjs/throttler`
      sees HTTP routes, and a socket.io handshake is served by engine.io before
      Nest's router ever sees it — so the one request that now costs a session
      lookup is the one request nothing counts. Belongs with the configurable
      throttling phase 5 already owes (E4); until then the cheapest mitigation
      is that a refused handshake does no database work beyond one indexed
      lookup on `token_hash`.
      **Moved to _Checkable after phase 5_ in AP 13 of phase 3**, which is
      where the configurable throttling of E4 already lives: the two are one
      piece of work, and doing the handshake alone would mean inventing a
      second place where limits are configured.

- [ ] **A deleted profile leaves its conversations standing** —
      `conversation_member.member_id` carries no foreign key (E39), on purpose.
      Nothing can delete a profile today (there is no endpoint, by design), so
      this is erasure work for **phase 5**, together with the rest of it: what a
      person may have removed, what stays because somebody else wrote it, and
      what a conversation looks like when one side is gone.
      **Moved to _Checkable after phase 5_ in AP 13 of phase 3.** Erasure is
      one subject, not five: what a person may have removed, what stays because
      somebody else wrote it, and what a conversation looks like when one side
      is gone. Nothing can delete a profile today, so nothing is broken in the
      meantime.

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
      **Moved to _Checkable after phase 5_ in AP 13 of phase 3.** What is
      missing is a sentence on the organizer's editor, and a sentence needs a
      number to put in it — how many people answered with the option about to
      disappear — which is a read nothing has today. Usability work with a
      query behind it, so it belongs with the usability round rather than in a
      closure package.

---

## Decided

Decisions only — the work they imply stays in the phase sections above.

- [x] **A room plan is a structure, not a map** — moved out of phase 4 by
      AP 10 (10.09.2026), because it was never a task: F14 decided in phase 1
      that v1 manages rooms as data (name, floor, seats, which session is in
      which), and that an OpenStreetMap/Leaflet floor plan is a later stage.
      Phase 4 built exactly that structure and nothing map-shaped, so the entry
      has no work behind it and no open question in it — only the standing
      rule for whenever the stage arrives: **OpenStreetMap/Leaflet, never a
      Google map** (NFR 9).
- [x] **F21, the room link** — decided 2026-08-26: a plug-in-owned join table,
      not a `room_id` column in `program_item`. Recorded as F21 in the
      requirements document, whose §5.3 schema draft is corrected; reasoning and
      the rejected alternatives in
      [`02-server-plugin.md`](docs/spikes/02-server-plugin.md#who-owns-the-link-between-a-programme-item-and-a-room--decided).
      Implementation is listed under phase 1.
- [x] **Thesis material in a public repository** — decided 2026-08-26: diagrams
      and mockups stay (they document where the architecture comes from), the
      full thesis PDF does not.

- [x] **A device without an account can only switch notifications off in the
      browser.** There is no page that is theirs to keep a setting on, and
      every browser's own site settings can do it — the offer's text says as
      much. A named limit rather than a gap: the alternative is a page for
      somebody who has deliberately not made an account.
      **Moved here in AP 13 of phase 3**, out of the phase-3 list: no phase
      closes it, because it is not open — it is what E43 costs, and nothing is
      waiting on anybody.

- [x] **Who from the organization answered is stored, and not shown.** A reply
      carries the administrator's own account in `sender_id` (E39, precisely so
      that the history says which _person_ answered), but the organizer client
      only recognises the reader's **own** lines — by the id of their session —
      and calls everything else "your organization". Showing a colleague's name
      needs a fourth read of `admin_user` through a port of its own; it was not
      in AP 10's acceptance criterion, and for a two-person organization the
      difference is invisible. Worth doing when an instance has more
      administrators than it has people who remember who wrote what.
      **Moved here in AP 13 of phase 3**, out of the phase-3 list: the fourth
      read of `admin_user` is not deferred work but work nobody has asked for.
      It becomes a task the day an instance has enough administrators for the
      question to come up.

- [x] **The organizer can see a picture in a conversation but not send one.**
      A participant may (E40), and the organizer's own route serves theirs
      (F133) — but an answer has to work as a **mail** too, and an attachment
      there would be a second delivery mechanism for something FR 3.4 does not
      ask for. If it ever comes, it comes for `group` conversations only, and
      the asymmetry has to be visible on the screen rather than in a 400.
      **Moved here in AP 13 of phase 3**, out of the phase-3 list: an answer
      that also has to arrive as a mail (F172) cannot carry an attachment, so
      the asymmetry is the decision rather than a gap in it.

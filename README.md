# Trefaro

**Open-source whitelabel application for efficient event management and community building in non-profit organizations.**

Trefaro (German _"Treff"_ + Esperanto collective suffix _"-aro"_ — "a collection of gatherings") helps small NGOs plan and run event series on a minimal budget while building lasting communities around them: event series & program management, registrations with double opt-in, participant overview, direct messaging and real-time chat, profiles with privacy-first search, push notifications — all fully rebrandable (colors, logo, font) and extensible through a plug-in architecture.

Every organization runs its **own instance** (Docker Compose, 5 containers). No multi-tenancy, no third-party trackers, no Google services — designed for organizations that handle sensitive activist data.

## Status

🚧 **Feature-complete for v1.0 — not tagged.** The concept is based on a master's thesis (empirical requirements analysis with NGOs, 2024). All five phases are built and verified; what is deliberately still open is at the end of this section, and the tag itself is a human step that has not been taken.

**Phase 0** built the foundation: the monorepo, the strictly layered server, the
plug-in mechanism on both sides, the container stack, the CI, and the four
architecture spikes the thesis left open — see
[`docs/spikes/`](docs/spikes/README.md).

**Phase 1 is complete** (28.08.2026): event series and events, the public start
page and event landing page, registration with double opt-in and a configurable
field kit including file upload, the participant overview, programme planning with
per-session sign-up, the event dashboard, follow-up text and external media links,
invitations to former participants — and administrator accounts with a login in
front of all of it. An organization can run its event work on an instance today.
The record, decision by decision, is in [`docs/PHASE1.md`](docs/PHASE1.md).

**Phase 2 is complete** (29.08.2026): an instance carries the organization's
name, colours, logo and app icon, switches its optional modules and plug-ins on
and off, walks an operator through its own first-run setup (with TLS as a compose
overlay), and installs on a phone as a PWA. Every sentence in both clients and in
every mail is **data the instance serves**, not strings baked into a client — so
an organization can correct a word, or add a language, without rebuilding
anything: the administration lists every language with how far it is translated,
edits it key by key beside the English original, takes a translation file out and
back in again, and decides separately which languages visitors may choose. Event
titles, descriptions and programmes get translations of their own. The record is
in [`docs/PHASE2.md`](docs/PHASE2.md).

**Phase 3 is complete** (04.09.2026): the community half. Somebody who has been to
an event can now make an account of their own — double opt-in, like a
registration — keep a profile with an avatar and the questions this organization
asks, decide whether they may be found at all, and see and cancel their
registrations without waiting for the mailed link. Those who opt in can be found
by name, place or field of work, and written to: one-to-one conversations with
pictures, groups the organizer assembles from an event's confirmed registrations,
delivered live over a WebSocket and by push notification to whoever is not
watching. An interested person with no account reaches the organizers from the
event page, and their answer arrives as ordinary mail. Organizers read and answer
all of it on a screen of their own. And two smaller promises: a moved event
notifies the phones that care about it, and an address can ask for news without
registering for anything (opt-in administration only — Trefaro sends no
newsletters). The record is in [`docs/PHASE3.md`](docs/PHASE3.md).

**Phase 4 is complete** (10.09.2026): the plug-ins. Five of them ship in the
image, and each organization decides at runtime which of them it wants —
switched on they appear in both clients, switched off their API is a plain 404
and nothing in either client mentions them, and switching one off never loses a
row. Participants **propose sessions** for a programme and **discuss** an event
in a forum per event, with the organizer approving each contribution before it
is public — both moderated from the same event dashboard. Organizers **plan
rooms**: what happens where, with more sign-ups than chairs and two sessions in
one room at the same time shown as warnings and nothing refused, and the room
plan visible to participants. Everybody who registered gets a **QR code** of
their own on their self-service page, which the door reads with a camera or
takes typed in when there is none, and a second scan says "already here, since
…" rather than failing. And anybody with an account can put an event's sessions
into a **programme plan of their own**, in their own language, which reserves
nothing and says where reserving actually happens. The record, package by
package, is in [`docs/PHASE4.md`](docs/PHASE4.md).

**Phase 5 is complete** (01.10.2026): the hardening round — the part a visitor
notices least and an operator most. Somebody who forgets their password gets
back in; somebody who wants to leave takes their data with them and goes, and
what other people wrote stays and names nobody. The server stops refusing in
English: a rejection travels as a code with values and is drawn in the language
of the page. Every rate limit comes from the environment with today's numbers as
defaults, and an instance says out loud at startup when one has been raised.
Mail goes through a server that demands authentication and encryption — proven
against one that refuses anything else — while deliverability stays what it is,
the operator's DNS, with a checklist to match. Both clients were then measured
against what they promised: the participant client against the thesis mockups at
390 pixels, where three structural deviations were built back and six more are
deliberate and written down; the organizer client against being usable at 768,
where thirteen tables got a scroll frame of their own. A security review of
twenty-six points is recorded with a decision on each, the operational logs carry
no personal data, and the load figures stand with their setup and date. The
plug-in contract took its last step and is **frozen at 1.3.0** for v1.0. The
architecture got twelve [arc42 sections](docs/arc42/README.md) that repeat no
rule written elsewhere — including the plug-in SDK guide, proven by building a
sixth plug-in out of it alone and then deleting it. And CI grew the two jobs
that catch what no test suite can see: the five containers brought up from an
empty volume with a browser driven over them, and a mail server that refuses
anonymous and unencrypted submission. The record, package by package, is in
[`docs/PHASE5.md`](docs/PHASE5.md).

**Not released yet, and that is a decision.**
[`docs/RELEASE-v1.0.md`](docs/RELEASE-v1.0.md) (German) states what v1.0 would
rest on, what stays open, and what a tag would deliberately **not** claim — the
tag is a human step, not something a work package sets. What is open and why is
in [`todo.md`](todo.md): two known gaps, twenty-one questions only the pilot
partner can answer, six things that need a person or hardware rather than a work
package — push notifications on four real devices, a camera at a door, and the
usability test with the pilot partner, which is prepared and not held — six
things looked at, understood and deliberately not built, and one browser test
that flickers about once in three full runs, with a name and a narrowed-down
cause.

[`docs/INSTALL.md`](docs/INSTALL.md) installs an instance;
`docs/BOOTSTRAP.md` sets up a development environment.
[`docs/arc42/`](docs/arc42/README.md) (German) describes the architecture and is
the place to start reading.
`docs/Anforderungsanalyse_und_Umsetzungsplan.md` (German) holds the full
requirements analysis and implementation plan.
[`docs/rules/`](docs/rules/README.md) (German) collects the conventions and traps
of each area — read the file for an area before changing it; what is written
there has gone wrong at least once.

## Getting started

```bash
npm ci
cp .env.example .env
docker compose -f infra/docker-compose.dev.yml up -d   # PostgreSQL + Mailpit
npx nx run-many -t build -p 'plugin-*'                  # plug-in web components
npx nx run server:serve                                # http://localhost:3000/api
npx nx run user-client:serve                           # http://localhost:4200
npx nx run admin-client:serve                          # http://localhost:4300
```

The whole stack as it ships, five containers behind a reverse proxy:

```bash
docker compose --env-file .env -f infra/docker-compose.yml up -d --build
```

Fill it with something to look at — two series, five events, a form with all four
field types, forty registrations, a programme with a full session, an invitation
that really went out, and, since phase 5, the community half as well: ten
participant accounts with profiles (seven findable, three deliberately not),
conversations, a forum with a moderation queue still in it, programme proposals
in all four states, three rooms of which one is too small for its session, and
six people already through the door:

```bash
node tools/demo-seed/seed.mjs            # --reset replaces an earlier run
```

A fresh instance needs four values in `.env` before it will start:
`DATABASE_PASSWORD`, `AUTH_SECRET`, `SMTP_HOST` and `SMTP_FROM`. The first
administrator comes either from `ADMIN_BOOTSTRAP_EMAIL`/`ADMIN_BOOTSTRAP_PASSWORD`
(unattended) or from the guided first-run setup: leave both empty and the server
prints a one-off setup token, which the organizer client asks for at
`/admin/setup`. And put TLS in front of the proxy —
`-f infra/docker-compose.tls.yml` — because the session cookie is `Secure` in
production, so without HTTPS the login works on `localhost` only.

**[`docs/INSTALL.md`](docs/INSTALL.md) is the full installation guide**:
prerequisites, every value that matters, TLS, mail, backups, updating, and a
symptom table for when something does not work.

## Tech stack

Angular 22 (standalone, signals, zoneless) · NestJS 11 · TypeScript end-to-end ·
PostgreSQL + TypeORM · socket.io · Web Push (VAPID, self-hosted) · Angular
Elements for plug-ins · Nx monorepo · Docker Compose + NGINX

## Architecture in one paragraph

A strictly layered NestJS server (business layer over data-access layer — only the data-access layer touches the database) combined with a plug-in pattern on both server (dynamic modules with their own entities and migrations) and clients (framework-agnostic web components, themed via CSS custom properties). Two separate web clients: a mobile-first participant app (PWA) and a desktop-first organizer app. Core modules cover event management; five curated plug-ins — forum, programme proposals, room planning, QR check-in and a personal programme plan — ship in the image and are switched on per instance at runtime, against a contract frozen at `PLUGIN_API_VERSION` 1.3.0 for v1.0.

## Contributing

**Pull requests are not merged before v1.0 is tagged** — issues, bug reports,
installation trouble and translations are very welcome.
[`CONTRIBUTING.md`](CONTRIBUTING.md) says why, what a contribution will have to
bring afterwards, and how to build a plug-in without needing this repository at
all.

Found something that could expose the data of an instance? Not in an issue —
use GitHub's private vulnerability reporting on this repository.
[`SECURITY.md`](SECURITY.md) has the details, including what is the operator's
job rather than this project's.

## License

[AGPL-3.0-or-later](LICENSE)

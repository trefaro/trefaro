# Trefaro

**Open-source whitelabel application for efficient event management and community building in non-profit organizations.**

Trefaro (German _"Treff"_ + Esperanto collective suffix _"-aro"_ — "a collection of gatherings") helps small NGOs plan and run event series on a minimal budget while building lasting communities around them: event series & program management, registrations with double opt-in, participant overview, direct messaging and real-time chat, profiles with privacy-first search, push notifications — all fully rebrandable (colors, logo, font) and extensible through a plug-in architecture.

Every organization runs its **own instance** (Docker Compose, 5 containers). No multi-tenancy, no third-party trackers, no Google services — designed for organizations that handle sensitive activist data.

## Status

🚧 **Pre-alpha.** The concept is based on a master's thesis (empirical requirements analysis with NGOs, 2024). The paragraphs above describe the finished product; this section describes what exists.

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

**Not built yet:** whitelabel settings, module administration, runtime language
switching and the PWA polish (phase 2); participant login, profiles, messaging,
real-time chat and push (phase 3); the four curated plug-ins — programme
proposals, forum, room planning, QR check-in (phase 4). What is deferred and why
is in [`todo.md`](todo.md).

`docs/BOOTSTRAP.md` sets up a development environment.
`docs/Anforderungsanalyse_und_Umsetzungsplan.md` (German) holds the full
requirements analysis and implementation plan.

## Getting started

```bash
npm ci
cp .env.example .env
docker compose -f infra/docker-compose.dev.yml up -d   # PostgreSQL + Mailpit
npx nx build plugin-room-planning                      # plug-in web components
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
that really went out:

```bash
node tools/demo-seed/seed.mjs            # --reset replaces an earlier run
```

A fresh instance needs four values in `.env` before it will start, and a fifth
before anyone can log in: `DATABASE_PASSWORD`, `AUTH_SECRET`, `SMTP_HOST` and
`SMTP_FROM` — plus `ADMIN_BOOTSTRAP_EMAIL`/`ADMIN_BOOTSTRAP_PASSWORD`, which
create the first administrator while no administrator exists. Every route that
could create one requires a session, so without them the instance has no way in.
Remove both once a personal account exists. Note that the session cookie is
`Secure` in production: put TLS in front of the proxy, or the login works on
`localhost` only.

## Tech stack

Angular 22 (standalone, signals, zoneless) · NestJS 11 · TypeScript end-to-end ·
PostgreSQL + TypeORM · socket.io · Web Push (VAPID, self-hosted) · Angular
Elements for plug-ins · Nx monorepo · Docker Compose + NGINX

## Architecture in one paragraph

A strictly layered NestJS server (business layer over data-access layer — only the data-access layer touches the database) combined with a plug-in pattern on both server (dynamic modules with their own entities and migrations) and clients (framework-agnostic web components, themed via CSS custom properties). Two separate web clients: a mobile-first participant app (PWA) and a desktop-first organizer app. Core modules cover event management; community features like forums, program proposals, room planning and QR check-in ship as curated plug-ins that each organization can enable at runtime.

## License

[AGPL-3.0-or-later](LICENSE)

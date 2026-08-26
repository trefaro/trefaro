# Trefaro

**Open-source whitelabel application for efficient event management and community building in non-profit organizations.**

Trefaro (German _"Treff"_ + Esperanto collective suffix _"-aro"_ — "a collection of gatherings") helps small NGOs plan and run event series on a minimal budget while building lasting communities around them: event series & program management, registrations with double opt-in, participant overview, direct messaging and real-time chat, profiles with privacy-first search, push notifications — all fully rebrandable (colors, logo, font) and extensible through a plug-in architecture.

Every organization runs its **own instance** (Docker Compose, 5 containers). No multi-tenancy, no third-party trackers, no Google services — designed for organizations that handle sensitive activist data.

## Status

🚧 **Pre-alpha.** The concept is based on a master's thesis (empirical requirements analysis with NGOs, 2024).

Phase 0 is complete: the monorepo, the strictly layered server, the plug-in
mechanism on both sides, the container stack and the CI are in place, and the four
architecture spikes the thesis left open are built and verified — see
[`docs/spikes/`](docs/spikes/README.md). No event management features exist yet;
that is phase 1.

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

## Tech stack

Angular 22 (standalone, signals, zoneless) · NestJS 11 · TypeScript end-to-end ·
PostgreSQL + TypeORM · socket.io · Web Push (VAPID, self-hosted) · Angular
Elements for plug-ins · Nx monorepo · Docker Compose + NGINX

## Architecture in one paragraph

A strictly layered NestJS server (business layer over data-access layer — only the data-access layer touches the database) combined with a plug-in pattern on both server (dynamic modules with their own entities and migrations) and clients (framework-agnostic web components, themed via CSS custom properties). Two separate web clients: a mobile-first participant app (PWA) and a desktop-first organizer app. Core modules cover event management; community features like forums, program proposals, room planning and QR check-in ship as curated plug-ins that each organization can enable at runtime.

## License

[AGPL-3.0-or-later](LICENSE)

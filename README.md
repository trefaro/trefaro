# Trefaro

**Open-source whitelabel application for efficient event management and community building in non-profit organizations.**

Trefaro (German *"Treff"* + Esperanto collective suffix *"-aro"* — "a collection of gatherings") helps small NGOs plan and run event series on a minimal budget while building lasting communities around them: event series & program management, registrations with double opt-in, participant overview, direct messaging and real-time chat, profiles with privacy-first search, push notifications — all fully rebrandable (colors, logo, font) and extensible through a plug-in architecture.

Every organization runs its **own instance** (Docker Compose, 5 containers). No multi-tenancy, no third-party trackers, no Google services — designed for organizations that handle sensitive activist data.

## Status

🚧 **Pre-alpha.** The concept is based on a master's thesis (empirical requirements analysis with NGOs, 2024). Implementation is starting — see `docs/BOOTSTRAP.md` for the current phase and `docs/Anforderungsanalyse_und_Umsetzungsplan.md` (German) for the full requirements analysis and implementation plan.

## Tech stack

Angular (latest) · NestJS · TypeScript end-to-end · PostgreSQL + TypeORM · socket.io · Web Push (VAPID) · Nx monorepo · Docker Compose + NGINX

## Architecture in one paragraph

A strictly layered NestJS server (business layer over data-access layer — only the data-access layer touches the database) combined with a plug-in pattern on both server (dynamic modules with their own entities and migrations) and clients (framework-agnostic web components, themed via CSS custom properties). Two separate web clients: a mobile-first participant app (PWA) and a desktop-first organizer app. Core modules cover event management; community features like forums, program proposals, room planning and QR check-in ship as curated plug-ins that each organization can enable at runtime.

## License

[AGPL-3.0-or-later](LICENSE)

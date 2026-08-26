# BOOTSTRAP — Phase 0

**Status: abgeschlossen.** Die Erkenntnisprotokolle der vier Spikes stehen in
[`docs/spikes/`](spikes/README.md); die Abweichungen von der ursprünglichen
Anleitung sind unten unter _Was anders lief_ aufgeführt.

Diese Anleitung beschreibt, wie der Zustand des Repositorys entstanden ist, und
dient ab jetzt als Referenz für das Aufsetzen einer Entwicklungsumgebung.

## 0. Voraussetzungen

```bash
node -v          # Node LTS (>= 22; entwickelt und getestet mit 24)
npm -v
docker --version && docker compose version
git --version
```

## 1. Entwicklungsumgebung starten

```bash
git clone git@github.com:trefaro/trefaro.git
cd trefaro
npm ci
cp .env.example .env          # Die Vorgaben passen zum Dev-Stack

# Infrastruktur: PostgreSQL und Mailpit (fängt alle Mails ab, UI auf :8025)
docker compose -f infra/docker-compose.dev.yml up -d

# Plug-in-Bundles bauen — der Server liefert sie unter /api/plugins aus
npx nx build plugin-room-planning

# Server (Port 3000), Nutzer-Client (4200), Veranstalter-Client (4300)
npx nx run server:serve
npx nx run user-client:serve
npx nx run admin-client:serve
```

Der Server wendet seine Migrationen beim Start selbst an und legt die
Standardkonfiguration an. Die Dev-Server der Clients proxien `/api` und
`/socket.io` auf Port 3000 (siehe `apps/*/proxy.conf.json`), deshalb funktionieren
dieselben relativen URLs in Entwicklung und hinter dem Produktions-Proxy.

## 2. Struktur des Workspace

```
apps/
  user-client/          Nutzer-Client (mobile-first, installierbare PWA)
  admin-client/         Veranstalter-Client (desktop-first)
  server/               NestJS-Server
    src/app/core/               Konfiguration, Fehlerbehandlung, Health, WebSocket-Adapter
    src/app/business/           GESCHÄFTSLOGIK-SCHICHT
      plugin-api/               Plug-in-Vertrag (versioniert)
      plugin-manager/           aggregiert die kuratierten Plug-ins
      config/ login/ events/ …  Kernmodule
    src/app/data-access/        DATENZUGRIFF-SCHICHT (einzige Schicht mit DB-Zugriff)
    src/plugins/                kuratierte Server-Plug-ins
  plugins/room-planning/  Web-Component-Bundle des Raumplanungs-Plug-ins
  *-e2e/                  Playwright (Clients) bzw. Jest (API-Vertrag)
libs/
  shared-models/        Modelle, die Server und beide Clients teilen
  shared-http/          HTTP- und socket.io-Kommunikation
  shared-config/        Konfigurationsabfrage + Theming-Start
  shared-theming/       Whitelabel-Design über CSS Custom Properties
  shared-plugins/       Client-Plug-in-Manager und Einhängepunkt-Komponente
infra/                  Docker Compose, Dockerfiles, NGINX
tools/spike-verification/  ausführbare Prüfungen gegen eine laufende Instanz
```

Die Schichtentrennung im Server wird von ESLint erzwungen, nicht durch
Konvention: `business/**` darf `typeorm`, `@nestjs/typeorm` und `pg` nicht
importieren und nicht in `data-access/` greifen; `data-access/**` darf nur die
Ports der Geschäftslogik und den Plug-in-Vertrag sehen. Die Regeln stehen in
`apps/server/eslint.config.mjs`.

## 3. Qualitätssicherung

```bash
npx nx run-many -t lint test build     # 12 Projekte
npx nx run-many -t e2e --parallel=1    # Playwright (Chromium, Firefox, WebKit) + API-Vertrag
```

E2E braucht ein laufendes PostgreSQL; Server und Client-Dev-Server startet Nx
selbst als kontinuierliche Task-Abhängigkeiten.

## 4. Produktions-Stack (5 Container)

```bash
cp .env.example .env      # Secrets ausfüllen; PUBLIC_*_URL auf den Proxy zeigen
docker compose --env-file .env -f infra/docker-compose.yml up -d --build
node tools/spike-verification/verify-proxy.mjs
```

Nur der Reverse Proxy veröffentlicht einen Port (Standard 8080). Nutzer-Client
unter `/`, Veranstalter-Client unter `/admin/`, API unter `/api/`, WebSockets
unter `/socket.io/`.

## 5. Die vier Architektur-Spikes

Alle vier sind umgesetzt und verifiziert — Details, Erkenntnisse und offene
Punkte in [`docs/spikes/`](spikes/README.md):

1. **Client-Plug-in** — Angular-Elements-Bundle (34 kB übertragen), zur Laufzeit
   geladen, ohne eigenes CSS, Theming über geerbte CSS Custom Properties.
2. **Server-Plug-in** — NestJS-DynamicModule mit eigener Entity und eigener
   Migration, per Konfiguration ohne Neustart aktivierbar (7 s gemessen).
3. **Web Push** — VAPID selbst gehostet; Serverseite verifiziert, Gerätetest auf
   Android und installierter iOS-PWA steht noch aus.
4. **WebSocket durch NGINX** — echter Upgrade (kein Long-Polling-Fallback) durch
   den Reverse Proxy, aus beiden Clients.

## Was anders lief als in der ursprünglichen Anleitung

- **Nx-Preset.** `create-nx-workspace --preset=apps` erzeugt ein
  TypeScript-Solution-Setup mit Project References, das `@nx/angular` nicht
  unterstützt (angular/angular#37276). Stattdessen wurde das klassische,
  `paths`-basierte Setup verwendet.
- **Kein Nx Cloud.** Das Template trägt trotz `--nxCloud=skip` eine
  `nxCloudId` ein. Sie wurde entfernt: Task-Metadaten sollen die Infrastruktur
  der Organisation nicht verlassen.
- **Eine fünfte geteilte Lib.** `libs/shared-plugins` für den Client-Plug-in-
  Manager und die Einhängepunkt-Komponente — die passten in keine der vier
  geplanten Libs.
- **`@angular/pwa` musste erst installiert werden**, dann funktionierte das
  Schematic im Nx-Workspace (es schreibt in `project.json`, nicht in eine
  `angular.json`).
- **`SERVER_PORT` statt `PORT`.** Vite und damit der Angular-Dev-Server lesen
  `PORT` ebenfalls; ein gemeinsames `PORT` verschob einen Client auf den
  Server-Port.
- **Ein PR pro Spike wurde nicht umgesetzt.** Die vier Spikes teilen den
  Plug-in-Vertrag und mussten gemeinsam existieren, um beurteilbar zu sein. Die
  Protokolle liegen trotzdem pro Spike vor.
- **Der TypeORM-Treiber wird explizit übergeben** (`driver: pg`), sonst fehlt er
  in der generierten Abhängigkeitsliste des Server-Images.

## Offene Entscheidung für Phase 1

**Wem gehört `program_item.room_id`?** Der Schemaentwurf in
`Anforderungsanalyse_und_Umsetzungsplan.md` lässt die Kerntabelle
`program_item` auf einen Raum verweisen, während die Architekturregeln Plug-ins
verbieten, Kerntabellen anzufassen. Beides gleichzeitig geht nicht. Details und
Optionen in [`docs/spikes/02-server-plugin.md`](spikes/02-server-plugin.md).

## Nächster Schritt

Phase 1 — Kern-MVP Eventmanagement (alle P1), siehe Kapitel 6 in
`Anforderungsanalyse_und_Umsetzungsplan.md`.

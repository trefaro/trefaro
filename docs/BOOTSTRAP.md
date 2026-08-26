# BOOTSTRAP — Phase 0 Schritt für Schritt

Diese Anleitung führt durch das Aufsetzen des Nx-Monorepos in diesem Ordner (`~/repos/trefaro`, WSL2). Sie ist für die Ausführung durch/mit Claude Code gedacht. Nach Abschluss existieren beide Angular-Apps, der NestJS-Server, die geteilten Libs, der Docker-Compose-Stack und die CI.

## 0. Voraussetzungen prüfen

```bash
node -v          # Node LTS (>= 22)
npm -v
docker --version && docker compose version
git --version
```

## 1. Git-Anbindung

Repo `trefaro/trefaro` auf GitHub anlegen (leer, ohne README — die Dateien kommen von hier). Dann:

```bash
cd ~/repos/trefaro
git init -b main
git remote add origin git@github.com:trefaro/trefaro.git
```

## 2. Nx-Workspace im bestehenden Ordner anlegen

`create-nx-workspace` legt normalerweise einen neuen Ordner an. Vorgehen: Workspace in einem Unterordner erzeugen und Inhalte hochziehen — oder direkt `nx init`-Pfad nutzen. Empfohlener Weg:

```bash
cd ~/repos
npx create-nx-workspace@latest trefaro-tmp --preset=apps --ci=skip --pm=npm
rsync -a trefaro-tmp/ trefaro/ && rm -rf trefaro-tmp
cd trefaro
```

(Die vorbereiteten Dateien — CLAUDE.md, docs/, infra/, LICENSE, .github/ — bleiben dabei erhalten; bei Konflikten mit .gitignore/README die vorbereiteten Versionen zusammenführen.)

## 3. Angular-Apps + NestJS-Server generieren

```bash
npx nx add @nx/angular
npx nx g @nx/angular:application apps/user-client   --style=scss --routing --standalone --e2eTestRunner=playwright
npx nx g @nx/angular:application apps/admin-client  --style=scss --routing --standalone --e2eTestRunner=playwright
npx nx add @nx/nest
npx nx g @nx/nest:application apps/server
```

Geteilte Libraries:

```bash
npx nx g @nx/js:library libs/shared-models   --bundler=tsc
npx nx g @nx/angular:library libs/shared-http
npx nx g @nx/angular:library libs/shared-config    # Konfigurations-/Modul-Abfrage
npx nx g @nx/angular:library libs/shared-theming   # CSS-Custom-Properties-Theming
```

Server-Grundpakete:

```bash
npm i @nestjs/typeorm typeorm pg @nestjs/config @nestjs/websockets @nestjs/platform-socket.io socket.io web-push nodemailer argon2 class-validator class-transformer
npm i -D @types/web-push @types/nodemailer
```

PWA für den Nutzer-Client:

```bash
npx nx g @angular/pwa:ng-add --project=user-client
```

## 4. Server-Struktur gemäß Architektur anlegen

Innerhalb `apps/server/src`:

```
app/
  core/                      # Querschnitt: Config-Laden, Logger, Fehler-Filter
  business/                  # GESCHÄFTSLOGIK-SCHICHT
    login/  config/  event-series/  events/  program/  registration/
    participants/  profiles/  profile-search/  chat/  mail/  push/  media-links/
    plugin-manager/          # aggregiert Server-Plug-ins (DynamicModules)
    plugin-api/              # Schnittstellen-Definitionen (Interfaces + Injection Tokens)
  data-access/               # DATENZUGRIFF-SCHICHT (einzige Schicht mit DB-Zugriff)
    entities/  repositories/  migrations/
    plugin-data-access/      # Manager für Plug-in-Entities/-Migrationen
plugins/                     # kuratierte Plug-ins (je ein DynamicModule)
  room-planning/  forum/  program-proposals/  qr-checkin/
```

Regeln: `business/*` importiert nie `typeorm`/`pg` direkt — nur Repository-Interfaces aus `plugin-api`/`data-access`-Abstraktionen. ESLint-Boundary-Regeln (Nx `enforce-module-boundaries`) entsprechend konfigurieren.

## 5. Docker-Stack

Entwürfe liegen bereit: `infra/docker-compose.dev.yml` (Postgres + Server + Clients im Dev-Modus) und `infra/nginx/trefaro.conf` (Reverse Proxy inkl. WebSocket-Upgrade). Produktions-Compose (`infra/docker-compose.yml`) mit 5 Containern folgt, sobald erste Builds stehen.

```bash
docker compose -f infra/docker-compose.dev.yml up -d postgres
```

## 6. CI

`.github/workflows/ci.yml` (Entwurf liegt bei): Lint → Unit-Tests → Builds → E2E (Playwright) auf PRs und main.

## 7. Die vier Architektur-Spikes (vor Feature-Arbeit!)

1. **Client-Plug-in:** Minimale Angular-Elements-Webkomponente bauen, vom Plug-in-Manager-Service zur Laufzeit laden, Theming per CSS Custom Properties durchreichen, in Navigationsleiste + Event-Detailansicht einhängen.
2. **Server-Plug-in:** NestJS-DynamicModule mit eigener TypeORM-Entity + eigener Migration, registriert über plugin-manager; aktivierbar/deaktivierbar per Konfiguration.
3. **Web-Push Ende-zu-Ende:** VAPID-Keys, Subscription im Service Worker des Nutzer-Clients, Versand vom Server; auf Android-Browser und iOS (installierte PWA) testen.
4. **WebSocket durch NGINX:** socket.io-Chat-Echo durch den Reverse Proxy (Upgrade-Header), aus beiden Clients.

Jeden Spike als kleiner PR mit kurzem Erkenntnis-Protokoll in `docs/spikes/`.

## 8. Erster Push

```bash
git add -A
git commit -m "chore: bootstrap nx workspace with apps, libs, infra and docs"
git push -u origin main
```

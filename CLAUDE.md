# CLAUDE.md — Projektgedächtnis Trefaro

## Was ist Trefaro?

**Trefaro** (deutsch „Treff" + Esperanto-Sammelsuffix „-aro" = „Sammlung von Treffen" ≙ Veranstaltungsreihe) ist eine **Open-Source-Whitelabel-Anwendung für effizientes Eventmanagement und Community-Bildung in gemeinnützigen Organisationen**. Grundlage ist die Masterthesis von Marius Schulze (WBH, 2024), die per Mixed-Methods-Forschung (Experteninterviews bei Democracy International e.V. + Online-Umfrage mit 42 Teilnehmenden) Anforderungen, Architektur und Design empirisch hergeleitet hat.

Zielgruppe: kleine NGOs (meist < 20 Mitarbeitende, sehr begrenztes Budget), die Veranstaltungsreihen planen/durchführen und langfristige Communities aufbauen wollen. **Jede Organisation betreibt ihre eigene Instanz** (kein Multi-Tenant — Datenschutzentscheidung der Thesis).

**Die maßgebliche Referenz ist `docs/Anforderungsanalyse_und_Umsetzungsplan.md`** — dort stehen alle 16 Use Cases, alle funktionalen Anforderungen mit Prioritäten (P1/P2/P3), alle 15 nicht-funktionalen Anforderungen, das Datenbankschema, das Entscheidungsprotokoll (F1–F20) und der Phasenplan. Bei Detailfragen immer dort nachschlagen. Original-Diagramme der Thesis liegen in `docs/thesis/`.

## Kommunikation & Konventionen

- Mit Marius auf **Deutsch** kommunizieren. Code, Bezeichner, Kommentare und Commit-Messages auf **Englisch**.
- **Conventional Commits** (`feat:`, `fix:`, `docs:`, `chore:`, …).
- Jedes Feature mit Unit-Tests; E2E mit Playwright.
- Lizenz: **AGPL-3.0-or-later**. Keine Abhängigkeiten mit inkompatiblen Lizenzen einführen.
- npm-Scope: `@trefaro`. GitHub: `github.com/trefaro/trefaro`.

## Festgelegter Tech-Stack (nicht ohne Rücksprache ändern)

| Bereich    | Entscheidung                                                                                                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Monorepo   | **Nx** — `apps/user-client`, `apps/admin-client`, `apps/server`, `libs/shared-*`                                                                                               |
| Frontend   | **Angular (neueste Major-Version, aktuell 22)**, Standalone Components, Signals, SCSS; **zwei getrennte Apps** (Nutzer-Client mobile-first, Veranstalter-Client desktop-first) |
| PWA        | Nutzer-Client ab v1 installierbare PWA (`@angular/pwa`)                                                                                                                        |
| Server     | **NestJS** (Node LTS, TypeScript)                                                                                                                                              |
| ORM / DB   | **TypeORM** auf **PostgreSQL**; Migrationen versioniert; `JSONB` für konfigurierbare Felder                                                                                    |
| Echtzeit   | **socket.io** über NestJS Gateways (Chat: 1:1 + Gruppen, inkl. Bildaustausch)                                                                                                  |
| Push       | **Web Push API** (VAPID, Service Worker), selbst gehostet — kein Firebase                                                                                                      |
| E-Mail     | SMTP-Server der Organisation (konfigurierbar), mehrsprachige Templates, signierte Double-Opt-In-Links                                                                          |
| i18n       | UI: **Transloco** (Laufzeitwechsel, von Organisationen pflegbare Sprachdateien); Inhalte: Übersetzungstabellen (`*_translation`)                                               |
| Karten     | **OpenStreetMap/Leaflet** — niemals Google-Dienste (Datenschutz-NFR!)                                                                                                          |
| Deployment | **Docker Compose, 5 Container**: user-client, admin-client, server, postgres, **NGINX** (Reverse Proxy, muss WebSockets proxien)                                               |
| CI         | GitHub Actions: Lint, Unit, E2E, Docker-Builds                                                                                                                                 |

## Architektur-Regeln (aus der Thesis, verbindlich)

1. **Schichtenarchitektur im Server (Strict Layering):** Geschäftslogik-Schicht (API-Controller, Services, Plug-in-Manager, Schnittstellen-Definitionen) → Datenzugriff-Schicht (Repositories, Datenzugriff-Plug-in-Manager) → DB. **Nur die Datenzugriff-Schicht spricht mit PostgreSQL.** Geschäftslogik kennt keine DB-Spezifika (DB-Wechsel muss allein durch Austausch der Datenzugriff-Schicht möglich bleiben).
2. **Plug-in-Muster (Server):** Ein Server-Plug-in ist ein NestJS-DynamicModule und liefert drei Teile gegen definierte Interfaces: API-Implementierung, Geschäftslogik-Implementierung, Datenzugriff-Implementierung (eigene Entities + eigene Migrationen; Kerntabellen werden nie angefasst). Plug-in-Manager aggregieren zur Laufzeit. Schnittstellen früh stabilisieren und nur versioniert ändern.
3. **Plug-in-Muster (Clients):** Client-Plug-ins sind **Web Components** (eigene via Angular Elements; fremde framework-unabhängig möglich). Sie bringen **kein eigenes CSS** mit — das Whitelabel-Design wird über **CSS Custom Properties** durchgereicht. Einhängepunkte: Navigationsleiste + Event-Detailansicht. Der Plug-in-Manager-Service lädt Bundles dynamisch nach Konfigurationsabfrage.
4. **Client-Start-Sequenz:** Jeder Client lädt beim Start zuerst die Konfiguration (Design + aktivierte Module) vom Konfigurations-Modul, wendet das Theming an und lädt dann die Plug-in-Webkomponenten.
5. **Kernmodule (Server):** Login, Konfiguration, Veranstaltungsreihen, Event, Programm, Registrierung, Teilnehmer, Profil, Profil-Suche, Chat, E-Mail, Push-Benachrichtigungen, Medien-Links (nur externe Stream-/Mediathek-URLs, kein Upload/Transcoding). **Plug-ins:** Raumplanung, Diskussionsforum, Programmvorschläge, QR-Code-Check-In, (optional) Individueller Programmplan.
6. **Plug-in-Distribution v1:** kuratierte Plug-ins sind im Image enthalten und werden zur **Laufzeit per Konfiguration aktiviert/deaktiviert**. Keine Fremdinstallation zur Laufzeit.
7. **Geteilte Client-Libs:** HTTP-Kommunikation, Umgebungskonfiguration, Design-/Modul-Abfrage, Models. Client-Code nach MVC-Gedanken strukturieren (Models wiederverwendbar über Ansichten).

## Produktregeln, die nicht verloren gehen dürfen

- Startseite (Veranstaltungsreihen) und Event-Landingpage sind **ohne Login** erreichbar; sensible Daten (Teilnehmerinfos, Interaktionen) **nur nach Login**.
- Kontaktaufnahme mit dem Veranstalter ist **auch ohne Registrierung** möglich; die Antwort an Interessenten ohne Account geht **per E-Mail** raus.
- Registrierung immer mit **Double-Opt-In** (signierter Bestätigungslink) + Aufforderung zur Profilerstellung; Registrierungsformular hat einen **Feld-Baukasten** (Text, Auswahl, Checkbox, **Datei-Upload** — z. B. Visa-Dokumente).
- **Teilnehmerübersicht muss die E-Mail-Adresse direkt in der Tabelle zeigen** (einzige Korrektur aus dem Usability-Test der Thesis).
- Profile sind in der Teilnehmersuche nur mit explizitem **Opt-in** (`searchable`) auffindbar — Aktivisten-Datenschutz.
- Programmpunkt-Anmeldungen (FR 3.10) speisen die **Überbuchungserkennung** gegen Raum-Kapazitäten (Raumplanungs-Plug-in).
- Mehrsprachigkeit: Englisch + Landessprache Pflicht; **neue Sprachen müssen durch die Organisation pflegbar** sein (kein Compile-Time-only-i18n).
- Whitelabel: Primär- + Akzentfarbe (mit berechneten Abstufungen), Logo, Schriftart — Änderung wirkt sofort auf beide Clients und alle Plug-ins. Fonts lokal hosten (kein Google-Fonts-CDN).
- Diskussionsforum und Programmvorschläge haben einen **Freigabe-Workflow** (Veranstalter moderiert vor Veröffentlichung), bei minimalem Moderationsaufwand.
- Gamification ist bewusst **nicht** Teil des Kerns (Umfrage: niedrigste Priorität).
- Kein integriertes Newsletter-Versand-Modul in v1 (nur Double-Opt-In-Verwaltung).

## Prioritäten-Kompass (Umfrageergebnisse)

Wichtigste Funktionen laut Empirie: Teilnehmerübersicht (3,86/4) > Nachhaltigkeit (3,83) > intuitive Bedienung (3,76) > Info-Darstellung für Teilnehmende (3,74) > Registrierung (3,69). Eventmanagement (Ø 3,39) rangiert vor Community-Bildung (Ø 2,89) — im Zweifel zuerst die Eventmanagement-Funktionalität fertigstellen. Vollständige P1/P2/P3-Tabellen im Plan-Dokument.

## Phasenplan (Kurzform — Details in docs/)

0. Setup + Spikes (Plug-in Client/Server, Web-Push, WebSocket-durch-NGINX) → `docs/BOOTSTRAP.md`
1. Kern-MVP Eventmanagement (alle P1)
2. Whitelabel-Theming, Modul-Verwaltung, i18n, PWA, Installations-Story
3. Profile, Nachrichten, Echtzeit-/Gruppenchat, Push, Profilsuche
4. Plug-ins: Programmvorschläge, Forum, Raumplanung, QR-Check-In
5. Härtung, Usability-Test mit Democracy International (Pilotpartner), Doku, Release v1.0

## Stand nach Phase 0 (abgeschlossen)

Monorepo, Server mit erzwungener Schichtentrennung, Plug-in-Mechanik auf beiden
Seiten, 5-Container-Stack und CI stehen; alle vier Spikes sind verifiziert
(`docs/spikes/`). Fachlich existiert noch nichts — das ist Phase 1.

Entscheidungen aus Phase 0, die nicht erneut aufgerollt werden sollten:

- **`SERVER_PORT`, nicht `PORT`** — Vite/Angular-Dev-Server lesen `PORT` auch mit
  und würden auf den Serverport wandern.
- **Kein Nx Cloud.** Task-Metadaten verlassen die Infrastruktur der Organisation
  nicht.
- **Plug-in-Aktivierung zur Laufzeit** heißt: alle kuratierten Plug-ins sind
  gemountet und ihre Tabellen existieren immer; das `module_config`-Flag steuert,
  ob die API antwortet (sonst 404) und ob die Clients davon erfahren. Der
  Registry-Cache wird alle 15 s neu gelesen.
- **Layer-Grenzen sind ESLint-Regeln** in `apps/server/eslint.config.mjs`, keine
  Konvention. Bei Verstoß nicht die Regel lockern, sondern einen Port einziehen.
- **Deaktivieren löscht nie Daten.** Nur `down`-Migrationen entfernen Tabellen.
- **`libs/shared-plugins`** ist eine fünfte geteilte Lib über die vier im
  Ursprungsplan hinaus (Client-Plug-in-Manager + Einhängepunkt-Komponente).
- **`tools/spike-verification/`** prüft eine _laufende_ Instanz; `*-e2e` prüft im
  CI. Beides bewusst getrennt.

**Offene Entscheidung vor Phase 1:** Wem gehört `program_item.room_id`? Der
Schemaentwurf lässt die Kerntabelle auf einen Raum verweisen, die
Architekturregeln verbieten Plug-ins den Zugriff auf Kerntabellen. Optionen in
`docs/spikes/02-server-plugin.md`.

## Betriebskontext

Entwicklung: lokal in WSL2 (dieser Ordner), Docker via Docker Desktop (WSL2-Backend) oder docker-ce. Zielbetrieb: eigener Linux-Server der Organisation, identische Container. Compose-Dateien und Dockerfiles unter `infra/`, CI unter `.github/workflows/ci.yml` (Qualität, E2E gegen echte DB und Browser, Image-Builds).

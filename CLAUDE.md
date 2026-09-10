# CLAUDE.md — Projektgedächtnis Trefaro

## Was ist Trefaro?

**Trefaro** (deutsch „Treff" + Esperanto-Sammelsuffix „-aro" = „Sammlung von
Treffen" ≙ Veranstaltungsreihe) ist eine **Open-Source-Whitelabel-Anwendung für
effizientes Eventmanagement und Community-Bildung in gemeinnützigen
Organisationen**. Grundlage ist die Masterthesis von Marius Schulze (WBH, 2024),
die per Mixed-Methods-Forschung (Experteninterviews bei Democracy International
e.V. + Online-Umfrage mit 42 Teilnehmenden) Anforderungen, Architektur und Design
empirisch hergeleitet hat.

Zielgruppe: kleine NGOs (meist < 20 Mitarbeitende, sehr begrenztes Budget), die
Veranstaltungsreihen planen/durchführen und langfristige Communities aufbauen
wollen. **Jede Organisation betreibt ihre eigene Instanz** (kein Multi-Tenant —
Datenschutzentscheidung der Thesis).

## Wo das Wissen liegt

Dieses Dokument ist die **Kurzfassung** — nur, was in jeder Sitzung gilt. Die
Detailregeln stehen bewusst woanders, damit sie nicht bei jedem Start mitgelesen
werden müssen:

| Frage                                                     | Nachschlagen in                                                                           |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Anforderungen, Use Cases, Prioritäten, DB-Schema, F1–F202 | **`docs/Anforderungsanalyse_und_Umsetzungsplan.md`** (maßgeblich)                         |
| Was in einer Phase passierte, E1–E45, _Was anders lief_   | `docs/PHASE1.md`, `docs/PHASE2.md`, `docs/PHASE3.md`, `docs/BOOTSTRAP.md`, `docs/spikes/` |
| Phase 4: Pakete, E46–E59, F186–F202, Stand je Paket       | **`docs/PHASE4.md`** (Plan oben, _Fortschritt_ unten)                                     |
| Installation, TLS, Betrieb                                | `docs/INSTALL.md`                                                                         |
| Offene Punkte, bekannte Lücken, Pilotpartner-Fragen       | `todo.md` (nach Phase gruppiert, nach jeder Phase durchgehen)                             |
| Diagramme der Thesis                                      | `docs/thesis/`                                                                            |
| **Regeln, die man beim Bauen braucht**                    | **`docs/rules/`** (Index in `docs/rules/README.md`)                                       |

`docs/rules/` ist das Destillat: zwölf Dateien, je eine pro Bereich — Schichten
und Ports, Verträge der Endpunkte, Datenmodell, Mail, i18n, Angular-Fallen,
E2E-Tests, Whitelabel/PWA, Deployment, Infrastruktur, Werkzeug-Fallen,
bestätigte Entscheidungen. Kurz gesagt: **was dort steht, ist schon einmal
schiefgegangen.** Vor der Arbeit an einem dieser Bereiche die zugehörige Datei
lesen.

Fünf Teilbäume tragen dafür eine eigene kurze `CLAUDE.md`, die nur auf die
passenden Regeldateien zeigt: `apps/server/`, `apps/admin-client/`,
`apps/user-client/`, `infra/`, `tools/`.

**Neu gelernte Regeln kommen nach `docs/rules/`, nicht in dieses Dokument**, und
**der Stand eines Arbeitspakets in sein Phasenprotokoll.** Hier landet nur, was
jede Sitzung braucht — ein fertiges Paket bekommt deshalb keinen Absatz, sondern
höchstens eine Zeile in der Phasenliste unten. Die Aufnahmebedingung für eine
Regel steht in `docs/rules/README.md`.

## Kommunikation & Konventionen

- **Mit Marius auf Englisch kommunizieren** (so von ihm festgelegt am
  03.09.2026 — vorher war es Deutsch). Code, Bezeichner, Kommentare und
  Commit-Messages waren und bleiben **Englisch**; die Dokumentation dieses
  Repositories bleibt **Deutsch**, denn sie gehört zur Thesis
  (`docs/`, `todo.md` und dieses Dokument).
- **Conventional Commits** (`feat:`, `fix:`, `docs:`, `chore:`, …).
- Jedes Feature mit Unit-Tests; E2E mit Playwright.
- Lizenz: **AGPL-3.0-or-later**. Keine Abhängigkeiten mit inkompatiblen Lizenzen.
- npm-Scope: `@trefaro`. GitHub: `github.com/trefaro/trefaro` (über die `gh`-CLI).
- **Marius gibt jedes Arbeitspaket einzeln frei** — nach einem Paket berichten und
  warten, nicht unaufgefordert weitermachen.

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

1. **Schichtenarchitektur im Server (Strict Layering):** Geschäftslogik
   (API-Controller, Services, Plug-in-Manager, Schnittstellen) → Datenzugriff
   (Repositories, Datenzugriff-Plug-in-Manager) → DB. **Nur die
   Datenzugriff-Schicht spricht mit PostgreSQL**; ein DB-Wechsel muss allein
   durch Austausch dieser Schicht möglich bleiben. Durchgesetzt als ESLint-Regeln
   — bei Verstoß **einen Port einziehen, nie die Regel lockern**.
2. **Plug-in-Muster (Server):** ein NestJS-`DynamicModule` mit drei Teilen gegen
   definierte Interfaces (API, Geschäftslogik, Datenzugriff), eigenen Entities und
   eigenen Migrationen; **Kerntabellen werden nie angefasst**. Plug-in-Manager
   aggregieren zur Laufzeit; Schnittstellen nur versioniert ändern.
3. **Plug-in-Muster (Clients):** Client-Plug-ins sind **Web Components** und
   bringen **kein eigenes CSS** mit — das Whitelabel-Design kommt über **CSS
   Custom Properties**. Einhängepunkte: Navigationsleiste + Event-Detailansicht.
4. **Client-Start-Sequenz:** zuerst die Konfiguration (Design + aktivierte
   Module) laden, dann das Theming anwenden, dann die Plug-in-Webkomponenten.
5. **Kernmodule (Server):** Login, Konfiguration, Veranstaltungsreihen, Event,
   Programm, Registrierung, Teilnehmer, Profil, Profil-Suche, Chat, E-Mail,
   Push, Medien-Links (nur externe Stream-/Mediathek-URLs, kein Upload/
   Transcoding). **Plug-ins:** Raumplanung, Diskussionsforum,
   Programmvorschläge, QR-Code-Check-In — und seit 04.09.2026 fest dazu, nicht
   mehr optional: Individueller Programmplan (FR 3.17).
6. **Plug-in-Distribution v1:** kuratierte Plug-ins sind im Image enthalten und
   werden zur Laufzeit per Konfiguration aktiviert/deaktiviert. Keine
   Fremdinstallation zur Laufzeit; Deaktivieren löscht nie Daten.
7. **Geteilte Client-Libs:** HTTP, Umgebungskonfiguration, Design-/Modul-Abfrage,
   Models — dazu `shared-plugins`, `shared-i18n` und (seit AP 6 der Phase 4)
   `shared-plugin-kit` für die Bündel. Client-Code nach
   MVC-Gedanken strukturieren (Models über Ansichten wiederverwendbar).

## Produktregeln, die nicht verloren gehen dürfen

- Startseite (Veranstaltungsreihen) und Event-Landingpage sind **ohne Login**
  erreichbar; sensible Daten (Teilnehmerinfos, Interaktionen) **nur nach Login**.
- Kontaktaufnahme mit dem Veranstalter ist **auch ohne Registrierung** möglich;
  die Antwort an Interessenten ohne Account geht **per E-Mail** raus.
- Registrierung immer mit **Double-Opt-In** (signierter Bestätigungslink) +
  Aufforderung zur Profilerstellung; das Registrierungsformular hat einen
  **Feld-Baukasten** (Text, Auswahl, Checkbox, **Datei-Upload** — z. B. Visa).
- **Die Teilnehmerübersicht zeigt die E-Mail-Adresse direkt in der Tabelle**
  (einzige Korrektur aus dem Usability-Test der Thesis).
- Profile sind in der Teilnehmersuche nur mit explizitem **Opt-in**
  (`searchable`) auffindbar — Aktivisten-Datenschutz.
- Programmpunkt-Anmeldungen (FR 3.10) speisen die **Überbuchungserkennung**
  gegen Raum-Kapazitäten (Raumplanungs-Plug-in).
- Mehrsprachigkeit: Englisch + Landessprache Pflicht; **neue Sprachen müssen
  durch die Organisation pflegbar** sein (kein Compile-Time-only-i18n).
- Whitelabel: Primär- + Akzentfarbe (mit berechneten Abstufungen), Logo,
  Schriftart — Änderung wirkt sofort auf beide Clients und alle Plug-ins. Fonts
  lokal hosten (**kein Google-Fonts-CDN**).
- Diskussionsforum und Programmvorschläge haben einen **Freigabe-Workflow**
  (Veranstalter moderiert vor Veröffentlichung), bei minimalem Aufwand.
- Gamification ist bewusst **nicht** Teil des Kerns (Umfrage: niedrigste
  Priorität). Kein integriertes Newsletter-Versand-Modul in v1 (nur
  Double-Opt-In-Verwaltung).
- **Löschen ist die Ausnahme, Archivieren die Regel.** Externe Medien werden
  verlinkt, nie eingebettet (kein fremder Code auf einer Seite, die das Gegenteil
  verspricht).

## Prioritäten-Kompass (Umfrageergebnisse)

Teilnehmerübersicht (3,86/4) > Nachhaltigkeit (3,83) > intuitive Bedienung
(3,76) > Info-Darstellung für Teilnehmende (3,74) > Registrierung (3,69).
Eventmanagement (Ø 3,39) rangiert vor Community-Bildung (Ø 2,89) — im Zweifel
zuerst die Eventmanagement-Funktionalität fertigstellen. Vollständige
P1/P2/P3-Tabellen im Plan-Dokument.

## Phasenplan und Stand

0. **✅** Setup + Spikes (Plug-in Client/Server, Web-Push, WebSocket durch NGINX)
   → `docs/BOOTSTRAP.md`, `docs/spikes/`
1. **✅ 28.08.2026, M2** Kern-MVP Eventmanagement (alle P1) → `docs/PHASE1.md`
   (offen geblieben: die Feedbackrunde mit Democracy International)
2. **✅ 29.08.2026, M5** Whitelabel-Theming, Modul-Verwaltung, i18n, PWA,
   Installations-Story → `docs/PHASE2.md`; im _Nachtrag_ dort auch das
   Zwischenpaket vom 01.09.2026, **das Logo je Reihe und Event** (F113–F117)
3. **✅ 04.09.2026** Profile, Nachrichten, Echtzeit-/Gruppenchat, Push,
   Profilsuche → `docs/PHASE3.md` — dreizehn Pakete, je eines mit einem
   Abschnitt unter _Fortschritt_, dazu ein phasenweites _Was anders lief_.
   **Meilenstein M8 ist erreicht bis auf die Gerätematrix**, die nur mit Geräten
   in der Hand abzuhaken ist
4. **In Arbeit** (Plan 04.09.2026) Plug-ins: Programmvorschläge, Forum,
   Raumplanung, QR-Check-In und **individueller Programmplan** →
   `docs/PHASE4.md` (zehn Pakete, M9–M12). **AP 1 bis AP 3 erledigt am
   07.09.2026:** der Plug-in-Vertrag steht auf **1.2.0** (der eine Schritt
   dieser Phase), Icons und Worte kommen aus der Instanz, und die
   Programmvorschläge stehen vollständig — Server, Bündel und beide Clients,
   mit dem dritten Einhängepunkt `event-dashboard`. **Meilenstein M9 ist
   erreicht.** **AP 4 und AP 5 erledigt am 08.09.2026:** das
   Diskussionsforum steht vollständig — Server (Threads, Beiträge, Freigabe je
   Beitrag, kein Status am Thread, F195), Bündel und beide Clients; am
   Dashboard stehen zwei Plug-in-Kacheln nebeneinander. **AP 6 erledigt am
   08.09.2026:** die Raumplanung ist echt — Ändern und Löschen, der Plan mit
   beiden Warnungen (E50: gezeigt, nichts abgelehnt), der öffentliche Raumplan,
   der Editor als dritte Kachel am Dashboard; der Port liest seit AP 6 die
   Sessions eines Events mit Titel (E56, vorgezogen), und die drei Bündel
   teilen ihre Helfer über `shared-plugin-kit`. **Meilenstein M10 ist
   erreicht.** **AP 7 und AP 8 erledigt am 09.09.2026:** der QR-Check-In
   steht — Server (`PluginRegistrationReads` als dritter Host-Port, eine eigene
   Eintrittskarte je Anmeldung, drei Controller für drei Zugangsstufen, zweimal
   200 auf denselben Code) und beide Bildschirme: der vierte Einhängepunkt
   `my-registration` mit dem QR-Code, schwarz auf weiß im Browser gezeichnet
   (E54), und die Tür am Dashboard mit Kamera, Eingabefeld und einem Knopf je
   Zeile (F199). **Meilenstein M11 ist erreicht.** **AP 9 erledigt am
   10.09.2026:** der individuelle Programmplan steht, Server und Bündel in
   einem Paket — eine Tabelle, ein Controller, eine Zielgruppe, und das
   fünfte Bündel am `event-detail`. Damit stehen **alle fünf** kuratierten
   Plug-ins; der Vertrag hat dafür genau ein Feld dazubekommen
   (`registrationEnabled`, E55) und einen geplanten Parameter **nicht** (F200).
   **AP 10 ist nicht freigegeben.**
5. Härtung, Usability-Test mit Democracy International (Pilotpartner), Doku,
   Release v1.0 — hier auch: konfigurierbare Drosselung, `CONTRIBUTING.md`

**Der Stand in Zahlen:** Entscheidungen **E1–E59** vergeben (E46–E59 im Plan der
Phase 4); Nachträge **F1–F195**, **F197–F202** stehen im Referenzdokument
(F62 und F129–F131 bleiben unvergeben), **F196** ist reserviert — es gehört zu
AP 6 und ist dort nicht geschrieben worden (`todo.md`); Katalog **1080**
Schlüssel. Was in einem Paket tatsächlich passierte,
steht im Phasenprotokoll, und was man beim Bauen daraus braucht, in
`docs/rules/` — **hier nicht noch einmal.**

**Wo die offenen Punkte liegen:** in `todo.md`, nach Phase gruppiert und nach
jeder Phase durchgegangen. Zwei Abschnitte braucht man öfter als die anderen —
_On a device — waiting for Marius_ (was einen Produktionsbuild und echte Geräte
braucht, darunter die Gerätematrix aus Spike 3, von der F7 abhängt) und
_Questions for the pilot partner_ (was in diesem Repository niemand entscheiden
kann). Was zu einer späteren Phase gehört, steht in deren Abschnitt, nicht in
der Liste oben.

## Betriebskontext

Entwicklung: lokal in WSL2 (dieser Ordner), Docker via Docker Desktop
(WSL2-Backend) oder docker-ce. Zielbetrieb: eigener Linux-Server der
Organisation, identische Container. Compose-Dateien und Dockerfiles unter
`infra/`, CI unter `.github/workflows/ci.yml`.

Zwei Werkzeuge unter `tools/`, beide gegen eine _laufende_ Instanz:
`spike-verification/` prüft ein Deployment (Proxy, API, Plug-in-Schalter,
Admin-Zugang, Mail, Katalog, Push, Ersteinrichtung), `demo-seed/` füllt es mit
Demo-Daten — ausschließlich über die API. Alle Skripte nehmen die Adresse aus
`BASE`, die zwei mit Datenbankzugriff zusätzlich `POSTGRES_CONTAINER`. Der Seed
braucht Mailpit. **Wer „grün" sagen will, hat den Stack hochgefahren** — was nur
im Produktionsbuild oder nur im Containerbetrieb passiert, sieht keine Testsuite
dieses Repositories. Und **wer „grün" über die CI sagt, hat den Abschluss des
Laufs gelesen**, nicht den Rückgabewert eines Wartens
(`docs/rules/tooling-traps.md`).

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
| Anforderungen, Use Cases, Prioritäten, DB-Schema, F1–F112 | **`docs/Anforderungsanalyse_und_Umsetzungsplan.md`** (maßgeblich)                         |
| Was in einer Phase passierte, E1–E45, _Was anders lief_   | `docs/PHASE1.md`, `docs/PHASE2.md`, `docs/PHASE3.md`, `docs/BOOTSTRAP.md`, `docs/spikes/` |
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

**Neu gelernte Regeln kommen nach `docs/rules/`, nicht in dieses Dokument.** Hier
landet nur, was jede Sitzung braucht. Die Aufnahmebedingung steht in
`docs/rules/README.md`.

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
   Programmvorschläge, QR-Code-Check-In, (optional) Individueller Programmplan.
6. **Plug-in-Distribution v1:** kuratierte Plug-ins sind im Image enthalten und
   werden zur Laufzeit per Konfiguration aktiviert/deaktiviert. Keine
   Fremdinstallation zur Laufzeit; Deaktivieren löscht nie Daten.
7. **Geteilte Client-Libs:** HTTP, Umgebungskonfiguration, Design-/Modul-Abfrage,
   Models — dazu `shared-plugins` und `shared-i18n`. Client-Code nach
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
   Installations-Story → `docs/PHASE2.md`
3. **In Arbeit** (AP 1–AP 8 erledigt, M7 erreicht) Profile, Nachrichten,
   Echtzeit-/Gruppenchat, Push, Profilsuche → `docs/PHASE3.md`
4. Plug-ins: Programmvorschläge, Forum, Raumplanung, QR-Check-In
5. Härtung, Usability-Test mit Democracy International (Pilotpartner), Doku,
   Release v1.0 — hier auch: konfigurierbare Drosselung, `CONTRIBUTING.md`

**Das Logo je Reihe und Event ist gebaut** (01.09.2026, eigenes Arbeitspaket
zwischen den Phasen, so von Marius am 31.08.2026 terminiert) — die P1-Lücke aus
FR 2.1 und FR 3.1, die Phase 2 in AP 13 gefunden und eskaliert hatte. Protokoll
in `docs/PHASE2.md` unter _Nachtrag_, Entscheidungen **F113–F117**. Kurz:
`business/logo-files/` besitzt die Bytes, die beiden Entity-Services behalten
ihre 404-Regel, je Zeile eine pfadfreie Medienroute (`/api/media/series/:id/logo`,
`…/events/:id/logo`), eigener Teilbaum `logos/` mit `CHECK` auf beiden Spalten,
dieselben Uploadregeln wie das Branding. **Kein** Erben des Reihenlogos durch ein
Event (F114) und **kein** Statusfilter auf der Medienroute (F115) — beides
bewusst; die Begründungen stehen in `docs/rules/`. Katalog damals 646 → 654.

**Phase 3 läuft** (seit 02.09.2026): Plan in `docs/PHASE3.md`, dreizehn
Arbeitspakete, Entscheidungen **E31–E45**, Nachträge ab **F118** (vergeben:
F118–F128, F132, F137–F164; F129–F131 und F133–F136 bleiben unvergeben bzw.
reserviert). **AP 1 (Teilnehmerkonto und Login), AP 2 (Profil und
Feld-Baukasten), AP 3 (Login, Registrierung und Profil in beiden Clients,
**Meilenstein M6**), AP 4 (die Anmeldung kennt den Menschen), AP 5
(Profilsuche), AP 6 (Gespräche, Nachrichten und Bilder), AP 7 (Echtzeit,
**Meilenstein M7**) und AP 8 (Chat im Nutzer-Client) sind erledigt** —
Protokoll je Paket unter _Fortschritt_. Als nächstes AP 9:
Organisator-Kontakt ohne Registrierung (FR 3.4, UC 14, F11). Katalog **817**
Schlüssel.

Aus AP 4: die Selbstbedienung kennt zwei Ansprüche — das signierte Token aus der
Mail und die Sitzung, aufgelöst über die Adresse (F148) —, die
Teilnehmerübersicht hat ihre Profilspalte (F149) und **eine Mail spricht die
Sprache ihres Empfängers, samt Inhalt** (F125).

Aus AP 5: `business/profile-search/` mit zwei Lesezugriffen unter
`/api/participant/profiles`, und das Opt-in **kann nichts umgehen** — die SQL des
Ports trägt `searchable` und die Bestätigung, nicht der Aufrufer (F152).
`searchable` steht jetzt auf der Profilseite, aber nur wo eine Suche es liest
(F151, schließt F142); ein fremdes Profil trägt **keine Adresse** (F150); und ein
Modulschalter darf eine **Voraussetzung** haben, die er nie still auflöst
(F128) — `profile-search` braucht `profiles`; `chat` hat seine seit AP 6.

Aus AP 6: `business/chat/` mit sechs Endpunkten, und die Zugangsregel hat **zwei
Hälften** — ein Gespräch _beginnen_ fragt nach `searchable` (403 für alles
andere, wortgleich), alles danach fragt nur nach Mitgliedschaft, weil laufende
Gespräche bleiben (F157, E14). Zwei Menschen haben **genau ein** Gespräch, und
das garantiert ein eindeutiger `direct_key` statt der Geschäftslogik (F153); der
Verlauf paginiert als einzige Liste über einen **Cursor** (F154); das Bild einer
Nachricht ist ein `attachment` in `messages/`, weshalb
`GET /api/admin/attachments/:id` seither **nur** Anmeldungsdateien bedient
(F155); und `/api/media/messages/:id/attachment` ist die **einzige** Medienroute
mit Berechtigungsprüfung — Sitzung über `@RequiresParticipant()`, ein Dekorator,
der nur verschärfen kann (F156). `chat` ist als Modul zurück, mit `profiles` als
Voraussetzung — womit die zweite Hälfte des Abnahmekriteriums von AP 5 geprüft
ist.

Aus AP 7: **der Handshake ist die Tür** (F132) — die Prüfung hängt in einer
socket.io-Namensraum-Middleware, fragt Sitzung **und** `chat`-Schalter, und eine
Verbindung ohne Sitzung entsteht nicht. Dafür ist der Socket nach
**`/api/socket.io`** umgezogen (F160): das Sitzungscookie trägt `Path=/api`, also
reist es nirgends anders mit — `REALTIME_PATH` in `shared-models` ist die eine
Schreibweise für Server, beide Clients, Proxy und Prüfskript. Zwei Räume, zwei
Fragen (F161): der eines Gesprächs wird nur auf `chat:join` und nur von einem
Mitglied betreten, der eines Mitglieds am Handshake — daher `chat:message` für
den offenen Verlauf und `chat:conversation` für die Liste. Zugestellt wird von
einem **eigenen** Dienst, weil Gateway und Gespräche sonst einen Kreis bilden
(F162), und die Empfänger kommen **aus dem Schreiben** statt aus einer
Port-Methode, die „wer schreibt mit wem" für jede Id beantworten würde (F163).
`chat:echo` ist überall weg; `verify-chat.mjs` prüft stattdessen den Satz des
Abnahmekriteriums durch den Proxy. Offen daraus: **der Handshake trägt keine
Drosselung** (engine.io bedient ihn vor Nests Router) — Phase 5.

Aus AP 8: zwei Seiten (`/messages`, `/messages/:id`) hinter Sitzung **und**
`chat`-Schalter, der Weg hinein ist der Knopf auf dem fremden Profil (E37,
sein 403 ist eine Rücknahme und kein Fehler). Der **Socket gehört der
Sitzung**, nicht dem Bildschirm (F166) — sonst hieße E44s „sieht jemand zu?“
nur „ist der Chat offen?“; den Raum eines Gesprächs betritt allein die
Gesprächsansicht. Eine gesendete Nachricht kommt zweimal an (Antwort und
Socket) und wird über die Id einmal gezeichnet (F167); die Liste frischt bei
`chat:conversation` das **gezeigte Fenster** in einer Anfrage auf und mischt
über die Id (F170); die Uhrzeit einer Nachricht steht in der Zone ihres
**Lesers** (F168, die eine Ausnahme von E8); und der Verbindungszustand steht
auf beiden Seiten in einem Bauteil, das nie mehr behauptet, als es weiß
(F169 — dafür gibt der Client einen Handshake nach acht statt zwanzig
Sekunden auf). Neu am Server: **eine** Route, `GET
/api/participant/conversations/:id`, weil eine Gesprächsansicht sagen muss,
mit wem sie ist — der Port konnte die Frage schon (F165). `initialsOf` ist als
vierte Kopie ausgezogen (F138).

Fünf Punkte warten auf ein anderes Paket bzw. auf Marius: das **Storno über die
Sitzung** gehört zu AP 12 (F148), der **Purge der Bilder eines Gesprächs** zu
AP 10 (F158 nennt die Reihenfolge), die **Drosselung des Handshakes** zu
Phase 5; ob es eine geteilte Bibliothek für Oberflächenbauteile geben soll, ist
eine Stack-Entscheidung (F145), und ob die Navigationsleiste einen
**Ungelesen-Zähler** tragen soll, eine Produktfrage aus AP 8. Alles fünf in
`todo.md`.

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
dieses Repositories.

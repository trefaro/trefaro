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
1. Kern-MVP Eventmanagement (alle P1) → `docs/PHASE1.md`
2. Whitelabel-Theming, Modul-Verwaltung, i18n, PWA, Installations-Story
3. Profile, Nachrichten, Echtzeit-/Gruppenchat, Push, Profilsuche
4. Plug-ins: Programmvorschläge, Forum, Raumplanung, QR-Check-In
5. Härtung, Usability-Test mit Democracy International (Pilotpartner), Doku, Release v1.0

## Stand nach Phase 0 (abgeschlossen)

Monorepo, Server mit erzwungener Schichtentrennung, Plug-in-Mechanik auf beiden
Seiten, 5-Container-Stack und CI stehen; alle vier Spikes sind verifiziert
(`docs/spikes/`). Fachlich baut darauf Phase 1 auf — Stand unten.

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

- **Raumzuordnung von Programmpunkten = plug-in-eigene Join-Tabelle** (F21,
  entschieden 26.08.2026). `program_item` bekommt **kein** `room_id`. Noch nicht
  implementiert — steht in `todo.md` unter Phase 1. Begründung in
  `docs/spikes/02-server-plugin.md`.

**Offene Punkte** stehen in `todo.md`, nach der Phase gruppiert, ab der sie
prüfbar werden — nach jeder Phase durchgehen.

## Stand in Phase 1 (laufend, Stand 27.08.2026)

Plan und Protokoll: `docs/PHASE1.md` (Arbeitspakete AP 1–13, Entscheidungen
E1–E16, je Paket ein Abschnitt „erledigt" mit dem, was tatsächlich passierte).
Marius gibt jedes Paket einzeln frei — **nicht** ohne Aufforderung mit dem
nächsten anfangen.

Erledigt: **AP 1** Login, Admin-Zugänge, Guard über `/api/admin` · **AP 2**
Veranstaltungsreihen · **AP 3** Events und öffentliche Landingpage · **AP 4**
Registrierung mit Double-Opt-In und Mail-Modul · **AP 5** Teilnehmerübersicht
→ damit ist **M1** erreicht (Kernschleife lauffähig, erste Feedbackrunde mit
Democracy International fällig) · **AP 6** Feld-Baukasten (Text, Auswahl,
Ankreuzfeld) · **AP 7** Feldtyp Datei-Upload, `attachment`, Download nur für
Admins · **AP 8** Programmplanung, `program_item`, Timeline auf der Landingpage.
Als nächstes AP 9 (Programmpunkt-Anmeldung, Lese-Schnittstelle im
Plug-in-Vertrag, F21).

Regeln aus Phase 1, die nicht erneut aufgerollt werden sollten:

- **Der Admin-Schutz hängt am URL-Präfix** (E16), nicht an einem Dekorator: ein
  vergessenes `@UseGuards` in einem Plug-in wäre ein offener Endpunkt.
- **Slugs sind je Elternteil eindeutig** (E7), nicht je Instanz. Öffentliche
  Adressen sind deshalb geschachtelt: `/series/:reihe/events/:event` — und die
  API-Pfade folgen dem (F28).
- **Zeiten sind absolute Zeitpunkte, die Zone hängt am Event** (E8). Formatiert
  wird ausschließlich über die Helfer in `shared-models`, auch beim Aggregieren
  (F33).
- **Der Double-Opt-In ist der Einwilligungsnachweis.** Das Token ist signiert,
  nicht gespeichert (F23); bestätigen kann nur der Mensch hinter der Adresse —
  ein Veranstalter darf stornieren und wiederherstellen, nicht bestätigen (F31).
- **Das öffentliche Registrierungsformular antwortet immer gleich** (E10), sonst
  wird es zur Abfrage über die Teilnehmerliste.
- **Löschen ist die Ausnahme, Archivieren die Regel** (E14). Reihe/Event mit
  bestätigten Anmeldungen: 409. Eine einzelne Anmeldung ist immer löschbar
  (DSGVO-Vorarbeit).
- **Zählen statt Lesen:** Wer nur Zahlen braucht, bekommt einen eigenen schmalen
  Port (`RegistrationTally`) statt Zugriff auf die Zeilen.
- **Listen sind serverseitig gefiltert, sortiert und paginiert**, mit der ID als
  letztem Sortierkriterium. Kein Endpunkt liefert „alles".
- **Keine Datenbankerweiterung** für Suche (F32) — Installierbarkeit vor
  Mikrooptimierung.
- **Query-Parameter kommen als `undefined` an**, auch wenn ein
  Angular-`input()` einen Standardwert hat. Nie darauf verlassen.
- **Der Feldschlüssel ist nicht die Beschriftung** (F35). Er wird aus ihr
  abgeleitet, ist je Event eindeutig und danach unveränderlich — genau deshalb
  lässt sich eine Frage umformulieren, ohne die Antworten von ihr zu lösen. Typ
  ebenfalls fest. Sechs Schlüssel sind für den Kern reserviert.
- **Eine gelöschte Formularfrage löscht keine Antworten** (F34). Die Werte
  bleiben in `custom_fields_json`; die Übersicht zeigt sie unter ihrem
  Schlüssel. Kein 409 — das wäre eine Sackgasse ohne Archiv-Flag.
- **Die Reihenfolge des Formulars wird als Ganzes geschrieben**, nie als „ein
  Feld nach unten": eine Liste aller Ids, `sort` in einer Transaktion neu
  vergeben. Deshalb ist `sort` bewusst nicht eindeutig.
- **Antworten werden gegen die Definitionen geprüft, nicht gegen ein DTO** —
  und vor dem Schreiben. Ein unbekannter Feldschlüssel ist ein 400, kein
  stilles Verwerfen.
- **`private` reicht für ein Angular-Template nicht**, und `tsc --noEmit` merkt
  das nicht: Template-Prüfung passiert erst im Testbuild des Clients.
- **Eine Datei ist keine Antwort in `custom_fields_json`** (F37), sondern eine
  `attachment`-Zeile mit echtem Fremdschlüssel auf `registration`, zugeordnet
  über den Feldschlüssel. Ein Wert unter einem Datei-Schlüssel ist ein 400.
- **Dateien sind Datenzugriff.** `FileStore` ist ein Port wie ein Repository; die
  Geschäftslogik weiß, _dass_ eine Datei bleibt, nicht _wo_. Bei Bedarf an
  Dateizugriff in der Geschäftslogik einen Port ziehen, nicht `fs` importieren.
- **Dem Content-Type wird nicht geglaubt** (F38): geprüft werden die ersten Bytes
  gegen den behaupteten Typ. Die erlaubten Typen sind ein Katalog in
  `shared-models`, kein Freitext — ein neuer Typ braucht dort einen Eintrag _und_
  eine Signatur in `file-signature.ts`.
- **Das Upload-Volume wird nie statisch ausgeliefert** (E9). Einziger Weg zu den
  Bytes: `GET /api/admin/attachments/:id`, immer als `attachment`-Download.
  `/api/media` ist für Logos in Phase 2 und ausdrücklich nicht dafür.
- **Kaskaden löschen Zeilen, keine Dateien.** Wer Anmeldungen (mittelbar) löscht
  — Anmeldung, Event, Reihe — ruft vorher `AttachmentsService.purge…`, solange
  die Zeilen noch sagen können, welche Dateien gemeint sind.
- **Eine Anmeldung mit Datei ist eine Anfrage** (F39): `multipart/form-data`,
  Felder als JSON im Teil `payload`, jede Datei in einem Teil mit dem Namen ihres
  Feldschlüssels. Geschrieben wird erst, wenn alles geprüft ist.
- **Ein Programm ist nach der Uhr sortiert, nicht nach einer Spalte** (F40).
  `program_item` hat kein `sort`; Gleichstand bricht `(starts_at, ends_at, id)`.
  Es gibt deshalb kein „nach oben" im Editor — eine Session verschiebt man, indem
  man ihre Zeit ändert.
- **Überschneidungen werden angezeigt, nicht abgelehnt** (F41). Zwei Sessions zur
  gleichen Zeit sind ein zweigleisiger Kongress. Abgelehnt (400) wird nur, was
  außerhalb des Eventzeitraums liegt.
- **Ein verschobenes Event lässt sein Programm stehen.** Der Zeitraum eines
  Programmpunkts wird nur geprüft, wenn er _geschrieben_ wird — sonst könnte ein
  Veranstalter, der das Event verschoben hat, die Punkte nicht mehr nachziehen.
  Der Editor markiert die außerhalb liegenden.
- **Ein Programmpunkt braucht eine Dauer** (`ends_at > starts_at`, strikt in der
  DB), ein Event nicht: das darf als einzelner Zeitpunkt gebucht werden, solange
  die Details offen sind.
- **Ein Programmpunkt hat keine eigene Zeitzone** — sie hängt am Event (E8).
  Timeline-Tage werden mit `groupProgramByDay` gebildet, Uhrzeiten mit
  `formatProgramTime`; beides in `shared-models`, damit „welcher Tag ist das"
  nicht an zwei Stellen zwei Dinge heißt.
- **Kein Feld ohne Bedeutung.** `registration_enabled`/`capacity` kommen erst mit
  `program_item_signup` in AP 9. Ein Flag, das nichts liest, sieht aus wie eine
  Funktion, die es gibt — dieselbe Linie wie bei der `type`-Constraint in AP 6.
- **Ein Formular, das sich selbst leert, wird währenddessen geschlossen.** Wer
  nach dem Absenden weitertippt, verlöre das Getippte beim Reset. Der
  Programm-Editor legt das Hinzufügen-Formular in ein `<fieldset [disabled]>`,
  solange eine Anfrage läuft — und solange das Event fehlt, ohne dessen Zone die
  Zeiten nicht lesbar sind.
- **Keine Backticks in Angular-Template-Kommentaren.** Sie beenden das
  Template-Literal, und der Compiler meldet die Folgefehler an ganz anderen
  Stellen.

## Betriebskontext

Entwicklung: lokal in WSL2 (dieser Ordner), Docker via Docker Desktop (WSL2-Backend) oder docker-ce. Zielbetrieb: eigener Linux-Server der Organisation, identische Container. Compose-Dateien und Dockerfiles unter `infra/`, CI unter `.github/workflows/ci.yml` (Qualität, E2E gegen echte DB und Browser, Image-Builds).

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
2. Whitelabel-Theming, Modul-Verwaltung, i18n, PWA, Installations-Story → `docs/PHASE2.md`
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
  Ursprungsplan hinaus (Client-Plug-in-Manager + Einhängepunkt-Komponente);
  `libs/shared-i18n` ist seit AP 6 der Phase 2 die sechste (mitgelieferte
  Kataloge + Transloco-Verkabelung + Sprachumschalter).
- **`tools/spike-verification/`** prüft eine _laufende_ Instanz; `*-e2e` prüft im
  CI. Beides bewusst getrennt.

- **Raumzuordnung von Programmpunkten = plug-in-eigene Join-Tabelle** (F21,
  entschieden 26.08.2026). `program_item` bekommt **kein** `room_id`. Noch nicht
  implementiert — steht in `todo.md` unter Phase 1. Begründung in
  `docs/spikes/02-server-plugin.md`.

**Offene Punkte** stehen in `todo.md`, nach der Phase gruppiert, ab der sie
prüfbar werden — nach jeder Phase durchgehen.

## Stand nach Phase 1 (abgeschlossen 28.08.2026, Meilenstein M2)

Plan und Protokoll: `docs/PHASE1.md` (Arbeitspakete AP 1–13, Entscheidungen
E1–E16, je Paket ein Abschnitt „erledigt" mit dem, was tatsächlich passierte;
dazu die Abschnitte _Was anders lief_ und die abgehakte Definition of Done).
Marius gibt jedes Paket einzeln frei — **nicht** ohne Aufforderung mit dem
nächsten anfangen; das gilt für Phase 2 genauso.

Erledigt: **AP 1** Login, Admin-Zugänge, Guard über `/api/admin` · **AP 2**
Veranstaltungsreihen · **AP 3** Events und öffentliche Landingpage · **AP 4**
Registrierung mit Double-Opt-In und Mail-Modul · **AP 5** Teilnehmerübersicht
→ damit ist **M1** erreicht (Kernschleife lauffähig, erste Feedbackrunde mit
Democracy International fällig) · **AP 6** Feld-Baukasten (Text, Auswahl,
Ankreuzfeld) · **AP 7** Feldtyp Datei-Upload, `attachment`, Download nur für
Admins · **AP 8** Programmplanung, `program_item`, Timeline auf der Landingpage
· **AP 9** Programmpunkt-Anmeldung (`program_item_signup`), Selbstbedienung über
den signierten Link (`business/self-service`), Lese-Port im Plug-in-Vertrag
(Plug-in-API **1.1.0**) und F21 (plug-in-eigene Raumzuordnung + der nachgezogene
Fremdschlüssel auf `plugin_room_planning_room.event_id`) · **AP 10**
Event-Dashboard (`business/dashboard`, ein Endpunkt je Bildschirm; die
Event-Adresse im Veranstalter-Client ist jetzt das Dashboard, das Formular liegt
unter `…/edit`) · **AP 11** Follow-Up-Text am Event und Medien-Links
(`business/media-links`, `media_link`), dazu der `CoreModuleEnabledGuard`:
`media-links` ist das erste abschaltbare Kernmodul mit eigener API · **AP 12**
Ehemalige Teilnehmende einladen (`business/invitations`, `invitation` +
`invitation_recipient`, `ContactsService` im Registrierungsmodul,
Widerspruchsseite im Nutzer-Client) und der Storno-Hinweis an Teilnehmende ·
**AP 13** Phasenabschluss: `todo.md` durchgearbeitet (sechs Einträge zu, zehn in spätere Phasen verschoben, vier in
den neuen Abschnitt _Questions for the pilot partner_), F22–F24 gegen die Umsetzung geprüft (keine
Abweichung; F23 trägt inzwischen drei Tokenzwecke), der Fünf-Container-Stack aus
dem Stand hochgefahren — dabei fiel auf, dass `infra/docker-compose.yml` die
Bootstrap-Zugangsdaten nicht durchreichte, also **hatte eine frische
Produktionsinstanz keinen Administrator**; behoben.

**Phase 1 ist damit abgeschlossen**, mit einer offenen Zusage: die Feedbackrunde
mit Democracy International (Punkt 5 der Definition of Done) hat nicht
stattgefunden. Die fünf Fragen an den Pilotpartner stehen gesammelt in `todo.md`
unter _Questions for the pilot partner_ — keine davon blockiert Phase 2.
**Entschieden am 28.08.2026:** sie werden erst an einem weiter entwickelten Stand
gestellt; sollte doch etwas blockieren, klärt Marius den einzelnen Punkt vorher.
Also **keine davon auf Verdacht umsetzen** — der jetzige Zustand _ist_ die
Entscheidung. Ebenfalls entschieden: **`CONTRIBUTING.md` wird geschrieben, wenn
alle Phasen durch sind** (nicht vorher, gegen die fertige v1.0; steht als
Erinnerung in `todo.md` unter Phase 5).

Drittens entschieden am 28.08.2026: **die Drosselungsgrenzen bleiben, wie sie
sind** — 20 Logins, 60 Registrierungen, 60 Bestätigungen je fünf Minuten je
Client-Adresse; die Erhöhungen aus AP 7 und AP 9 sind bestätigt. Sie werden
**nicht** für Tests entfernt: eine fehlende Drosselung hat kein Symptom, und eine
Grenze, die für Tests gelockert wird, wird nicht mehr geprüft (E4). Wer beim
Entwickeln in eine Sperre läuft, startet den Server neu — die Zähler liegen im
Speicher. Konfigurierbar (mit den strengen Werten als Vorgabe und einer
Startwarnung bei Lockerung) werden sie in **Phase 5**, zusammen mit dem zweiten
Zähler je Empfängeradresse.

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
- **Anmeldung ist je Programmpunkt, aus, und eine Kapazität braucht sie** (F42).
  `capacity` ohne `registration_enabled` ist ein 400 _und_ ein `CHECK` —
  eine Grenze, die nichts durchsetzt, sieht aus wie eine, die durchgesetzt wird.
  Abschalten setzt die Kapazität zurück und löscht **keine** Anmeldungen; abmelden
  bleibt danach möglich, sonst wäre die Liste falsch statt kürzer.
- **Die Platzgrenze entscheidet die Datenbank** (F43), in einer Anweisung, unter
  `FOR UPDATE` auf der Programmpunkt-Zeile. Der Port nimmt die Kapazität mit und
  antwortet mit `created`/`already-signed-up`/`full`: die Regel bleibt in der
  Geschäftslogik, die Unteilbarkeit in der Datenzugriffsschicht. Wer eine zweite
  Grenze braucht, zieht denselben Schnitt — nicht „erst zählen, dann schreiben".
- **Ein Platz existiert oder nicht.** `program_item_signup` hat keine
  Statusspalte; abmelden löscht die Zeile. Abmelden ist **immer** erlaubt, auch
  nach dem Abschalten und nach Beginn — eine Regel, die Menschen in einer Liste
  festhält, macht die Liste falsch.
- **Das Selbstbedienungs-Token steht beim Lesen in der Query, beim Ändern im
  Rumpf** (F44). Lesen ist, was der Link in der Mail tut; ändern darf kein
  Linkvorschau-Dienst können (dieselbe Begründung wie E5b). Nur eine
  **bestätigte** Anmeldung hat eine Selbstbedienungsseite.
- **Selbstbedienung liest über die Event-Id, nicht über die öffentliche
  Adresse.** Sonst wäre jeder Link tot, sobald das Event auf Entwurf zurückgeht —
  `ProgramService.listForEvent` und `EventsService.locate` sind genau dafür da.
- **Ein Plug-in liest Kerndaten nur über den Vertrag** (E12, F45).
  `PluginProgramReads` liefert fünf Felder je Programmpunkt und Anmeldezahlen,
  nichts sonst. Bereitgestellt vom globalen `PluginHostModule`; ein Plug-in
  importiert weiterhin ausschließlich aus `plugin-api`. Neue Fähigkeit = Minor am
  `PLUGIN_API_VERSION` plus ein Fall im Kompatibilitätstest.
- **Ein `<input type="number">` schreibt eine Zahl in ein `string`-Control.**
  Angulars `NumberValueAccessor` konvertiert, `tsc` merkt nichts. Wer den Wert
  weiterverarbeitet, nimmt `string | number` an — sonst stirbt `.trim()` still
  und nur der Browsertest sieht es.

- **Ein Event hat eine Startseite, und die ist nicht sein Formular** (F48).
  `/series/:reihe/events/:event` ist das Dashboard, `…/edit` das Formular —
  dieselbe Ordnung wie bei der Reihe. Speichern führt zurück aufs Dashboard, ein
  _neues_ Event weiterhin auf die Reihe.
- **Keine Kachel für ein Modul, das es noch nicht gibt** (F47). Nachrichten
  (Phase 3), Vorschläge und Forum (Phase 4) fehlen im Typ, statt als `0`
  dazustehen; das Kachelraster fließt nach. Der Einhängepunkt `event-dashboard`
  im Plug-in-Vertrag wird erst gezogen, wenn ein Plug-in eine Kachel mitbringt.
- **Ein Endpunkt für einen Bildschirm** (F49). Das Dashboard ist eine Anfrage,
  nicht vier — und es zählt statt zu lesen. Einen zählenden Port bekommt, was
  groß oder unbegrenzt ist (`RegistrationTally`, `ProgramTally`); dreißig winzige
  Felddefinitionen, die der Editor sowieso liest, werden in der Geschäftslogik
  gezählt.
- **Eine Zusammensetzung gehört über ihre Teile.** `business/dashboard` importiert
  Events, Reihen und Registrierung; im `EventsModule` hätte derselbe Service den
  Kreis geschlossen und einen `forwardRef` gebraucht. Und: jeder gefragte Service
  löst das Event selbst auf — drei Primärschlüssel-Lesezugriffe sind der Preis
  dafür, dass jedes Modul seine 404-Regel behält.
- **Die öffentliche Adresse eines Events wird an einer Stelle gebaut**:
  `publicEventPath` in `shared-models`. Verlinkt wird sie im Veranstalter-Client
  nicht — der Nutzer-Client ist ein anderer Origin, und dieser Client weiß nicht,
  welcher (Phase 2, steht in `todo.md`).
- **Playwrights `name` vergleicht Teilstrings**, nicht ganze Namen:
  `getByRole('link', { name: 'Participants' })` traf auch „All participants".
  Wo eine Seite zwei Wege zur selben Ansicht anbietet, braucht der Test
  `exact: true` — nicht die Seite einen künstlicheren Namen.

- **Der Follow-Up-Text verlässt den Server erst nach `ends_at`** (F50). Gefiltert
  wird in `toPublicEvent`, nicht im Template: ein `@if` hätte den Text
  mitgeliefert und nur nicht gezeichnet. Der Veranstalter liest ihn immer — er
  schreibt ihn, meist vorher.
- **Externe Medien werden verlinkt, nicht eingebettet** (F51). Ein `<iframe>`
  lädt fremden Code (praktisch Googles) in eine Seite, die das Gegenteil
  verspricht (NFR 9). Deshalb `target="_blank"` + `rel="noopener noreferrer"`,
  und der Server fragt die Zieladresse **nie** ab (kein oEmbed, kein
  Vorschaubild, kein Titel-Abruf). Erlaubt sind nur `http`/`https` — geprüft in
  Client, DTO und Geschäftslogik.
- **Die Art ist die Reihenfolge** (F52). `MEDIA_LINK_KINDS` ist die Menge der
  gültigen Werte _und_ ihre Sequenz; `media_link` hat kein `sort`. Umsortieren
  heißt: Art ändern, oder löschen und neu anlegen.
- **Ein abgeschaltetes Kernmodul antwortet 404**, wie ein Plug-in (F53) —
  `@CoreModuleController(key)` plus `CoreModuleEnabledGuard`. Und: `/api/config`
  und der Guard lesen **denselben** Zwischenspeicher (`ModuleFlagCache`, 15 s),
  damit nicht ein Client von einem Modul erfährt, dessen API 404 gibt. Ein neues
  optionales Modul braucht beides; wer den Schalter zur Laufzeit umlegt, ruft
  `refresh()`.
- **Die Zugehörigkeit eines Links zu einer Session garantiert die Datenbank**
  (F54): der Fremdschlüssel ist das Paar `(program_item_id, event_id)`. Die
  Geschäftslogik prüft es zusätzlich, damit daraus ein 400 wird und kein
  Constraint-Fehler.
- **Ein Empfänger ist eine Anmeldung, keine Adresse** (F55). Keine Schnittstelle
  dieser Anwendung nimmt eine E-Mail-Adresse an, um etwas hinzuschicken; eine
  Auswahl nennt Ids, und jede wird erneut durch denselben Filter gelesen
  (bestätigt, diese Reihe, kein Widerspruch). `invitation_recipient` hat deshalb
  keine Adressspalte — die Adresse kommt beim Verfassen über den Fremdschlüssel.
- **Ein Versand an viele Adressen ist ein Vorgang, keine Anfrage** (F56). Der
  `POST` schreibt die Empfängerzeilen und antwortet **202**; die Zeilen _sind_ die
  Warteschlange, und nach jeder Mail wird erneut nach der nächsten `pending`-Zeile
  gefragt. Der Fortschritt wird aus den Zeilen **gezählt**, nie daneben
  gespeichert. Wer eine zweite solche Funktion baut, zieht denselben Schnitt.
- **Ein Widerspruch gehört dem Menschen, nicht der Zeile** (F57): `contact_opt_out`
  wird auf **allen** Anmeldungen einer Adresse in der ganzen Instanz gesetzt, und
  nur die noch nicht widersprochenen werden gezählt — „null geändert" ist die
  Aussage „hatte schon widersprochen".
- **`contact_opt_out` stoppt Einladungen, nicht transaktionale Mail** (F59).
  Bestätigung, Empfangsbestätigung und Stornohinweis gehen unabhängig davon raus.
  Der Stornohinweis nur, wenn der **Veranstalter** eine **bestätigte** Anmeldung
  storniert; Selbstabsage und Wiederherstellen schicken nichts. Deshalb hat
  `setStatus` einen `actor` — nicht als Berechtigung, sondern damit diese eine
  Entscheidung an der Aufrufstelle sichtbar ist.
- **Ein UPDATE über `repository.query()` antwortet `[rows, rowCount]`** — zwei
  Elemente, immer. `rows.length` meldet also „zwei Zeilen geändert", auch wenn
  nichts geändert wurde. Wer eine Anzahl braucht, nimmt den Query-Builder und
  `result.affected`.
- **Fixture-Namen in den Browsersuiten tragen keine Uhrzeit.** `fixtureLabel()`
  bildet `<scope>-<pid>-<n>`; ein Playwright-Arbeiter ist ein Prozess, seine pid
  trennt ihn von allen anderen. `Date.now()` kollidierte am eindeutigen
  Slug-Index, und der Fehlschlag las sich wie ein kaputtes Fixture.
- **Eine Browsersuite meldet sich einmal pro Lauf an**, nicht pro Fixture: der
  Login erlaubt 20 Versuche in fünf Minuten (E4), und ein 429 im Seed sagt nichts
  über den Test. Beide Suiten legen die Sitzung in eine Datei im Temp-Verzeichnis
  und lesen sie.
- **Aufräumcode muss mit einem 404 rechnen.** Seit AP 12 legt eine Suite je Test
  eine Reihe an und löscht sie wieder; wer über eine Liste iteriert, findet
  Einträge, die es beim zweiten Zugriff nicht mehr gibt.
- **Ein `<select>`, dessen Optionen aus einem `@for` kommen, nimmt kein
  `[value]`** — Angular schreibt die Eigenschaft, bevor die Optionen existieren,
  und die Zuweisung fällt wortlos weg. `[selected]` an den Optionen; mit
  `formControlName` tritt das Problem nicht auf.
- **Zwei Browsersuiten dürfen nicht denselben Slug ableiten.** `E2E Series
<projekt> <ms>` in zwei Dateien = ein Rennen am eindeutigen Index, sobald zwei
  Playwright-Arbeiter in derselben Millisekunde säen. Der Fehlschlag liest sich
  wie ein kaputtes Fixture.

- **Eine Umgebungsvariable lebt an drei Stellen, nicht an zwei.** `env.ts` liest
  sie, `.env.example` dokumentiert sie — und `infra/docker-compose.yml` muss sie
  an den Server-Container **durchreichen**, sonst existiert sie im Zielbetrieb
  nicht. Genau das war mit `ADMIN_BOOTSTRAP_*` passiert: eine frische
  Produktionsinstanz hatte keinen Administrator und keinen Weg, einen anzulegen
  (AP 13). Kein Test der Suite kann das finden — die E2E-Suiten fahren den Server
  per `nx serve`, und die CI **baut** die Images, ohne sie je zusammen zu starten.
- **Wer Installierbarkeit prüfen will, fährt den Stack hoch.**
  `docker compose -f infra/docker-compose.yml up -d --build` gegen ein leeres
  Volume, mit eigenem `-p`-Projektnamen, danach `down -v`. Das ist die einzige
  Prüfung, die NFR 15 belegt, und sie gehört an das Ende jeder Phase.
- **Der Service Worker des Nutzer-Clients hat Scope `/` — also auch `/admin/`.**
  `ngsw-worker.js` liegt im Wurzelverzeichnis, und Angulars Service Worker
  beantwortet **jede** Navigation in seinem Scope aus dem eigenen Cache, sofern
  `navigationUrls` sie nicht ausschließt. Bis 28.08.2026 fehlte `/admin` dort:
  wer den Nutzer-Client einmal geladen hatte, bekam unter `/admin/` dessen
  `index.html`, und die Wildcard-Route schickte ihn auf `/` — der
  Veranstalter-Client war im Containerbetrieb **nicht erreichbar**. Wer eine
  Adresse ergänzt, die nicht diesem Client gehört, ergänzt sie dort. Geprüft wird
  es in `verify-proxy.mjs` gegen das gebaute `ngsw.json`, mit ngsws eigener
  Auswahlregel — ein Unit-Test und jede `fetch`-Prüfung sind dafür blind.
- **Was nur im Produktionsbuild passiert, sieht keine Suite dieses Repositories.**
  Angular registriert den Service Worker nur dort, die Playwright-Suiten fahren
  `nx serve`, die Vertragssuite benutzt `fetch`, und die CI baut die Images ohne
  sie je zusammen zu starten. Für diese Klasse von Fehlern ist
  `tools/spike-verification/` gegen einen laufenden Stack das einzige Netz —
  benutzen, bevor man „grün" sagt.
- **Ohne TLS ist der Produktionsstack nur auf `localhost` bedienbar.** Das
  Sitzungscookie trägt `Secure`, sobald `NODE_ENV=production` (E2), und ein
  Browser speichert ein `Secure`-Cookie nur über HTTPS. TLS gehört damit zur
  Installations-Story, nicht zur Härtung; `Secure` fallen zu lassen ist keine
  Alternative.

## Stand nach Phase 2 (abgeschlossen 29.08.2026, Meilenstein M5)

Plan **und Protokoll**: `docs/PHASE2.md` — dreizehn Arbeitspakete, Entscheidungen
**E17–E30** (die Zählung läuft über die Phasen weiter), Meilensteine M3
(Whitelabel), M4 (alle P1: brandbar, konfigurierbar, selbst installierbar) und M5
(Abschluss), Nachträge **F60–F112 ohne F62** (die Nummer wurde nie vergeben —
F70 beantwortet, was für sie geplant war). Was tatsächlich passierte, steht dort
unter _Fortschritt_, je Paket ein Abschnitt „erledigt" mit den Abweichungen, und
am Ende ein phasenweites _Was anders lief_ — dort zuerst nachsehen. **Jedes Paket
einzeln von Marius freigeben** — nicht ohne Aufforderung mit dem nächsten
anfangen; das gilt für Phase 3 genauso.

Erledigt: **AP 1** Konfiguration schreibbar (Name, zwei Hex-Farben, Schriftart
aus einem mitgelieferten, selbst gehosteten Katalog) · **AP 2** Logo und
App-Icon (`PUT/DELETE /api/admin/config/{logo,app-icon}`,
`GET /api/media/branding/{logo,app-icon}` öffentlich und **ohne Pfad vom
Aufrufer**, eigener `branding/`-Teilbaum im Upload-Volume, `CHECK` auf beide
Pfadspalten, Typ aus den ersten Bytes und kein SVG) · **AP 3** Design-Seite im
Veranstalter-Client (`/design`) mit Live-Vorschau im eigenen Dokument,
Zurücknehmen bei Abbrechen **und** beim Verlassen, Legibilitätspanel (F67), den
zwei Uploads mit Vorschau — und beide Kopfzeilen tragen jetzt den
Organisationsnamen statt „Trefaro" (damit ist **M3** erreicht) · **AP 4**
Modul- und Plug-in-Verwaltung: `CORE_MODULES` auf zwei echte Einträge
zusammengezogen (F63), `GET/PATCH /api/admin/modules`, die Seite `/modules`
schreibend, `push` mit Guard und Bedingung am VAPID-Schlüssel, und die Kacheln
in der Event-Detailansicht des Nutzer-Clients (F68) · **AP 5**
Installations-Story: `business/setup/` mit `GET /api/setup/state` und
`POST /api/setup/admin` (tokengeschützt, existiert nur solange `admin_user` leer
ist), der Einrichtungsassistent unter `/setup` im Veranstalter-Client, das
TLS-Overlay `infra/docker-compose.tls.yml` und `docs/INSTALL.md` — damit ist
**M4** erreicht (alle P1 der Phase: brandbar, konfigurierbar, selbst
installierbar) · **AP 6** Transloco in beiden Clients, `libs/shared-i18n` als
sechste geteilte Bibliothek (mitgelieferte Kataloge **und** die Angular-Seite),
`business/i18n/` mit `GET /api/i18n/:locale` (mitgelieferter Katalog überlagert
von `translation_override`, ETag, 304), Sprachumschalter in beiden Shells,
`<html lang>` folgt, und `titleKey`/`labelKey` lösen jetzt auf —
`moduleDisplayName` ist entfallen · **AP 7** Sprachverwaltung: `TranslationAdminService`
und `/api/admin/i18n` (Übersicht mit Vollständigkeitszahl, eine Locale je
Schlüssel, Merge-Write, Zurücksetzen je Schlüssel), `PUT /api/admin/config/locales`
für `active_locales`/`default_locale`, die Seite `/languages` im
Veranstalter-Client mit Editor, Filter „nur fehlende“, Export und Import als
JSON — und `verify-i18n.mjs` geht das Abnahmekriterium jetzt über die API durch
statt über `psql` · **AP 8** Nutzer-Client übersetzt: 149 Schlüssel in beiden
mitgelieferten Katalogen, sieben Seiten plus Diagnoseseite und Shell, die
Datums-/Zeit-/Größenformate bekommen die Sprache des **Lesers** (E8 unberührt),
`MEDIA_LINK_KIND_LABELS`/`uploadTypeLabel`/der rohe Anmeldestatus sind
Katalogschlüssel geworden, `Problem = { key, detail }` in `shared-http` (F77) —
und die Playwright-Suite prüft gegen den Katalog statt gegen englische Wörter ·
**AP 9** Veranstalter-Client übersetzt: **598 Schlüssel** in beiden
mitgelieferten Katalogen (443 unter `admin.`), sechzehn Seiten plus Shell, der
in AP 6 zurückgestellte Sprachumschalter auf dem Anmeldeformular, alle siebzehn
`error()`-Signale halten `Problem`, `eventStatusKey`/`eventSeriesStatusKey` in
`shared-models`, und die Browsersuite dieses Clients prüft ebenfalls gegen
Schlüssel (`support/catalogue.ts` mit dem neuen `tPattern()`) · **AP 10** Die
Mails aus demselben Katalog: `templates/de.ts` und `templates/en.ts` entfallen,
**21 Schlüssel** unter `mail.` (Katalog 598 → **619**), je Mail ein
`MailTemplate` aus Schlüsselliste **und** Renderer, `MailCatalogue` mit E24,
`CatalogueService.ownTexts`/`servableLocales`, der Einrichtungsassistent fragt
die Mailsprachen zur Laufzeit — und `verify-mail.mjs` prüft alle vier Briefe in
Mailpit, in beiden Sprachen · **AP 11** Inhaltsübersetzungen: drei Tabellen
(`event_series_translation`, `event_translation`, `program_item_translation`),
drei Ports beim jeweiligen Elternteil, `business/content-translations` als
Zusammensetzung darüber, `?locale=` auf allen öffentlichen Leseendpunkten
(inkl. Selbstbedienung), `canonicalLocaleTag` in `shared-models`, im
Veranstalter-Client `/series/:id/translations` und
`…/events/:eventId/translations` mit einem Reiter je Zielsprache
(Katalog 619 → **636**) · **AP 12** PWA-Ausbau: `GET /api/config/manifest.webmanifest`
aus der Konfiguration (`business/manifest/` über Konfiguration **und** Katalog),
`imageDimensions` liest die Icongröße aus dem Dateikopf, `theme-color` schreibt
der `ThemeService`, `features/pwa/` im Nutzer-Client (Offline-Banner,
Installationshinweis, `apple-touch-icon` folgt der Konfiguration), das statische
`manifest.webmanifest` ist entfallen, und `verify-proxy.mjs` prüft Manifest,
Farbe, Name und jedes Icon einzeln (Katalog 636 → **643**) · **AP 13**
Phasenabschluss: `todo.md` unter _Checkable after phase 2_ leer (sieben Einträge
zu, fünf mit Begründung verschoben, **einer eskaliert**), F60–F112 im
Referenzdokument geprüft, der Fünf-Container-Stack aus dem Stand hochgefahren und
acht Prüfskripte plus der Demo-Seed dagegen gefahren (dazu ein **zweiter**,
bootstrap-freier Stack aus leerem Volume für `verify-setup.mjs`), beide Werkzeuge
nachgezogen — und die zwei Zusagen dieser Phase eingelöst, die keines ihrer
Pakete eingelöst hatte: die Browser-Tabs tragen jetzt den Namen der Organisation
(F111) und der Veranstalter-Client verlinkt die öffentliche Seite (F112);
Katalog 643 → **646**.

**Eskaliert statt abgehakt:** `event_series.logo_path` und `event.logo_path`
existieren, drei Ansichten des Nutzer-Clients zeichnen `logoUrl`, und geschrieben
hat die Spalten nie jemand — **FR 2.1 und FR 3.1 führen das Logo aber unter den
Pflichtfeldern, beide P1**. Also keine offene Entscheidung, sondern eine nie
gebaute P1-Anforderung, die schon an AP 2/AP 3 der Phase 1 vorbeigelaufen ist.
Die Gestalt ist in AP 13 entschieden (Routen ohne Aufrufer-Pfad, je Zeile
aufgelöst, wie `/api/media/branding/logo` — E19, F66), **gebaut ist sie nicht**;
sie steht in `todo.md` unter _Known gaps in the current state_ und ist ein
eigenes Paket. Nicht nebenbei nachziehen.

Reihenfolge: AP 1–3 Whitelabel (FR 1.4) · AP 4 Modulverwaltung (FR 1.5) · AP 5
Installations-Story mit geführter Ersteinrichtung und TLS-Overlay (FR 1.1,
NFR 15) · AP 6–10 Transloco, pflegbare Sprachen, beide Clients, die Mails ·
AP 11 Inhaltsübersetzungen (FR 3.12) · AP 12 PWA · AP 13 Abschluss.

**E17–E29 sind am 28.08.2026 von Marius bestätigt** und werden nicht erneut
aufgerollt. Sie stehen ausführlich in `docs/PHASE2.md`; diese sechs würden sonst
in einer frischen Sitzung improvisiert:

- **Farben nur als Hex** (E17) — `readableTextColor` muss den Kontrast
  entscheiden können; was es nicht parst, bekommt Weiß.
- **Schriftarten sind ein mitgelieferter Katalog, kein Upload** (E18) — vorerst:
  ausdrücklich als Startpunkt bestätigt, der Upload ist zurückgestellt und steht
  in `todo.md`, nicht verworfen.
- **`/api/media/branding/…` nimmt keinen Pfad vom Aufrufer** (E19). Branding ist
  öffentlich, Anhänge nicht (E9) — die zwei Dateiarten dürfen nicht in einer
  URL verwechselbar sein.
- **Der Übersetzungskatalog kommt vom Server** (E22), nicht aus dem
  Client-Image, sonst ist „von der Organisation pflegbar" nicht einlösbar. Eine
  Mail fällt als Ganzes in die Standardsprache zurück, die Oberfläche je
  Schlüssel (E23, E24).
- **`CORE_MODULES` listet nur Module, die es gibt** (E21): `newsletter` entfällt,
  `chat`/`profiles`/`profile-search` kommen mit Phase 3 zurück, `push` bekommt
  seinen Guard.
- **Die Ersteinrichtung ist tokengeschützt** (E28); `ADMIN_BOOTSTRAP_*` bleibt
  der unbeaufsichtigte Weg.
- **Eine Sprache entsteht, indem man sie übersetzt** (E30, seit AP 7); ob
  Besucher sie wählen können, ist die zweite, getrennte Entscheidung
  (`active_locales`). Zurücknehmen löscht nie eine Übersetzung.

Regeln aus AP 3, die nicht erneut aufgerollt werden sollten:

- **Text auf einer Markenfarbe kann nicht zu blass werden** (F67).
  `readableTextColor` wählt an der Kreuzungsluminanz, also liegt das Verhältnis
  immer bei ≥ ≈ 4,58:1 (`MIN_DERIVED_TEXT_CONTRAST`). Der geplante Hinweis
  „unter 4,5:1 gegen die berechnete Textfarbe" kann deshalb **nie** auslösen und
  ist keine Prüfung, sondern eine angezeigte Tatsache. Gewarnt wird bei der
  **Primärfarbe gegen die weiße Seite unter 3:1** — sie ist die Fläche und die
  Quelle der Linkfarbe. Die **Akzentfarbe** bekommt keine Warnung (sie ist immer
  _in_ etwas, und die Vorgabe `#e8a33d` liegt bei 2,2:1 — eine Warnung erschiene
  ab Werk). Der Fokusring beider Clients nimmt darum
  `--trefaro-color-accent-strong`, nicht den rohen Akzent.
- **Ein laufender Client wird nur von seiner eigenen Seite umgefärbt.** Die
  Design-Seite ruft `ThemeService.apply()` mit dem Entwurf; `DestroyRef` stellt
  beim Verlassen wieder her, `Discard` beim Klick. Nach jedem Schreiben wird
  `/api/config` über `AppConfigService.reload()` **neu gelesen**, nie gemergt —
  der Server besitzt den beschnittenen Namen, den CSS-Stack hinter dem
  Schriftschlüssel und die neue `?v=`.
- **`<input type="color">` kann nur `#rrggbb`.** Ein gespeichertes `#fff` (E17
  erlaubt es) wird beim Laden erweitert; sonst zeigt der Wähler wortlos Schwarz
  und schreibt es beim ersten Öffnen zurück. Deshalb auch kein zweites
  Freitextfeld je Farbe.
- **Ein Bild wird beim Hochladen geschrieben, nicht beim Speichern** — zwei
  Schritte je Bild, und „Discard changes" erfasst es ausdrücklich nicht.
- **Die Browsersuiten schreiben `app_config` nur in Chromium.** Eine einzige
  Zeile, drei parallele Playwright-Browser: jeder prüfte den Wert, den ein
  anderer gerade ersetzt hat. Und sie schreiben **keine Farbe** — `#1f6f5c` wird
  von `start-up.spec.ts` in beiden Clients geprüft. Wer eine Instanzeinstellung
  im Browser schreibt, beschränkt den Test auf einen Browser und stellt her, was
  er gefunden hat.

Regeln aus AP 4, die nicht erneut aufgerollt werden sollten:

- **`CORE_MODULES` nennt nur Module, die es gibt** (E21, F63): `media-links` und
  `push`. `newsletter` entfällt endgültig, `chat`/`profiles`/`profile-search`
  kommen mit Phase 3 zurück. Zeilen entfallener Schlüssel werden **nicht
  gelöscht** — `ModuleFlagCache` ignoriert, was kein Deskriptor beansprucht. Ein
  neues optionales Kernmodul braucht Deskriptor **und** Guard, sonst ist der
  Schalter eine Attrappe.
- **Die Modulverwaltung liest den Zustand aus den Registries, nie aus der
  Tabelle.** Dieselbe Quelle wie `/api/config` und die Guards (F53); ein dritter
  Leser könnte beiden widersprechen. Geschrieben wird über den Port, danach
  werden **beide** `refresh()` abgewartet — sonst wartet ein Veranstalter eine
  Viertelminute auf seinen eigenen Klick (F6). Ein unbekannter Schlüssel ist ein
  404, keine neue Zeile.
- **`push` ist ein echter Schalter.** Endpunkte mit Guard, `webPushPublicKey`
  `null`, solange das Modul aus ist. Wer Push testet, schaltet das Modul vorher
  ein und stellt den Schalter zurück (`verify-push.mjs`, die Validierungstests in
  `public-endpoints.spec.ts`).
- **Eine Kachel gibt es nur, wo etwas dahinter ist** (F68) — nicht je aktiviertem
  Modul: `media-links` ist ab Werk an, und die meisten Events haben keine Links.
  Dieselbe Regel wie beim Dashboard (F47). Ein Plug-in, dessen Bundle nicht
  geladen hat, bekommt keine.
- **Ein reiner Fragment-Link funktioniert in diesen Clients nicht.** Beide tragen
  ein `<base href>`, und `href="#program"` löst dagegen auf — der Klick verließ
  das Event und landete auf der Startseite. Sprungmarken gehen über den Router
  (`[routerLink]="[]"` + `fragment`); der Nutzer-Client hat dafür
  `withInMemoryScrolling({ anchorScrolling: 'enabled' })`.
- **`module_config` gehört der Instanz.** Eine Browsersuite, die einen Schalter
  umlegt, läuft nur in Chromium und schaltet **nicht** `media-links` — zwei
  andere Suiten benutzen es parallel. Für Modulschalter mit Fernwirkung ist
  `apps/server-e2e` der richtige Ort: dort läuft eine Suite allein
  (`maxWorkers: 1`).

Regeln aus AP 5, die nicht erneut aufgerollt werden sollten:

- **Die Existenzbedingung der Ersteinrichtung ist „kann sich überhaupt jemand
  anmelden?"** (F64) — bei jedem Aufruf an die Datenbank gestellt, kein Flag,
  keine Datei, nicht „ein Token liegt vor". Nur die Antwort selbst kann ihr nie
  widersprechen. Und die **Statuscodes sind der Vertrag**: 401 heißt
  „unbeansprucht, Token fehlt oder ist falsch", 404 heißt „es gibt einen
  Administrator". Genau aus diesem Unterschied entscheidet der Client, welchen
  Bildschirm er zeigt — ohne dass der Rumpf je ohne Token herausgegeben wird.
- **Das Setup-Token lebt nur im Speicher**, 32 Zufallsbytes, bei jedem Start neu,
  Vergleich mit `timingSafeEqual`. **Keine Drosselung enger als die globale**: ein
  256-Bit-Token lässt sich nicht raten, und eine Grenze, die niemand auslösen
  kann, müsste die Testsuite trotzdem überleben (E4).
- **Der Account wird zuletzt geschrieben.** Er ist es, der die Route schließt —
  also erst Name, Sprache, Farben, dann das Konto: wird ein Wert abgelehnt,
  bekommt der Betreiber das Formular zurück und keine verschlossene Instanz. Und
  **keine Sitzung** als Antwort: angemeldet wird sich auf dem Login, weil dort ein
  Deployment ohne TLS sofort auffällt (E2).
- **Der Admin-Guard überschätzt** (F69): `isAdminPath` liest jeden _deklarierten_
  Pfad einzeln, also sieht `@Post('admin')` unter `@Controller('setup')` für ihn
  aus wie `/api/admin/…` — und `/api/setup/admin` antwortete 401. Absicht, weil
  der Fehler in die andere Richtung ein offener Endpunkt wäre. Wer so eine Route
  braucht, setzt `@AllowAnonymous()` **und** einen eigenen Guard davor; sichtbar
  ist das nur auf HTTP-Ebene.
- **`startupWarnings()` ist eine reine Funktion mit zwei Lesern**: dem Startlog
  und dem Setup-Zustand. Sie meldet Werte, die _vorhanden_ und für ein echtes
  Deployment _falsch_ sind (Klartext-URL, Mailserver auf `localhost`, Absender
  ohne Domain, fehlendes VAPID-Paar, unverschlüsselte Verbindung zu einer
  entfernten Datenbank) — nicht, was `loadEnv` schon verweigert. Eine neue solche
  Bedingung kommt dorthin, nicht in ein Dokument.
- **Das Routing des Proxys steht in `infra/nginx/trefaro-locations.conf`**, einmal,
  eingebunden von `trefaro.conf` und `trefaro-tls.conf`. Zwei Kopien wären zwei
  Kopien, von denen die produktive die ungetestete ist. Und **`ports:` im Overlay
  braucht `!override`** — Compose verkettet Sequenzen, Mounts führt es über ihr
  Ziel zusammen.
- **Der Assistent färbt den Client am Ende selbst um.** Das Theme wird genau
  einmal angewendet (Startlauf); `AppConfigService.reload()` frischt nur die Daten
  auf. Wer Konfiguration schreibt und _sofort_ eine Wirkung sehen soll, ruft
  zusätzlich `ThemeService.apply()`. Sonst repaint nichts (E20).
- **Zwei Felder dürfen nicht „Name" heißen.** Person und Organisation im selben
  Formular sind für einen Screenreader nicht unterscheidbar (NFR 4) — „Your name"
  und „Organization name". Gefunden hat es der Browserdurchlauf, kein Unit-Test.
- **`defaultLocale` schreibt nur die Ersteinrichtung** (`setLocales` als eigene
  Port-Methode, nicht `save`): `AppConfigChange` ist der Rumpf der Design-Seite,
  und die Sprache jeder ausgehenden Mail darf dort nicht mitreisen. Gewählt werden
  kann nur eine Locale, für die dieses Image Mailvorlagen hat; Englisch bleibt
  immer in `active_locales` (NFR 4).
- **Der Erfolgspfad der Ersteinrichtung hat keinen automatisierten Test und kann
  keinen haben.** Die Endpunkte existieren nur bei leerer `admin_user`-Tabelle,
  jede Suite läuft gegen eine Instanz aus `ADMIN_BOOTSTRAP_*`, und der letzte
  Administrator ist nicht löschbar (F22). Also: Unit-Tests plus
  `tools/spike-verification/verify-setup.mjs` gegen einen frischen Stack; die
  Suiten prüfen, dass die Route **zu** ist.
- **`verify-proxy.mjs` läuft über HTTPS, wenn `PROXY_BASE` https ist** (dazu
  `PROXY_PLAIN_BASE` für die Umleitung und die Anmeldung mit `Secure`-Cookie).
  Gegen ein selbst ausgestelltes Zertifikat braucht auch der socket.io-Client die
  Ausnahme, sonst liest sich der Fehlschlag wie „der Proxy leitet keine Upgrades
  weiter".

Regeln aus AP 6, die nicht erneut aufgerollt werden sollten:

- **Transloco und zoneless verträgt sich — die Falle ist eine andere** (F72).
  Pipe, Strukturdirektive und `translateSignal` zeichnen nach einem
  Sprachwechsel neu, ohne `detectChanges()`; festgehalten in
  `zoneless-language-change.spec.ts`. Aber: eine Beschriftung, die **in
  TypeScript** entsteht, hat keine Pipe, die sie neu zeichnet, und
  `TranslocoService.translate()` liest eine gewöhnliche Map ohne
  Signal-Abhängigkeit. Wer eine Beschriftung berechnet, liest deshalb
  `TranslationService.locale()` in derselben `computed()` — so machen es
  `modules-page.ts` und `event-detail-tiles.ts`. Und **ein Fake in einem
  solchen Test muss die Nicht-Reaktivität nachbilden**: das erste Fake war
  reaktiver als Transloco, der Test blieb grün, und gefunden hat es der
  Browserdurchlauf.
- **Ein Sprachwechsel lädt erst und aktiviert dann.** `setActiveLang()` wartet
  nicht auf den Katalog und zeigt weiter die alte Sprache, bis das JSON über das
  Netz da ist. `TranslationService.use()` ist deshalb die einzige Stelle, die
  umschaltet — `load()`, dann `setActiveLang()`, dann `localStorage`, dann
  `<html lang>`; `switching()` ist dazwischen wahr, und bei einem Fehlschlag wird
  **nichts** gemerkt.
- **Ein Sprachwechsel lädt immer, auch für die schon aktive Sprache.** Transloco
  puffert, also kostet es nichts — und eine Abkürzung „ist schon aktiv“ ließ eine
  Instanz, deren Sprache genau die Rückfallsprache ist, **ohne Katalog** starten:
  `active` beginnt auf `en`. Sichtbar war das nur, wenn keine Pipe zufällig
  vorher lud. Und **`start()` merkt sich nichts**: die Anfangssprache ist
  abgeleitet, gespeichert wird nur, was durch `use()` kommt.
- **Der Katalog ist flach, mit gepunkteten `lowerCamelCase`-Schlüsseln** (F70),
  geprüft von `isTranslationKey` in `shared-models`. Drei Dinge adressieren eine
  Übersetzung — die Zeile in `translation_override`, die Vollständigkeitszahl aus
  AP 7 und der Schlüssel im Template. Folge: ein Modulschlüssel kann sich nicht
  selbst schreiben (`media-links` ist kein legales Segment), also **deklariert**
  jeder Deskriptor seinen `titleKey`/`labelKey`, statt ihn abzuleiten. Ein neuer
  Schlüssel kommt zuerst in `en.json` — Englisch **ist** die Schlüsselliste (E23),
  und `catalogues.spec.ts` verlangt, dass Deutsch vollständig bleibt.
- **Die mitgelieferten Kataloge werden nie importiert.** Sie liegen in
  `libs/shared-i18n/catalogues/*.json`, und der Server liest sie zur Laufzeit
  hinter dem Port `ShippedCatalogueReader` — Dateien sind Datenzugriff (dieselbe
  Linie wie `FileStore`), und ein `import` würde Oberflächentext zur
  Vertragsschicht machen. `apps/server` hängt weiterhin nur an
  `@trefaro/shared-models`.
- **`I18N_CATALOGUE_DIR` lebt an drei Stellen**: `env.ts`, `.env.example` — und
  die webpack-`assets`-Regel **plus** der `COPY` in
  `infra/docker/server.Dockerfile`. Fehlt eines, antwortet die Instanz `200 {}`,
  beide Clients zeichnen ihre Schlüssel, und **jede** Suite bleibt grün: sie
  fahren `nx serve` aus dem Arbeitsbereich, wo die Vorgabe auf die Bibliothek
  zeigt. Geprüft wird das von `verify-i18n.mjs` gegen ein laufendes Deployment.
- **Der Katalog wird revalidiert, nicht zwischengespeichert** — `no-cache` plus
  ein ETag **über die ausgelieferten Bytes**, nicht über ein `updated_at`. Drei
  Dinge entscheiden die Antwort (Datei im Image, Zeilen der Organisation,
  Auflösungsregel) und nur eines hat einen Zeitstempel; so macht auch ein neues
  Image jede Client-Kopie ungültig.
- **Eine frische Instanz bietet an, was das Image mitbringt** (F71). Die
  Migration zieht `active_locales` auf `['en','de']` nach — aber nur dort, wo der
  Wert noch exakt die Vorgabe ist: eine Migration überschreibt keine
  Entscheidung. Wer eine Sprache wieder abbestellen will, tut das in der
  Sprachverwaltung (AP 7), und das Entfernen löscht keine Übersetzung.
- **Sprachnamen kommen von `Intl.DisplayNames`, endgültig.** Ein Katalogeintrag
  bräuchte einen Schlüssel je Sprache je Sprache — und die Sprache, die eine
  Organisation in AP 7 erfindet, wäre in jeder anderen namenlos.
- **Für einen Spec mit Übersetzungen im Template:**
  `provideTranslationsForTest({...})` aus `@trefaro/shared-i18n`. Ohne Argument
  ein leerer Katalog, dann rendert ein Schlüssel als Schlüssel — was ein Test
  über einen Knopf sehen will. Wer eine Beschriftung prüft, nennt die Wörter.

Regeln aus AP 8, die nicht erneut aufgerollt werden sollten:

- **Eine Meldung hat zwei Hälften** (F77): der Satz dieses Clients kommt aus dem
  Katalog, der Grund des Servers steht englisch daneben (`Problem = { key,
detail }`, `.notice__detail`). Die Servermeldung wegzuwerfen kostet die
  Begründung, sie allein zu zeigen setzt Englisch auf eine deutsche Seite.
  `ApiError.explained` unterscheidet dabei den Text des Servers von dem, den die
  HTTP-Bibliothek selbst geschrieben hat — „Not Found" ist kein Grund. Wo der
  Client den Grund kennt (404), setzt er `detail: null`. **Server**meldungen
  bleiben englisch; der Weg dahin sind Fehlercodes statt Sätze und steht in
  `todo.md`.
- **Eine Template-Methode zeichnet neu, ein `computed()` nicht.** `where()` und
  `seats()` sind Methoden und werden neu ausgewertet, sobald eine
  `transloco`-Pipe derselben Seite den View markiert; `tiles()` und `days()` sind
  memoisiert und **müssen** `TranslationService.locale()` selbst lesen (F72).
  Beide Sorten stehen im Nutzer-Client nebeneinander, und der Unterschied ist nur
  nach einem Klick auf „Deutsch" sichtbar.
- **Format ist nicht Übersetzung** (F78). Datum, Uhrzeit, **Zonenname** und
  Dateigröße folgen der Sprache des Lesers (`this.i18n.locale()`, nicht
  `config.defaultLocale`); die **Zone** bleibt die des Events (E8). `zoneLabel`
  geht über `Intl`, also heißt dasselbe Berlin auf Deutsch `MEZ` und auf Englisch
  `GMT+1` — ein Test, der `GMT+1` erwartet, prüft die Sprache mit.
- **Ein Satz um ein Element herum ist keine Übersetzungseinheit** (F79). Ein
  Schlüssel mit `{{platzhalter}}`, und die Auszeichnung entfällt; drei Fragmente
  kann eine Übersetzerin nicht umstellen, Deutsch verlangt aber genau das.
  `[innerHTML]` ist keine Alternative (NFR 9).
- **Eine Beschriftung ohne Template gehört trotzdem in den Katalog.**
  `mediaLinkKindKey()`, `uploadTypeLabelKey()` und `registrationStatusKey()`
  liefern **Schlüssel**; `shared-models` wird auch vom Server importiert, und ein
  Server, der Oberflächenwörter besitzt, besitzt sie in einer Sprache.
  `uploadTypeLabel()` bleibt englisch — es schreibt die Ablehnungen des Servers.
- **Die Browsersuite nennt Schlüssel, keine Wörter.** `t(key, params, locale)`
  aus `support/catalogue.ts` liest die mitgelieferten Kataloge von der Platte
  (und **wirft** bei einem unbekannten Schlüssel, statt Schlüssel gegen Schlüssel
  zu vergleichen); `expectNoRawKeys(page)` findet jede Lücke der Extraktion auf
  einer besuchten Seite. Verglichen werden **ganze** Textknoten — eine Domain im
  Linktext hat dieselbe Gestalt wie ein Schlüssel.
- **Ein Aufräumcode, der über alle Katalogschlüssel läuft, wächst mit dem
  Katalog.** `resetLocale()` in `admin-client-e2e` schickte ein `DELETE` je
  Schlüssel; bei fünf war das billig, bei 149 lief der Test in seinen Timeout. Er
  **fragt** jetzt, welche Schlüssel eine Zeile haben — schnell und weiterhin
  selbstheilend, denn ein abgebrochener Lauf lässt Zeilen zurück, die sonst
  niemand mehr kennt.
- **`test.skip(browserName !== 'chromium')` verhindert kein Rennen innerhalb
  einer Datei.** Playwright verteilt auch die Tests **einer** Datei auf mehrere
  Arbeiter (`fullyParallel` im Nx-Preset), lokal also parallel; die CI läuft mit
  einem Arbeiter und sieht es nie. Zwei Tests, die denselben instanzweiten
  Zustand schreiben, gehören in ein
  `test.describe.configure({ mode: 'serial' })` — oder in `apps/server-e2e`.

Regeln aus AP 7, die nicht erneut aufgerollt werden sollten:

- **Übersetzen und Anbieten sind zwei Entscheidungen** (E30, F76). Die
  Sprachverwaltung schreibt Zeilen für **jeden** wohlgeformten Tag — auch für
  einen, den nichts kennt; `GET /api/admin/i18n/:locale` antwortet deshalb auch
  dann, sonst müsste man eine Sprache erst den Besuchern zeigen, um das erste
  Wort übersetzen zu können. Was angeboten wird, steht in `active_locales` und
  wird über `PUT /api/admin/config/locales` **als Ganzes** geschrieben (die
  Vorgabesprache muss eine der angebotenen sein, Englisch bleibt immer dabei).
  Das Zurücknehmen des Angebots löscht nichts.
- **Vollständigkeit ist übersetzte Schlüssel geteilt durch die englische
  Schlüsselliste** (F73). Ein Schlüssel zählt, wenn die Sprache einen **eigenen**
  Text hat (Zeile der Organisation oder mitgelieferte Zeile dieser Sprache) —
  was nur über die Rückfallkette englisch erscheint, ist genau die Lücke, die die
  Zahl zeigen soll. Gerechnet wird in `translationCompleteness`
  (`shared-models`), damit Liste, Editor und Test dieselbe Zahl meinen.
- **In `translation_override` steht nur, was die Organisation _anders_ haben
  will** (F74). Ein leerer Wert löscht die Zeile; ein Wert, der dem
  mitgelieferten Text gleicht, wird nicht gespeichert — sonst überstimmte der
  erste Import einer exportierten Datei jede künftige Formulierung des Images.
  Ein Wert **mit** Leerzeichen am Ende wird gespeichert wie er ist.
- **Ein unbekannter Schlüssel ist hier kein 400** (F75), anders als beim
  Feld-Baukasten: er kommt aus einer Datei, die vor Monaten exportiert wurde.
  Importiert wird, was verstanden wurde, und das Ergebnis **nennt** die
  ignorierten Schlüssel. Ein Klick im Editor und ein Import gehen durch denselben
  Codepfad — `reset()` ist `write()` mit leerem Wert.
- **Eine Sprache, an der gerade gearbeitet wird, bleibt in der Liste.** Der
  Server listet erst, was übersetzt **oder** angeboten ist; die Seite mischt die
  auf diesem Besuch angefassten Tags dazu, sonst verschwände die gerade angelegte
  Sprache in dem Moment, in dem ihr letzter Schlüssel zurückgesetzt wird.
- **Instanzweite Sprachschalter gehören nach `apps/server-e2e`.** Eine dritte
  Sprache im Umschalter ließe die parallel laufenden Browsersuiten fehlschlagen;
  der Browsertest der Sprachverwaltung schreibt deshalb nur Übersetzungen, in
  einer Sprache, die sonst niemand benutzt.
- **`getByText('0%')` trifft auch die Null in „20 %“.** Playwright vergleicht
  Teilstrings; ohne `exact: true` beweist so ein Test das Gegenteil dessen, was
  er behauptet. Und zwei Tabellen auf einer Seite brauchen `aria-label`, sonst
  trifft ein Zeilen-Locator auch die Kopfzeile der anderen.

Regeln aus AP 9, die nicht erneut aufgerollt werden sollten:

- **Ein Schlüssel ist ein Ort in der Oberfläche, kein Wort** (F80). Menüeintrag,
  Knopf und Überschrift, die auf dieselbe Seite zeigen, teilen deren Schlüssel
  (`admin.series.title`, `admin.events.new`, `admin.participants.title`) — zwei
  Schlüssel mit gleichem Text wären zwei Stellen, an denen eine Umbenennung
  ankommen kann, und nur eine täte es. Und die Gegenrichtung, die wichtigere:
  **gleicher englischer Text heißt nicht gleicher Schlüssel.** `Cancel` ist auf
  einem Formular „Abbrechen" und auf einer Anmeldung „Stornieren"; ein
  gemeinsamer `admin.common.cancel` hätte einen Veranstalter dazu gebracht, eine
  Anmeldung abzubrechen. Vor dem Zusammenlegen fragen, welche **Handlung**
  gemeint ist, nicht welche Zeichenkette dasteht.
- **`admin.*` ist der Namensraum dieses Clients** (F82). Beide Clients lesen
  denselben Katalog und teilen nur, was **dasselbe Ding** benennt:
  `registration.status.*`, `mediaLinks.kind.*`, `modules.*.title`,
  `common.loading`. „On site and online" (Teilnehmende) und „Hybrid"
  (Veranstalter) sind dasselbe Feld und trotzdem zwei Schlüssel — zwei
  Zielgruppen, zwei Vokabulare.
- **Ein gespeichertes Statuswort bekommt eine Schlüsselfunktion in
  `shared-models`** (F83): `eventStatusKey`, `eventSeriesStatusKey` neben
  `registrationStatusKey`. Je Typ eine, aus demselben Grund, aus dem die Typen
  getrennt sind. Was **kein** gespeicherter Zustand ist, bleibt im Client —
  `admin.eventType.*` steht in `apps/admin-client/src/app/features/i18n/labels.ts`.
- **Zwei Zähler in einem Satz brauchen einen Schlüssel je Kombination** (F81),
  solange kein Plural-Modul installiert ist: `…metaSeats.oneOne`, `.oneMany`,
  `.manyOne`, `.manyMany`. Der Satz in zwei Fragmente zu zerlegen ist das, was
  F79 ausschließt. Ein Satz mit **einer** Zahl bleibt bei `.one`/`.many`.
- **Eine Meldung hält Schlüssel und Parameter, nicht den fertigen Satz** (F84) —
  sie steht auf dem Bildschirm und muss einem Sprachwechsel folgen (F72).
  Ausnahme ist die Sprachverwaltung: „Saved: 3 written, 1 reset …" setzt sich aus
  einer wechselnden Zahl von Teilsätzen zusammen, hat also keinen Schlüssel, und
  behält die Sprache der Handlung.
- **Ein Wert, den niemand übersetzen darf, reist als Parameter** (F85) —
  `docker compose logs server`, `Secure`, `docs/INSTALL.md`, Beispiel-Tags. Der
  Satz wird ein Schlüssel, das `<code>` fällt weg, der Literal bleibt im Code.
- **Die Browsersuite dieses Clients nennt Schlüssel**, wie die des
  Nutzer-Clients: `support/catalogue.ts` (dieselbe Datei) plus `tPattern()` für
  Sätze, deren Parameter ein Test nicht nachbauen kann. Literal bleibt nur
  Fixture-Text, ein Bezeichner, eine Uhrzeit — oder eine **Server**meldung
  (F77). `expectNoRawKeys(page)` **nicht** auf der Sprachverwaltung: die zeigt
  Katalogschlüssel, das ist ihre Funktion.
- **Eine Prozentzahl über 598 Schlüssel bewegt sich nicht.** Ein übersetzter
  Schlüssel sind 0,17 % und runden auf 0 % — deshalb steht die **Anzahl** neben
  der Zahl, und deshalb zählt der Browsertest der Sprachverwaltung („1 von 598
  Schlüsseln") statt zu runden.
- **Zwei Anzeigen bleiben englisch, mit Absicht:** die Schriftartennamen im
  Design-Formular (drei Eigennamen, der vierte laut Katalogkommentar bewusst so
  formuliert — E18) und der Ladehinweis in `index.html`, der gezeichnet wird,
  bevor es einen Katalog gibt.

Regeln aus AP 10, die nicht erneut aufgerollt werden sollten:

- **In den Katalog wandern Sätze, nie die Auszeichnung um sie herum** (F86).
  `<div>`, `<p>`, `<strong>` und der Link bleiben Code; eine Organisation ändert
  die Worte, nicht die Gestalt des Dokuments. Daraus die Reihenfolge beim
  Rendern: erst den **Katalogtext** maskieren, dann interpolieren — Platzhalter
  überstehen das Maskieren, ein zuerst eingesetzter Wert wäre doppelt maskiert.
- **Die Einheit des Rückfalls aus E24 ist eine Mail** (F87), nicht der Katalog
  und nicht ein Schlüssel. Wer die drei Anmeldemails übersetzt hat und die
  Einladung nicht, schickt drei deutsche und eine englische. Deshalb tragen
  Schlüsselliste und Renderer **einen** Wert (`MailTemplate`) — eine daneben
  geführte Liste driftet, und dann prüft E24 die falsche Menge.
- **Text- und HTML-Teil sind zwei Darstellungen eines Satzes** (F88). Derselbe
  Schlüssel ist die Beschriftung des Links und die Zeile über der nackten
  Adresse; der Doppelpunkt dazwischen ist `mail.actionLine` und kein Zeichen im
  Code (Französisch setzt `Label :`).
- **Welche Sprachen Mail können, wird gefragt, nicht importiert** (F89).
  `MailCatalogue.localesForMail()` statt einer Konstante, und streng: eine
  Sprache zählt nur, wenn sie **jede** Mail abdeckt. `SetupModule` importiert
  dafür `MailModule`.
- **Ein regionaler Tag ist eine eigene Sprache** (F90), auch für Mail. Den
  Rückfall `de-AT` → `de` gibt es nicht mehr; der Katalog kennt ihn auch nicht,
  und zwei Antworten hätten englische Oberfläche mit deutscher Mail ergeben.
- **Ein Platzhalter, den niemand füllt, bleibt in einer Mail stehen** (F91) —
  anders als in Transloco auf einem Bildschirm. Einen Bildschirm lädt man neu,
  eine Mail ist raus; `{{tage}}` ist meldbar, eine Lücke nicht.
- **`Html` ist ein Typ, kein Kommentar** (F92). Alles, was Auszeichnung baut,
  gibt ihn zurück; alles, was Auszeichnung annimmt, verlangt ihn; die einzige
  Tür von `string` dorthin ist `escapeHtml`. Seit der Text aus dem Katalog kommt,
  steht das Maskieren einmal je **Parameter** statt einmal je Satz.
- **Die Gültigkeitsdauer des Bestätigungslinks kommt aus
  `CONFIRMATION_TOKEN_TTL_MS`**, nicht aus dem Katalogtext (F85 angewandt):
  „14 Tage" in zwei Sprachen als Prosa hätte beim nächsten Wechsel zweimal
  gelogen.
- **Jest und Vitest starten aus verschiedenen Verzeichnissen.** `process.cwd()`
  ist unter Vitest (`libs/*`) der Arbeitsbereich und unter Jest (`apps/server`)
  das Projektverzeichnis. Wer in einem Servertest eine Datei des Arbeitsbereichs
  liest, sucht sie nach oben, statt einen Pfad zu raten.
- **Die beiden Browsersuiten laufen nacheinander, nicht gleichzeitig.** Sechs
  Browser gegen einen Server, alle von `::1`, reißen die globale Drosselung
  (300 Anfragen je Minute je Adresse, E4): `/api/i18n/:locale` antwortet 429,
  beide Clients zeichnen ihre Schlüssel roh, und die Fehlschläge sehen nach
  kaputtem Katalog aus. Kein `nx run-many -t e2e` über beide — erst
  `user-client-e2e`, dann `admin-client-e2e`, wie in der CI.
- **`tools/spike-verification/verify-mail.mjs`** ist der Nachweis, den keine
  Suite führen kann: es registriert, bestätigt, storniert und lädt ein, liest die
  vier Mails aus Mailpit, ändert einen Betreff über die API und prüft ihn an der
  **nächsten** Mail, und stellt die Instanz auf eine halb übersetzte Sprache, um
  E24 zu zeigen. `LOCALE=de` schaltet die Instanz für einen Lauf um und wieder
  zurück.

Regeln aus AP 11, die nicht erneut aufgerollt werden sollten:

- **Eine Übersetzung hängt an einem echten Fremdschlüssel** (F93). Drei Tabellen
  mit `(elternteil_id, locale)` und `ON DELETE CASCADE`, keine polymorphe
  `(entity_type, entity_id)`-Tabelle: der Fremdschlüssel _ist_ der Grund, warum
  niemand Übersetzungen aufräumen muss, und eine verwaiste Zeile tauchte
  irgendwann unter einem neuen Event mit derselben Id auf. Jede Textspalte
  nullbar — `NULL` heißt „nimm das Original", nicht „leer".
- **Nicht übersetzt werden Adresse, Personenname, Zeit und `languages`** (F61,
  E25). Eine übersetzte Straße schickt Menschen an den falschen Ort; ein Name
  ist, wie jemand heißt; ein Zeitpunkt ist ein Zeitpunkt (E8); und in welchen
  Sprachen eine Veranstaltung _stattfindet_ (FR 3.1) ist eine Tatsache über sie,
  keine Darstellung von ihr — eine englischsprachige Konferenz darf eine
  deutsche Landingpage haben.
- **`?locale=` hat drei Antworten, und nur eine ist ein Fehler** (F94). Fehlt der
  Parameter, stehen die Originale (und es kostet keine Abfrage). Eine
  wohlgeformte Sprache, in die niemand übersetzt hat, ist **kein** Fehler — ein
  geteilter Link muss weiter eine Seite zeigen. Was kein Sprachtag ist, ist ein 400. In der Query, nicht in `Accept-Language`. `LocaleQueryPipe` +
  `ApiLocaleQuery()` in `business/common/`.
- **Übersetzt wird vor dem Tor** (F95). Die Überlagerung passiert **in**
  `toPublicEvent`, vor der `hasEnded`-Prüfung: nachträglich gelegt, hätte eine
  Übersetzung genau den Follow-Up-Text zurückgegeben, den F50 zurückhält.
- **Eine übersetzte Liste wird nach dem Übersetzen sortiert** (F96) — nur die
  Reihenliste, mit `Intl.Collator` in der Sprache des Lesers und dem Slug als
  letztem Kriterium. Events und Programmpunkte stehen nach der Uhr (F40); ein
  übersetzter Name verschiebt nichts in der Zeit.
- **Ein Bildschirm ist eine Anfrage, ein Speichern ist ein Ding und eine
  Sprache** (F97). `GET …/events/:id/translations` bringt Event **und** Programm
  (F49); geschrieben wird je Ding, damit ein Fehler in der neunzehnten Session
  die achtzehn davor nicht wegwirft.
- **Eine geleerte Übersetzung löscht ihre Zeile, und Schreiben ersetzt** (F98,
  F74 auf Inhalte). Alles, was übersetzte Sprachen zählt, zählt Zeilen; und ein
  Merge machte ein geleertes Feld unausdrückbar.
- **Übersetzen und Anbieten bleiben zwei Entscheidungen** (F99, E30). Geschrieben
  werden darf für jeden wohlgeformten Tag. Die Reiter sind `active_locales`
  **ohne die Vorgabesprache** (das Hauptformular _ist_ sie) **plus** alles, wofür
  schon eine Übersetzung existiert — `targetLocales()` im Veranstalter-Client.
- **Der Lese-Port liegt beim Elternteil, das Schreiben darüber** (F100). Die drei
  Module bekommen nur die Lesehälfte ihres Ports; `ContentTranslationsModule`
  sitzt über allen dreien (F49-Linie, kein `forwardRef`). Der gemeinsame Port
  musste dafür nach `business/common/**ports**/` — die Linter-Regel lässt die
  Datenzugriffsschicht nur auf `ports/` zugreifen, und die Regel wird nicht
  gelockert, sondern der Port richtig gelegt.
- **`type` statt `interface` für die Nutzlasten** (F101). Nur ein Objekt-`type`
  bekommt eine implizite Indexsignatur, und daran hängen der eine generische
  Port, das eine generische Repository und das eine Formularbauteil.
- **Die Identität eines Übersetzungsformulars ist (Ding, Sprache)** (F102). Der
  Entwurf wird zurückgesetzt, wenn der Reiter oder die Session wechselt — **nicht**,
  wenn ein Elternteil eine neue Feldliste baut: die wird `untracked` gelesen.
  Der erste Entwurf baute sie in einer Template-Methode, und das Formular leerte
  sich zwischen zwei Tastenanschlägen. **Gefunden hat es nur der
  Browserdurchlauf** — ein Unit-Test setzt Eingaben genau einmal.
- **`ApiClient.put/delete/post` nehmen jetzt Query-Parameter.** Die
  Selbstbedienung antwortet auf jeden Klick mit der ganzen Seite, also muss auch
  ein `PUT` die Sprache tragen; kodiert wird sie über denselben Mechanismus wie
  bei `get`.
- **Eine Seite, deren Inhalt der Server übersetzt, lädt bei einem Sprachwechsel
  neu.** Jede betroffene Seite des Nutzer-Clients liest `i18n.locale()` **im
  `effect()`**, nicht in `load()` — ein Client, der nur neu zeichnete, behielte
  die Sätze, die er schon hat.
- **Mails übersetzen keine Inhalte** — bewusst bis Phase 3: die Sprache einer
  Mail wählt niemand (E24), und einen Inhalt in eine Sprache zu übersetzen, die
  sich der Empfänger nicht ausgesucht hat, ist eine halbe Entscheidung. Steht in
  `todo.md`.

Regeln aus AP 12, die nicht erneut aufgerollt werden sollten:

- **Das Manifest kommt vom Server, gebaut aus der Konfiguration** (E26, F103).
  `GET /api/config/manifest.webmanifest`, gebaut in `business/manifest/` — einem
  Modul **über** `ConfigurationModule` und `I18nModule`, weil es beides braucht
  und der Katalog schon die Konfiguration liest (dieselbe Linie wie F49/F100).
  Der URL-Präfix wird mit dem Konfigurations-Controller geteilt; das Modul nicht.
  Ein statisches Manifest im Client-Image gibt es nicht mehr — und was aus
  `public/` verschwindet, verschwindet auch aus `ngsw-config.json`.
- **Ein Manifest hat keine Sprachwahl** (F104). Der Browser holt es aus einem
  `<link>`, während jemand installiert; also die Vorgabesprache der Instanz und
  `lang` dazu, genau wie bei einer Mail (E24). Kein `?locale=`.
- **Ein hochgeladenes App-Icon ist nie `maskable`** (F105). Nur die
  mitgelieferten Icons tragen den Schutzrand, weil sie mit einem gezeichnet
  wurden. Und es **ersetzt** sie nur, wenn ein Browser davon installieren kann —
  quadratisch und ≥ `MIN_INSTALLABLE_ICON_PX` (144). Sonst steht es davor und die
  mitgelieferten dahinter: die Regel zeigt in beide Richtungen, weil die eine
  Fehlrichtung Trefaros Icon auf einem fremden Startbildschirm ist und die andere
  eine Instanz, die sich gar nicht installieren lässt.
- **Maße aus dem Dateikopf zu lesen ist keine Prüfung** (F106). AP 2 bleibt
  gültig: kein Upload wird wegen seiner Form abgelehnt, keine Spalte speichert
  eine. `imageDimensions` (neben `file-signature.ts`, ohne Abhängigkeit) liest
  PNG, JPEG und alle drei WebP-Formen, damit das Manifest eine Größe **nennen**
  kann. Sagt der Kopf nichts, heißt es `sizes: "any"` — und dann bleiben die
  mitgelieferten Icons daneben. Wer eine Bildeigenschaft braucht: aus den Bytes
  lesen, nicht in eine zweite Spalte schreiben.
- **`SHIPPED_APP_ICONS` ist ein Vertrag zwischen zwei Projekten** (F107). Der
  Server schreibt die Pfade, der Nutzer-Client beantwortet sie, und verbunden
  sind sie durch nichts sonst — deshalb steht die Liste in `shared-models` und
  ein Test des Clients prüft jeden `src` gegen `public/icons`.
- **`theme-color` schreibt der `ThemeService`** (F108), nicht `index.html`. Es
  ist der Teil der Marke außerhalb des Dokuments; der Wert im Dokument ist die
  Farbe **vor** der Konfiguration. Gilt für beide Clients.
- **Ein Hinweis, den man nicht befolgen kann, ist Werbung** (F109). Der
  Installationshinweis existiert nur hinter `beforeinstallprompt` — auf iOS und
  in Firefox steht nichts, weil eine Seite „Teilen → Zum Home-Bildschirm" nicht
  auslösen, sondern nur anpreisen kann. Das abgefangene Ereignis ist einmal
  benutzbar und wird beim Klick verworfen; installieren, „jetzt nicht" (in
  `localStorage`) und `appinstalled` beenden das Angebot dauerhaft.
- **`navigator.onLine` ist asymmetrisch** (F110): `false` ist eine Aussage,
  `true` ist keine — ein WLAN mit Anmeldeseite meldet `true`. Das Offline-Banner
  erscheint deshalb nur bei `false` und behauptet nie die Gegenrichtung, und jede
  Seite behält ihre eigene Fehlermeldung: eine Anfrage, die fehlschlägt, während
  der Browser sich für online hält, ist ein Seitenfehler und darf nicht unter
  einer falschen Erklärung verschwinden.
- **Playwright emuliert Offline in WebKit nicht.** `context.setOffline()` wirkt in
  Chromium und Firefox; in WebKit kommen die Ereignisse nie an, also ist dieser
  eine Test dort mit Begründung übersprungen.
- **Ein Client-Test, der Dateien liest, braucht `"node"` in
  `tsconfig.spec.json`.** Zwei tun es: die Iconliste gegen `public/` und die
  Manifest-Adresse gegen `index.html` — eine Adresse, die TypeScript nicht
  typisieren kann und die falsch geschrieben nur dazu führt, dass sich nichts
  mehr installieren lässt.

Regeln aus AP 13, die nicht erneut aufgerollt werden sollten:

- **Ein Routentitel ist eine Beschriftung ohne Template** (F111), und deshalb hat
  ihn keine Textextraktion gefunden. Er ist ein **Katalogschlüssel**;
  `TrefaroTitleStrategy` (in `shared-i18n`, weil sie Katalog **und**
  Konfiguration braucht) hängt `organizationName()` an, und eine Route **ohne**
  Titel bekommt allein den Namen der Organisation — das ist die Startseite des
  Nutzer-Clients. Der Tab folgt einem Sprachwechsel ohne Navigation, weil der
  Schlüssel in einem Signal liegt und ein `effect` Sprache und Namen daneben
  liest (F72). Wer eine neue Route anlegt, gibt ihr einen Schlüssel, keinen Satz.
- **Die öffentliche Adresse wird an einer Stelle gebaut, jetzt auch absolut**
  (F112): `publicEventPath`, `publicSeriesPath` und `publicUrl(origin, pfad)` in
  `shared-models`, benutzt vom Mailmodul **und** vom Veranstalter-Client. Den
  Origin kennt nur das Deployment (`publicUserClientUrl` aus `/api/config`);
  dieser Client kann ihn nicht ableiten. Verlinkt wird **nur Veröffentlichtes** —
  ein Link, der „nicht gefunden" antwortet, liest sich wie eine falsche Adresse
  statt wie ein Entwurf — und die Adresse bleibt zum Kopieren daneben stehen.
- **Ein Prüfskript darf keinen Containernamen als Literal tragen.** `verify-push`
  und `verify-plugin-toggle` nehmen `POSTGRES_CONTAINER`, `DATABASE_USER` und
  `DATABASE_NAME`; mit dem alten Literal legte ein Lauf gegen den Container-Stack
  den Schalter der **Entwicklungs**instanz um und prüfte gegen die andere. Alle
  Skripte nehmen die Adresse jetzt aus **`BASE`** (die alten Namen gelten weiter
  und gewinnen), also treibt ein exportiertes `BASE` einen ganzen Lauf.
- **Eine gebrandete Instanz ist der Normalfall.** `verify-api.mjs` prüft deshalb
  nicht mehr die zwei gesäten Farben, sondern ihre Form (Hex, E17) und dass eine
  Logo-URL entweder fehlt oder die pfadfreie Route ist (E19). Ein Prüfskript, das
  einen konfigurierbaren Wert festnagelt, meldet beim nächsten echten Deployment
  einen Fehler, den es nicht gibt.
- **Der Demo-Seed brandet die Instanz und übersetzt einen Teil davon.** Name,
  zwei Farben, Schrift, ein Logo und ein quadratisches 512er-App-Icon —
  **erzeugt**, nicht eingecheckt (`demoPng` in `api.mjs`), weil der Server die
  ersten Bytes liest (F38) und seit AP 12 den Kopf noch einmal für die Größe
  (F106). `--reset` nimmt die Marke **nicht** zurück; es gibt nichts, worauf.
  Übersetzt wird bewusst nur ein Teil — „teilweise übersetzt" ist der Zustand,
  in dem eine echte Organisation lange ist (F94).
- **Ein Abschlusspaket baut keine P1-Funktion nach.** Was diese Phase schuldig
  geblieben ist und einen halben Tag kostet, wird dort erledigt (die Tabtitel,
  der öffentliche Link). Was ein Paket groß ist, wird **entschieden und
  eskaliert**, nicht nebenbei gebaut — sonst weiß hinterher niemand mehr, was
  eine Phase enthielt.

## Betriebskontext

Entwicklung: lokal in WSL2 (dieser Ordner), Docker via Docker Desktop (WSL2-Backend) oder docker-ce. Zielbetrieb: eigener Linux-Server der Organisation, identische Container. Compose-Dateien und Dockerfiles unter `infra/`, CI unter `.github/workflows/ci.yml` (Qualität, E2E gegen echte DB und Browser, Image-Builds).

Zwei Werkzeuge unter `tools/`, beide gegen eine _laufende_ Instanz:
`spike-verification/` prüft ein Deployment (Proxy, API, Plug-in-Schalter,
Admin-Zugang, Mail, Katalog, Push), `demo-seed/` füllt es mit Demo-Daten —
**ausschließlich über die API**, damit kein Zustand entsteht, den die Anwendung
selbst ablehnen würde. `node tools/demo-seed/seed.mjs --reset` ersetzt einen
früheren Lauf. Der Seed braucht Mailpit: Bestätigung, Selbstbedienungslink und
Widerspruch sind Tokens, die nur in versandter Mail existieren; seit AP 13 der
Phase 2 setzt er außerdem die Marke der Instanz und übersetzt einen Teil des
Inhalts ins Englische. Alle Skripte nehmen die Adresse aus `BASE`, die zwei mit
Datenbankzugriff zusätzlich `POSTGRES_CONTAINER`.

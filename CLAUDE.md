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

| Frage                                                         | Nachschlagen in                                                                                        |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **Architektur — wie das Ganze geschnitten ist und warum**     | **`docs/arc42/`** (zwölf Abschnitte, Index in `docs/arc42/README.md`; darin der Plug-in-SDK-Leitfaden) |
| Anforderungen, Use Cases, Prioritäten, DB-Schema, F1–F208     | **`docs/Anforderungsanalyse_und_Umsetzungsplan.md`** (maßgeblich)                                      |
| Was in einer Phase passierte, E1–E45, _Was anders lief_       | `docs/PHASE1.md`, `docs/PHASE2.md`, `docs/PHASE3.md`, `docs/BOOTSTRAP.md`, `docs/spikes/`              |
| Phase 4: Pakete, E46–E59, F186–F202, Stand je Paket           | **`docs/PHASE4.md`** (Plan oben, _Fortschritt_ unten)                                                  |
| Phase 5: Pakete, E60–E71, F203 ff., Stand je Paket            | **`docs/PHASE5.md`** (Plan oben, _Fortschritt_ unten)                                                  |
| Installation, TLS, Betrieb                                    | `docs/INSTALL.md`                                                                                      |
| Was das Sicherheitsreview ansah und entschied                 | **`docs/SECURITY-REVIEW.md`** (Befund und Entscheidung je Punkt, AP 9 der Phase 5)                     |
| Offene Punkte, bekannte Lücken, Pilotpartner-Fragen           | `todo.md` (nach Phase gruppiert, nach jeder Phase durchgehen)                                          |
| Diagramme der Thesis                                          | `docs/thesis/`                                                                                         |
| **Regeln, die man beim Bauen braucht**                        | **`docs/rules/`** (Index in `docs/rules/README.md`)                                                    |
| Wie jemand mitmacht — und was vor v1.0 gilt                   | **`CONTRIBUTING.md`** (englisch, weil nach außen adressiert)                                           |
| Worauf v1.0 sich stützt und was offen bleibt                  | **`docs/RELEASE-v1.0.md`** (AP 14 der Phase 5; der Tag selbst ist Marius' Schritt, E71)                |
| Wohin ein Sicherheitsfund geht — und was dem Betreiber gehört | **`SECURITY.md`** (englisch; GitHubs private vulnerability reporting, seit 01.10.2026 eingeschaltet)   |

`docs/rules/` ist das Destillat: dreizehn Dateien, je eine pro Bereich —
Schichten und Ports, Verträge der Endpunkte, Datenmodell, Mail, i18n,
Angular-Fallen, E2E-Tests, Whitelabel/PWA, Deployment, Infrastruktur,
was ins Protokoll darf, Werkzeug-Fallen, bestätigte Entscheidungen. Kurz gesagt: **was dort steht, ist schon einmal
schiefgegangen.** Vor der Arbeit an einem dieser Bereiche die zugehörige Datei
lesen.

Fünf Teilbäume tragen dafür eine eigene kurze `CLAUDE.md`, die nur auf die
passenden Regeldateien zeigt: `apps/server/`, `apps/admin-client/`,
`apps/user-client/`, `infra/`, `tools/`.

`docs/arc42/` ist der **Einstieg** daneben: zwölf Abschnitte nach arc42, die die
Architektur beschreiben und dafür **verweisen** statt zu wiederholen (E70) — und
in Abschnitt 8 den einzigen Text, den es vorher nirgends gab, den
**Plug-in-SDK-Leitfaden**. Wer ein Plug-in baut, liest den; wer im Kern arbeitet,
`docs/rules/`.

**Neu gelernte Regeln kommen nach `docs/rules/`, nicht in dieses Dokument**, und
**der Stand eines Arbeitspakets in sein Phasenprotokoll.** Hier landet nur, was
jede Sitzung braucht — ein fertiges Paket bekommt deshalb keinen Absatz, sondern
höchstens eine Zeile in der Phasenliste unten. Die Aufnahmebedingung für eine
Regel steht in `docs/rules/README.md`.

## Kommunikation & Konventionen

- **Mit Marius auf Englisch kommunizieren** (so von ihm festgelegt am
  03.09.2026 — vorher war es Deutsch). Code, Bezeichner, Kommentare und
  Commit-Messages waren und bleiben **Englisch**; die Dokumentation dieses
  Repositories ist **Deutsch**, denn sie gehört zur Thesis (`docs/` und dieses
  Dokument). **Vier Ausnahmen, in AP 14 der Phase 5 gemessen statt geglaubt:**
  `README.md`, `docs/INSTALL.md` und `CONTRIBUTING.md` sind englisch, weil sie
  nach außen adressiert sind — und `todo.md` sowie `docs/spikes/` sind es,
  weil sie es immer waren. Beide sind Aufzeichnungen, und eine Aufzeichnung
  wird nicht nachträglich übersetzt.
- **Conventional Commits** (`feat:`, `fix:`, `docs:`, `chore:`, …).
- Jedes Feature mit Unit-Tests; E2E mit Playwright.
- Lizenz: **AGPL-3.0-or-later**. Keine Abhängigkeiten mit inkompatiblen Lizenzen.
- npm-Scope: `@trefaro`. GitHub: `github.com/trefaro/trefaro` (über die `gh`-CLI).
- **Marius gibt jedes Arbeitspaket einzeln frei** — nach einem Paket berichten und
  warten, nicht unaufgefordert weitermachen.
- **Vor v1.0 werden keine Pull Requests gemerged** (AP 13 der Phase 5, F241):
  Issues, Fehlerberichte, Installationsprobleme und Übersetzungen ja, Code nein —
  der Plug-in-Vertrag ist bei 1.3.0 geschlossen und der kuratierte Satz auch.
  Beiträge tragen später **DCO** (`Signed-off-by`), nie ein CLA. Alles dazu in
  `CONTRIBUTING.md`.

## Festgelegter Tech-Stack (nicht ohne Rücksprache ändern)

| Bereich    | Entscheidung                                                                                                                                                                                                                                                |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Monorepo   | **Nx** — `apps/user-client`, `apps/admin-client`, `apps/server`, `libs/shared-*`                                                                                                                                                                            |
| Frontend   | **Angular (neueste Major-Version, aktuell 22)**, Standalone Components, Signals, SCSS; **zwei getrennte Apps** (Nutzer-Client mobile-first, Veranstalter-Client desktop-first)                                                                              |
| PWA        | Nutzer-Client ab v1 installierbare PWA (`@angular/pwa`)                                                                                                                                                                                                     |
| Server     | **NestJS** (Node LTS, TypeScript)                                                                                                                                                                                                                           |
| ORM / DB   | **TypeORM** auf **PostgreSQL**; Migrationen versioniert; `JSONB` für konfigurierbare Felder                                                                                                                                                                 |
| Echtzeit   | **socket.io** über NestJS Gateways (Chat: 1:1 + Gruppen, inkl. Bildaustausch)                                                                                                                                                                               |
| Push       | **Web Push API** (VAPID, Service Worker), selbst gehostet — kein Firebase                                                                                                                                                                                   |
| E-Mail     | SMTP-Server der Organisation (konfigurierbar), mehrsprachige Templates, signierte Double-Opt-In-Links                                                                                                                                                       |
| i18n       | UI: **Transloco** (Laufzeitwechsel, von Organisationen pflegbare Sprachdateien); Inhalte: Übersetzungstabellen (`*_translation`)                                                                                                                            |
| Karten     | **OpenStreetMap/Leaflet** — niemals Google-Dienste (Datenschutz-NFR!)                                                                                                                                                                                       |
| Deployment | **Docker Compose, 5 Container**: user-client, admin-client, server, postgres, **NGINX** (Reverse Proxy, muss WebSockets proxien)                                                                                                                            |
| CI         | GitHub Actions, **fünf Aufträge**: `quality` (Format, Lint, Unit, Build), `e2e` (beide Clients im Browser), `secure-mail` (E62 gegen einen strengen Mailserver), `images` (die drei Images) und `stack` (die fünf Container aus leerem Volume, mit Browser) |

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
  lokal hosten (**kein Google-Fonts-CDN**). Was kein `--trefaro-*` ausliefert,
  darf kein Bauteil nennen (F222).
- **Die Mockups der Thesis sind die Referenz des Nutzer-Clients** (E66), er
  wird bei **390** Pixeln entworfen (E67), und seine Navigation ist seit AP 7
  der Phase 5 eine eingeschobene Lade — bei jeder Breite. Der
  Veranstalter-Client hat **keine Bögen** und bleibt desktop-first (NFR 6);
  für ihn ist **768** ein Boden, unter dem seine Seitenleiste zur Lade wird
  und jede Tabelle in ihrem eigenen Rahmen scrollt (AP 8, F223, F225). **Eine
  `@media`-Abfrage im ganzen Client** — wer eine zweite braucht, hat eine
  Entscheidung zu treffen und nicht eine Zeile zu schreiben.
- Diskussionsforum und Programmvorschläge haben einen **Freigabe-Workflow**
  (Veranstalter moderiert vor Veröffentlichung), bei minimalem Aufwand.
- Gamification ist bewusst **nicht** Teil des Kerns (Umfrage: niedrigste
  Priorität). Kein integriertes Newsletter-Versand-Modul in v1 (nur
  Double-Opt-In-Verwaltung).
- **Löschen ist die Ausnahme, Archivieren die Regel** — außer dort, wo ein
  Mensch seine eigene Löschung verlangt (E65, seit AP 6 der Phase 5: Konto und
  Anmeldungen gehen, Gespräche und Forum-Themen bleiben und benennen niemanden
  mehr). Externe Medien werden
  verlinkt, nie eingebettet (kein fremder Code auf einer Seite, die das Gegenteil
  verspricht) — seit AP 9 der Phase 5 sagt das auch eine Kopfzeile des Proxys:
  alles `'self'`, `frame-src 'none'`, und `script-src` ohne Ausnahme, was auch
  für ein Plug-in-Bündel gilt.

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
4. **✅ 10.09.2026, M12** Plug-ins: Programmvorschläge, Diskussionsforum,
   Raumplanung, QR-Check-In und individueller Programmplan → `docs/PHASE4.md` —
   zehn Pakete, je eines mit einem Abschnitt unter _Fortschritt_, dazu ein
   phasenweites _Was anders lief_. **Fünf kuratierte Plug-ins sind zur Laufzeit
   schaltbar**; der Vertrag ist genau **einen** Schritt gegangen
   (`PLUGIN_API_VERSION` **1.2.0**: vier Einhängepunkte, drei Lese-Ports,
   Sprache und Worte am Slot; **seit AP 11 der Phase 5 steht er bei 1.3.0 und
   ist für v1.0 geschlossen** — die Zone des Events am Port, E69), und der
   Fünf-Container-Stack ist aus leerem
   Volume gefahren worden. **M9 bis M12 sind erreicht.** Offen bleiben zwei
   Dinge, beide benannt: eine Zeile der Gerätematrix (eine Kamera am Einlass)
   und ein Flackern in der Veranstaltersuite, das seit AP 10 einen Testnamen
   hat.
5. **✅ 01.10.2026, M16** Härtung, Gestaltung, Doku, Vorbereitung des
   Usability-Tests, Release-Feststellung → `docs/PHASE5.md` — vierzehn Pakete,
   je eines mit einem Abschnitt unter _Fortschritt_, dazu ein phasenweites _Was
   anders lief_. **M13 bis M16 sind erreicht.** E60–E71 sind in AP 14 gegen die
   Umsetzung geprüft (zwölf von zwölf halten, zwei davon mechanisch), der
   Abschnitt _Checkable after phase 5_ in `todo.md` ist durchgearbeitet und
   geschlossen, und **worauf v1.0 sich stützt, steht in
   `docs/RELEASE-v1.0.md`**. Offen bleiben die Dinge, die einen Menschen oder
   Hardware brauchen — darunter der Usability-Test selbst, der vorbereitet und
   nicht gehalten ist. **v1.0 taggt Marius, nicht ein Paket** (E71); vor dem
   Tag stehen drei Schritte in der Feststellung.

**Der Stand in Zahlen:** Entscheidungen **E1–E71** vergeben (E46–E59 in Phase 4,
in AP 10 gegen die Umsetzung geprüft; E60–E71 in Phase 5, in AP 14 gegen die
Umsetzung geprüft); Nachträge **F1–F247** stehen vollständig
im Referenzdokument (F62 und F129–F131 bleiben unvergeben; F203–F205 kamen in
AP 2 der Phase 5 dazu, F206–F208 in AP 3, F209–F211 in AP 4, F212–F214 in
AP 5, F215–F218 in AP 6, F219–F222 in AP 7, F223–F226 in AP 8, F227–F231 in
AP 9, F232–F234 in AP 10, F235–F237 in AP 11, F238–F240 in AP 12, F241–F245 in AP 13, F246 und F247 in AP 14); Katalog **1289**
Schlüssel. Was in einem Paket tatsächlich passierte, steht im Phasenprotokoll,
und was man beim Bauen daraus braucht, in `docs/rules/` — **hier nicht noch
einmal.**

**Wo die offenen Punkte liegen:** in `todo.md`. Die Phasenabschnitte sind seit
AP 14 der Phase 5 alle durchgearbeitet; offen ist, was keiner Phase gehört, und
das sind seitdem **drei** Abschnitte — _On a device — waiting for Marius_ (was
einen Produktionsbuild, echte Geräte oder einen echten Server braucht, darunter
die Gerätematrix aus Spike 3, von der F7 abhängt), _Questions for the pilot
partner_ (was in diesem Repository niemand entscheiden kann) und _After v1.0_
(angesehen, verstanden und mit Begründung nicht gebaut). Dazu _Known gaps_ für
das, was heute fehlen würde. **Eine neue Lücke kommt in den passenden dieser
vier Abschnitte, nicht in eine Phasenliste** — es gibt keine nächste Phase mehr.

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

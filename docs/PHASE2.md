# Phase 2 — Whitelabel, Konfiguration, Mehrsprachigkeit, PWA

**Status: geplant** (28.08.2026). Kein Arbeitspaket ist begonnen; die Abschnitte
oberhalb von _Fortschritt_ sind Plan, nicht Protokoll. Wie in Phase 1 gibt
Marius jedes Paket einzeln frei.

Grundlage: Kapitel 6, Phase 2 in
[`Anforderungsanalyse_und_Umsetzungsplan.md`](Anforderungsanalyse_und_Umsetzungsplan.md).
Dieses Dokument übersetzt sie in Arbeitspakete, legt die Entscheidungen fest, die
sonst während der Implementierung improvisiert würden, und benennt pro Paket ein
prüfbares Abnahmekriterium. Was Phase 1 offen gelassen hat, steht in
[`todo.md`](../todo.md) unter _Checkable after phase 2_.

Die Entscheidungen zählen bei **E17** weiter, nicht bei E1: sie werden im Code
und in `CLAUDE.md` ohne Phasenpräfix zitiert (E4, E16), ein zweites E1 wäre
zweideutig. Ergänzungen am Referenzdokument bekommen **F60** und folgende.

## Ziel

Am Ende der Phase gehört die Instanz der Organisation, die sie betreibt — ohne
Datenbankzugriff, ohne Neubau eines Images, ohne Entwickler:

- Name, zwei Markenfarben, Logo, App-Icon und Schriftart sind im
  Veranstalter-Client einstellbar und wirken auf **beide** Clients und alle
  Plug-ins (FR 1.4).
- Optionale Module und die kuratierten Plug-ins werden dort an- und abgeschaltet,
  und das Abschalten hat eine sichtbare Folge (FR 1.5).
- Die Oberfläche spricht Englisch und Deutsch, die Sprache wird zur Laufzeit
  gewechselt, und **eine dritte Sprache legt die Organisation selbst an** — ohne
  Deployment. Dasselbe gilt für die Texte der vier Mails.
- Reihen, Events und Programmpunkte sind feldweise übersetzbar (FR 3.12).
- Der Nutzer-Client ist eine installierbare PWA, die das Logo der Organisation
  auf dem Startbildschirm zeigt (F20).
- Eine frische Instanz führt durch die Ersteinrichtung, und TLS ist ein
  zusätzliches Compose-Overlay statt eines Umbaus (FR 1.1, NFR 15).

**Nicht** Teil von Phase 2: Profile, Nutzer-Login, Nachrichten, Chat, Profilsuche
und das Versenden von Push-Nachrichten (Phase 3); die vier Plug-in-Fachlichkeiten
(Phase 4); Lasttests, DSGVO-Werkzeuge, Monitoring (Phase 5).

## Scope

### Drin

| FR / Quelle       | Inhalt                                                            | Arbeitspaket |
| ----------------- | ----------------------------------------------------------------- | ------------ |
| 1.4               | Farben, Logo, App-Icon, Schriftart, Organisationsname             | AP 1–3       |
| 1.5               | Modul- und Plug-in-Verwaltung, sichtbare Folge des Schalters      | AP 4         |
| 1.1 · NFR 15      | Geführte Ersteinrichtung, TLS-Overlay, Installationsdokumentation | AP 5         |
| Kap. 4 „Mehrspr." | Transloco, Katalog vom Server, Sprachwechsel zur Laufzeit         | AP 6         |
| Kap. 4 „Mehrspr." | Sprachen von der Organisation pflegbar, Vollständigkeitsanzeige   | AP 7         |
| NFR 4, 6          | Alle Texte beider Clients aus dem Katalog                         | AP 8, 9      |
| Kap. 4 „Mehrspr." | Die vier Mails aus demselben Katalog                              | AP 10        |
| 3.12              | Inhaltsübersetzungen für Reihe, Event, Programmpunkt              | AP 11        |
| F20               | PWA-Ausbau: Manifest aus der Konfiguration, Offline-Zustand       | AP 12        |
| —                 | Phasenabschluss                                                   | AP 13        |

### Bewusst draußen

- **Ein Push-Versand bei Änderungen** (FR 3.15) — Phase 3. Phase 2 macht `push`
  nur abschaltbar (E21), damit der Schalter, den `CORE_MODULES` verspricht, auch
  etwas tut.
- **Übersetzte Formularfragen** (der Feld-Baukasten aus AP 6/AP 7 der Phase 1).
  Ein `registration_field_def_translation` wäre dieselbe Form wie die drei
  Tabellen aus AP 11 — aber die Beschriftung ist der Ursprung des
  **Feldschlüssels** (F35), und eine übersetzte Beschriftung darf ihn nicht
  ändern. Das ist eine eigene Entscheidung; sie gehört zu FR 3.12, wenn der
  Pilotpartner mehrsprachige Formulare braucht, und steht bis dahin in `todo.md`.
- **Schriftart-Upload.** Nur eine Auswahl aus mitgelieferten Familien (E18).
- **Ein zweiter Farbwert je Modus** (Dark Mode). Die Thesis nennt Primär- und
  Akzentfarbe mit berechneten Abstufungen; ein dunkles Schema ist eine zweite
  Palette und ein zweites Kontrastproblem.
- **Ein Editor für die Startseite.** Whitelabel heißt in FR 1.4 Farben, Logo,
  Schrift — kein CMS.
- **Zwischenspeichern von API-Antworten im Service Worker** (E27).
- **Zertifikatsbeschaffung** im Stack. TLS ist ein Overlay, Let's Encrypt bleibt
  Sache des Betreibers (E29).

---

## Der Ist-Zustand, auf dem diese Phase aufbaut

Damit nicht gebaut wird, was schon steht:

- `app_config` existiert seit Phase 0 als Singleton-Zeile mit
  `primary_color`, `accent_color`, `logo_path`, `font_family`, `default_locale`,
  `active_locales`. **Niemand schreibt sie** — es gibt keinen Endpunkt dafür.
- `GET /api/config` liefert Theme, Locales, aktivierte Module und
  Plug-in-Deskriptoren; beide Clients holen sie in `provideTrefaroConfig()` vor
  dem ersten Rendern und wenden das Theme über `ThemeService` an.
  `deriveThemeVariables()` rechnet die Abstufungen mit `color-mix()` und
  entscheidet Textfarbe über die WCAG-Luminanz — die Fachlogik des Themings ist
  fertig und getestet.
- `ConfigurationService` baut die Logo-URL heute als
  `/api/media/<logo_path>`. Das Präfix ist damit schon festgelegt, **ein
  Controller dahinter fehlt** — und der gespeicherte Pfad steht in der URL, was
  AP 2 ändert (E19).
- `module_config` und `ModuleFlagCache` (15 s) tragen die Schalter; sowohl
  `CoreModuleRegistryService` als auch `PluginRegistryService` haben ein
  `refresh()`, das noch niemand aufruft. Die Modulseite im Veranstalter-Client
  ist nur lesend.
- Von den sechs Einträgen in `CORE_MODULES` liest **einer** seinen Schalter
  (`media-links`, über `@CoreModuleController` + `CoreModuleEnabledGuard`, F53).
- Der Nutzer-Client hat Manifest, acht Icons und einen Service Worker; Manifest,
  `theme-color` und `<html lang>` sind hart kodiert. `navigationUrls` schließt
  seit AP 13 `/admin`, `/api` und `/socket.io` aus.
- Transloco ist **nicht** installiert. `titleKey`/`labelKey` im Plug-in-Vertrag
  und `CORE_MODULES` zeigen auf Schlüssel, die nichts auflöst. Die Mailtexte sind
  TypeScript, eine Datei je Locale hinter einem vollständig zu erfüllenden
  Interface.
- Rund 10 200 Zeilen Client-Code mit Inline-Templates in 50 Dateien, alle Texte
  englisch und im Template. Das ist der Umfang von AP 8 und AP 9 — und der
  Hauptgrund, warum die im Referenzdokument geschätzten „3–4 Wochen" für diese
  Phase nicht reichen (siehe _Risiken_).

---

## Entscheidungen, die diese Phase festlegt

**E17 — Farben sind Hex-Werte, nicht beliebige CSS-Farben.** Erlaubt sind
`#rgb` und `#rrggbb`, geprüft im Client, im DTO und in der Geschäftslogik. Grund:
`readableTextColor()` muss Schwarz oder Weiß für die Schrift **auf** der Farbe
entscheiden, und was es nicht parsen kann, bekommt Weiß — auf einem gelben Logo
wäre das ein unlesbarer Knopf. Gerendert würde jede Notation (`color-mix()` kann
alles), sicher ist nur eine parsbare. Kein Alphakanal: eine durchscheinende
Markenfarbe macht Kontrast unentscheidbar. Ein Farbwähler liefert genau Hex.

**E18 — Die Schriftart ist eine Auswahl aus mitgelieferten, selbst gehosteten
Familien, kein Upload.** Katalog in `shared-models` wie `UPLOAD_TYPES`, Dateien
in `libs/shared-theming/assets/fonts`, von beiden Client-Builds in ihr Bundle
kopiert — eine Kopie im Repository, keine im Quellbaum doppelt, und NGINX liefert
sie statisch aus. Fünf Einträge: `system-ui` (Vorgabe, ohne Datei), Inter,
Source Sans 3, Atkinson Hyperlegible (NFR 4: „für Jung und Alt"), Lora (Serif) —
alle SIL OFL 1.1, Lizenztexte unter `licenses/` (AGPL-Konformität). Grund gegen
einen woff2-Upload: er stellt eine Lizenzfrage, die das Produkt für den Betreiber
nicht beantworten kann, und braucht ein `@font-face` je Instanz. Ein neuer Eintrag
im Katalog braucht **die Datei und** einen Test, der sie in beiden Bundles findet
— dieselbe Linie wie F38 (Typ ohne Signatur gibt es nicht).

**E19 — Das Logo ist öffentlich, und deshalb liegt es nicht bei den Anhängen.**
E9 sagt: das Upload-Volume wird nie statisch ausgeliefert, Anhänge nur über
`GET /api/admin/attachments/:id`. Ein Logo dagegen muss ohne Login sichtbar sein.
Beides gilt gleichzeitig nur, wenn die zwei Dateiarten nicht verwechselbar sind:
Branding-Dateien bekommen einen eigenen Teilbaum (`branding/`) im Volume, und die
öffentliche Route nimmt **keinen Pfad vom Aufrufer** an, sondern liefert genau
das, was `app_config` benennt: `GET /api/media/branding/logo` und
`…/app-icon`. Die URL in `/api/config` trägt `?v=<updated_at>`, die Antwort
`Cache-Control: public, max-age=31536000, immutable` — ein neues Logo ist eine
neue URL, und `/api/config` wird ohnehin bei jedem Start geholt. Ein
gespeicherter Pfad in einer URL (wie heute) wäre eine Einladung, ihn zu raten.

**E20 — Ein laufender Client repaintet nicht; „sofort" heißt ohne Redeploy.**
FR 1.4 verlangt sofortige Wirkung auf beide Clients. Das Theme wird in der
Client-Start-Sequenz angewendet; eine Änderung erreicht einen Client beim
nächsten Laden. Die Einstellungsseite zeigt eine **Live-Vorschau** im eigenen
Dokument und stellt beim Abbrechen wieder her. Kein Push-Kanal für Konfiguration:
ein WebSocket, der jeden offenen Teilnehmerbrowser umfärbt, ist eine Funktion,
die niemand verlangt hat, und die Konfiguration wird bei jedem Seitenaufruf neu
geholt. Die Seite sagt das („wirkt beim nächsten Laden").

**E21 — Die Modulverwaltung listet nur Module, die es gibt.** `CORE_MODULES` nennt
heute sechs Schlüssel, einer liest seinen Schalter. Das ist dieselbe Sorte
Attrappe wie ein Feld, das nichts liest (F42) — und sie wird sichtbar, sobald ein
Veranstalter die Liste zu sehen bekommt. Also:

- `newsletter` **entfällt**. Es wird kein Newsletter-Modul geben (F8), und die
  Einladung ehemaliger Teilnehmender ist ausdrücklich nicht dasselbe (F55). Die
  Opt-In-Verwaltung aus FR 4.8 bekommt in Phase 3 einen eigenen Schlüssel, wenn
  sie kommt.
- `chat`, `profiles`, `profile-search` **entfallen** und kommen in Phase 3 mit
  ihren Modulen zurück. Die Deskriptorliste ist kein Fahrplan.
- `push` **bleibt und wird echt**: `POST /api/user/push/subscriptions` bekommt
  `@CoreModuleController('push')`, und `webPushPublicKey` in `/api/config` ist
  `null`, solange das Modul aus ist — der Client bietet dann kein Abonnement an.
  Damit gates der Schalter etwas Wirkliches (ob Endpunkte für Abonnements
  überhaupt antworten und ob Browser-Endpunkte gespeichert werden, NFR 7), und
  der Versand aus Phase 3 liest denselben Schalter.

Phase 2 hat damit zwei abschaltbare Kernmodule und die kuratierten Plug-ins.

**E22 — Der Übersetzungskatalog wird vom Server ausgeliefert, nicht vom
Client-Image.** „Neue Sprachen müssen durch die Organisation pflegbar sein"
(Kapitel 4) schließt Compile-Time-i18n aus — und JSON-Dateien im Client-Image
genauso, denn die ändert man nur durch einen Neubau. Also Transloco mit eigenem
Loader gegen `GET /api/i18n/:locale` (öffentlich, ohne Login: der Nutzer-Client
braucht Texte, bevor es einen Login gibt). Geantwortet wird der **mitgelieferte**
Katalog der Locale, überlagert von den **Änderungen der Instanz** aus der
Datenbank. Die mitgelieferten Kataloge liegen als JSON in
`libs/shared-i18n/catalogues/*.json` und werden vom Server-Build in das Image
kopiert — gelesen zur Laufzeit von der Platte, **nicht importiert**: der Server
importiert weiterhin nur `@trefaro/shared-models` (ein Import brächte die Frage
auf, ob Client-Text eine Vertragsschicht ist; eine kopierte Datei nicht).
Derselbe Katalog bedient beide Clients **und** die Mails (AP 10) — sonst gibt es
zwei Orte für „Anmeldung bestätigen".

**E23 — Eine Sprache darf unvollständig sein, aber nie unsichtbar
unvollständig.** Auflösungskette je Schlüssel: Änderung der Instanz →
mitgelieferte Locale → mitgeliefertes Englisch. So ist eine zu 60 % übersetzte
Sprache benutzbar, statt Lücken als leere Knöpfe zu zeigen. Damit „60 %" nicht
verborgen bleibt, nennt die Sprachverwaltung je Locale die Zahl und die fehlenden
Schlüssel. Englisch ist die Schlüsselliste; ein CI-Test prüft, dass jede
mitgelieferte Locale nur bekannte Schlüssel benutzt und Deutsch vollständig ist.

**E24 — Eine Mail fällt als Ganzes zurück, nicht Schlüssel für Schlüssel.**
Fehlt in der gewünschten Sprache **ein** Baustein einer Mail, geht die ganze Mail
in der Standardsprache raus. Grund: ein englischer Absatz mitten in einer
deutschen Mail liest sich wie ein Fehler, eine englische Beschriftung in einer
deutschen Oberfläche nur wie eine fehlende Übersetzung. Der Unterschied ist, dass
niemand eine Mail neu laden kann. Damit verliert AP 4 der Phase 1 seine
Compile-Time-Garantie (ein Interface je Locale) — sie wird zum Test über die
mitgelieferten Kataloge plus dieser Regel zur Laufzeit.

**E25 — Inhaltsübersetzungen sind feldweise, additiv und ohne eigene
Sprachliste.** Drei Tabellen (Reihe, Event, Programmpunkt), Primärschlüssel
`(<parent>_id, locale)`, `ON DELETE CASCADE`. Übersetzt wird nur, was gelesen
wird: Name, Beschreibung, Ortsbezeichnung, Follow-Up-Text, Titel eines
Programmpunkts. **Nicht** übersetzt werden Adressen und Personennamen
(`venue_address`, `speaker`) — eine übersetzte Straße schickt Menschen an den
falschen Ort. Fehlt eine Übersetzung, steht das Original da; ein Feld ist nie
leer, weil eine Sprache fehlt. Die Zielsprachen sind die `active_locales` der
Instanz: `event.languages` behält seine Bedeutung aus FR 3.1 (in welchen Sprachen
die Veranstaltung stattfindet) und ist nicht dasselbe — eine englischsprachige
Konferenz darf eine deutsche Landingpage haben. „Sprachen pro Event
konfigurieren" (FR 3.12) ist erfüllt, indem eine Übersetzung existiert oder
nicht. Gelesen wird mit `?locale=` in der Query, nicht über `Accept-Language`:
eine geteilte oder zwischengespeicherte URL muss dieselbe Seite zeigen.

**E26 — Das Manifest kommt vom Server, und die Instanz hat einen Namen.** Ein
Manifest mit `name: "Trefaro"` ist kein Whitelabel. `app_config` bekommt
`organization_name` (auch für `<title>`, Kopfzeile und Mail-Absendername) und
`app_icon_path`; `GET /api/config/manifest.webmanifest` setzt daraus `name`,
`short_name`, `theme_color` und `icons`. Das App-Icon ist ein **zweiter,
optionaler** Upload, quadratisch, weil ein Logo im Briefkopfformat auf einem
Startbildschirm beschnitten wird. Ohne Upload bleiben die mitgelieferten
Trefaro-Icons — sie sind für `purpose: "maskable"` gestaltet, ein hochgeladenes
Icon wird nur als `"any"` deklariert: `maskable` für ein Bild zu behaupten, dessen
Schutzrand wir nicht kennen, erzeugt ein beschnittenes Logo. Kein
Bildbearbeitungs-Paket im Image (`sharp` wäre eine native Abhängigkeit für ein
Rätselraten über den Bildaufbau).

**E27 — Der Service Worker speichert keine API-Antworten.** Keine `dataGroups`
in v1. Die App-Shell wird zwischengespeichert (das macht die PWA installierbar und
schnell), Daten kommen immer aus dem Netz, und offline zeigt der Client einen
ausdrücklichen Zustand statt einer alten Seite. Grund: Phase 3 setzt einen
Teilnehmer-Login davor, und eine zwischengespeicherte Antwort, die eine Sitzung
überlebt, ist auf einem geteilten Gerät ein Datenschutzproblem (NFR 7) — der
Nutzen einer veralteten Eventseite wiegt das nicht auf.

**E28 — Die Ersteinrichtung ist durch ein Token geschützt, das beim Start ins Log
geht.** `GET /api/setup/state` und `POST /api/setup/admin` existieren **nur**,
solange `admin_user` leer ist, und verlangen ein Token, das der Server in diesem
Fall bei jedem Start einmal ins Log schreibt (im Speicher, nicht gespeichert).
Grund: eine frische Instanz ist erreichbar, bevor der Betreiber den Browser
öffnet — ohne Token gehört sie dem, der zuerst kommt. Das Log hat der Betreiber,
er hat `docker compose up` getippt. `ADMIN_BOOTSTRAP_*` (E3) bleibt für
unbeaufsichtigte Installationen, CI und `tools/demo-seed`; sobald ein Zugang
existiert, antwortet die Setup-Route 404 wie ein abgeschaltetes Modul.

**E29 — TLS ist ein Compose-Overlay, kein Umbau.**
`infra/docker-compose.tls.yml` plus `infra/nginx/trefaro-tls.conf`: Zertifikat und
Schlüssel werden hineingemountet, NGINX hört auf 443 und leitet von 80 um. Die
Beschaffung bleibt draußen und dokumentiert (Let's Encrypt auf dem Host, ein
vorhandenes Zertifikat der Organisation, oder ein Terminator davor). Grund gegen
Certbot im Stack: ein sechster Container, ein Erneuerungszeitplan und ein Anspruch
auf Port 80 — und viele Organisationen terminieren TLS ohnehin zentral. `Secure`
fallen zu lassen ist keine Alternative (E2).

---

## Datenbankschema der Phase

Eine Migration je Arbeitspaket, explizites SQL, `down` mitgeschrieben. Die
Kerntabellen aus Phase 0/1 werden nur um Spalten erweitert, nie umgebaut.

```
app_config        + organization_name  varchar(128) NOT NULL DEFAULT 'Trefaro'
                  + app_icon_path      varchar(512)                    ← E26
                  ← logo_path/app_icon_path zeigen ab AP 2 in den Teilbaum
                    branding/ des Upload-Volumes, nie in attachments/ (E19)

translation_override (locale varchar(16), key varchar(200), value text,
                   updated_at)
                   PK (locale, key)
                   ← die Änderungen der Instanz am mitgelieferten Katalog (E22).
                     Kein Fremdschlüssel auf active_locales: eine Sprache wird
                     angelegt, indem man sie übersetzt, und aus app_config
                     entfernt, ohne die Arbeit zu löschen

event_series_translation (series_id → event_series [ON DELETE CASCADE],
                   locale, name?, description?, updated_at)
                   PK (series_id, locale)
event_translation (event_id → event [ON DELETE CASCADE], locale,
                   name?, description?, venue_name?, follow_up_body?, updated_at)
                   PK (event_id, locale)
program_item_translation (program_item_id → program_item [ON DELETE CASCADE],
                   locale, title?, description?, updated_at)
                   PK (program_item_id, locale)
                   ← alle drei: jede Spalte nullbar, denn feldweise heißt
                     feldweise (E25); NULL bedeutet „Original benutzen", nicht
                     „leer". venue_address und speaker fehlen absichtlich
```

Der Schemaentwurf 5.3 nennt `event_translation` und `program_item_translation`,
aber keine Übersetzung der Reihe. Die kommt dazu (→ F61): die Startseite des
Nutzer-Clients listet Reihen, und ein unübersetzter Reihenname auf einer
übersetzten Seite ist genau das Loch, das FR 3.12 schließen soll.

Kein Schema für das Setup-Token (E28: Speicher) und keins für die Schriftarten
(E18: Katalog im Code).

---

## API-Oberfläche

| Methode + Pfad                                              | Zweck                                                      | AP  |
| ----------------------------------------------------------- | ---------------------------------------------------------- | --- |
| `GET/PATCH /api/admin/config`                               | FR 1.4: Name, Farben, Schrift, Locales                     | 1   |
| `PUT/DELETE /api/admin/config/logo`                         | Logo hoch- und wegnehmen                                   | 2   |
| `PUT/DELETE /api/admin/config/app-icon`                     | App-Icon (E26)                                             | 2   |
| `GET /api/media/branding/logo` · `app-icon`                 | öffentlich, ohne Pfad vom Aufrufer (E19)                   | 2   |
| `GET /api/admin/modules`                                    | FR 1.5: Kernmodule und Plug-ins mit Zustand                | 4   |
| `PATCH /api/admin/modules/:key`                             | an/aus, mit `refresh()` auf beiden Registries              | 4   |
| `GET /api/setup/state` · `POST /api/setup/admin`            | FR 1.1: geführte Ersteinrichtung, 404 danach (E28)         | 5   |
| `GET /api/i18n/:locale`                                     | Katalog, öffentlich (E22)                                  | 6   |
| `GET /api/admin/i18n`                                       | Locales mit Vollständigkeit und fehlenden Schlüsseln (E23) | 7   |
| `PUT/DELETE /api/admin/i18n/:locale`                        | Änderungen der Instanz schreiben, zurücksetzen             | 7   |
| `GET /api/config/manifest.webmanifest`                      | F20, aus der Konfiguration gebaut (E26)                    | 12  |
| `GET/PUT/DELETE /api/admin/series/:id/translations/:locale` | FR 3.12                                                    | 11  |
| `GET/PUT/DELETE /api/admin/events/:id/translations/:locale` | FR 3.12                                                    | 11  |
| `… /api/admin/program-items/:id/translations/:locale`       | FR 3.12                                                    | 11  |
| `GET /api/user/**?locale=…`                                 | die öffentlichen Leseendpunkte nehmen eine Locale (E25)    | 11  |

`GET /api/config` wächst um `organizationName`, `publicUserClientUrl` (damit der
Veranstalter-Client auf die öffentliche Seite verlinken kann — steht seit AP 10
der Phase 1 in `todo.md`) und um Manifest-taugliche Icon-URLs; `webPushPublicKey`
wird `null`, wenn das Modul aus ist (E21).

Jeder Payload-Typ liegt in `libs/shared-models`.

---

## Arbeitspakete

Reihenfolge = Abhängigkeits- **und** Prioritätsreihenfolge: FR 1.4, 1.5 und 1.1
sind P1, FR 3.12 ist P2. Jedes Paket endet mit lauffähiger, prüfbarer Software,
eigenen Unit-Tests, mindestens einem E2E- oder API-Vertragstest und einem
Conventional Commit.

### AP 1 — Konfiguration schreibbar machen (FR 1.4, Teil 1)

Der kürzeste Weg zu einer Instanz, die nicht mehr nach Trefaro aussieht.
Server: `business/config/` bekommt `AdminConfigController`,
`ConfigurationService.update…`, DTOs mit der Hex-Prüfung (E17) und der
Schriftart-Prüfung gegen den Katalog (E18); der Port `AppConfigRepository` lernt
`save`. Migration: `organization_name`. `shared-models`:
`FONT_FAMILIES`, `AppConfigSettings`, `organizationName` und
`publicUserClientUrl` in `AppConfig`. `shared-theming`: die Schriftdateien und
das `@font-face`-Stylesheet, von beiden Client-Builds kopiert.

**Fertig, wenn** ein `PATCH` mit `#123456` durchgeht, mit `red` und mit
`rgba(0,0,0,.5)` 400 gibt, ein Neuladen beider Clients die neue Farbe und Schrift
zeigt — auch **innerhalb** der Raumplanungs-Webkomponente — und
`readableTextColor` bei einer hellen Akzentfarbe schwarze Schrift wählt.

### AP 2 — Logo und App-Icon (FR 1.4, Teil 2)

Server: `PUT/DELETE` für beide Bilder, `MediaController` unter `/api/media`
(öffentlich, ohne Pfadparameter, E19), Branding-Teilbaum im `FileStore`,
Migration `app_icon_path`,
Typprüfung gegen die ersten Bytes (F38) mit PNG/JPEG/WebP — **kein SVG**, weil es
aus derselben Origin geliefertes Skript wäre —, eigene, deutlich kleinere
Größengrenze als `MAX_UPLOAD_BYTES`, `?v=` und Cache-Header (E19).
`ConfigurationService` baut die Logo-URL nicht mehr aus dem gespeicherten Pfad.

**Fertig, wenn** ein hochgeladenes Logo ohne Login unter
`/api/media/branding/logo?v=…` erscheint, ein umbenannter Anhangpfad dort **nicht**
erreichbar ist, eine als PNG deklarierte ZIP-Datei 400 bekommt und ein zweiter
Upload sofort das neue Bild zeigt (neues `?v=`).

### AP 3 — Design-Einstellungsseite (FR 1.4, Teil 3) → **Meilenstein M3**

Veranstalter-Client: Seite „Design" mit Farbwählern, Schriftauswahl,
Organisationsname, den zwei Uploads mit Vorschau, Live-Vorschau im eigenen
Dokument und Zurücksetzen (E20); ein Kontrasthinweis, wenn Primär- oder
Akzentfarbe gegen ihre berechnete Textfarbe unter 4,5:1 liegt (NFR 4). Beide
Clients zeigen Logo und Organisationsname in der Kopfzeile statt „Trefaro".

**Fertig, wenn** ein Veranstalter Farbe, Schrift, Name und Logo ohne
Datenbankzugriff ändert, die Vorschau vor dem Speichern wirkt und ein Abbrechen
sie zurücknimmt, und die Startseite des Nutzer-Clients nach einem Neuladen die
Marke der Organisation trägt.

### AP 4 — Modul- und Plug-in-Verwaltung (FR 1.5)

Server: `AdminModulesController` (Liste mit Deskriptor, Zustand, bei Plug-ins
Version und Bundle), `PATCH` schreibt `module_config` und ruft **beide**
`refresh()` (sonst wartet der Veranstalter eine Viertelminute auf seinen eigenen
Klick); `CORE_MODULES` wird auf E21 zusammengezogen; `push` bekommt seinen Guard
und `webPushPublicKey` seine Bedingung. Veranstalter-Client: die Modulseite wird
schreibend, Ladefehler eines Bundles bleiben sichtbar. Nutzer-Client: die
Kacheln in der Event-Detailansicht entstehen hier — je aktiviertem Modul und je
Plug-in am Einhängepunkt `event-detail` eine, „Programmplan" verlinkt auf die
Timeline aus AP 8 der Phase 1 (Mockups 5.2, steht in `todo.md`).

**Fertig, wenn** das Abschalten von `media-links` in der Oberfläche die Kachel
und die Dashboard-Kachel beim nächsten Neuladen verschwinden lässt — nicht
fünfzehn Sekunden später —, der zugehörige öffentliche Endpunkt 404 antwortet,
das Anschalten eines Plug-ins es ohne Redeploy erscheinen lässt, und
`/api/config` keinen VAPID-Schlüssel mehr nennt, wenn `push` aus ist.

### AP 5 — Installations-Story (FR 1.1, NFR 15) → **Meilenstein M4**

Server: `SetupController` mit Token (E28), Prüfung „kein Admin vorhanden" als
einzige Existenzbedingung, Drosselung wie beim Login, und ein Startlog, das das
Token und die fehlenden Pflichtwerte nennt. Nutzer- oder Veranstalter-Client:
der Einrichtungsassistent (Zugang, Organisationsname, Sprache, Farben) im
Veranstalter-Client, erreichbar nur solange die Setup-Route existiert.
Infrastruktur: `infra/docker-compose.tls.yml` + `trefaro-tls.conf` (E29).
Dokumentation: `docs/INSTALL.md` — Voraussetzungen, `.env`, erster Start, TLS,
SMTP, Sicherung der beiden Volumes, Aktualisieren (Migrationen laufen beim
Start), und die Werte, ohne die eine Instanz nicht startet oder niemand sich
anmelden kann.

**Fertig, wenn** ein Fünf-Container-Stack aus leerem Volume hochkommt, der
Assistent mit dem Token aus dem Log den ersten Administrator anlegt, die
Setup-Route danach 404 gibt, ein zweiter Aufruf mit falschem Token 401 gibt, und
derselbe Stack mit einer zusätzlichen `-f`-Datei und einem Zertifikat über HTTPS
bedienbar ist — inklusive Login, was ohne TLS außerhalb von `localhost` nicht
geht (E2).

### AP 6 — Transloco und der Katalog vom Server (Kap. 4)

`@jsverse/transloco` (MIT, Peer `@angular/core >=16`) in beide Clients, eigener
Loader gegen `GET /api/i18n/:locale`, `setAvailableLangs()` aus der geholten
Konfiguration (die Locales stehen erst zur Laufzeit fest), Sprachumschalter in
beiden Shells, Auswahl im `localStorage`, Fallback nach E23. Server:
`business/i18n/` mit Katalogleser, Overlay aus `translation_override`, ETag;
`libs/shared-i18n/catalogues/{en,de}.json` und die Kopie in beide Images.
`<html lang>` folgt der Sprache, `titleKey`/`labelKey` aus Plug-in-Vertrag und
`CORE_MODULES` lösen jetzt auf.

**Beginnt mit einer kleinstmöglichen Prüfung**, dass ein Sprachwechsel in einem
**zoneless** Angular-Client tatsächlich neu zeichnet — vor 10 000 Zeilen
Textextraktion, nicht danach. Falls `reRenderOnLangChange` dort nicht greift, ist
die signalbasierte Lesart der Ausweg.

**Fertig, wenn** der Umschalter in beiden Clients die Modulnamen und die
Plug-in-Beschriftung wechselt, ein fehlender Schlüssel in `de` den englischen
Text zeigt statt einer leeren Fläche, und ein `PUT` auf einen Schlüssel nach
einem Neuladen wirkt — ohne Neubau.

### AP 7 — Sprachen pflegbar machen (Kap. 4)

Veranstalter-Client: Seite „Sprachen" — Liste der Locales mit
Vollständigkeitszahl, Anlegen einer Locale (BCP-47-Tag), Bearbeiten je Schlüssel
mit dem mitgelieferten Text daneben, Filter „nur fehlende", Zurücksetzen eines
Schlüssels, Export/Import als JSON für Übersetzungsarbeit außerhalb der App;
`active_locales` und `default_locale` werden hier gesetzt. Server: die
Vollständigkeitsrechnung, der CI-Test aus E23.

**Fertig, wenn** eine dritte Sprache ohne Neubau des Images entsteht, in beiden
Clients auswählbar ist, ihre Zahl von 0 % auf einen echten Wert steigt, und das
Entfernen einer Locale aus `active_locales` die schon geleistete Übersetzung
nicht löscht.

### AP 8 — Nutzer-Client übersetzen (NFR 4, 6)

Jeder Text aus dem Template in den Katalog: sieben Seiten plus Diagnoseseite,
Shell, Formulare,
Fehlermeldungen, Datums- und Zeitformate (die Helfer aus `shared-models`
bekommen eine Locale, statt sie zu erfinden — E8 bleibt unberührt),
`MEDIA_LINK_KIND_LABELS` und die Abschnittsüberschriften aus AP 11 der Phase 1.
Keine Umformulierung während der Extraktion: eine geänderte Formulierung ist ein
eigener Commit, sonst verbirgt sich eine inhaltliche Änderung in tausend
Textverschiebungen.

**Fertig, wenn** eine Volltextsuche über `apps/user-client/src` keinen
sichtbaren englischen Satz mehr in einem Template findet, die Landingpage auf
Deutsch vollständig deutsch ist, und die Playwright-Suite gegen
Übersetzungsschlüssel statt gegen englische Beschriftungen prüft.

### AP 9 — Veranstalter-Client übersetzen (NFR 4, 6)

Dasselbe für elf Seiten, Tabellen, Dialoge und die Validierungstexte. Umfangreicher
als AP 8 und deshalb ein eigenes Paket.

**Fertig, wenn** ein Veranstalter die Anwendung auf Deutsch von der Anmeldung bis
zum Einladungsversand bedienen kann und die Teilnehmerübersicht auch auf Deutsch
die E-Mail-Spalte an derselben Stelle zeigt (die Korrektur aus dem
Usability-Test).

### AP 10 — Die Mails aus demselben Katalog (Kap. 4)

`business/mail/templates` liest den Katalog statt der TypeScript-Datei je Locale;
die vier Mails (Bestätigungsaufforderung, Empfangsbestätigung, Stornohinweis,
Einladung) werden Schlüssel mit Platzhaltern, die HTML-Hülle bleibt Code. E24:
ein fehlender Baustein lässt die ganze Mail in die Standardsprache fallen —
geprüft, nicht behauptet.

**Fertig, wenn** eine Organisation den Betreff der Bestätigungsmail ohne Neubau
ändert, eine unvollständige Locale eine vollständige englische Mail erzeugt statt
einer gemischten, und die vier Mails in Mailpit in beiden Sprachen richtig
aussehen.

### AP 11 — Inhaltsübersetzungen (FR 3.12)

Server: drei Tabellen, drei Ports, ein `TranslationsService`, `?locale=` auf den
öffentlichen Leseendpunkten mit Rückfall auf das Original (E25);
Veranstalter-Client: je Reihe, Event und Programmpunkt ein eigener Reiter je
Zielsprache — nie im Hauptformular, das die Standardsprache bleibt.
Nutzer-Client: die gewählte Sprache reist mit.

**Fertig, wenn** ein Event mit deutscher Übersetzung auf Deutsch deutsch und auf
Englisch englisch erscheint, ein Programmpunkt ohne Übersetzung sein Original
zeigt statt einer Lücke, `venue_address` in jeder Sprache identisch ist, und das
Löschen eines Events seine Übersetzungen mitnimmt.

### AP 12 — PWA-Ausbau (F20)

Manifest aus der Konfiguration (E26), `theme-color` und `<html lang>` zur
Laufzeit statt hart kodiert, Offline-Zustand statt weißer Seite, ein Hinweis auf
Installierbarkeit, `ngsw-config.json` erneut geprüft (die `/admin`-Lehre aus
AP 13 der Phase 1) und `verify-proxy.mjs` um Manifest und Icons erweitert. Keine
`dataGroups` (E27).

**Fertig, wenn** eine Installation auf einem Android-Gerät das Icon und den Namen
der Organisation zeigt, ein Wechsel der Primärfarbe nach Neuinstallation im
Splash sichtbar ist, und der Client offline eine erkennbare Seite statt eines
Browserfehlers zeigt. Der Nachweis braucht ein Gerät; was ohne Gerät prüfbar ist,
prüft `verify-proxy.mjs`.

### AP 13 — Abschluss der Phase → **Meilenstein M5**

`todo.md` unter _Checkable after phase 2_ durchgehen (abhaken oder mit Begründung
verschieben), F60–F65 im Referenzdokument nachtragen, den Fünf-Container-Stack
aus dem Stand hochfahren, `tools/spike-verification/` und `tools/demo-seed/` auf
den neuen Stand ziehen (der Seed sollte künftig auch Übersetzungen und ein Logo
anlegen), `docs/PHASE2.md` von Plan auf Protokoll korrigieren und _Was anders
lief_ schreiben. `CLAUDE.md` bekommt den Stand nach Phase 2.

---

## Meilensteine

| Meilenstein | Nach  | Inhalt                                                                         |
| ----------- | ----- | ------------------------------------------------------------------------------ |
| M3          | AP 3  | Die Instanz trägt die Marke der Organisation, ohne Datenbank und ohne Neubau   |
| M4          | AP 5  | Alle P1 dieser Phase: brandbar, konfigurierbar, selbst installierbar (mit TLS) |
| M5          | AP 13 | Phase 2 abgeschlossen, Mehrsprachigkeit und PWA geprüft                        |

**M4 ist der Stand, an dem die fünf Fragen an den Pilotpartner sinnvoll gestellt
werden können** — eine Instanz, die Democracy International selbst aufsetzen,
branden und benutzen kann. Vorschlag, keine Zusage: die Entscheidung vom
28.08.2026 lautet „später, an einem weiter entwickelten Stand", und wann das ist,
entscheidet Marius.

## Querschnittsregeln für jedes Arbeitspaket

- **Erst der Test, dann der Code.** Unit-Tests je Service und Guard, API-Vertrag
  in `apps/server-e2e`, Oberfläche in `apps/*-e2e` (Chromium, Firefox, WebKit).
- **Schichtgrenzen nicht verhandeln.** Bei einem Linter-Verstoß wird ein Port
  eingezogen, nicht die Regel gelockert. Der Server importiert weiterhin nur
  `@trefaro/shared-models` (E22 hält das ein).
- **Eine Migration pro Arbeitspaket**, explizites SQL, `down` mitgeschrieben und
  einmal wirklich ausgeführt.
- **Kein neuer Schalter, der nichts liest** (E21) und kein neuer Wert, den
  `infra/docker-compose.yml` nicht durchreicht (die Lehre aus AP 13).
- **Deutsch mit Marius, Englisch im Code**; Conventional Commits.
- **Kein Google-Dienst**, keine Abhängigkeit mit AGPL-inkompatibler Lizenz — in
  dieser Phase besonders zu beachten: Schriftarten (E18) und alles, was ein
  Manifest oder ein Icon anfassen will.
- **Nach jedem Paket** `nx run-many -t lint test build` und die E2E-Suiten grün,
  dann committen.

## Risiken

| Risiko                                                                                                                                                      | Gegenmaßnahme                                                                                                                                                                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Die Textextraktion ist der halbe Phasenumfang.** ~10 200 Zeilen Client-Code, alle Texte im Template; „3–4 Wochen" im Referenzdokument sind dafür zu wenig | Zwei eigene Pakete (AP 8, AP 9), Schlüsselkonvention einmal in AP 6 entschieden, keine Umformulierung während der Extraktion, und die Reihenfolge so, dass die P1-Anforderungen (AP 1–5) vorher fertig sind |
| Transloco und **zoneless** Angular 22 vertragen sich nicht                                                                                                  | AP 6 beginnt mit der kleinsten Prüfung, die das zeigt, bevor irgendein Text umgezogen wird; Ausweg ist die signalbasierte Lesart statt `reRenderOnLangChange`                                               |
| Ein Plug-in bringt eigenes CSS mit und ignoriert das Theme                                                                                                  | Die Raumplanung ist der Prüffall: der Plug-in-E2E-Test prüft, dass die Webkomponente in der konfigurierten Primärfarbe rendert                                                                              |
| Ein Logo im falschen Seitenverhältnis zerlegt die Kopfzeile                                                                                                 | Bytegrenze, `max-block-size` im CSS, Vorschau in der Einstellungsseite — und ein getrenntes App-Icon (E26), damit nicht ein Bild zwei Formate erfüllen muss                                                 |
| Die Setup-Route ist eine neue unauthentifizierte Oberfläche                                                                                                 | Token aus dem Log (E28), Drosselung wie beim Login, Existenz nur bei leerer `admin_user`-Tabelle, und ein Vertragstest, der 404 nach dem ersten Zugang festschreibt                                         |
| Inhaltsübersetzungen verdoppeln die Bearbeitungsfläche jedes Events                                                                                         | Übersetzungen leben in einem eigenen Reiter je Sprache, nie im Hauptformular; nullbare Spalten heißen „Original benutzen"                                                                                   |
| Was nur im Produktionsbuild passiert (Service Worker, Manifest, `Secure`-Cookie), sieht keine Suite dieses Repositories                                     | `tools/spike-verification/` gegen den laufenden Stack ist das Netz — und wird in AP 5 und AP 12 erweitert, nicht erst am Phasenende benutzt                                                                 |

## Nachträge am Referenzdokument — geplant

Wird beim jeweiligen Paket eingetragen, nicht am Ende gesammelt:

| Nr. | Inhalt                                                                                            | AP  |
| --- | ------------------------------------------------------------------------------------------------- | --- |
| F60 | `app_config` bekommt `organization_name` und `app_icon_path`; Ergänzung zu Schema 5.3 (E26)       | 1   |
| F61 | Übersetzungstabelle auch für `event_series`, und was **nicht** übersetzt wird (E25)               | 11  |
| F62 | Der Übersetzungskatalog wird vom Server ausgeliefert — so wird Kapitel 4 eingelöst (E22–E24)      | 6   |
| F63 | `CORE_MODULES` listet nur Module, die es gibt; `newsletter` entfällt (E21, Bezug F8)              | 4   |
| F64 | Die Ersteinrichtung ist tokengeschützt; `ADMIN_BOOTSTRAP_*` bleibt der unbeaufsichtigte Weg (E28) | 5   |
| F65 | Die Schriftart ist ein mitgelieferter Katalog, kein Upload (E18, Bezug NFR 9)                     | 1   |

Anhangspunkt 18 (TLS gehört zur Installations-Story) wird in AP 5 von „geplant"
auf „umgesetzt" gezogen.

## Definition of Done für Phase 2

1. Jedes Arbeitspaket hat sein Abnahmekriterium nachweislich erfüllt;
   `nx run-many -t lint test build` und alle E2E-Suiten sind grün.
2. Eine Organisation kann ohne Datenbankzugriff und ohne Neubau eines Images:
   ihre Instanz benennen und branden (Name, zwei Farben, Logo, App-Icon,
   Schrift), Module und Plug-ins schalten, eine Sprache hinzufügen und
   Oberfläche, Mails und Eventinhalte darin pflegen, und den Nutzer-Client mit
   ihrem eigenen Icon als PWA installieren.
3. Ein frischer Fünf-Container-Stack kommt aus leerem Volume hoch, die geführte
   Ersteinrichtung legt den ersten Administrator an, und TLS lässt sich mit einer
   zusätzlichen Compose-Datei einschalten — von Hand geprüft, mit
   `tools/spike-verification/` belegt.
4. `docs/INSTALL.md` existiert und ist von jemandem nachvollziehbar, der dieses
   Repository nicht kennt (NFR 8).
5. `todo.md` unter _Checkable after phase 2_ ist durchgearbeitet, F60–F65 stehen
   im Referenzdokument.
6. Dieses Dokument ist von Plan auf Protokoll korrigiert und hat einen Abschnitt
   _Was anders lief_.

---

## Fortschritt

Noch nichts begonnen. Je Paket kommt hier ein Abschnitt „erledigt" mit dem, was
tatsächlich passierte — wie in [`PHASE1.md`](PHASE1.md).

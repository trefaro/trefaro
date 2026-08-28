# Phase 2 — Whitelabel, Konfiguration, Mehrsprachigkeit, PWA

**Status: in Arbeit** (28.08.2026). **AP 1 bis AP 6 sind erledigt** (siehe
_Fortschritt_) — damit sind **Meilenstein M3** und **Meilenstein M4** erreicht;
die Abschnitte oberhalb davon sind Plan, nicht Protokoll. Wie in Phase 1 gibt
Marius jedes Paket einzeln frei — AP 7 wartet auf seine Freigabe.

**Die Entscheidungen E17–E29 sind am 28.08.2026 von Marius bestätigt** — sie
werden nicht erneut aufgerollt, sondern nur gegen die Umsetzung geprüft (wie
F22–F24 in AP 13 der Phase 1). Eine davon trägt eine ausdrückliche Ausbaustufe:
E18.

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

Bestätigt am 28.08.2026 mit einer ausdrücklichen Ausbaustufe: „erstmal ein
mitgelieferter Katalog, das kann im Zweifelsfall noch ausgebaut werden." Der
Upload ist damit nicht verworfen, sondern zurückgestellt — und der Katalog ist
die Stelle, an der er andockt: `font_family` bliebe, dazu käme ein `font_source`
für die ausgelieferte Datei. Steht in `todo.md`, zu entscheiden, sobald eine
Organisation ihre Hausschrift wirklich vermisst; der Preis ist dann die
Lizenzfrage, nicht der Code.

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
verschieben), F60–F68 im Referenzdokument nachtragen, den Fünf-Container-Stack
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
| F66 | Wie ein Logo öffentlich wird, ohne die Anhänge mitzunehmen (E19, Bezug E9, F38)                   | 2   |
| F67 | Welcher Kontrast geprüft wird — und warum nicht der gegen die berechnete Textfarbe (NFR 4, E17)   | 3   |
| F68 | Wie die Kacheln der Event-Detailansicht entstehen (Mockups 5.2, Bezug F47)                        | 4   |
| F69 | Warum der Setup-Controller `@AllowAnonymous()` trägt — der Admin-Guard überschätzt (Bezug E16)    | 5   |
| F70 | Gestalt und Herkunft eines Übersetzungsschlüssels; flach, gepunktet, `lowerCamelCase` (E22)       | 6   |
| F71 | Welche Sprachen eine frische Instanz anbietet — die, die das Image mitbringt (NFR 4)              | 6   |
| F72 | Transloco und zoneless: was die Vorprüfung wirklich fand (Bezug E20)                              | 6   |

Anhangspunkt 18 (TLS gehört zur Installations-Story) ist in AP 5 von „geplant"
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
5. `todo.md` unter _Checkable after phase 2_ ist durchgearbeitet, F60–F68 stehen
   im Referenzdokument.
6. Dieses Dokument ist von Plan auf Protokoll korrigiert und hat einen Abschnitt
   _Was anders lief_.

---

## Fortschritt

Je Paket ein Abschnitt „erledigt" mit dem, was tatsächlich passierte — wie in
[`PHASE1.md`](PHASE1.md). Abweichungen vom Plan stehen hier, damit AP 13 sie
nicht rekonstruieren muss.

### AP 1 — Konfiguration schreibbar machen (erledigt)

Umgesetzt:

- **`shared-models`** — `FONT_FAMILIES` mit fünf Einträgen (`system-ui`, Inter,
  Source Sans 3, Atkinson Hyperlegible Next, Lora), `fontFamilyStack`,
  `isFontFamilyKey`, `HEX_COLOR_PATTERN`/`isHexColor` (E17), `AppConfigSettings`
  und `AppConfigChange`; `AppConfig` trägt jetzt `organizationName` und
  `publicUserClientUrl`.
- **`shared-theming`** — die acht `woff2`-Dateien (vier Familien × `latin` und
  `latin-ext`, Gewichtsachse variabel, aufrecht), die vier OFL-Texte, ein
  `fonts.css` mit den `@font-face`-Blöcken und ein `fonts/README.md` mit der
  Herkunft. Beide Client-Builds nehmen `fonts.css` in ihre `styles` — dadurch
  emittiert der Bundler die Dateien gehasht, und sie landen in der
  `assets`-Gruppe von `ngsw.json`.
- **Server** — Migration `InstanceIdentity`, `AdminConfigController`
  (`GET`/`PATCH /api/admin/config`), `ConfigurationService.getSettings` und
  `.updateSettings` mit beiden Prüfungen, `AppConfigRepository.save`,
  `AppConfigSettingsDto`/`UpdateAppConfigDto`. `/api/config` liefert
  `organizationName`, `publicUserClientUrl` und den **expandierten** Stack.

Nachweise: 12 neue Unit-Tests (`shared-models`, `ConfigurationService`), 8 neue
API-Vertragstests, 3 neue Browser-Tests über alle drei Engines. `down` der
Migration einmal wirklich ausgeführt und wieder hochgezogen. F60 und F65 stehen
im Referenzdokument, Anhangspunkt 19 dazu.

Abweichungen und ihre Gründe:

- **Die Migration ändert zwei Dinge, nicht eines.** Geplant war nur
  `organization_name`. E18 sagt aber, dass der Katalog die Schriftart entscheidet,
  und damit hält `font_family` einen **Schlüssel** statt eines CSS-Stacks — sonst
  wäre die Prüfung ein Vergleich gegen Stack-Zeichenketten, und ein korrigierter
  Fallback würde gespeicherte Zeilen ungültig machen. Also im selben Paket: ein
  pauschales `UPDATE` (Phase 1 hatte keinen Schreibweg, der Wert _ist_ auf jeder
  existierenden Instanz der gesäte Stack) und `varchar(64)` statt 256. Kein
  `CHECK` — dieselbe Linie wie `kind` in `media_link` (F52).
- **Die Locales bleiben draußen.** `AppConfigSettings` hat vier Felder, nicht
  sechs: eine Sprachliste, die kein Modul liest, wäre ein Schalter ohne Wirkung.
  `default_locale`/`active_locales` werden in AP 7 schreibbar, zusammen mit der
  Sprachverwaltung, die sie braucht.
- **Der Katalog liefert `Atkinson Hyperlegible Next`, nicht `Atkinson
Hyperlegible`.** Die Variable-Font-Fassung der Familie; der Schlüssel heißt
  deshalb `atkinson-hyperlegible-next`, weil der Schlüssel das ist, was in der
  Datenbank stehen bleibt.
- **Kein Italic, und nur `latin`/`latin-ext`.** Die Clients setzen nirgends
  `font-style: italic` (geprüft), also synthetisiert der Browser bei Bedarf eine
  Kursive statt acht weitere Dateien mitzubringen. Griechisch, Kyrillisch und
  Vietnamesisch fehlen im Katalog — eine bekannte Grenze, notiert in
  `fonts.css`, keine Grenze des Mechanismus.
- **Der Beweis der Kette liegt in zwei Suiten, nicht in einer.** `app_config` ist
  eine einzige Zeile, die die ganze Instanz liest, und Playwright fährt seine
  Dateien parallel: eine Browsersuite, die die Instanz umfärbt, hätte eine
  fremde Suite an der Farbe scheitern lassen, die sie prüft. Also: das
  **Schreiben** in `apps/server-e2e/src/api/app-config.spec.ts`, das **Rendern**
  in `apps/user-client-e2e/src/theming.spec.ts` gegen ein abgefangenes
  `/api/config`. Die Abfangvariante prüft zusätzlich, was eine gesäte Instanz
  nicht gleichzeitig sein kann: dunkle Primär- **und** helle Akzentfarbe.
- **Die Prüfung „innerhalb der Webkomponente" läuft gegen einen Shadow Root, den
  der Test selbst anlegt** — nicht gegen die Raumplanung. Das Plug-in ist in
  dieser Suite nicht aktiv, und einschalten kann man es erst mit der
  Modulverwaltung aus AP 4; dort bekommt es seine eigene Prüfung. Getestet ist
  damit genau der Mechanismus, auf dem die Regel „Plug-ins bringen kein CSS mit"
  beruht.
- **WebKit normalisiert die Anführungszeichen** einer Custom Property beim
  Zurücklesen (`"Lora"` für `'Lora'`), Chromium und Firefox nicht. Der
  Browsertest prüft deshalb Familie und generischen Fallback, nicht die
  Zeichenkette.
- **Das Mail-Modul hängt jetzt an einem Lesetyp** (`AppConfigReader =
Pick<AppConfigRepository, 'load'>`). Es braucht die Standardsprache, nicht die
  Fähigkeit, die Marke zu ändern — dieselbe Linie wie die zählenden Ports.

Was AP 1 **nicht** enthält: die Oberfläche. Farben, Schrift und Name sind über
die API einstellbar; die Design-Seite im Veranstalter-Client ist AP 3, und bis
dahin ist `PATCH /api/admin/config` der Weg.

### AP 2 — Logo und App-Icon (erledigt)

Umgesetzt:

- **`shared-models`** — `BRANDING_IMAGE_KINDS` (`logo`, `app-icon`),
  `BRANDING_TYPES` mit PNG/JPEG/WebP und **ohne SVG**, `BRANDING_MIME_TYPES`,
  `MAX_BRANDING_BYTES` (512 KB), `BRANDING_IMAGE_PART`, `brandingTypeSummary`,
  `isBrandingImageKind`; `AppConfig` trägt jetzt `appIconUrl`.
- **Migration `BrandingImages`** — `app_icon_path` und
  `CHK_app_config_branding_paths`: beide Pfadspalten dürfen nur `branding/%`
  enthalten.
- **Server** — `BrandingService` (Prüfen, Schreiben, Ersetzen, Wegnehmen, Lesen),
  `AdminBrandingController` mit `PUT`/`DELETE` je Bild unter
  `/api/admin/config/{logo,app-icon}`, `BrandingMediaController` mit
  `GET /api/media/branding/{logo,app-icon}` (öffentlich, ohne Pfadparameter),
  `AppConfigRepository.setBrandingImage`, `FileStore.save` nimmt jetzt einen
  **Bereich** (`attachments` | `branding`), `signatureType` in
  `file-signature.ts` und `branding-url.ts` als einzige Stelle, die die zwei
  öffentlichen URLs baut.
- **`/api/config`** — `theme.logoUrl` ist nicht mehr `/api/media/<gespeicherter
Pfad>`, sondern `/api/media/branding/logo?v=<updated_at>`; dazu `appIconUrl`.

Nachweise: 20 neue Unit-Tests (`BrandingService`, Branding-Katalog in
`shared-models`), 9 neue API-Vertragstests (`apps/server-e2e/src/api/branding.spec.ts`)
— darunter die vier Punkte des Abnahmekriteriums. `down` der Migration einmal
wirklich ausgeführt und wieder hochgezogen, dabei zusätzlich geprüft, dass das
`CHECK` einen Anhangpfad tatsächlich ablehnt. F66 steht im Referenzdokument,
Schema 5.3 nennt `app_icon_path` und das `CHECK`.

Abweichungen und ihre Gründe:

- **Drei Schichten für E19, nicht eine.** Geplant war „öffentlich, ohne
  Pfadparameter". Dazu kamen zwei: der `FileStore` schreibt in einen **Bereich**
  (`branding/` neben `attachments/`, im Volume mit `ls` prüfbar), und die
  Datenbank lehnt eine Pfadspalte ab, die nicht dort hineinzeigt. Grund: das ist
  die einzige öffentliche Route zu gespeicherten Bytes dieser Anwendung, und ihre
  Nachbarn im Volume sind Visa-Dokumente (E9). Die Route allein wäre eine
  Zusicherung über eine Datei; drei Schichten sind eine über den Zustand.
- **Der Typ steht nirgends gespeichert, er wird beim Ausliefern aus den Bytes
  gelesen.** Geplant war die Prüfung beim Hochladen (F38). Beim Ausliefern
  braucht die Antwort aber einen `Content-Type`, und dafür gab es zwei Wege: eine
  Spalte, oder dieselbe Signaturprüfung noch einmal. Die Spalte wäre ein zweiter
  Ort, an dem der Typ steht, und der könnte falsch sein — also `signatureType`,
  und ein Bild, dessen Bytes nachträglich etwas anderes sind, ist ein 404 mit
  Logzeile.
- **`Cache-Control` wird im Rumpf gesetzt, nicht per `@Header`.** Ein Dekorator
  gilt auch für den 404 — und ein für ein Jahr zwischengespeicherter 404 auf
  `…/logo` überlebt genau den Upload, der ihn heilen soll. `nosniff` und die CSP
  bleiben Dekoratoren (auf **beiden** Handlern; ein Dekorator auf der geteilten
  privaten Methode täte wortlos nichts).
- **`toMediaUrl` ist weg, und Reihe und Event liefern `logoUrl: null`.** Der
  Platzhalter aus Phase 0 baute `/api/media/<gespeicherter Pfad>` — genau die
  Form, die E19 verbietet. Geschrieben wurde `event_series.logo_path` /
  `event.logo_path` noch nie; die Spalten und die Payload-Felder bleiben, aber
  ein Logo je Reihe braucht eine eigene pfadfreie Route. Steht in `todo.md`.
- **Kein Prüfen der Bildmaße.** E26 schließt ein Bildbearbeitungspaket aus, also
  weiß der Server nicht, ob ein App-Icon quadratisch ist. Die Bytegrenze bleibt
  die einzige Aussage über das Bild; „quadratisch" sagt die Design-Seite in AP 3
  und zeigt eine Vorschau.
- **Die Version ist `app_config.updated_at`, also gemeinsam für beide Bilder.**
  Ein Farbwechsel lädt das Logo einmal neu. Der Preis ist ein Bild von wenigen
  Dutzend Kilobyte; die Alternative wäre eine zweite Spalte je Bild, die mit der
  ersten in Schritt gehalten werden muss.
- **Der Vertragstest liest eine Spalte direkt aus der Datenbank.** Das
  Abnahmekriterium lautet „der gespeicherte Pfad ist nicht erreichbar" — und der
  einzige Ort, der den Pfad kennt, ist die Zeile. Dafür hat
  `support/database.ts` jetzt einen Lesezugriff (`brandingPaths`), den einzigen
  in dieser Datei.
- **Die Suite legt zurück, was sie gefunden hat.** `app_config` ist eine einzige
  Zeile: sie holt die vorhandenen Bilder zuerst als Bytes ab und lädt sie am Ende
  wieder hoch — sonst wäre eine gebrandete Instanz nach einem Testlauf ungebrandet.

Was AP 2 **nicht** enthält: die Oberfläche. Hochladen geht über
`PUT /api/admin/config/logo`; die Design-Seite mit Vorschau, Farbwählern und
Kontrasthinweis ist AP 3 und schließt damit M3 ab.

### AP 3 — Design-Einstellungsseite (erledigt) → **Meilenstein M3**

Umgesetzt:

- **Veranstalter-Client** — Seite „Design" unter `/design`
  (`pages/design/design-page.ts`) mit Organisationsname, zwei Farbwählern,
  Schriftauswahl aus dem Katalog, Legibilitätspanel, Vorschaukarte und den zwei
  Uploads; `pages/design/branding-image-field.ts` als eigene Komponente je Bild;
  `features/config/config-admin.service.ts` als einziger Zugang zu
  `/api/admin/config` und den beiden Bildrouten.
- **Live-Vorschau im eigenen Dokument** (E20): jede Formularänderung ruft
  `ThemeService.apply()` mit dem Entwurf, also färbt sich der laufende
  Veranstalter-Client mit — Menü, Knöpfe und jede Plug-in-Webkomponente, weil
  die Custom Properties an der Wurzel hängen. „Discard changes" **und** das
  Verlassen der Seite (`DestroyRef.onDestroy`) stellen das Gespeicherte wieder
  her.
- **`shared-theming`** — `contrastRatio()`, `MIN_TEXT_CONTRAST` (4,5),
  `MIN_SURFACE_CONTRAST` (3), `MIN_DERIVED_TEXT_CONTRAST` (≈ 4,58) und
  `PAGE_BACKGROUND_COLOR`; `readableTextColor` liest die Luminanz jetzt über
  denselben Helfer.
- **`shared-config`** — `organizationName` als Signal (Rückfall auf
  `DEFAULT_ORGANIZATION_NAME`) und `reload()`, das die Konfiguration nach einem
  eigenen Schreibvorgang neu liest, statt den Cache zu patchen.
- **Beide Kopfzeilen** tragen den Organisationsnamen statt „Trefaro", das Logo
  daneben ist `aria-hidden` (der Name sagt dasselbe), und der Login des
  Veranstalter-Clients nennt die Organisation — `/api/config` ist öffentlich,
  also ist der Name vor der Anmeldung bekannt.
- **`shared-models`** — `BrandingImages` (die zwei öffentlichen URLs) wanderte
  aus `apps/server/.../branding-url.ts` hierher: der Client liest genau diese
  Antwort.

Nachweise: 18 neue Unit-Tests (`DesignPage` 10, `BrandingImageField` 8), 3 in
`shared-theming` (Kontrastspanne, Symmetrie, bekannte Paare, der gefegte
Luminanzbereich für die Garantie), 1 in `shared-config` (`reload`), 8 neue
Browsertests im Veranstalter-Client (`apps/admin-client-e2e/src/design.spec.ts`)
und 2 im Nutzer-Client (`theming.spec.ts`). Vier Punkte des Abnahmekriteriums
stehen dort namentlich: die Vorschau wirkt vor dem Speichern, Abbrechen nimmt sie
zurück, Speichern zieht die Kopfzeile sofort nach und übersteht ein Neuladen, und
die Startseite des Nutzer-Clients trägt den konfigurierten Namen.

Abweichungen und ihre Gründe:

- **Der geplante Kontrasthinweis kann nicht auslösen — also prüft er etwas
  anderes** (F67). Geplant war: warnen, wenn eine Markenfarbe gegen ihre
  _berechnete Textfarbe_ unter 4,5:1 liegt. Das ist rechnerisch unmöglich:
  `readableTextColor` wählt Schwarz oder Weiß genau an der Luminanz, an der beide
  gleich kontrastieren (L = √0,0525 − 0,05), und dort beträgt das Verhältnis
  ≈ 4,58:1 — der schlechteste Fall über alle Farben. Eine Prüfung, die nie
  greift, liest sich wie eine Zusicherung, über die jemand wacht. Gezeigt wird
  die Zahl deshalb als **Tatsache**; gewarnt wird, wo nichts entschieden werden
  kann: **die Primärfarbe gegen die weiße Seite, Schwelle 3:1** (WCAG 2.2
  SC 1.4.11, die Schwelle für ein Bedienelement statt für Text). Die Primärfarbe
  ist die Fläche — Menü, Knopf, Kachel — und die Quelle der Linkfarbe
  (`-strong`); eine fast weiße Primärfarbe lässt beides verschwinden, während der
  Text darauf tadellos lesbar bleibt. Ein Unit-Test fegt den Luminanzbereich ab
  und hält die Garantie fest.
- **Die Akzentfarbe bekommt keine Warnung, und das ist kein Versehen.** Sie ist
  nie die Fläche, die gefunden werden muss, sondern Abzeichen oder Rand _in_
  etwas, das schon gefunden ist — immer mit ihrer abgeleiteten Textfarbe darauf.
  Eine Warnung dort würde auf der **ausgelieferten Vorgabe** (`#e8a33d`, 2,2:1
  gegen Weiß) sofort erscheinen und Veranstalter darauf trainieren, das Panel zu
  überlesen.
- **Der Fokusring nimmt jetzt `--trefaro-color-accent-strong`.** Beim Prüfen des
  Punktes davor fiel auf, dass die einzige Stelle, an der die Akzentfarbe doch
  eine dünne Linie auf weißem Grund war, der Fokusring beider Clients ist — und
  dort gilt 3:1 zwingend. `-strong` ist aus dem Akzent abgeleitet und damit immer
  dunkler; die Vorgabe kommt so auf ≈ 4,2:1, ohne dass eine Markenfarbe geändert
  werden musste.
- **Nur ein Farbwähler je Farbe, kein zweites Textfeld.** E17 sagt: „Ein
  Farbwähler liefert genau Hex." Ein Freitextfeld daneben müsste `#fff`
  entgegennehmen (die API akzeptiert es), und `<input type="color">` kann das
  nicht darstellen — es zeigt wortlos Schwarz und schreibt dieses Schwarz beim
  ersten Öffnen zurück. Der gespeicherte Wert wird deshalb beim Laden auf sechs
  Stellen erweitert; der Hexwert steht als Text unter dem Wähler.
- **Ein Bild wird beim Hochladen geschrieben, nicht beim Speichern.** Zwei
  Schritte je Bild (auswählen → hochladen), weil niemand prüfen kann, ob ein
  App-Icon quadratisch ist (E26 schließt eine Bildbibliothek aus) — die einzige
  Prüfung ist ein Blick auf die Vorschau. Und weil ein Upload eben **nicht** von
  „Discard changes" erfasst wird, was ein Zwei-Klick-Ablauf sichtbar macht.
- **Nach jedem Schreiben wird `/api/config` neu gelesen**, statt den Cache zu
  patchen. Der Server besitzt die Antwort: den beschnittenen Namen, den
  CSS-Stack hinter dem Schriftschlüssel und die neue `?v=` der Bilder. Ein
  gemergter Cache wäre eine zweite Wahrheit.
- **Die Browsersuite schreibt nur in Chromium.** `app_config` ist eine einzige
  Zeile, und Playwright fährt drei Browser gleichzeitig: drei Arbeiter, die
  speichern und zurücksetzen, prüfen jeweils den Wert, den ein anderer gerade
  ersetzt hat. Die zwei schreibenden Tests sind deshalb auf Chromium beschränkt
  (mit `test.skip` und Begründung im Code) und stellen her, was sie gefunden
  haben. Alles, was nur im Client passiert, läuft in allen drei.
- **Und sie schreibt keine Farbe.** Die Farbe der Instanz wird von
  `start-up.spec.ts` in **beiden** Clients geprüft (`#1f6f5c`); ein Test, der sie
  ändert, ließe einen unbeteiligten Test scheitern. Geschrieben werden Name und
  Schriftart, die niemand sonst prüft — dass eine Farbe durchgeschrieben wird,
  belegt `apps/server-e2e/src/api/app-config.spec.ts` aus AP 1.
- **Die Seitentitel bleiben „… — Trefaro".** Sie stehen als Zeichenketten in
  beiden `app.routes.ts` und werden in AP 6 zu Übersetzungsschlüsseln; sie jetzt
  auf den Organisationsnamen umzuhängen (eine `TitleStrategy`) hieße, dieselben
  Zeilen zweimal anzufassen. Steht in `todo.md`.

Was AP 3 **nicht** enthält: die Modulverwaltung. Die Seite „Modules" bleibt
lesend — sie wird in AP 4 schreibend.

### AP 4 — Modul- und Plug-in-Verwaltung (erledigt)

Umgesetzt:

- **`shared-models`** — `ModuleSummary` (Schlüssel, Familie, `titleKey`, Zustand,
  Vorgabe, bei Plug-ins Version, Bundle und Einhängepunkte), `ModuleToggle`,
  `PUSH_MODULE_KEY`, `moduleDisplayName` (der vermenschlichte Schlüssel, bis AP 6
  den Katalog bringt) und `pluginElementId`.
- **Server** — `CORE_MODULES` auf zwei Einträge zusammengezogen (`media-links`
  an, `push` aus; F63); `ModuleAdminService` + `AdminModulesController` mit
  `GET /api/admin/modules` und `PATCH /api/admin/modules/:key`; der `PushModule`
  importiert `ConfigurationModule` und `PushController` trägt
  `@CoreModuleController('push')` samt Guard; `webPushPublicKey` in `/api/config`
  ist `null`, solange das Modul aus ist.
- **Veranstalter-Client** — `ModulesAdminService` und die Seite `/modules`
  schreibend: eine Tabelle für beide Familien mit Zustand, Vorgabe, Bundle und
  dessen Ladeergebnis, einem Knopf je Zeile, und zwei Sätzen — dass Abschalten
  nichts löscht und dass ein eingeschaltetes Plug-in erst nach einem Neuladen
  erscheint (E20).
- **Nutzer-Client** — `EventDetailTiles` in der Event-Detailansicht: eine Kachel
  je Abschnitt, der wirklich etwas enthält, und eine je geladenem Plug-in am
  Einhängepunkt `event-detail` (F68). Die Abschnitte tragen jetzt `id="program"`
  und `id="media"`, der Plug-in-Slot setzt `id="plugin-<key>"` auf jedes
  gemountete Element.
- **Werkzeuge** — `verify-plugin-toggle.mjs` hat einen Abschnitt für den
  Verwaltungsendpunkt (ohne jedes Warten, das ist der Punkt);
  `verify-push.mjs` schaltet das Modul für seinen Lauf ein und stellt den Schalter
  zurück; `verify-api.mjs` prüft die Gegenseite (404 und kein VAPID-Schlüssel,
  solange `push` aus ist).

Belege: `nx run-many -t lint test build` grün für 12 Projekte (u. a. sieben neue
Unit-Tests für `ModuleAdminService`, sieben für die Modulseite, acht für die
Kacheln); `nx e2e server-e2e` **16 Suiten / 304 Tests** — neu
`apps/server-e2e/src/api/modules.spec.ts`, das die Sofortwirkung festschreibt;
Browsersuiten **219 + 6 übersprungen** (Veranstalter, neu `modules.spec.ts`) und
**150** (Nutzer, drei neue Kacheltests).

Abweichungen und Entscheidungen, die beim Bauen fielen:

- **Der Zustand in der Liste kommt aus den Registries, nicht aus der Tabelle.**
  Dieselbe Quelle, aus der `/api/config` und die Guards antworten (F53) — ein
  dritter Leser könnte beiden widersprechen, und eine Liste, die `media-links`
  als „an" zeigt, während seine Endpunkte 404 antworten, ist schlimmer als keine.
- **Ein `PATCH` frischt beide Zwischenspeicher auf**, nicht nur den der
  betroffenen Familie: sie lesen dieselbe Tabelle, und der zweite Aufruf ist eine
  Abfrage. So entfällt die Frage, ob der richtige gewählt wurde.
- **Ein unbekannter Schlüssel ist ein 404, keine neue Zeile.** `module_config`
  nähme sie, und nichts würde sie je lesen.
- **Die Kacheln entstehen nicht „je aktiviertem Modul"** (F68), sondern je
  Abschnitt mit Inhalt — sonst führte die `media-links`-Kachel bei den meisten
  Events ins Leere.
- **Ein reiner Fragment-Link funktioniert in diesen Clients nicht.** `<base
href>` lässt `href="#program"` gegen die Basis auflösen: der Klick verließ das
  Event und landete auf der Startseite mit Fragment. Die Kacheln verlinken
  deshalb über den Router (`[routerLink]="[]"` + `fragment`), und der
  Nutzer-Client bekam `withInMemoryScrolling({ anchorScrolling: 'enabled' })` —
  ohne das ändert sich nur die Adresse und nichts bewegt sich.
- **Das `icon` im Plug-in-Vertrag bleibt ungenutzt.** Es nennt ein
  Material-Symbols-Glyph, und keiner der beiden Clients lädt eine Icon-Schrift;
  von Google nachladen verbietet NFR 9. Die Kacheln sind Text. Steht in
  `todo.md`.
- **Die schreibende Browsersuite schaltet `push`, nicht `media-links`.** Zwei
  andere Browsersuiten benutzen die Medien-Links; sie ihnen unter den Füßen
  abzuschalten hätte sie zum Scheitern gebracht, und der Fehlschlag hätte wie
  eine kaputte Seite gelesen. Dass genau `media-links` — Endpunkt, Abschnitt und
  Dashboard-Kachel — beim Schreiben des Schalters sofort verschwindet, prüft
  `apps/server-e2e/src/api/modules.spec.ts`, wo die Suite allein läuft.
- **Vier bestehende Tests mussten nachgezogen werden**, und jeder war ein
  Symptom: der Startup-Test des Veranstalter-Clients erwartete „No plug-in is
  enabled" (jetzt hat auch ein abgeschaltetes Plug-in eine Zeile); die vier
  Validierungstests in `public-endpoints.spec.ts` liefen gegen den
  Push-Endpunkt, der jetzt 404 antwortet, und schalten das Modul nun selbst ein;
  `verify-api.mjs` und `verify-push.mjs` standen auf derselben Annahme.
- **Zeilen entfallener Schlüssel bleiben stehen** (F63). Der Zwischenspeicher
  ignoriert, was kein Deskriptor beansprucht; Phase 3 findet `chat` wieder so
  vor, wie eine Organisation es gelassen hat.

Was AP 4 **nicht** enthält: die Übersetzung der Modulnamen (`titleKey`,
`labelKey`) — das ist AP 6; und keinen Einhängepunkt `event-dashboard` im
Plug-in-Vertrag, solange kein Plug-in eine Kachel dafür mitbringt (F47).

### AP 5 — Installations-Story (erledigt) → **Meilenstein M4**

Umgesetzt:

- **`shared-models`** — `SetupState` (die Vorbelegung des Formulars, die
  wählbaren Sprachen, die Befunde zum Deployment), `SetupSubmission`,
  `SetupResult`, `SETUP_TOKEN_HEADER` und `MAX_LOCALE_TAG_LENGTH`.
- **Server, `business/setup/`** — `SetupTokenService` (32 Zufallsbytes, nur im
  Speicher, `timingSafeEqual`), `startupWarnings()` als reine Funktion,
  `SetupService` mit `onApplicationBootstrap` (Befunde ins Log, Token nur wenn
  niemand sich anmelden kann), `SetupGuard` (404 vor 401, in dieser Reihenfolge)
  und `SetupController` mit `GET /api/setup/state` und `POST /api/setup/admin`.
  `SetupModule` importiert `LoginModule` und `ConfigurationModule` — damit steht
  es über beiden (F49) _und_ läuft sein Bootstrap-Hook nach dem der Anmeldung, so
  dass eine Instanz mit `ADMIN_BOOTSTRAP_*` kein Token bekommt.
- **Server, bestehende Bausteine** — `AdminUserService.hasAny()`;
  `ConfigurationService.setDefaultLocale()` als einziger Schreiber der
  Locale-Spalten, mit `setLocales()` als neuer Port-Methode (getrennt von `save`,
  weil `AppConfigChange` der Rumpf der Design-Seite ist).
- **`shared-http`** — `get`/`post` nehmen optionale Kopfzeilen (`RequestHeaders`).
  Der Setup-Token ist der erste und bisher einzige Fall: er ist keine Sitzung und
  kann kein Cookie sein, und in der Query stünde er im Zugriffsprotokoll des
  Proxys.
- **Veranstalter-Client** — `features/setup/` (Dienst, der die Verfügbarkeit aus
  dem **Statuscode** liest, und `setupPendingGuard`), die Seite `/setup` in drei
  Schritten (Token · ein Formular mit Konto, Organisation, Sprache, zwei Farben ·
  fertig), und die zwei Sitzungs-Guards schicken jetzt zur Einrichtung statt zu
  einem Login ohne Konto dahinter. Der Startlauf fragt die Setup-Route nur, wenn
  keine Sitzung besteht.
- **Infrastruktur** — `infra/nginx/trefaro-locations.conf` (das Routing, einmal),
  eingebunden von `trefaro.conf` und dem neuen `trefaro-tls.conf`;
  `infra/docker-compose.tls.yml` als Overlay mit `ports: !override`, Zertifikat
  und Schlüssel als Read-only-Mounts, HSTS, TLS 1.2 als Untergrenze und einer
  ACME-Webroot, damit eine Erneuerung ohne Ausfall geht.
- **Dokumentation** — `docs/INSTALL.md`: Voraussetzungen, die Werte ohne die
  nichts startet, erster Start, beide Wege zum ersten Administrator, TLS mit den
  drei Beschaffungswegen, SMTP, Push, Sicherung der zwei Volumes _und_ des
  `AUTH_SECRET`, Aktualisieren, eine Symptomtabelle und ein Diagramm.
- **Werkzeuge** — `verify-setup.mjs` (der einzige Beweis des Erfolgspfads, der
  existieren kann); `verify-admin-access.mjs` prüft, dass die Route auf einer
  laufenden Instanz **weg** ist; `verify-proxy.mjs` läuft jetzt über HTTPS, wenn
  `PROXY_BASE` eine https-Adresse ist, und meldet sich dabei einmal an.

Belege: `nx run-many -t lint test build` grün für 12 Projekte (neu: acht Tests für
`startupWarnings`, sechs für den Token, dreizehn für `SetupService`, vier für den
Guard, fünf für `setDefaultLocale`, acht für den Client-Dienst, zehn für die
Seite); `nx e2e server-e2e` **17 Suiten / 310 Tests** (neu `setup.spec.ts`);
Browsersuiten **225 + 6 übersprungen** (Veranstalter, neu `setup.spec.ts`) und
**150** (Nutzer).

Und, weil das Abnahmekriterium es verlangt, von Hand gegen einen echten Stack —
`-p trefaro-fresh`, leeres Volume, `ADMIN_BOOTSTRAP_*` leer:

1. `verify-setup.mjs` mit dem Token aus dem Containerlog: **16 von 16 PASS**,
   einschließlich „a refused value does not close the setup" und
   „a second submission cannot create a second first administrator".
2. Der Assistent im echten Browser (Chromium gegen die gebauten Images): falsches
   Token abgewiesen, richtiges öffnet das vorbelegte Formular, Sprachen als
   „English"/„Deutsch", ein Befund angezeigt, Administrator angelegt, Übergabe an
   den Login („Administration — Democracy International e.V."), Anmeldung,
   Arbeitsbereich in `#7b2d8e` — und `/admin/setup` bietet danach keinen
   Assistenten mehr.
3. Mit dem TLS-Overlay und einem selbst ausgestellten Zertifikat:
   `verify-proxy.mjs` über `https://…` **alle Prüfungen grün**, inklusive
   WebSocket-Upgrade, HSTS, 301 von Port 80 und der Anmeldung mit `Secure`-Cookie;
   dazu eine Browseranmeldung über HTTPS, deren Sitzung ein Neuladen übersteht.
4. Alle fünf Befunde einmal in einem echten Produktionslog gesehen (zwei
   Klartext-URLs, SMTP-Host, SMTP-Absender, fehlendes VAPID-Paar).

Was anders lief:

- **`POST /api/setup/admin` antwortete 401** — der Admin-Guard liest jeden
  _deklarierten_ Pfad einzeln, und `@Post('admin')` unter `@Controller('setup')`
  sieht für ihn aus wie eine administrative Route (F69). Gefunden vom
  Vertragstest beim ersten Lauf; kein Unit-Test kann das sehen. Gelöst mit
  `@AllowAnonymous()` am Controller — die dritte Verwendung eines Dekorators, der
  zwei hatte — plus einem Test an `isAdminPath` selbst, der die Überschätzung
  festhält, damit der nächste Treffer nicht wieder auf HTTP-Ebene gesucht wird.
- **Die Verfügbarkeit steckt im Statuscode, nicht im Rumpf.** E28 verlangt ein
  Token für _beide_ Endpunkte, und der Client muss trotzdem vor der ersten
  Eingabe wissen, welchen Bildschirm er zeigt. Beides geht auf, weil 401 und 404
  verschiedene Dinge sagen: unbeansprucht gegen eingerichtet. Der Rumpf wird nie
  ohne Token herausgegeben, und mehr als „diese Instanz hat noch keinen
  Administrator" verrät die Unterscheidung nicht.
- **Keine Drosselung enger als die globale**, gegen den Plan („Drosselung wie beim
  Login"). Ein 256-Bit-Zufallstoken lässt sich nicht raten; eine Grenze, die
  niemand auslösen kann, müsste die Testsuite aber trotzdem überleben, und eine
  Grenze, die für Tests gelockert wird, wird nicht mehr geprüft (E4). Was den
  Endpunkt schützt, ist der Guard.
- **Die Sprache ist im Assistenten, die Schrift nicht.** `defaultLocale` hat heute
  Bedeutung (Mailsprache und Datumsformate), also wird sie gefragt — beschränkt
  auf die Locales, für die dieses Image Mailvorlagen mitbringt, weil eine Sprache
  ohne Vorlagen englische Bestätigungen schickt und dabei behauptet, deutsch zu
  sein. Die Schrift hat einen Katalog und eine Vorschau auf der Design-Seite; eine
  fünfte Frage hätte den Assistenten länger gemacht, ohne etwas zu entscheiden,
  was nicht dort besser entschieden wird.
- **Die Sprachnamen kommen von `Intl.DisplayNames`**, nicht aus einem Katalog:
  „Deutsch" statt „de", ohne Download und ohne Vorgriff auf AP 6.
- **Der Assistent färbt den Client am Ende selbst um.** Das Theme wird genau
  einmal angewendet, im Startlauf — `AppConfigService.reload()` frischt die Daten
  auf und lässt das Dokument in Trefaros Grün. Aufgefallen im Browserdurchlauf
  gegen die Images: die Farbe war korrekt gespeichert und nicht zu sehen. Jetzt
  ruft die Seite `ThemeService.apply()` mit dem neu gelesenen Theme; sonst
  repaint nichts (E20), aber dies ist der Moment, in dem eine Organisation ihre
  Farbe zum ersten Mal sieht, und der Login danach ist ein Routenwechsel, kein
  neuer Ladevorgang.
- **Zwei Felder hießen „Name".** Person und Organisation im selben Formular — für
  einen Screenreader nicht unterscheidbar (NFR 4). Gefunden, weil der
  Browserdurchlauf das Feld nicht traf. Jetzt „Your name" und „Organization
  name".
- **Das Routing des Proxys liegt jetzt in einer eigenen Datei.** Zwei Kopien der
  Location-Blöcke — eine mit TLS, eine ohne — wären zwei Kopien, von denen die
  produktive die ungetestete ist. `trefaro-locations.conf` wird von beiden
  eingebunden und in beiden Compose-Dateien gemountet.
- **`ports:` braucht `!override`.** Compose _verkettet_ Sequenzen aus mehreren
  Dateien, also hätte das Overlay die 8080er-Zuordnung der Basisdatei zusätzlich
  veröffentlicht. Mounts werden dagegen über ihr Ziel zusammengeführt, weshalb die
  beiden Konfigurationsdateien die der Basisdatei einfach ersetzen.
- **`verify-proxy.mjs` prüfte auf Trefaros Grün.** Seit dieses Paket den
  Assistenten hat, hat eine normal eingerichtete Instanz eine andere Primärfarbe —
  die Prüfung wäre auf jedem echten Deployment fehlgeschlagen. Jetzt wird auf
  „eine Hex-Farbe" geprüft (E17), nicht auf _die_ Vorgabe. Und der
  socket.io-Client bekommt dieselbe Ausnahme wie der Rest des Laufs, sonst liest
  sich ein selbst ausgestelltes Zertifikat wie „der Proxy leitet keine Upgrades
  weiter".
- **Der Erfolgspfad hat keinen automatisierten Test und kann keinen haben.** Die
  Endpunkte existieren nur, solange `admin_user` leer ist; jede Suite dieses
  Repositorys läuft gegen eine Instanz aus `ADMIN_BOOTSTRAP_*`, und der letzte
  Administrator ist nicht löschbar (F22) — genau die Eigenschaft, die den Zustand
  unerreichbar macht. Also: Unit-Tests für Dienst, Guard und Seite,
  `verify-setup.mjs` gegen einen frischen Stack, und die Suiten prüfen die andere
  Hälfte — dass die Route zu ist.

Was AP 5 **nicht** enthält: keine Zertifikatsautomatik im Stack (E29 — ein
sechster Container, ein Erneuerungszeitplan und ein Anspruch auf Port 80); keine
Sprachverwaltung (AP 7 — der Assistent wählt aus den mitgelieferten Locales);
keine übersetzten Seitentitel (AP 6); und keine Sitzung als Antwort des
Assistenten.

### AP 6 — Transloco und der Katalog vom Server (erledigt)

Beginnt, wie der Plan es verlangt, mit der kleinsten Prüfung: **zeichnet ein
zoneless Angular-Client nach einem Sprachwechsel neu?** `zone.js` ist keine
Abhängigkeit dieses Arbeitsbereichs, Transloco ist mehrere Hauptversionen älter
als dieser Modus, und er zeichnet neu, indem er `markForCheck()` aus einem
Abonnement ruft. Ergebnis: **ja**, alle drei Lesarten (Pipe, Strukturdirektive,
`translateSignal`) landen im DOM einer `OnPush`-Komponente, ohne dass jemand
`detectChanges()` ruft — Angulars `markForCheck()` benachrichtigt seit Version 18
den zoneless-Planer. Festgehalten in
`libs/shared-i18n/src/lib/zoneless-language-change.spec.ts`, drei Tests, gelaufen
**vor** der ersten verschobenen Zeile Text. Die signalbasierte Lesart als Ausweg
war nicht nötig; was die Prüfung stattdessen fand, steht unter _Abweichungen_ und
in F72.

Umgesetzt:

- **`libs/shared-i18n`** — eine sechste geteilte Bibliothek, mit beidem darin:
  `catalogues/en.json` und `catalogues/de.json` (die **mitgelieferten** Kataloge,
  flach, gepunktete Schlüssel) und der Angular-Seite — `TrefaroCatalogueLoader`
  (Transloco-Loader gegen `GET /api/i18n/:locale`), `TranslationService`,
  `LanguageSwitcher`, `provideTrefaroTranslations()` und
  `provideTranslationsForTest()`.
- **`shared-models`** — `lib/i18n/`: `TranslationCatalogue` (der flache
  Wire-Typ), `FALLBACK_LOCALE`, `MAX_TRANSLATION_KEY_LENGTH`,
  `MAX_TRANSLATION_VALUE_LENGTH` und `isTranslationKey` — die
  Schlüsselkonvention als Prüffunktion, nicht als Empfehlung (F70).
  `moduleDisplayName` **entfernt**, wie der Plan es vorsah.
- **Server, `business/i18n/`** — zwei Ports (`ShippedCatalogueReader`,
  `TranslationOverrideReader`), `CatalogueService` mit der Auflösungskette aus
  E23 und einem ETag über die ausgelieferten Bytes, `I18nController`
  (`GET /api/i18n/:locale`, öffentlich, `no-cache` + `If-None-Match` → 304).
  Exportiert `CatalogueService` für AP 10.
- **Server, Datenzugriff** — `BundledCatalogueReader` (liest die Kataloge von der
  Platte, prozessweit gepuffert, ein defektes File wird geloggt und gilt als
  abwesend), `TypeormTranslationOverrideRepository`, Entity
  `TranslationOverrideEntity`, Migration `Translations1787790200000`.
- **Verkabelung** — `I18N_CATALOGUE_DIR` in `env.ts` und `.env.example`, die
  webpack-`assets`-Regel nach `assets/i18n`, der `COPY` und das `ENV` in
  `infra/docker/server.Dockerfile`; beide Clients registrieren
  `provideTrefaroTranslations()` und tragen `<trefaro-language-switcher />` in
  ihrer Shell.
- **Die zwei Aufrufstellen, die der Plan nennt** — `modules-page.ts` löst
  `titleKey` auf, `event-detail-tiles.ts` löst `labelKey` auf, beide über
  `TranslationService`. Die `titleKey` der Kernmodule heißen jetzt
  `modules.<name>.title` statt `modules.<name>`, damit beide Familien eine
  Konvention haben.
- **`tools/spike-verification/verify-i18n.mjs`** — 16 Prüfungen gegen ein
  laufendes Deployment, darunter die einzige, die zählt: dass der Katalog
  wirklich **im Image** liegt.

Nachweise: `nx run-many -t lint test build` grün für 14 Projekte (13 + die neue
Bibliothek). Neu: 38 Unit-Tests in `shared-i18n` (Spike 3, Kataloge 15,
`TranslationService` 14, Umschalter 6), 3 in `apps/server` zu den Modulschlüsseln,
19 zum `CatalogueService`, 13 API-Vertragstests, 1 Reaktivitätstest je Client, 6
Browser-Tests im Nutzer-Client und 6 im Veranstalter-Client (2 × 3 Engines).
Suiten: `server-e2e` 18 Suiten / 322 Tests, `user-client-e2e` 165, `admin-client-e2e` 231. Manuell gegen den Fünf-Container-Stack aus leerem Volume: `verify-i18n.mjs`
16/16 durch den Proxy, `verify-proxy.mjs` vollständig grün, ein Chromium-Rundgang
durch beide Clients, `ls /app/assets/i18n` im Server-Container, `down -v`. F70–F72
und `translation_override` stehen im Referenzdokument, Anhangspunkt 20 dazu.

Abweichungen und ihre Gründe:

- **Die Prüfung fand nicht das erwartete Problem, sondern zwei andere.** Dass ein
  Sprachwechsel zeichnet, war in Ordnung. Aber `setActiveLang()` **wartet nicht
  auf den Katalog** — es zeigt weiter die alte Sprache, bis das JSON über das Netz
  da ist. Über ein Netz statt über einen Stub ist das sichtbar lang, und ein Klick
  auf „Deutsch“, der die Oberfläche englisch stehen lässt, sieht aus wie ein
  kaputter Knopf. Deshalb lädt `TranslationService.use()` erst und aktiviert dann,
  mit `switching()` dazwischen. Und die teurere Hälfte: eine Beschriftung, die
  **in TypeScript** entsteht, hat keine Pipe, die sie neu zeichnet — die
  Modulverwaltung zeigte nach dem Umschalten weiter Englisch, während
  `<html lang>` schon „de“ sagte. Gefunden hat es der Browserdurchlauf, und der
  Unit-Test dazu war **grün**: das Fake war reaktiver als Transloco. Beide
  Fakes bilden jetzt nach, dass `translate()` nicht reaktiv ist, und beide Tests
  wurden gegen die zurückgenommene Korrektur als fehlschlagend belegt (F72).
- **Der Umschalter hätte auf einer englischen Instanz beim ersten Zeichnen
  Schlüssel gezeigt.** `use()` hatte eine Abkürzung „ist schon die aktive
  Sprache, nichts zu tun“ — und `active` beginnt auf der Rückfallsprache. Eine
  Instanz, deren Sprache **genau** die Rückfallsprache ist, nahm also die
  Abkürzung und hatte keinen Katalog, bis irgendeine Pipe zufällig einen Ladevorgang
  auslöste. Der Browserdurchlauf sah es nicht, weil der Umschalter selbst eine
  Pipe hat und schneller war. Gefunden beim Nachlesen des Diffs; `activate()`
  lädt jetzt immer (Transloco puffert), und der Test dazu wurde gegen die
  zurückgenommene Abkürzung als fehlschlagend belegt.
- **`start()` merkt sich nichts.** Die Anfangssprache ist _abgeleitet_, nicht
  gewählt; sie zu speichern hieße, aus „dein Browser fragt nach Deutsch“ ein „du
  hast Deutsch gewählt“ zu machen — und wer später seinen Browser umstellt, bekäme
  weiter die alte Sprache, ohne dass etwas das erklärt. Gemerkt wird nur, was
  durch `use()` kommt, also durch den Umschalter.
- **Eine frische Instanz bot Deutsch nicht an.** `active_locales` war mit
  Englisch allein gesät, also hatte der Umschalter auf einer neuen Instanz nichts
  zu schalten — obwohl das Image einen vollständigen deutschen Katalog mitbringt.
  Das Abnahmekriterium dieses Pakets wäre nicht vorführbar gewesen. Nachgezogen
  von derselben Migration, aber nur dort, wo der Wert noch exakt die ausgelieferte
  Vorgabe ist (F71). Deshalb heißt die Migration `Translations…` und nicht
  `TranslationOverrides…`: sie ändert zwei Dinge.
- **Die mitgelieferten Kataloge liegen nur im Server-Image**, nicht „in beiden
  Images“, wie die Paketbeschreibung sagt. E22 ist hier die Entscheidung und ist
  ausdrücklich: JSON im Client-Image ändert man nur durch einen Neubau, also wäre
  eine Kopie dort ein zweiter Katalog, den niemand pflegt. Ist der Server nicht
  erreichbar, zeigen die Clients ihre Schlüssel — ehrlich, und ohnehin nur in
  einem Zustand erreichbar, in dem es auch keine Inhalte gibt.
- **Der Katalog ist flach, mit gepunkteten Schlüsseln.** Der Plan legte die
  Konvention nicht fest, verlangte aber, sie hier zu entscheiden. Flach, weil
  `translation_override` einen Schlüssel speichert, die Vollständigkeitszahl aus
  AP 7 Schlüssel zählt und ein Template einen Schlüssel schreibt; verschachtelt
  wäre „welcher fehlt“ ein Baumdurchlauf. Segmente in `lowerCamelCase`, erzwungen
  von `isTranslationKey` — mit der Folge, dass ein Modulschlüssel sich nicht selbst
  schreiben kann (`media-links` ist kein legales Segment) und jeder Deskriptor
  seinen `titleKey` **deklariert** statt ihn abzuleiten (F70).
- **Sprachnamen bleiben bei `Intl.DisplayNames`.** In `CLAUDE.md` stand „bis
  AP 6“; jetzt ist es endgültig. Ein Katalogeintrag bräuchte einen Schlüssel je
  Sprache **je Sprache** — und genau die Sprache, die eine Organisation in AP 7
  erfindet, wäre in jeder anderen namenlos.
- **Der Katalog wird revalidiert, nicht zwischengespeichert.** Ein langes
  `max-age` würde die Funktion aushöhlen, die es bedient. Der ETag ist ein Hash
  **über die ausgelieferten Bytes**, nicht über ein `updated_at`: drei Dinge
  entscheiden diese Antwort — die Datei im Image, die Zeilen der Organisation und
  die Auflösungsregel — und nur eines davon hat einen Zeitstempel. So macht ein
  neues Image auch jede Client-Kopie ungültig, ohne dass jemand daran denkt.
- **Die Kataloge sind Datenzugriff.** `ShippedCatalogueReader` ist ein Port wie
  `FileStore` (E9 im Geiste): die Geschäftslogik weiß, _dass_ der mitgelieferte
  Text existiert, nicht wo. Der zweite Grund ist die Schichtgrenze — ein
  `import` von `libs/shared-i18n/catalogues/en.json` in einen Dienst würde
  Oberflächentext zur Vertragsschicht machen, und `apps/server` hängt weiterhin
  nur an `@trefaro/shared-models`.
- **`I18N_CATALOGUE_DIR` lebt an drei Stellen**, und das ist die Lehre aus AP 13
  der Phase 1 in neuer Gestalt: `env.ts`, `.env.example` — und die webpack-Regel
  plus der `COPY` im Dockerfile. Fehlt eines davon, antwortet die Instanz `200 {}`
  und beide Clients zeichnen ihre Schlüssel, während **jede** Suite grün bleibt
  (sie fahren `nx serve` aus dem Arbeitsbereich, wo die Vorgabe auf die Bibliothek
  selbst zeigt) und die CI die Images baut, ohne sie zu starten. Dafür gibt es
  jetzt `verify-i18n.mjs`.
- **Der Umschalter fehlt auf dem Anmeldeformular.** Die Shell des
  Veranstalter-Clients zeichnet ihre Seitenleiste erst nach der Anmeldung. Die
  Anfangssprache folgt ohnehin dem Browser und der Vorgabe der Instanz, und wer
  einmal gewählt hat, findet seine Wahl wieder — bleibt also die erste Anmeldung
  mit einem falsch eingestellten Browser. Nachgezogen in **AP 9**, wo der Text
  dieser Seite ohnehin in den Katalog zieht; ein Bedienelement auf eine Seite zu
  setzen, deren Aufbau bis dahin unangetastet bleibt, wäre vorgegriffen.
- **`provideTranslationsForTest()` steht im Haupt-Einstiegspunkt.** Für eine
  Funktion keinen zweiten Entry Point von ng-packagr; sie ist eine
  Provider-Fabrik, also zieht sie nichts in ein Bundle, das sie nicht ruft. Ab
  AP 8 braucht sie fast jeder Spec beider Clients.

Was AP 6 **nicht** enthält: keine Sprachverwaltung und keine
Vollständigkeitszahl (AP 7 — `GET /api/admin/i18n` und die Schreibrouten fehlen
noch, der Port ist deshalb lesend); **keine** Textextraktion aus den Templates
(AP 8 und AP 9 — der Katalog hat fünf Schlüssel, genau die, die dieses Paket
auflöst); keine übersetzten Mails (AP 10, E24 — die Vorlagen liegen weiter in
TypeScript); keine übersetzten Seitentitel und keine `TitleStrategy`; und keine
Inhaltsübersetzungen (AP 11).

# Phase 2 — Whitelabel, Konfiguration, Mehrsprachigkeit, PWA

**Status: abgeschlossen** (29.08.2026). **AP 1 bis AP 13 sind erledigt** (siehe
_Fortschritt_, je Paket ein Abschnitt „erledigt") — damit sind **M3**, **M4** und
**M5** erreicht und die Definition of Done ist in allen sechs Punkten erfüllt.
Die Abschnitte zwischen _Ziel_ und _Fortschritt_ sind der **Plan**, wie er vor
der Umsetzung dastand; sie werden nicht rückwirkend korrigiert. Wo Umsetzung und
Plan auseinandergehen, gilt _Fortschritt_ — und die Unterschiede stehen dort
sowie gesammelt unter _Was anders lief — über die ganze Phase_ am Ende.

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
zweideutig. Ergänzungen am Referenzdokument bekommen **F60** und folgende; vergeben wurden
F60–F112, **ohne F62** (siehe AP 13).

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

**E30 — Eine Sprache entsteht, indem man sie übersetzt; angeboten wird sie
getrennt davon.** `translation_override` hat bewusst keinen Fremdschlüssel auf
`active_locales` (Schema 5.3 sagt es schon), und AP 7 macht daraus eine
Bedienregel: die Sprachverwaltung schreibt Zeilen für **jeden** wohlgeformten
BCP-47-Tag, ob das Image ihn mitbringt oder nicht und ob die Organisation ihn
anbietet oder nicht. Ob Besucher ihn wählen können, ist die zweite, getrennte
Entscheidung — `app_config.active_locales`, geschrieben über
`PUT /api/admin/config/locales`. Drei Folgen: `GET /api/admin/i18n/:locale`
antwortet auch für eine Sprache, von der noch nichts existiert (sonst müsste man
sie erst den Besuchern zeigen, um das erste Wort übersetzen zu können); die Liste
der Sprachen ist die **Vereinigung** aus mitgeliefert, angeboten und übersetzt,
damit halbfertige Arbeit nicht von dem Bildschirm verschwindet, der sie fertig
machen soll; und das Zurücknehmen des Angebots löscht **nichts** — es ist der
Unterschied zwischen „wir zeigen das gerade nicht“ und „wir werfen die Arbeit
weg“. Englisch bleibt immer angeboten (NFR 4, E23), und die Vorgabesprache muss
eine der angebotenen sein — beides wird beim Schreiben erzwungen, nicht
angenommen.

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

| Methode + Pfad                                             | Zweck                                                              | AP  |
| ---------------------------------------------------------- | ------------------------------------------------------------------ | --- |
| `GET/PATCH /api/admin/config`                              | FR 1.4: Name, Farben, Schrift, Locales                             | 1   |
| `PUT/DELETE /api/admin/config/logo`                        | Logo hoch- und wegnehmen                                           | 2   |
| `PUT/DELETE /api/admin/config/app-icon`                    | App-Icon (E26)                                                     | 2   |
| `GET /api/media/branding/logo` · `app-icon`                | öffentlich, ohne Pfad vom Aufrufer (E19)                           | 2   |
| `GET /api/admin/modules`                                   | FR 1.5: Kernmodule und Plug-ins mit Zustand                        | 4   |
| `PATCH /api/admin/modules/:key`                            | an/aus, mit `refresh()` auf beiden Registries                      | 4   |
| `GET /api/setup/state` · `POST /api/setup/admin`           | FR 1.1: geführte Ersteinrichtung, 404 danach (E28)                 | 5   |
| `GET /api/i18n/:locale`                                    | Katalog, öffentlich (E22)                                          | 6   |
| `GET /api/admin/i18n` · `GET /api/admin/i18n/:locale`      | Locales mit Vollständigkeit, dann eine Locale je Schlüssel (E23)   | 7   |
| `PUT /api/admin/i18n/:locale`                              | Änderungen der Instanz schreiben — ein Schlüssel oder ein Import   | 7   |
| `DELETE /api/admin/i18n/:locale/:key`                      | einen Schlüssel auf den mitgelieferten Text zurücksetzen           | 7   |
| `PUT /api/admin/config/locales`                            | welche Sprachen angeboten werden, und welche die Vorgabe ist (E30) | 7   |
| `GET /api/config/manifest.webmanifest`                     | F20, aus der Konfiguration gebaut (E26)                            | 12  |
| `GET /api/admin/series/:id/translations`                   | FR 3.12: ein Bildschirm, eine Anfrage (F97)                        | 11  |
| `PUT/DELETE /api/admin/series/:id/translations/:locale`    | FR 3.12: geschrieben wird je Ding und Sprache                      | 11  |
| `GET /api/admin/events/:id/translations`                   | FR 3.12: Event **und** Programm in einer Antwort                   | 11  |
| `PUT/DELETE /api/admin/events/:id/translations/:locale`    | FR 3.12                                                            | 11  |
| `GET/PUT/DELETE /api/admin/program-items/:id/translations` | FR 3.12, `:locale` beim Schreiben und Löschen                      | 11  |
| `GET /api/user/**?locale=…`                                | die öffentlichen Leseendpunkte nehmen eine Locale (E25, F94)       | 11  |

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
verschieben), F60–F102 im Referenzdokument nachtragen, den Fünf-Container-Stack
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

| Nr.     | Inhalt                                                                                                                                       | AP  |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| F60     | `app_config` bekommt `organization_name` und `app_icon_path`; Ergänzung zu Schema 5.3 (E26)                                                  | 1   |
| F61     | Übersetzungstabelle auch für `event_series`, und was **nicht** übersetzt wird (E25)                                                          | 11  |
| ~~F62~~ | ~~Der Übersetzungskatalog wird vom Server ausgeliefert~~ — **nie vergeben**: F70 beantwortet es mitsamt der Gestalt eines Schlüssels (AP 13) | 6   |
| F63     | `CORE_MODULES` listet nur Module, die es gibt; `newsletter` entfällt (E21, Bezug F8)                                                         | 4   |
| F64     | Die Ersteinrichtung ist tokengeschützt; `ADMIN_BOOTSTRAP_*` bleibt der unbeaufsichtigte Weg (E28)                                            | 5   |
| F65     | Die Schriftart ist ein mitgelieferter Katalog, kein Upload (E18, Bezug NFR 9)                                                                | 1   |
| F66     | Wie ein Logo öffentlich wird, ohne die Anhänge mitzunehmen (E19, Bezug E9, F38)                                                              | 2   |
| F67     | Welcher Kontrast geprüft wird — und warum nicht der gegen die berechnete Textfarbe (NFR 4, E17)                                              | 3   |
| F68     | Wie die Kacheln der Event-Detailansicht entstehen (Mockups 5.2, Bezug F47)                                                                   | 4   |
| F69     | Warum der Setup-Controller `@AllowAnonymous()` trägt — der Admin-Guard überschätzt (Bezug E16)                                               | 5   |
| F70     | Gestalt und Herkunft eines Übersetzungsschlüssels; flach, gepunktet, `lowerCamelCase` (E22)                                                  | 6   |
| F71     | Welche Sprachen eine frische Instanz anbietet — die, die das Image mitbringt (NFR 4)                                                         | 6   |
| F72     | Transloco und zoneless: was die Vorprüfung wirklich fand (Bezug E20)                                                                         | 6   |
| F73     | Vollständigkeit ist eine Zahl über die englische Schlüsselliste (E23)                                                                        | 7   |
| F74     | Ein leerer Wert ist keine Übersetzung — und der mitgelieferte Text wird nicht gespeichert (E22)                                              | 7   |
| F75     | Import ist ein Merge, und unbekannte Schlüssel werden genannt statt geschluckt                                                               | 7   |
| F76     | Sprachen anbieten ist eine Entscheidung über `app_config`, nicht über die Übersetzungen (E30)                                                | 7   |
| F77     | Eine Meldung hat zwei Hälften: der Satz des Clients aus dem Katalog, der Grund des Servers daneben                                           | 8   |
| F78     | Was ein Format ist und keine Übersetzung — Datum, Zonenname, Dateigröße (Bezug E8)                                                           | 8   |
| F79     | Ein Satz, der um ein Element gebaut ist, ist keine Übersetzungseinheit                                                                       | 8   |
| F80     | Ein Schlüssel ist ein Ort in der Oberfläche; wer eine Seite benennt, nimmt deren Schlüssel                                                   | 9   |
| F81     | Zwei Zähler in einem Satz brauchen einen Schlüssel je Kombination, solange kein Plural-Modul da ist                                          | 9   |
| F82     | `admin.*` ist ein eigener Namensraum: die Clients teilen den Katalog, nicht die Sätze                                                        | 9   |
| F83     | Gespeicherte Statuswörter bekommen Schlüsselfunktionen in `shared-models` — zwei Typen, zwei Räume                                           | 9   |
| F84     | Eine Meldung aus einer wechselnden Zahl von Teilsätzen wird beim Handeln fertig, nicht beim Zeichnen                                         | 9   |
| F85     | Ein Wert, den niemand übersetzen darf — ein Befehl, ein Tag, ein Dateiname — reist als Parameter                                             | 9   |
| F86     | Der Katalog bekommt Sätze, nie die Auszeichnung um sie herum — Struktur ist Code                                                             | 10  |
| F87     | Die Einheit des Rückfalls aus E24 ist **eine Mail**, nicht der Katalog und nicht ein Schlüssel                                               | 10  |
| F88     | Text- und HTML-Teil sind zwei Darstellungen **eines** Satzes, nicht zwei Sätze                                                               | 10  |
| F89     | In welchen Sprachen eine Instanz Mail schreiben kann, ist eine Laufzeitfrage, keine Konstante                                                | 10  |
| F90     | Ein regionaler Tag ist auch für Mail eine eigene Sprache — kein Rückfall auf die Basissprache                                                | 10  |
| F91     | Ein Platzhalter, den niemand füllt, bleibt in einer Mail **stehen** — anders als auf einem Bildschirm                                        | 10  |
| F92     | Maskieren ist ein Typ, keine Gewohnheit: `Html` und die einzige Tür von `string` dorthin                                                     | 10  |
| F93     | Drei Übersetzungstabellen mit `(elternteil, locale)` und `ON DELETE CASCADE`, kein polymorpher Schlüssel                                     | 11  |
| F94     | Was `?locale=` bedeutet: fehlend, unbekannt, unbrauchbar — und warum nur das dritte ein Fehler ist                                           | 11  |
| F95     | Übersetzt wird **vor** dem Tor, nie danach — sonst gibt eine Übersetzung zurück, was F50 zurückhielt                                         | 11  |
| F96     | Eine übersetzte Liste ist nach dem sortiert, was der Leser sieht — in der Geschäftsschicht                                                   | 11  |
| F97     | Ein Bildschirm ist eine Anfrage, ein Speichern ist ein Ding und eine Sprache                                                                 | 11  |
| F98     | Eine geleerte Übersetzung löscht ihre Zeile, und Schreiben ersetzt, statt zu mergen (F74 auf Inhalte)                                        | 11  |
| F99     | Übersetzen und Anbieten sind zwei Entscheidungen — auch bei Inhalten (E30 auf Inhalte)                                                       | 11  |
| F100    | Der Lese-Port liegt beim Elternteil, das Schreiben darüber — die Abhängigkeit läuft in eine Richtung                                         | 11  |
| F101    | `type` statt `interface` für die Nutzlasten: nur so bleibt ein generischer Weg offen                                                         | 11  |
| F102    | Die Identität eines Formulars ist (Ding, Sprache) — und eine Feldliste ist kein Grund zurückzusetzen                                         | 11  |
| F103    | Das Manifest kommt vom Server und sitzt als Komposition über Konfiguration und Katalog (E26, Bezug F49)                                      | 12  |
| F104    | Es spricht die Vorgabesprache der Instanz — die Sprache eines Manifests wählt niemand (Linie E24)                                            | 12  |
| F105    | Ein hochgeladenes App-Icon ist nie `maskable` und ersetzt die mitgelieferten nur, wenn es installierbar ist                                  | 12  |
| F106    | Die Bildmaße kommen aus dem Dateikopf, ungespeichert — Lesen ist keine Prüfung (verfeinert AP 2)                                             | 12  |
| F107    | `SHIPPED_APP_ICONS` ist ein Vertrag zwischen Server und Nutzer-Client, mit einem Test gegen die Dateien                                      | 12  |
| F108    | `theme-color` schreibt der ThemeService, nicht `index.html`                                                                                  | 12  |
| F109    | Ein Hinweis, den man nicht befolgen kann, ist Werbung — angeboten wird nur, wo es geht                                                       | 12  |
| F110    | `navigator.onLine` ist asymmetrisch: nur `false` ist eine Aussage                                                                            | 12  |

Anhangspunkt 18 (TLS gehört zur Installations-Story) ist in AP 5 von „geplant"
auf „umgesetzt" gezogen.

## Definition of Done für Phase 2

Stand 29.08.2026, nach AP 13. **Alle sechs Punkte sind erfüllt** — anders als in
Phase 1, wo der sechste außerhalb dieses Repositories lag; die Rückmeldungsrunde
mit dem Pilotpartner ist in Phase 2 bewusst kein Kriterium (die fünf Fragen an
ihn stehen weiter gesammelt in `todo.md` und blockieren nichts).

1. ✅ **Jedes Arbeitspaket hat sein Abnahmekriterium nachweislich erfüllt**;
   `nx run-many -t lint test build` über 13 Projekte, 737 Server-Unit-Tests, 367
   API-Vertragstests und beide Browsersuiten sind grün — nacheinander gefahren,
   nie zusammen (die globale Drosselung, siehe AP 10).
2. ✅ **Eine Organisation kann ohne Datenbankzugriff und ohne Neubau eines
   Images:** ihre Instanz benennen und branden (Name, zwei Farben, Logo,
   App-Icon, Schrift), Module und Plug-ins schalten, eine Sprache hinzufügen und
   Oberfläche, Mails und Eventinhalte darin pflegen, und den Nutzer-Client mit
   ihrem eigenen Icon als PWA installieren. In AP 13 am laufenden
   Fünf-Container-Stack durchgespielt, einschließlich des Manifests, das danach
   den Namen, die Farbe und **nur** das hochgeladene Icon nennt.
3. ✅ **Ein frischer Fünf-Container-Stack kommt aus leerem Volume hoch**, die
   geführte Ersteinrichtung legt den ersten Administrator an (AP 5,
   `verify-setup.mjs`), und TLS lässt sich mit einer zusätzlichen Compose-Datei
   einschalten (AP 5, `verify-proxy.mjs` über HTTPS). In AP 13 noch einmal aus
   dem Stand gefahren, mit allen acht Prüfskripten gegen genau diese Instanz.
4. ✅ **`docs/INSTALL.md` existiert** und führt jemanden durch, der dieses
   Repository nicht kennt (NFR 8) — geschrieben in AP 5, gegen den Stack
   nachgezogen.
5. ✅ **`todo.md` unter _Checkable after phase 2_ ist durchgearbeitet**, F60–F112
   stehen im Referenzdokument (ohne F62 — die Nummer wurde nie vergeben, siehe
   AP 13). Der Abschnitt ist leer: sieben Einträge abgehakt, fünf mit Begründung
   verschoben, einer als nie gebaute P1-Anforderung nach _Known gaps_ eskaliert.
6. ✅ **Dieses Dokument ist von Plan auf Protokoll korrigiert** und hat je Paket
   einen Abschnitt „erledigt" sowie am Ende ein phasenweites _Was anders lief_.

---

## Fortschritt

Je Paket ein Abschnitt „erledigt" mit dem, was tatsächlich passierte — wie in
[`PHASE1.md`](PHASE1.md). Abweichungen vom Plan stehen hier, damit AP 13 sie
nicht rekonstruieren musste; das phasenweite Fazit steht am Ende des Dokuments.

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

### AP 7 — Sprachen pflegbar machen (erledigt)

Das Paket, das aus „neue Sprachen müssen durch die Organisation pflegbar sein“
eine Handlung macht: eine Sprache anlegen, sie Schlüssel für Schlüssel neben dem
englischen Original übersetzen, sehen wie weit sie ist, einen Schlüssel
zurücksetzen, die Datei für Übersetzungsarbeit außerhalb der Anwendung heraus-
und wieder hereingeben — und getrennt davon entscheiden, ob Besucher sie
überhaupt wählen können (E30).

Umgesetzt:

- **`shared-models`** — `lib/i18n/administration.ts` (`LocaleOverview`,
  `LocaleSummary`, `LocaleCatalogueDetail`, `TranslationEntry` mit den vier
  Texten nebeneinander, `TranslationWriteResult`, `translationCompleteness`) und
  in `lib/config/app-config.ts` **`isLocaleTag`**, `MAX_ACTIVE_LOCALES`,
  `LocaleSettings`. `isLocaleTag` ersetzt die drei Kopien desselben Musters, die
  sonst entstanden wären.
- **Server, `business/i18n/`** — `TranslationAdminService` (Vollständigkeit,
  Detail je Schlüssel, Merge-Write, Zurücksetzen), `I18nAdminController`
  (`GET /api/admin/i18n`, `GET`/`PUT /api/admin/i18n/:locale`,
  `DELETE /api/admin/i18n/:locale/:key`), DTOs. Der Port
  `TranslationOverrideRepository` bekommt **eine** Schreibmethode: `apply()`
  schreibt und löscht eine Sprache in einer Transaktion.
- **Server, `business/config/`** — `ConfigurationService.getLocaleSettings()` und
  `setLocales()`, `PUT /api/admin/config/locales`. Englisch wird ergänzt, wenn es
  fehlt; eine Vorgabesprache außerhalb der angebotenen ist ein 400.
- **Veranstalter-Client** — Seite `/languages`: Liste mit Zahl, Häkchen
  „Offered“, Radio „Default“, Anlegen über einen Tag, Editor mit dem englischen
  Text neben jedem Feld, Filter „nur fehlende“, Suche, Zurücksetzen je Schlüssel,
  Export und Import als JSON. Dazu `TranslationsAdminService` und
  `ConfigAdminService.setLocales()`.
- **`verify-i18n.mjs`** — läuft jetzt über die API statt über `psql`: es meldet
  sich an und geht das ganze Abnahmekriterium durch (Sprache anlegen, übersetzen,
  anbieten, öffentliche Antwort prüfen, Angebot zurücknehmen, Übersetzung
  überlebt, zurücksetzen), 25 Prüfungen.

Nachweise: `nx run-many -t lint test build` grün für alle Projekte,
`nx format:check` sauber. Neu: 29 Unit-Tests zum `TranslationAdminService`,
11 im Veranstalter-Client zur Seite, 15 API-Vertragstests
(`apps/server-e2e/src/api/admin-i18n.spec.ts`), 4 Browser-Tests. Suiten:
`server-e2e` 19 Suiten / 337 Tests, `admin-client-e2e` 239, `user-client-e2e` 165. `verify-i18n.mjs` 25/25 gegen eine laufende Instanz. F73–F76 und E30 stehen
im Referenzdokument bzw. oben.

Abweichungen und ihre Gründe:

- **Zwei Endpunkte statt der geplanten zwei — aber andere.** Der Plan sah
  `PUT/DELETE /api/admin/i18n/:locale` vor. Ein `DELETE` auf die ganze Sprache
  wäre ein Knopf, den niemand drückt; gebraucht wird „diesen einen Schlüssel
  zurücksetzen“, also `DELETE /api/admin/i18n/:locale/:key`. Und das Setzen von
  `active_locales`/`default_locale` liegt **nicht** unter `/api/admin/i18n`,
  sondern auf `PUT /api/admin/config/locales`: es sind zwei Spalten von
  `app_config`, ein zweiter Schreiber derselben Zeile wäre einer zu viel — und
  `…/i18n/locales` hätte mit `…/i18n/:locale` um dieselbe Route gestritten.
- **Zurücksetzen und Schreiben sind ein Codepfad.** `reset(locale, key)` ruft
  `write(locale, {key: ''})`. Zwei Pfade wären zwei Antworten auf die Frage, was
  ein leerer Wert bedeutet — und genau diese Frage muss der Import beantworten
  können (F74).
- **Ein Wert, der dem mitgelieferten Text gleicht, wird nicht gespeichert.**
  Sonst entstünde beim ersten Import einer exportierten Datei für jede Zeile
  eine Zeile in `translation_override` — und jede davon würde die Formulierung
  des nächsten Images überstimmen. Wer heute „Sprache“ schreibt, weil dort
  „Sprache“ steht, will nicht, dass es „Sprache“ bleibt, wenn das Image es
  ändert (F74).
- **Ein unbekannter Schlüssel ist kein 400.** Das widerspricht der Regel aus
  Phase 1 („ein unbekannter Feldschlüssel ist ein 400, kein stilles Verwerfen“),
  und zwar mit Absicht: dort ist der Schlüssel eine Frage, die dieses Event
  gestellt hat, hier ist er eine Zeile in einer Datei, die eine Übersetzerin vor
  einem halben Jahr bekommen hat. Ein 400 machte die ganze Datei unbenutzbar. Der
  Ausweg ist die dritte Möglichkeit: importieren, **und die ignorierten
  Schlüssel im Ergebnis benennen** (F75). Still verworfen wird nichts.
- **Der Whitespace-Fall ist entschieden, der Trailing-Space-Fall auch.** Ein Wert
  aus lauter Leerzeichen ist „keine eigene Übersetzung“ und löscht die Zeile;
  ein Wert **mit** Leerzeichen am Ende wird gespeichert wie er ist. Eine
  Übersetzung darf auf ein Leerzeichen enden, und es stillschweigend zu
  entfernen wäre eine Formatierungsentscheidung hinter dem Rücken der
  Übersetzerin.
- **Die Vorgabesprache wird nicht auf Sprachen mit Mailvorlagen eingeschränkt.**
  Die Ersteinrichtung tut das (AP 5), weil dort niemand nachsehen kann; hier
  nicht, weil `mailTemplates()` ohnehin am Tag entlang auf Englisch zurückfällt
  und AP 10 diese Einschränkung ganz auflöst. Eine Organisation, die ihre
  Instanz auf Französisch stellt, bekommt bis AP 10 englische Mails — das ist
  E24 in klein und kein Datenverlust.
- **Die Liste zeigt, woran gerade gearbeitet wird.** Der Server listet eine
  Sprache erst, wenn sie übersetzt **oder** angeboten ist — richtig für eine
  Antwort, falsch für einen Bildschirm: der gerade angelegte Tag, und die
  Sprache, deren letzter Schlüssel eben zurückgesetzt wurde, verschwänden aus
  der Zeile, während ihr Editor darunter offen steht. Die Seite hält deshalb
  eine kleine Menge „auf diesem Besuch angefasst“ und mischt sie in die Antwort.
  Gefunden hat es der Browserdurchlauf, nicht der Unit-Test.
- **Das Angebot wird als Ganzes geschrieben, die Übersetzungen auch.** Ein
  Häkchen schreibt nicht sofort: die Vorgabesprache muss eine der angebotenen
  sein, also gäbe es zwischen zwei Anfragen einen Moment, in dem sie es nicht
  ist. Und alle geänderten Felder gehen in **einer** Anfrage raus, die der Server
  in **einer** Transaktion anwendet — dieselbe Linie wie beim Umsortieren des
  Formulars in Phase 1.
- **Der Browsertest fasst `active_locales` nicht an.** Eine dritte Sprache im
  Umschalter würde zwei andere Suiten zum Fehlschlagen bringen, die parallel
  laufen. Diese Hälfte des Abnahmekriteriums steht deshalb in
  `apps/server-e2e` (dort läuft eine Suite allein) und in `verify-i18n.mjs`; der
  Browsertest schreibt nur Übersetzungen, und zwar in einer Sprache, die sonst
  niemand benutzt.
- **`getByText('0%')` findet auch die Null in „20 %“.** Playwrights
  Textvergleich ist ein Teilstring — der Test bewies das Gegenteil dessen, was er
  behauptete, bis `exact: true` daran stand. Und zwei Tabellen auf einer Seite
  brauchen `aria-label`, sonst trifft ein Zeilen-Locator auch die Kopfzeile der
  anderen; das ist zugleich die Barrierefreiheits-Korrektur (NFR 4).

Was AP 7 **nicht** enthält: keine Übersetzung der Sprachverwaltung selbst — die
Seite ist englisch wie jede andere Seite dieses Clients bis AP 9; keine
Textextraktion (AP 8, AP 9); keine übersetzten Mails (AP 10); keine
Inhaltsübersetzungen (AP 11); und **keinen** Upload eigener Schriftarten (E18,
steht weiter in `todo.md`).

### AP 8 — Nutzer-Client übersetzen (erledigt)

Jeder sichtbare Text der sieben Seiten, der Diagnoseseite und der Shell steht im
Katalog: **149 Schlüssel** in `en.json`, dieselben in `de.json`. Die Landingpage
ist auf Deutsch vollständig deutsch — geprüft im Browser, in allen drei Engines.

Was dabei entschieden wurde und in der Umsetzung steht:

**F77 — eine Meldung hat zwei Hälften.** Die Sätze dieses Clients wandern in den
Katalog; die Meldung des **Servers** bleibt englisch, weil der Server englisch
ist. Beides zu mischen ginge auf zwei Arten schief: die Servermeldung wegzuwerfen
kostet die Begründung („dieser Programmpunkt ist voll", „diese Datei ist zu
groß"), sie allein zu zeigen setzt einen englischen Satz auf eine deutsche Seite.
Also beides: `Problem = { key, detail }` in `shared-http`, der Schlüssel wird
gezeichnet, der Grund steht als `.notice__detail` darunter. Damit „Not Found"
nicht als Begründung durchgeht, trägt `ApiError` jetzt `explained` — wahr nur,
wenn der Server einen eigenen Text geschickt hat, falsch für alles, was diese
Bibliothek selbst formuliert hat (offline, Statustext). Wo der Client den Grund
schon kennt (404 auf eine Reihe oder ein Event), setzt er `detail: null` von
Hand. Deutsche Servermeldungen wären eine eigene Arbeit — Fehlercodes statt
Sätze, quer durch die Geschäftslogik; das steht in `todo.md`.

**F78 — was ein Format ist und keine Übersetzung.** Die Helfer aus
`shared-models` bekommen jetzt die Sprache des **Lesers**, nicht die
Vorgabesprache der Instanz (`this.i18n.locale()` statt
`config.defaultLocale`). E8 bleibt unberührt: die **Zone** ist die des Events.
Dazu kommt `formatBytes(bytes, locale)` — „4.7 MB" ist für eine deutsche Leserin
eine andere Zahl als „4,7 MB". Der Browserdurchlauf hat dabei etwas gezeigt, das
im Plan niemand aufgeschrieben hatte: auch der **Zonenname** folgt der Sprache,
weil `zoneLabel` über `Intl` geht — dasselbe Berlin heißt auf Deutsch `MEZ` und
auf Englisch `GMT+1`. Der Test erwartet jetzt beides, je Sprache.

**F79 — ein Satz um ein Element herum ist keine Übersetzungseinheit.** „We have
sent a confirmation link to **&lt;strong&gt;adresse&lt;/strong&gt;**. Open it …"
sind für eine Übersetzerin drei Fragmente, und Deutsch stellt sie anders. Der
Satz ist deshalb **ein** Schlüssel mit `{{address}}` als Platzhalter; die
Auszeichnung entfällt. Zwei Stellen betroffen (Anmeldebestätigung und die
Bestätigungsseite). Der Wortlaut ist unverändert — der Fettdruck ist der Preis,
und er ist kleiner als drei unübersetzbare Bruchstücke.

Beschriftungen ohne Template gab es an drei Stellen, und alle drei sind jetzt
Schlüssel statt Text in einer Bibliothek, die auch der Server importiert:

- `MEDIA_LINK_KIND_LABELS` → `mediaLinkKindKey(kind, count)`;
  `MediaLinkGroup.label` heißt jetzt `labelKey`. Der Veranstalter-Client zog mit
  (eine Zeile), der Rest folgt in AP 9.
- `UPLOAD_TYPES` bekommt je Eintrag ein `key`-Segment und dazu
  `uploadTypeLabelKey(mimeType)`; `uploadTypeLabel()` **bleibt** englisch, weil
  es die Ablehnungen des Servers schreibt.
- `registrationStatusKey(status)` — die Selbstbedienungsseite zeigte den
  gespeicherten Wert (`confirmed`), also ein Datenbankwort an einen Menschen.

**Die Browsersuite prüft gegen Schlüssel.** `support/catalogue.ts` liest die
mitgelieferten Kataloge von der Platte und liefert `t(key, params, locale)`; jede
Assertion nennt einen Schlüssel statt eines englischen Wortes. Damit ist eine
Umformulierung durch die Organisation keine Teständerung mehr — und ein Schlüssel
ohne Eintrag lässt `t()` **werfen**, statt Schlüssel gegen Schlüssel zu
vergleichen. Dazu `expectNoRawKeys(page)`: es sucht Textknoten, die **ganz** wie
ein Schlüssel aussehen, und ist damit die eine Prüfung, die _jede_ Lücke der
Extraktion auf einer besuchten Seite findet. Ganze Knoten, nicht Teilstrings —
eine Domain im Linktext (`files.example.org`) hat dieselbe Gestalt wie ein
Schlüssel und steht nie allein in einem Knoten.

Was anders lief:

- **Der Aufräumcode der Sprachverwaltung lief in einen Timeout — und legte
  dabei einen älteren Fehler frei.** Der Katalog hatte fünf Schlüssel und hat
  jetzt 149; `resetLocale()` schickte ein `DELETE` **je Schlüssel** und brauchte
  damit länger, als der ganze Test darf. Er **fragt** jetzt, welche Schlüssel
  überhaupt eine Zeile haben, und löscht nur die — schnell im Normalfall und
  weiterhin selbstheilend, was mehr wiegt: ein abgebrochener Lauf lässt Zeilen
  zurück, und ein Aufräumen, das nur die eigenen Schlüssel kennt, ließe sie für
  den nächsten Lauf liegen. Nachgewiesen, indem eine fremde Zeile absichtlich
  zurückgelassen und die Suite darauf angesetzt wurde.
- **Zwei Tests derselben Datei liefen parallel und schrieben dieselbe Sprache.**
  Sichtbar wurde es erst hier — die längeren Läufe ließen die Fenster
  überlappen —, aber der Fehler lag schon vorher: `test.skip(browserName !==
'chromium')` hält die drei Engines auseinander und sagt nichts darüber, dass
  Playwright die Tests **einer Datei** ebenfalls auf mehrere Arbeiter verteilt
  (`fullyParallel` im Nx-Preset). Beide schrieben den ersten Schlüssel von `oc`,
  und jeder prüfte, was der andere gerade ersetzt hatte. In der CI konnte das nie
  auffallen: dort läuft **ein** Arbeiter. Behoben mit
  `test.describe.configure({ mode: 'serial' })` um die zwei schreibenden Tests —
  die Aussage, die vorher nur im Kommentar stand.
- **Eine Template-Methode zeichnet neu, ein `computed()` nicht.** Beides steht
  in diesem Paket nebeneinander: `where()` und `seats()` sind Methoden und werden
  neu ausgewertet, sobald die Pipes derselben Seite den View markieren; `tiles()`
  und `days()` sind memoisiert und lesen deshalb `locale()` selbst (F72). Der
  Unterschied ist nirgends sichtbar außer im Verhalten nach einem Klick auf
  „Deutsch" — der Browsertest prüft jetzt beide Sorten auf einer Seite.
- **Der Fake eines Sprachdienstes musste Platzhalter lernen.** Der aus AP 6 gab
  den Text zurück, ohne `{{count}}` zu füllen; die Kachelbeschriftungen tun genau
  das. Ein Fake, der weniger kann als das Original, verschiebt den Fehlschlag in
  den Browser.
- **Zwei Anzeigen bleiben roh, mit Absicht.** Auf der Diagnoseseite stehen die
  Zustandswörter des Push- und des Socket-Clients (`subscribed`, `connected`) und
  die Modulschlüssel unübersetzt da: das sind Werte, die ein Betreiber meldet,
  keine Wörter, die er liest. Ebenso die Feldbeschriftungen des
  Registrierungsformulars — die gehören der Organisation, nicht dem Katalog
  (Inhaltsübersetzungen sind AP 11).

Was AP 8 **nicht** enthält: den Veranstalter-Client (AP 9, bis auf die eine
Zeile in der Medien-Link-Seite), die Mails (AP 10), Inhalte (AP 11) und deutsche
**Server**meldungen (`todo.md`).

### AP 9 — Veranstalter-Client übersetzen (erledigt)

Sechzehn Seiten plus die Shell. Der Katalog wächst von 149 auf **598 Schlüssel**
in beiden mitgelieferten Sprachen, 443 davon unter `admin.`; ein Veranstalter
bedient die Anwendung von der Anmeldung bis zum Einladungsversand auf Deutsch.
Der Sprachumschalter, der in AP 6 auf dem Anmeldeformular gefehlt hat, ist
nachgezogen — es ist die einzige Seite dieses Clients mit einem eigenen, weil
die Seitenleiste erst nach der Anmeldung gezeichnet wird.

Fünf Entscheidungen waren mehr als „Zeichenketten verschieben":

**Ein Schlüssel ist ein Ort in der Oberfläche, kein Wort** (F80). Die Navigation
sagt „Event series", die Startseite auch — und beides ist derselbe Ort: der
Menüeintrag benennt die Seite, auf die er führt, also nimmt er ihren Schlüssel
(`admin.series.title`). Genauso „New event" (Knopf und Überschrift),
„Participants" und „Invite former participants". Zwei Schlüssel mit demselben
Text wären zwei Stellen, an denen eine Umbenennung ankommen kann — und nur eine
davon würde es. Die Gegenprobe steht im selben Paket: **`Cancel` ist zweimal
etwas anderes.** Auf einem Formular heißt es „Abbrechen", auf einer Anmeldung
„Stornieren" — ein gemeinsamer `common.cancel` hätte im Deutschen einen
Veranstalter dazu gebracht, eine Anmeldung abzubrechen. Gleiche Wörter, die im
Englischen zusammenfallen, sind der häufigste Weg, eine Übersetzung falsch zu
machen.

**`admin.*` ist ein eigener Namensraum** (F82). Beide Clients lesen denselben
Katalog, und die 149 Schlüssel aus AP 8 gehören dem Nutzer-Client. Sie werden
nicht wiederverwendet — auch nicht dort, wo der englische Text gleich ist: der
Teilnehmenden-Client sagt „On site and online", weil jemand entscheidet, ob er
reist; der Veranstalter-Client sagt „Hybrid" in einer Spalte „Art". Zwei
Zielgruppen, zwei Vokabulare. Wiederverwendet wird nur, was **dasselbe Ding**
benennt: `registration.status.*`, `mediaLinks.kind.*`, `modules.*.title`,
`common.loading` — und `register.submit` in der Design-Vorschau, die ja genau
den Knopf zeigt, den Teilnehmende drücken.

**Gespeicherte Statuswörter bekommen eine Schlüsselfunktion** (F83), wie
`registrationStatusKey` sie in AP 8 bekommen hat: `eventStatusKey` und
`eventSeriesStatusKey` in `shared-models`. Zwei Funktionen, nicht eine — genau
aus dem Grund, aus dem `EventStatus` und `EventSeriesStatus` zwei Typen sind
(ein Event bekommt eher einmal ein `cancelled` als eine Reihe). Ein gemeinsamer
Schlüsselraum hätte die Kopplung wiederhergestellt, die die Typen vermeiden.
Der Feldtyp des Baukastens (`text`, `select`, `checkbox`, `file`) zieht
mit — die Karte druckte bis hier `select` an einen Menschen —, und zwar aus
**denselben** vier Schlüsseln, die das Auswahlfeld „Art der Antwort" benutzt:
zwei Vokabulare für eine Sache auf einem Bildschirm wären schlimmer als ein
langes Wort in einer kleinen Pille. `admin.eventType.*` bleibt dagegen im
Client (`features/i18n/labels.ts`), weil es kein gespeicherter Zustand ist,
sondern die Wortwahl dieses Clients.

**Zwei Zähler in einem Satz brauchen einen Schlüssel je Kombination** (F81).
„9 seats taken in 2 sessions" zählt zweimal, Transloco bringt hier keine
Pluralregeln mit, und die Alternative — „9 Plätze belegt" plus „in 2 Sitzungen"
als zwei Fragmente — ist genau das, was F79 ausschließt: was schon
zusammengeklebt ankommt, kann eine Übersetzerin nicht umstellen. Also vier
Schlüssel (`metaSeats.oneOne`, `.oneMany`, `.manyOne`, `.manyMany`). Das ist der
ehrliche Preis, und er ist ein Hinweis: ein Satz, der zweimal zählt, ist ein
Satz, den man beim nächsten Mal anders schneidet.

**Eine Meldung aus wechselnd vielen Teilsätzen wird beim Handeln fertig** (F84).
„Saved: 3 written, 1 reset, 2 unknown keys ignored (…)" hat keine feste Gestalt,
also gibt es keinen Schlüssel, den ein Template halten könnte; die Sprachseite
speichert deshalb den **fertigen Satz** und behält die Sprache, in der die
Handlung passiert ist. Jede andere Meldung dieses Clients speichert Schlüssel
und Parameter (`{ key, params }`) und folgt einem Sprachwechsel wie alles andere
— so machen es die Modul- und die Einladungsseite. Der Unterschied ist die
wechselnde Zahl der Teilsätze, nicht die Flüchtigkeit.

Dazu kommt eine Erweiterung von F79: **ein Wert, den niemand übersetzen darf,
reist als Parameter** (F85) — `docker compose logs server`, `Secure`,
`docs/INSTALL.md`, die drei Beispiel-Sprachkürzel `fr`/`pt-BR`/`tr`. Sie standen
in `<code>`-Elementen mitten im Satz; der Satz ist jetzt ein Schlüssel, die
Auszeichnung entfällt, und der Literal bleibt im Code statt im Katalog, wo ihn
jemand übersetzen könnte.

Fehlermeldungen folgen F77 unverändert: der Satz dieses Clients aus dem Katalog,
der Grund des Servers englisch daneben in `.error__detail` (jetzt global in
`apps/admin-client/src/styles.scss`). Alle siebzehn `error()`-Signale dieses
Clients halten jetzt `Problem` statt `string` — sechzehn Seiten und das Bild-Feld
der Design-Seite. Wo dieser Client den Grund selbst kennt — 401 und 429
auf dem Login, 401 und 404 in der Ersteinrichtung, 404 auf einer Reihe oder
einem Event —, setzt er `detail: null`; ein 409 der Ersteinrichtung dagegen
bringt den Grund mit, weil nur er sagt, **welcher** Wert abgelehnt wurde. Neu
ist ein `CatalogueFileError` auf der Sprachseite: eine Datei, die dieser Client
selbst ablehnt („kein JSON", „kein Objekt aus Text"), trägt einen Schlüssel
statt eines englischen Satzes — anders als eine Ablehnung des Servers.

Formate folgen F78: `formatInstant`, `formatEventPeriod`, `formatProgramTime`,
`groupProgramByDay` und `formatBytes` bekommen überall
`TranslationService.locale()`. Die Programmseite las bis hier
`config.defaultLocale` — die Sprache der **Instanz** statt die des Lesers; das
war derselbe Fehler, den F78 im Nutzer-Client benannt hat, und er stand hier
noch. Die Zeitzone bleibt die des Events (E8); die Zeitstempel der
Administratorenliste stehen dagegen in der Zone des Lesers, weil eine Anmeldung
zu keinem Event gehört (`localTimeZone()`).

**Die Browsersuite prüft gegen Schlüssel.** `support/catalogue.ts` ist dieselbe
Datei wie im Teilnehmenden-Client, um `tPattern()` erweitert: für die Sätze,
deren Parameter ein Browsertest nicht nachbauen kann (ein formatierter Zeitraum,
eine Zonenabkürzung, die der Sprache des Lesers folgt) wird der Schlüsseltext zu
einem regulären Ausdruck mit `.+` an den Platzhaltern — statt ein englisches
Fragment zu behaupten. 250 Zeichenketten sind Nachschläge geworden; was literal
bleibt, ist Fixture-Text, ein Bezeichner, eine Uhrzeit oder eine **Server**meldung
(F77). Rund 350 Nachschläge stehen jetzt in den fünfzehn Dateien; zwei Tests
sind neu und prüfen genau das Abnahmekriterium: ein
Rundgang auf Deutsch durch Startseite, Zugänge und Design (mit
`expectNoRawKeys` auf jeder), und die Teilnehmerübersicht auf Deutsch — deren
Spaltenreihenfolge zeigt, dass die E-Mail-Spalte an derselben Stelle steht
(E13), in der Sprache, die der Veranstalter gewählt hat.

**Was anders lief:**

- **Der größere Katalog macht eine Prozentzahl unbrauchbar.** Der Browsertest
  der Sprachverwaltung prüfte, dass die Vollständigkeit „von 0 % auf einen
  echten Wert" springt, sobald ein Schlüssel übersetzt ist. Bei 149 Schlüsseln
  war ein Schlüssel 0,67 % und rundete auf 1 %; bei 598 sind es 0,17 % und die
  Zahl bleibt bei 0 %. Das ist kein Fehler, sondern eine Rundung — und genau
  deshalb steht die **Anzahl** neben der Prozentzahl. Der Test zählt jetzt
  („1 von 598 Schlüsseln") statt zu runden. Für eine Organisation heißt das:
  eine neue Sprache zeigt ihren Fortschritt zuerst in der Zahl, nicht im
  Prozentwert.
- **Die Extraktion fand eine Anzeige, die niemand übersetzt hätte.** Das
  Event-Formular listete die Sprachen einer Veranstaltung als `de`, `en` — die
  gespeicherten Tags. Sie heißen jetzt „Deutsch" und „English"
  (`TranslationService.languageName`), wie überall sonst in beiden Clients. Kein
  Katalogeintrag, sondern `Intl.DisplayNames` — die Entscheidung aus AP 6.
- **Ein Backtick in einem Template-Kommentar, erneut.** Diesmal um
  `Europe/Berlin`; der Compiler meldete zehn Folgefehler an anderen Stellen
  (`Cannot find name 'Berlin'`). Die Regel steht seit Phase 1 in `CLAUDE.md` und
  ist trotzdem wieder passiert — jetzt steht die Begründung im Kommentar selbst.
- **`admin.invitations.colSubject` und `admin.invitations.subject` heißen beide
  „Subject".** Die automatische Umstellung der Browsersuite griff zum
  Spaltenkopf, wo das Formularfeld gemeint war; der Test wäre grün geblieben und
  hätte nach einer deutschen Umformulierung des einen den anderen gesucht. Wo
  zwei Schlüssel denselben englischen Text tragen, entscheidet der Ort, nicht
  die Zeichenkette — das ist F80 von der anderen Seite.
- **Ein Fake, der `translate()` nicht kann, bricht erst im Browser.** Der
  Sprachdienst-Fake der Sprachverwaltung hatte nur `languageName` und `locale`;
  die Seite ruft seit diesem Paket auch `translate()`. Er hat es gelernt,
  einschließlich der Platzhalter — und bleibt so nicht-reaktiv wie Transloco
  (dieselbe Linie wie in AP 6 und AP 8).
- **Zwei Anzeigen bleiben roh, mit Absicht.** Die Schriftartennamen im
  Design-Formular („System font", „Inter", „Lora") — drei sind Eigennamen, und
  der vierte ist laut Katalogkommentar bewusst so formuliert, dass er keine
  Übersetzung braucht (E18). Und der Ladehinweis in `index.html` („Loading
  Trefaro…"), der gezeichnet wird, bevor es einen Katalog gibt; im
  Teilnehmenden-Client steht er aus demselben Grund englisch da.

Was AP 9 **nicht** enthält: die Mails (AP 10), Inhalte wie Event- und
Programmtexte (AP 11) und deutsche **Server**meldungen (`todo.md`).

### AP 10 — Die Mails aus demselben Katalog (erledigt)

Die vier Mails — Bestätigungsaufforderung, Empfangsbestätigung, Stornohinweis,
Einladung — lesen ihren Text aus dem Katalog, den die Organisation pflegt. Die
beiden Dateien `templates/de.ts` und `templates/en.ts` sind **entfallen**; an
ihre Stelle treten **21 Schlüssel** unter `mail.` (Katalog: 598 → **619**), ein
Renderer je Mail und die Regel von E24 als eigener Dienst. Ein Veranstalter
ändert den Betreff der Bestätigungsmail auf der Sprachverwaltung, und die
nächste Mail trägt ihn — ohne Neubau, ohne Neustart. Nachgewiesen an einer
laufenden Instanz, in beiden Sprachen (`verify-mail.mjs`, unten).

Umgesetzt:

- **`libs/shared-i18n/catalogues/{en,de}.json`** — 21 neue Schlüssel: drei
  geteilte (`mail.greeting`, `mail.event.when`, `mail.event.details`), einer für
  die Handlungszeile im Textteil (`mail.actionLine`) und je Mail ihre eigenen.
- **`business/mail/templates/`** — `mails.ts` (die vier `MailTemplate`, jeweils
  Schlüsselliste **und** Renderer), `strings.ts` (`MailStrings`, Interpolation,
  `MissingMailTextError`), `html.ts` (jetzt mit dem Typ `Html`), `types.ts` ohne
  das alte `MailTemplates`-Interface.
- **`business/mail/mail-catalogue.service.ts`** — E24: `strings(keys)` liest die
  Standardsprache der Instanz, prüft sie gegen die Schlüsselliste **dieser** Mail
  und fällt sonst als Ganzes auf Englisch zurück, mit einer Logzeile, die die
  fehlenden Schlüssel **nennt**. Dazu `localesForMail()`.
- **`business/i18n/catalogue.service.ts`** — zwei Leser mehr: `ownTexts(locale)`
  (was eine Sprache selbst sagt, mit den Lücken offen) und `servableLocales()`.
- **`business/setup/`** — der Assistent fragt die Liste jetzt, statt sie zu
  importieren; `MAIL_TEMPLATE_LOCALES` ist entfallen.
- **`tools/spike-verification/verify-mail.mjs`** — neu, 35 Prüfungen gegen eine
  laufende Instanz plus Mailpit.

Sieben Entscheidungen waren mehr als „Text verschieben":

**Der Katalog bekommt Sätze, nie die Auszeichnung um sie herum** (F86). Was in
den Katalog wandert, ist der Satz; `<div>`, `<p>`, `<strong>` und der Link
bleiben Code. Eine Organisation ändert die Worte ihrer Bestätigungsmail, nicht
die Gestalt des Dokuments — und ein `<` in einer Übersetzung wäre sonst
Auszeichnung im Postfach eines Fremden. Deshalb wird der **Katalogtext selbst**
maskiert und erst danach interpoliert: die Platzhalter überstehen das Maskieren
unverändert, ein zuerst eingesetzter Wert wäre doppelt maskiert.

**Die Einheit des Rückfalls ist eine Mail** (F87). E24 sagt „fehlt ein Baustein
einer Mail"; offen war, was „eine Mail" heißt. Es heißt genau das: eine Sprache,
die die drei Anmeldemails übersetzt hat und die Einladung nicht, schickt drei
deutsche Mails und eine englische. Gröber — je Instanz — würde ein
unübersetzter Satz die gesamte Korrespondenz ins Englische kippen; feiner — je
Schlüssel — gäbe es E24 nicht. Die Schlüsselliste reist deshalb **mit** dem
Renderer in einem Wert (`MailTemplate`), sonst driftet sie von ihm weg.

**Text- und HTML-Teil sind zwei Darstellungen eines Satzes** (F88). Die alten
Vorlagen sagten im Textteil „open the link below" und setzten im HTML-Teil einen
Knopf — zwei Formulierungen, die eine Übersetzerin unabhängig voneinander falsch
machen kann. Jetzt gibt es einen Satz und **eine** Handlung: derselbe Schlüssel
ist die Beschriftung des Links und die Zeile über der nackten Adresse. Der
Doppelpunkt dazwischen ist ein eigener Schlüssel (`mail.actionLine`) und kein
Zeichen im Code — im Französischen steht dort `Label :`, und Satzzeichen, die in
TypeScript angeschweißt sind, erreicht keine Übersetzung.

**Welche Sprachen Mail können, ist eine Laufzeitfrage** (F89).
`MAIL_TEMPLATE_LOCALES` war `Object.keys()` über eine Registry von Dateien; seit
der Text Daten ist, lautet die Frage „hat diese **Instanz** deutsche Worte für
alle vier Mails". Der Einrichtungsassistent fragt sie über
`MailCatalogue.localesForMail()`, und die Antwort ist streng: eine Sprache zählt
nur, wenn sie **jede** Mail abdeckt — die Wahl der Standardsprache entscheidet
über alle künftige Korrespondenz, und E24 würde sonst die Hälfte davon
stillschweigend auf Englisch stellen. Die Kehrseite ist der Gewinn: eine
Organisation, die eine dritte Sprache fertig übersetzt, kann die Instanz darauf
stellen, ohne dass jemand ein Image baut.

**Ein regionaler Tag ist eine eigene Sprache** (F90). `mailTemplates('de-AT')`
fiel bisher am Tag entlang auf Deutsch zurück; das gibt es nicht mehr. Der Grund
ist Übereinstimmung: `CatalogueService.resolve('de-at')` kennt diesen Rückfall
auch nicht, also hätte eine Instanz mit `de-AT` eine englische Oberfläche und
deutsche Mails gehabt. Wer `de-AT` benutzen will, übersetzt es — was seit AP 7
zwei Klicks sind — oder benutzt `de`.

**Ein Platzhalter, den niemand füllt, bleibt stehen** (F91). Transloco setzt auf
einem Bildschirm eine leere Zeichenkette ein; hier bleibt `{{tage}}` sichtbar.
Der Unterschied ist derselbe wie bei E24 selbst: einen Bildschirm lädt man neu,
eine Mail ist raus. „Der Link ist {{tage}} Tage gültig" ist etwas, das eine
Empfängerin melden und eine Organisation finden kann; „Der Link ist Tage
gültig" ist es nicht.

**Maskieren ist ein Typ** (F92). Solange jede Vorlage ihre Sätze selbst
schrieb, stand `escapeHtml` einmal je Satz; jetzt steht es einmal je
**Parameter**, und ein vergessenes wäre ein `<script>` im Postfach. `Html` ist
deshalb ein eigener Typ, jede Funktion, die Auszeichnung baut, gibt ihn zurück,
jede, die Auszeichnung annimmt, verlangt ihn — und die einzige Tür von `string`
dorthin ist `escapeHtml`. Der Compiler fragt jetzt danach.

Dazu eine Anwendung von F85: **die Gültigkeitsdauer des Bestätigungslinks kommt
aus `CONFIRMATION_TOKEN_TTL_MS`**, nicht aus dem Katalogtext. „14 Tage" stand
bisher in zwei Sprachen als Prosa da; wären aus E5 einmal zehn Tage, hätten beide
gelogen, und nichts hätte es gemerkt.

Nachgewiesen:

- **Unit:** `mails.spec.ts` rendert die vier Mails gegen die **wirklich
  mitgelieferten** Katalogdateien (nicht gegen ein Fixture) — das ist der
  Nachfolger der Compile-Time-Garantie, die E24 aufgibt; `strings.spec.ts`
  (Interpolation, doppeltes Maskieren, stehender Platzhalter);
  `mail-catalogue.service.spec.ts` (E24 in fünf Varianten, `localesForMail`);
  `catalogue.service.spec.ts` um `ownTexts`/`servableLocales` erweitert.
  `nx run-many -t lint test build` über 13 Projekte grün, Server **667 Tests**;
  `server-e2e` 337, `user-client-e2e` 168 und `admin-client-e2e` 245 Tests grün.
- **Gegen eine laufende Instanz:** `verify-mail.mjs`, **35 PASS**, einmal in
  Englisch und einmal mit `LOCALE=de` — es registriert, bestätigt, storniert und
  lädt ein, liest alle vier Mails aus Mailpit, ändert den Betreff über
  `PUT /api/admin/i18n/:locale` und prüft ihn an der **nächsten** Mail, stellt
  die Instanz auf eine zu 1/21 übersetzte Sprache und prüft, dass der ganze Brief
  englisch ankommt. Danach stellt es alles wieder her.

Was anders lief:

- **Der Text- und der HTML-Teil sagten nicht dasselbe.** Aufgefallen erst beim
  Zusammenlegen: „Your personal page — … or cancel:" gegen „On your personal
  page you can … or cancel." Ein Satz je Stelle, nicht zwei — sonst hätte die
  Zusammenlegung eine Formulierung stillschweigend gewonnen.
- **`{{label}}:` ist ein Schlüssel geworden, nicht ein Doppelpunkt im Code.**
  Der erste Entwurf schrieb `${label}:` — und wäre im Französischen falsch
  gesetzt. Ein Zeichen, das keine Übersetzerin erreichen kann, ist dasselbe
  Problem wie ein Satzfragment (F79), nur kleiner.
- **Jest und Vitest laufen aus verschiedenen Verzeichnissen.**
  `catalogues.spec.ts` in der Bibliothek liest `process.cwd()` — dort ist das der
  Arbeitsbereich. In `apps/server` ist es das Projektverzeichnis, und derselbe
  Pfad war leer. `mails.spec.ts` sucht das Katalogverzeichnis deshalb nach oben,
  statt einen Pfad zu raten.
- **Ein Test, der zu viel wegnahm.** „Fällt je Mail zurück" hielt der Sprache
  alle Schlüssel der Einladung vor — darunter Gruß und Eventblock, die die
  Empfangsbestätigung genauso braucht. Beide fielen zurück, und der Test bewies
  das Gegenteil dessen, was er behauptete. Er nimmt jetzt nur, was **allein** zur
  Einladung gehört.
- **`MAIL_TEMPLATE_LOCALES` hatte einen zweiten Leser**, den die Suche zuerst
  nicht zeigte: `SetupService` prüft damit die gewählte Standardsprache. Aus der
  Konstante wurde ein Aufruf, aus dem `import` eine Modulabhängigkeit
  (`SetupModule` → `MailModule`) — und die Fehlermeldung sagt jetzt „languages
  this instance can send mail in" statt „languages this instance ships", weil das
  seit diesem Paket zweierlei ist.
- **Der Server hat einen zweiten `FALLBACK_LOCALE` verloren.** `templates/index.ts`
  hatte einen eigenen neben dem in `shared-models`. Jetzt gibt es einen.
- **Beide Browsersuiten gleichzeitig zu starten sprengt die Drosselung.** Ein
  `nx run-many -t e2e` über `user-client-e2e` **und** `admin-client-e2e` schickt
  sechs Browser gleichzeitig gegen einen Server, und alle kommen von `::1`: 104 ×
  `429 /api/i18n/en`, worauf beide Clients ihre Schlüssel roh zeichnen und die
  Fehlschläge nach kaputtem Katalog aussehen. Die Grenze ist richtig (E4, 300
  Anfragen je Minute je Adresse) und wird nicht gelockert; die Suiten laufen
  nacheinander, wie in der CI. Mit AP 10 hat das nichts zu tun — 21 Schlüssel
  mehr sind mehr Bytes, nicht mehr Anfragen.

### AP 11 — Inhaltsübersetzungen (erledigt)

Was eine Organisation selbst schreibt — Reihen, Events, Programmpunkte — hat
jetzt je Sprache eine zweite Fassung. Drei Tabellen, drei Ports, ein
`ContentTranslationsService`, `?locale=` auf allen öffentlichen Leseendpunkten,
und im Veranstalter-Client je Reihe und Event eine eigene Übersetzungsseite mit
einem Reiter je Zielsprache. Ein Event mit deutscher Übersetzung erscheint auf
Deutsch deutsch und auf Englisch englisch; ein Programmpunkt ohne Übersetzung
zeigt sein Original; `venue_address` ist in jeder Sprache dieselbe Straße; und
das Löschen eines Events nimmt seine Übersetzungen mit.

Umgesetzt:

- **`shared-models`** — `lib/i18n/content.ts` mit `EventSeriesTranslation`,
  `EventTranslation`, `ProgramItemTranslation`, den Bildschirmtypen
  (`TranslatableItem`, `EventTranslations` mit `programItems`) und den beiden
  Regeln als Funktionen (`translatedText`, `isEmptyTranslation`); dazu
  `canonicalLocaleTag` neben `isLocaleTag` und die Spaltengrenzen
  `MAX_CONTENT_NAME_LENGTH`, `MAX_CONTENT_DESCRIPTION_LENGTH`,
  `MAX_VENUE_NAME_LENGTH`, die bis dahin als private Kopien in zwei DTO-Dateien
  standen.
- **Schema** — `event_series_translation`, `event_translation`,
  `program_item_translation`; Migration `1787790300000-ContentTranslations`.
- **Ports** — `business/common/ports/content-translation.port.ts` (die gemeinsame
  Form, Lese- und Schreibhälfte getrennt) plus je ein Token im Modul des
  Elternteils; drei TypeORM-Implementierungen über einer generischen Basis.
- **Überlagerung** — `EventSeriesService`, `EventsService`, `ProgramService` und
  `SelfServiceService` nehmen ein optionales `locale` und legen die Übersetzung
  feldweise über das Original.
- **`business/content-translations/`** — der Schreibdienst und drei Controller
  (`/api/admin/{series,events,program-items}/:id/translations[/:locale]`).
- **`LocaleQueryPipe`** und `ApiLocaleQuery()` in `business/common/`.
- **Nutzer-Client** — die vier öffentlichen Dienste tragen die Sprache; fünf
  Seiten laden neu, wenn sie sich ändert. `ApiClient.put/delete/post` nehmen
  dafür Query-Parameter.
- **Veranstalter-Client** — `features/content-translations/`, die Seiten
  `/series/:id/translations` und
  `/series/:seriesId/events/:eventId/translations`, die Bausteine
  `translation-fields.ts`, `translation-languages.ts` und `target-locales.ts`,
  **17 neue Katalogschlüssel** unter `admin.translations.` (Katalog: 619 →
  **636**).

Zehn Entscheidungen, die sonst improvisiert worden wären:

**Drei Tabellen, kein polymorpher Fremdschlüssel** (F93). Eine Tabelle mit
`(entity_type, entity_id)` wäre eine Tabelle ohne Fremdschlüssel — und der
Fremdschlüssel ist hier der ganze Punkt: `ON DELETE CASCADE` ist der Grund,
warum niemand daran denken muss, Übersetzungen aufzuräumen. Eine verwaiste Zeile
wäre nicht nur Müll, sie tauchte irgendwann unter einem **neuen** Event auf, das
zufällig dieselbe Id bekommt. Der Schlüssel ist je Tabelle
`(<elternteil>_id, locale)`, jede Textspalte ist nullbar, und `NULL` heißt
„nimm das Original", nicht „leer". Was **fehlt**, ist die andere Hälfte der
Entscheidung (F61): `venue_address` und `speaker` haben keine Übersetzung — eine
übersetzte Straße schickt Menschen an einen Ort, den es nicht gibt, und ein Name
ist, wie jemand heißt. `event.languages` fehlt ebenfalls: in welchen Sprachen
eine Veranstaltung **stattfindet** (FR 3.1), ist eine Tatsache über sie und
keine Darstellung von ihr — deshalb darf eine englischsprachige Konferenz eine
deutsche Landingpage haben.

**`?locale=` hat drei Antworten, und nur eine ist ein Fehler** (F94). Fehlt der
Parameter, stehen die Originale — der Normalfall, der keine Abfrage kostet. Ist
er eine wohlgeformte Sprache, in die niemand übersetzt hat, ist das **kein**
Fehler: ein Link, den jemand letztes Jahr geteilt hat, muss weiter eine Seite
zeigen, auch wenn die Organisation diese Sprache längst nicht mehr anbietet. Nur
was gar kein Sprachtag ist (`de_DE`, ein Satz), ist ein 400 — das kommt aus
keinem echten Link, und die englische Seite auszuliefern versteckte den Fehler
hinter einer Seite, die richtig aussieht. In der Query und nicht in
`Accept-Language`, weil eine geteilte oder zwischengespeicherte URL dieselbe
Seite zeigen muss.

**Übersetzt wird vor dem Tor** (F95). Der Follow-Up-Text verlässt den Server erst
nach `ends_at` (F50). Die Übersetzung nachträglich über das fertige Objekt zu
legen hätte genau den Text zurückgegeben, den F50 gerade zurückgehalten hat — die
Überlagerung passiert deshalb **in** `toPublicEvent`, vor der Prüfung. Ein Test
hält das fest, in beide Richtungen.

**Eine übersetzte Liste ist nach dem sortiert, was der Leser sieht** (F96). Die
Datenbank ordnet die Reihen nach dem Namen, den der Veranstalter getippt hat;
eine Liste deutscher Namen in der Reihenfolge ihrer englischen Originale ist in
gar keiner Reihenfolge. Sobald eine Sprache im Spiel ist, sortiert die
Geschäftsschicht neu, mit `Intl.Collator` in der Sprache des Lesers und dem Slug
als letztem Kriterium. Events und Programmpunkte sind davon nicht betroffen: sie
stehen nach der Uhr, und ein übersetzter Name verschiebt nichts in der Zeit.

**Ein Bildschirm ist eine Anfrage, ein Speichern ist ein Ding und eine Sprache**
(F97). `GET …/events/:id/translations` liefert das Event **und** sein ganzes
Programm in einer Antwort (F49) — wer ein Event übersetzt, macht Kopf und
Sessions in einem Zug, und eine Anfrage je Session wäre eine Anfrage je Zeile.
Geschrieben wird dagegen einzeln: ein zu langer Titel in der neunzehnten Session
darf die achtzehn davor nicht wegwerfen, und eine Übersetzerin arbeitet ohnehin
Session für Session.

**Eine geleerte Übersetzung löscht ihre Zeile** (F98) — F74 auf Inhalte
angewandt. Jedes Feld wird beschnitten, ein leeres wird `NULL`, und eine
Übersetzung, in der nichts mehr steht, verschwindet, statt als Zeile
dazustehen, die nichts sagt: alles, was übersetzte Sprachen zählt, zählt Zeilen.
Und geschrieben wird **ersetzend**, nicht mergend — der Bildschirm schickt die
ganze Übersetzung eines Dings, ein fehlendes Feld ist also ein geleertes Feld.
Anders herum ließe sich „ich habe das gelöscht" gar nicht ausdrücken.

**Übersetzen und Anbieten bleiben zwei Entscheidungen** (F99) — E30, jetzt für
Inhalte. Geschrieben werden darf für **jeden** wohlgeformten Tag, ob die Instanz
ihn anbietet oder nicht; sonst müsste man eine Sprache erst den Besuchern zeigen,
um das erste Wort übersetzen zu können. Die Reiter des Editors sind deshalb
`active_locales` **ohne die Vorgabesprache** — das Hauptformular _ist_ die
Vorgabesprache, ein Reiter dafür wäre eine zweite Stelle für denselben Satz —
**plus** alles, wofür schon eine Übersetzung existiert: eine abbestellte Sprache
behält ihre Arbeit, und ein verschwundener Reiter machte sie unerreichbar.

**Der Lese-Port liegt beim Elternteil, das Schreiben darüber** (F100). Jedes der
drei Module liest nur die **Lesehälfte** seines eigenen Ports — die Zusammensetzung,
die schreibt, sitzt über allen dreien (dieselbe Linie wie `business/dashboard`,
F49). Damit läuft die Abhängigkeit in eine Richtung: `EventsModule` weiß nicht,
dass es ein Übersetzungsmodul gibt, und kein Dienst, der eine Landingpage
zeichnet, kann eine Übersetzung schreiben. Der gemeinsame Port musste dafür nach
`business/common/**ports**/` — die Layer-Regel des Linters lässt die
Datenzugriffsschicht nur auf `ports/` zugreifen, und das ist richtig so: er
_ist_ ein Port.

**`type` statt `interface`** (F101). TypeScript gibt einem Objekt**typ** eine
implizite Indexsignatur und einem Interface keine. Nur deshalb sind die drei
Nutzlasten `Record<string, TranslatedText>`-verträglich — und daran hängen der
eine generische Port, das eine generische Repository und das eine
Formularbauteil. Wer eine davon in ein `interface` zurückverwandelt, verteilt
Casts über drei Dateien.

**Die Identität eines Formulars ist (Ding, Sprache)** (F102). Das
Übersetzungsformular füllt sich neu, wenn es ein anderes Formular wird — anderer
Reiter, andere Session — und **nicht**, wenn ein Elternteil zufällig eine neue
Feldliste baut. Die Feldliste wird deshalb `untracked` gelesen. Warum das eine
Entscheidung und keine Feinheit ist, steht unten unter _Was anders lief_.

Nachgewiesen:

- **Unit:** `content-translations.service.spec.ts` (14 Fälle: Bildschirm,
  Schreiben, Löschen, `de-AT`/`de-at`, unbekannte Sprache, 404 vor dem
  Schreiben); die Überlagerung in `event-series.service.spec.ts`,
  `events.service.spec.ts` (inkl. F95 in beide Richtungen) und
  `program.service.spec.ts`; `locale-query.pipe.spec.ts`; `content.spec.ts` und
  `canonicalLocaleTag` in `shared-models`; `target-locales.spec.ts` und
  `series-translations-page.spec.ts` im Veranstalter-Client. Server **700 Tests**.
- **API-Vertrag:** `apps/server-e2e/src/api/content-translations.spec.ts` — 22
  Fälle gegen eine echte Datenbank, darunter der Kaskadentest, der Guard, die
  400er und dass eine geleerte Übersetzung keine Zeile hinterlässt.
  `nx e2e server-e2e` **359 Tests** grün.
- **Browser:** `user-client-e2e/src/content-translations.spec.ts` (die
  Abnahmekriterien aus der Sicht der Teilnehmenden, in drei Engines) und
  `admin-client-e2e/src/content-translations.spec.ts` (die Seiten, die Reiter,
  je Abschnitt ein Speichern, das Entfernen). **180** bzw. **260** Tests grün,
  nacheinander gefahren.

Was anders lief:

- **Ein Formular, das sich beim Tippen selbst leerte.** Die Sessions bekamen ihre
  Feldliste aus einer Template-Methode, also je Änderungslauf ein neues Array;
  der Effekt im Formularbauteil beobachtete diese Liste und setzte den Entwurf
  jedes Mal auf den gespeicherten Stand zurück. Wer tippte, verlor das Getippte
  zwischen zwei Tastenanschlägen, und „Speichern" schrieb eine leere Übersetzung
  — die dann auch noch korrekt ihre Zeile löschte (F98). Der Abschnitt des
  Events war nicht betroffen, weil seine Liste aus einem `computed()` kam. Zwei
  Änderungen: die Sessions bekommen ein memoisiertes Sichtmodell, und der Effekt
  liest die Feldliste `untracked` und hängt stattdessen an der Formularidentität
  (F102). **Gefunden hat es nur der Browserdurchlauf** — jeder Unit-Test des
  Bauteils setzt die Eingaben genau einmal.
- **Ein Test, der schon grün war, bevor er etwas geprüft hatte.** „Gespeichert."
  ist eine Meldung für alle Abschnitte; die zweite Prüfung fand die Meldung der
  **ersten** Speicherung vor und ging durch, bevor die eigene Anfrage überhaupt
  raus war. Die Suite wartet jetzt auf die `PUT`-Antwort selbst.
- **Zwei Elemente mit demselben Text.** `getByText(seriesName)` traf auf der
  Übersetzungsseite die Brotkrume _und_ den Originalblock — dieselbe Klasse von
  Fehlschlag wie `exact: true` in AP 13 der Phase 1. Der Test nennt jetzt die
  Rolle.
- **Zwei private Kopien einer Spaltengrenze.** `MAX_NAME_LENGTH = 200` stand in
  `create-event.dto.ts` **und** in `create-event-series.dto.ts`, und die
  Übersetzung hätte eine dritte gebraucht. Sie stehen jetzt in `shared-models`:
  eine Übersetzung, die länger sein dürfte als ihr Original, passt in kein
  Layout, in das das Original passt.
- **`ApiClient` konnte an einem `PUT` keine Query-Parameter.** Die
  Selbstbedienung antwortet auf jeden Klick mit der **ganzen** Seite, also muss
  auch ein `PUT` die Sprache mitnehmen — sonst wechselt die Seite beim Benutzen
  ins Englische. `put`, `delete` und `post` nehmen jetzt denselben
  Parameter-Mechanismus wie `get`, damit das Kodieren an einer Stelle bleibt.
- **Mails übersetzen keine Inhalte, mit Absicht.** Der Eventname in einer
  Bestätigungsmail bleibt das Original. Die Sprache einer Mail wählt in Phase 2
  niemand — sie ist die Standardsprache der Instanz (E24) —, und einen Inhalt in
  eine Sprache zu übersetzen, die sich der Empfänger nicht ausgesucht hat, ist
  eine halbe Entscheidung. In Phase 3 bekommt ein Profil eine Sprache; dann
  bewegen sich beide Hälften zusammen. Steht in `todo.md`.

### AP 12 — PWA-Ausbau (erledigt)

Der Nutzer-Client installiert sich als die Organisation, nicht als Trefaro. Das
Manifest baut der Server aus der Konfiguration (E26), `theme-color` folgt der
Primärfarbe zur Laufzeit statt als Literal im Dokument zu stehen, ein Ausfall der
Verbindung ist ein benannter Zustand statt einer Seite, die nichts tut, und wo
ein Browser eine Installation anbietet, bietet der Client sie mit an. Keine
`dataGroups` (E27) — die Anwendungshülle wird zwischengespeichert, Daten kommen
immer aus dem Netz.

Umgesetzt:

- **`shared-models`** — `lib/config/pwa.ts` mit `WebManifest`,
  `WebManifestIcon`, `WEB_MANIFEST_PATH`, `WEB_MANIFEST_MIME_TYPE`,
  `MIN_INSTALLABLE_ICON_PX` und `SHIPPED_APP_ICONS` (die acht Icons, die der
  Nutzer-Client mitbringt).
- **`business/manifest/`** — `buildWebManifest` (rein), `webManifestEtag`,
  `WebManifestService` und `GET /api/config/manifest.webmanifest` mit
  `application/manifest+json`, `no-cache` und einem ETag über die
  ausgelieferten Bytes. Ein eigenes Modul über `ConfigurationModule` und
  `I18nModule` (F103).
- **`imageDimensions`** in `business/attachments/` — PNG, JPEG (mit
  Segmentlauf) und alle drei WebP-Formen, aus dem Dateikopf, ohne Abhängigkeit;
  dazu `BrandingService.describe()`.
- **`shared-theming`** — `ThemeService.apply()` schreibt zusätzlich
  `<meta name="theme-color">` und legt das Tag an, wenn es fehlt.
- **Nutzer-Client** — `features/pwa/` mit `ConnectivityService`,
  `InstallPromptService`, `AppIconService`, `OfflineBanner` und `InstallHint`,
  beide Bausteine in der Shell; `index.html` verweist auf das gelieferte
  Manifest; `public/manifest.webmanifest` ist entfallen und aus
  `ngsw-config.json` gestrichen. **Sieben neue Katalogschlüssel** (Katalog:
  636 → **643**).
- **`verify-proxy.mjs`** — Manifest, Farbe, Name, Wurzeladressen, jedes Icon
  einzeln, die 304-Revalidierung, und `/api/config/manifest.webmanifest` in der
  Liste der Adressen, die der Service Worker dem Netz überlässt.

Acht Entscheidungen, die sonst improvisiert worden wären:

**Das Manifest ist eine Zusammensetzung, kein Feld von `/api/config`** (F103).
Es braucht die Konfiguration _und_ einen Satz aus dem Katalog, und der Katalog
liest bereits die Konfiguration — im `ConfigurationModule`, wo die URL es
vermuten lässt, hätte derselbe Endpunkt einen `forwardRef` gebraucht. Also ein
eigenes Modul darüber, dieselbe Linie wie `business/dashboard` (F49) und
`business/content-translations` (F100). Der URL-Präfix `config` wird mit dem
Konfigurations-Controller geteilt; das ist Absicht und genau der Punkt.

**Das Manifest spricht die Vorgabesprache der Instanz** (F104). Ein Browser holt
es aus einem `<link>`, während jemand installiert — ohne Zutun der Seite und ohne
zweite Gelegenheit. Das ist die Lage, in der auch eine Mail ist (E24), und
deshalb dieselbe Antwort: nicht die Sprache des Lesers, sondern die der Instanz,
und `lang` sagt sie mit. `?locale=` wäre hier eine Zusage, die niemand einlösen
kann.

**Ein hochgeladenes App-Icon ist nie `maskable`** (F105, E26). Die
mitgelieferten Icons tragen den Schutzrand, weil sie mit einem gezeichnet
wurden; ihn für ein Bild zu behaupten, das niemand gesehen hat, ist der Weg, auf
dem einem Logo die Ränder abrasiert werden. Und es **ersetzt** die
mitgelieferten nur, wenn ein Browser davon installieren kann — quadratisch und
mindestens 144 Pixel. Die Regel zeigt in beide Richtungen: die Icons daneben
stehen zu lassen, hieße, dass ein Browser Trefaros Icon dem der Organisation
vorzieht; sie für ein zu kleines, längliches oder unlesbares Bild wegzuwerfen,
hieße, die Instanz **uninstallierbar** zu machen — ein Fehlschlag, den niemand
bemerkt, bis er installieren will.

**Die Maße kommen aus dem Dateikopf, und das ist keine Prüfung** (F106). AP 2
hielt fest: kein Prüfen der Bildmaße, weil E26 ein Bildbearbeitungspaket
ausschließt. Das gilt weiter — abgelehnt wird kein Upload, keine Spalte speichert
etwas, und die Design-Seite bleibt der Ort, an dem ein schlechtes Icon auffällt.
Was dazukommt, ist, dass das Manifest eine Größe **nennen** muss und ein Browser
danach handelt: er wählt das nächstliegende Icon und verweigert die Installation,
wenn alle zu klein sind. Zwanzig Zeilen Arithmetik an drei festen Offsets sind
kein Paket; sie liegen neben `file-signature.ts`, aus demselben Grund, aus dem
das dort steht. Sagt der Kopf nichts, heißt es `sizes: "any"` — und dann bleiben
die mitgelieferten Icons daneben, sodass die Vermutung nichts trägt.

**Die mitgelieferten Icons sind ein Vertrag zwischen zwei Projekten** (F107).
Der Server schreibt acht Pfade in ein Dokument, und der Nutzer-Client ist der
Container, der sie beantwortet — verbunden sind sie durch nichts als diese
Liste. Sie steht deshalb in `shared-models`, und ein Test des Nutzer-Clients
prüft jeden `src` gegen die Dateien auf der Platte. Ein umbenanntes Icon wäre
sonst ein Manifest voller 404, und eine Instanz, deren Icons alle fehlen, ist
gar nicht installierbar.

**`theme-color` gehört dem `ThemeService`** (F108). Es ist der eine Teil der
Marke, der _außerhalb_ des Dokuments gemalt wird — die Browserleiste auf Android,
die Titelzeile eines installierten Clients —, und bis zu diesem Paket stand er
als Literal in beiden `index.html`. Eine gebrandete Instanz hatte die Farbe der
Organisation auf der Seite und Trefaros Grün darum herum. Jetzt schreibt die
Stelle, die dem Dokument das Theme anlegt, auch dieses Tag; die Design-Vorschau
bewegt es mit. Der Wert im Dokument bleibt als Farbe **vor** der Konfiguration.

**Ein Hinweis, den man nicht befolgen kann, ist Werbung** (F109). Der
Installationshinweis hängt vollständig an `beforeinstallprompt` — dem Ereignis,
mit dem Chromium sagt, dass es installieren _würde_. Der Client fängt es ab
(`preventDefault()` unterdrückt Chromes eigene Leiste) und bietet an seiner
Stelle an, wo sich das erklären und ablehnen lässt. Wo es das Ereignis nicht
gibt — jeder Browser auf iOS, Firefox —, steht **nichts**: dort heißt
installieren „Teilen → Zum Home-Bildschirm", und das kann eine Seite nicht
auslösen, sondern nur anpreisen. Drei Dinge beenden das Angebot dauerhaft:
installieren, „jetzt nicht" (in `localStorage`, wie die Sprache), und die
Meldung des Browsers, dass die Anwendung schon installiert ist. Und das
abgefangene Ereignis ist **einmal** benutzbar, wird also beim Klick verworfen —
ein Knopf, der stehen bliebe, täte beim zweiten Klick nichts, was kaputt
aussieht und nicht abgelehnt.

**`navigator.onLine` ist asymmetrisch, und nur die eine Hälfte wird geglaubt**
(F110). `false` heißt: der Browser weiß, dass keine Verbindung besteht. `true`
heißt nur, dass es eine Netzwerkschnittstelle gibt — ein WLAN mit Anmeldeseite,
ein totes Uplink, ein kaputtes DNS sind alle `true`. Das Banner erscheint
deshalb ausschließlich bei `false` und behauptet nie die Gegenrichtung. Und
genau deshalb behält jede Seite ihre eigene Fehlermeldung: eine Anfrage, die
fehlschlägt, während der Browser sich für online hält, ist ein Seitenfehler und
kein Offline-Zustand — sie darf nicht unter einem Banner verschwinden, das die
falsche Erklärung anbietet.

Was anders lief:

- **Das statische Manifest ist gelöscht, nicht überschrieben.**
  `apps/user-client/public/manifest.webmanifest` und der Eintrag in
  `ngsw-config.json` sind weg. Eine Datei, die noch da wäre und die niemand mehr
  verlinkt, ist die Fassung, die beim nächsten Lesen für die richtige gehalten
  wird.
- **Der Service Worker speichert das Manifest jetzt nicht mehr mit.** Das ist die
  Folge der Adresse, nicht eine zweite Entscheidung: es liegt unter `/api/`, und
  `ngsw-config.json` hat dort weder Asset- noch (E27) Datengruppe. Geprüft am
  gebauten `ngsw.json` — acht Icons im Cache, kein Manifest.
- **`<html lang>` war schon fertig.** Der Punkt stand in `todo.md` in einem Atemzug
  mit `theme-color`; die Sprache setzt `TranslationService` seit AP 6 bei jeder
  Aktivierung. Nachgeprüft, nicht neu gebaut.
- **`apps/user-client/tsconfig.spec.json` bekommt `"node"`.** Zwei Tests dieses
  Clients lesen Dateien: die Icons in `public/` und die eine Adresse in
  `index.html`, die TypeScript nicht typisieren kann. `libs/shared-i18n` macht es
  seit AP 6 genauso, und aus demselben Grund — was auf der Platte liegt, wird von
  der Platte geprüft.
- **Playwright emuliert Offline in WebKit nicht.** Der Offline-Test läuft in
  Chromium und Firefox und ist in WebKit mit Begründung übersprungen; die
  Ereignisse, auf die das Banner hört, kommen dort nie an.
- **Zwei Namen für dieselbe Anwendung.** Das Manifest trägt jetzt den Namen der
  Organisation, `<title>` weiterhin „Trefaro" — der Punkt steht seit Phase 1 in
  `todo.md` und braucht eine `TitleStrategy` in **beiden** Clients. Er gehört zu
  AP 13, nicht hierher; hier ist er nur sichtbarer geworden.

### AP 13 — Abschluss der Phase (erledigt) → **Meilenstein M5**

Geplant war: `todo.md` unter _Checkable after phase 2_ durchgehen, F60–F102 im
Referenzdokument nachtragen, den Fünf-Container-Stack aus dem Stand hochfahren,
beide Werkzeuge nachziehen, dieses Dokument von Plan auf Protokoll korrigieren.
Alles davon ist passiert — und zwei der Einträge in `todo.md` waren keine
Verschiebungen, sondern Zusagen dieser Phase, die keiner ihrer Pakete eingelöst
hatte. Sie sind hier gebaut worden, nicht weitergereicht.

**Was gebaut wurde.**

- **Die Browser-Tabs tragen den Namen der Organisation** (F111). Bis hierher
  stand in jedem `app.routes.ts` ein Literal, und fast jedes endete auf
  „Trefaro". Der Eintrag war ausdrücklich AP 8 und AP 9 zugeschrieben und blieb
  in beiden liegen — die Lehre daraus steht unter _Was anders lief_.
  `TrefaroTitleStrategy` in `libs/shared-i18n` (dort, weil sie Katalog **und**
  Konfiguration braucht) löst jetzt den Schlüssel der Route auf und hängt
  `AppConfigService.organizationName()` an. Eine Route **ohne** Titel bekommt
  allein den Namen der Organisation — das ist die Startseite des Nutzer-Clients.
  Und der Tab folgt einem Sprachwechsel ohne Navigation: der Schlüssel liegt in
  einem Signal, ein `effect` liest Sprache und Namen daneben (F72). Ein neuer
  Katalogschlüssel dafür: `admin.dashboard.title` — die einzige Seite, deren
  `<h1>` ein Eventname ist und die deshalb keinen eigenen hatte.
- **Der Veranstalter-Client verlinkt die öffentliche Seite** (F112). Die Adresse
  stand seit AP 10 als Text da, weil dieser Client nicht weiß, welcher Origin der
  andere ist. Er weiß es doch — `publicUserClientUrl` steht seit Phase 1 in
  `/api/config` —, also war das ganze Stück Client-Arbeit: `PublicSite` verbindet
  den Origin mit `publicEventPath`/`publicSeriesPath` über das neue
  `publicUrl()` in `shared-models`, das jetzt auch das Mailmodul benutzt. Der
  Link erscheint nur bei Status `published`, die Adresse bleibt zum Kopieren
  daneben stehen, und er trägt `rel="noopener noreferrer"` wie jeder Link, der
  diesen Origin verlässt (F51).

**`todo.md`, Abschnitt _Checkable after phase 2_: durchgearbeitet.** Sieben
Einträge sind abgehakt (Kacheln, Modulschalter, Manifest, `theme-color` und
`<html lang>`, Service Worker, beide Registries, Katalog, Schriftarten, Mails —
und neu: Programmpunkt-Übersetzungen aus AP 11, die Namen der Medien-Link-Arten
aus AP 8, `newsletter` aus AP 4, dazu die zwei oben). Fünf sind mit Begründung
**verschoben**, jeder dorthin, wo er prüfbar wird:

| Eintrag                                             | wohin                      | warum                                                                                           |
| --------------------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------- |
| „My registration" ist nirgends verlinkt             | Phase 3                    | Bedingung ist der Teilnehmenden-Login, und daran hat Phase 2 nichts geändert                    |
| Das Icon im Plug-in-Vertrag, das niemand zeichnet   | Phase 4                    | Feld entfernen heißt Major-Bump; ein Iconsatz ist eine Gestaltungsfrage — beides gehört dorthin |
| Die Design-Seite könnte Maße eines App-Icons nennen | Phase 5                    | Verbesserung an einem funktionierenden Bildschirm; die Usability-Runde ist der richtige Anlass  |
| Der Server lehnt englisch ab                        | Phase 5                    | keine Textextraktion, sondern ein Fehlercode-Vertrag durch die ganze Geschäftsschicht           |
| Kein Installationshinweis auf iOS · Schrift-Upload  | Fragen an den Pilotpartner | beides Entscheidungen, die dieses Repository nicht allein treffen kann                          |

**Und einer ist eskaliert statt abgehakt:** `event_series.logo_path` und
`event.logo_path` existieren, der Nutzer-Client zeichnet `logoUrl` an drei
Stellen, und geschrieben hat die Spalten nie jemand. Beim Durchgehen fiel auf,
dass **FR 2.1 und FR 3.1 das Logo unter den Pflichtfeldern führen, beide P1** —
das ist also keine offene Entscheidung, sondern eine nie gebaute P1-Anforderung,
die an AP 2 und AP 3 der Phase 1 vorbeigelaufen ist. Die Gestalt ist jetzt
entschieden, damit sie niemand improvisiert (Routen ohne Aufrufer-Pfad, je Zeile
aufgelöst, wie `/api/media/branding/logo` — E19, F66); **gebaut wurde sie nicht**:
ein Abschlusspaket ist nicht der Ort, ungefragt eine P1-Funktion nachzuziehen.
Der Eintrag steht deshalb jetzt unter _Known gaps in the current state_ und nicht
mehr unter einer Phase.

**Der Fünf-Container-Stack, aus dem Stand.** `docker compose -f
infra/docker-compose.yml up -d --build` mit eigenem `-p`-Projektnamen gegen ein
leeres Volume, danach **acht** Prüfskripte gegen genau diese Instanz:
`verify-proxy` (Manifest, Icons, Service-Worker-Regel, WebSocket-Upgrade),
`verify-api`, `verify-i18n`, `verify-mail` (vier Briefe aus Mailpit, in beiden
Sprachen, plus E24), `verify-push`, `verify-plugin-toggle`, `verify-socket`
(gegen den Proxy) und `verify-admin-access`. Danach `tools/demo-seed/seed.mjs`
gegen dieselbe Instanz: 3 Reihen, 5 Events, 40 Anmeldungen, 35 Bestätigungen aus
echter Mail, 11 Plätze, eine versandte Einladung und ein Widerspruch aus dem
Link darin — und, neu, die Marke und neun Übersetzungen. Das Manifest der
gebrandeten Instanz nennt danach `Demokratie Initiative e.V.`, `#1d4e6f` und
**nur** das hochgeladene 512×512-Icon: F105 in Betrieb.

Und daneben, weil es die eine Prüfung ist, die eine schon benutzte Instanz nicht
führen kann: ein **zweiter** Stack aus leerem Volume, diesmal ohne
`ADMIN_BOOTSTRAP_*`. Der Server schreibt sein Setup-Token ins Log,
`verify-setup.mjs` geht die ganze Ersteinrichtung durch — 401 ohne Token, ein
abgelehnter Wert, der die Route **nicht** schließt, der erste Administrator, die
danach verschwundene Route, Name, Farben und Sprache der neuen Instanz, und eine
Anmeldung, deren Sitzungscookie `Secure` trägt. Das ist FR 1.1 und NFR 15 an
einer Installation, die niemand vorher angefasst hat; danach `down -v`.

**Die Werkzeuge sind nachgezogen.**

- `tools/demo-seed/` setzt jetzt zuerst die Marke der Instanz (Name, zwei Farben,
  Schrift) und lädt **zwei erzeugte PNG** hoch — ein Logo im Briefkopfformat und
  ein quadratisches 512er App-Icon. Erzeugt statt eingecheckt: ein Binärblob im
  Repository müsste erklärt werden, und der Server liest die ersten Bytes (F38)
  und seit AP 12 noch einmal den Kopf für die Größe (F106) — ein handgeschriebenes
  PNG erfüllt beides, weil es wirklich eines ist. Danach schreibt er die
  englische Seite von neun Dingen und lässt den Rest bewusst deutsch (F94).
  `--reset` nimmt die Marke **nicht** zurück; es gibt nichts, worauf.
- `tools/spike-verification/` nimmt die Adresse jetzt überall aus **`BASE`** (die
  alten Namen gelten weiter und gewinnen), und die zwei Skripte, die in die
  Datenbank greifen, nehmen `POSTGRES_CONTAINER`, `DATABASE_USER`,
  `DATABASE_NAME`. Vorher stand `trefaro-postgres` als Literal darin — ein Lauf
  gegen den Container-Stack legte damit den Schalter der **Entwicklungs**instanz
  um und prüfte gegen die andere; zwölf Prüfungen schlugen fehl, und keine davon
  aus dem Grund, den sie nannte. Außerdem prüft `verify-api.mjs` nicht mehr die
  zwei gesäten Farben als Literal, sondern ihre Form — seit AP 1 ist eine
  gebrandete Instanz der Normalfall.

**F60–F112 stehen im Referenzdokument** (Version 1.28), eingetragen jeweils beim
Paket. Beim Nachzählen fiel auf: **F62 wurde nie vergeben.** Geplant war „der
Übersetzungskatalog wird vom Server ausgeliefert", und genau das beantwortet F70
mitsamt der Gestalt eines Schlüssels. Die Nummer bleibt frei, statt nachträglich
belegt zu werden — sonst zeigte ein Verweis auf F62 in einem älteren Text
plötzlich auf etwas anderes.

Was anders lief:

- **Eine Textextraktion findet Routentitel nicht.** AP 8 und AP 9 haben jede
  Beschriftung beider Clients in den Katalog geholt und sind an den Titeln
  vorbeigelaufen — sie stehen als einzige Beschriftung eines Clients **nicht** in
  einem Template, sondern in einer Routentabelle. Gefunden hat es erst dieses
  Paket, und nur, weil AP 12 das Manifest daneben gestellt hat: derselbe Client
  hieß im Manifest wie die Organisation und im Tab wie das Produkt.
- **Zwei Zusagen dieser Phase waren keine Verschiebungen.** Die Titel und der
  Link auf die öffentliche Seite standen mit Paketzuordnung in `todo.md` und
  blieben liegen. Für ein Abschlusspaket ist das die eigentliche Arbeit:
  unterscheiden, was auf eine spätere Phase wartet, und was diese Phase
  schuldig geblieben ist. Die Grenze war der Umfang — beides war zusammen ein
  halber Tag; das Logo je Reihe und Event ist ein Paket und wurde deshalb
  eskaliert statt nebenbei gebaut.
- **Der Skript-Lauf gegen den Stack hat die Skripte geprüft, nicht nur den
  Stack.** Zwei von acht sind an ihren eigenen Annahmen gescheitert (der
  Containername, die zwei gesäten Farben), eines an einer Adresse, die nur im
  Entwicklungsbetrieb existiert. Das ist genau das, wofür der Lauf am Phasenende
  da ist — die Skripte prüfen ein _Deployment_, und ein Deployment, das nicht das
  eigene Notebook ist, sieht anders aus.
- **`AUTH_SECRET` unter 32 Zeichen bringt den Server in eine Neustartschleife**,
  mit einer klaren Meldung im Log. Beim Aufsetzen der Stack-Umgebung passiert,
  und richtig so — `loadEnv` verweigert den Start (E1), statt mit einem schwachen
  Schlüssel zu signieren. Erwähnt, weil `docs/INSTALL.md` die Länge nennt und ein
  von Hand gebautes `.env` sie trotzdem unterschreitet.
- **Mailpit erreicht man aus dem Stack am kürzesten über
  `host.docker.internal`.** Die README nannte bisher nur den Weg über
  `docker network connect`; beides funktioniert, und der kürzere steht jetzt
  daneben.

---

## Was anders lief — über die ganze Phase

Je Paket steht es oben; das hier sind die fünf Dinge, die man erst sieht, wenn
man dreizehn Pakete nebeneinanderlegt.

**Der Umfang war die Textextraktion, und das war vorher bekannt.** Das
Risikoregister nannte sie als halben Phasenumfang, und so kam es: AP 8 und AP 9
haben zusammen mehr Zeilen bewegt als AP 1 bis AP 5 zusammen, und der Katalog ist
von 5 Schlüsseln nach AP 6 auf **646** gewachsen. Die Gegenmaßnahme hat
funktioniert — zwei eigene Pakete, die Schlüsselkonvention einmal in AP 6
entschieden (F70), keine Umformulierung während der Extraktion. Was sie nicht
verhindert hat, ist der Rest: eine Beschriftung, die **nicht** in einem Template
steht, wird von einer Textextraktion nicht gefunden. Zwei Sorten davon sind
aufgefallen — in AP 6 die in TypeScript berechneten Labels (F72), in AP 13 die
Routentitel (F111). Wer eine dritte sucht: es ist alles, was kein `| transloco`
tragen kann.

**„Die Organisation pflegt es selbst" ist an mehr Stellen wahr geworden, als
Kapitel 4 verlangt.** Der Plan sagte: Oberfläche und neue Sprachen. Geworden sind
es fünf Sorten Text aus derselben Quelle — Oberfläche, Modul- und Plug-in-Namen,
die vier Mails (AP 10), die Inhalte (AP 11) und das Manifest (AP 12). Der Grund
ist eine einzige Entscheidung: der Katalog kommt vom Server (E22). Alles, was
danach Text brauchte, konnte ihn von dort nehmen, statt sich eine zweite Quelle
zu bauen.

**Drei Fehler dieser Phase waren derselbe Fehler.** Der Katalog, der nicht ins
Image kommt (AP 6), das Manifest, das nur der Produktionsbuild anfasst (AP 12),
und der Containername in den Prüfskripten (AP 13): jedes Mal war die Suite grün,
weil sie gegen `nx serve` im Arbeitsbereich lief, und jedes Mal hätte nur ein
laufendes Deployment es zeigen können. `tools/spike-verification/` ist deshalb in
dieser Phase dreimal gewachsen und ist nicht Beiwerk, sondern das einzige Netz
für diese Klasse. Die Regel dazu steht seit Phase 1 in `CLAUDE.md` und hat sich
dreimal bewährt: **benutzen, bevor man „grün" sagt.**

**Zwei Entscheidungen haben sich beim Bauen gedreht.** F67: die geplante
Kontrastwarnung „unter 4,5:1 gegen die berechnete Textfarbe" kann konstruktiv nie
auslösen — gewarnt wird jetzt vor etwas anderem. Und F105: geplant war, dass ein
hochgeladenes App-Icon die mitgelieferten ersetzt; herausgekommen ist eine Regel,
die **in beide Richtungen** zeigt, weil die eine Fehlrichtung Trefaros Icon auf
einem fremden Startbildschirm ist und die andere eine Instanz, die sich gar nicht
installieren lässt. Beide Male war die Ursache dieselbe: der Plan hat eine Regel
formuliert, ohne den Grenzfall auszurechnen.

**Was die Phase schuldig geblieben ist, hat sie in AP 13 selbst gefunden — und
nicht alles davon gebaut.** Zwei Zusagen (die Tabtitel, der Link auf die
öffentliche Seite) waren einen halben Tag und sind erledigt. Die dritte, ein Logo
je Reihe und je Event, ist eine **P1-Anforderung aus FR 2.1 und FR 3.1**, die
schon Phase 1 nicht gebaut hat; sie steht jetzt unter _Known gaps_ mit
entschiedener Gestalt und ohne Code. Ein Abschlusspaket, das ungefragt eine
P1-Funktion nachzieht, verschiebt nur die Grenze, an der niemand mehr weiß, was
eine Phase eigentlich enthielt.

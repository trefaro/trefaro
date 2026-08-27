# Phase 1 — Kern-MVP „Eventmanagement" (alle P1)

**Status: Plan. Beginnt erst auf ausdrückliches Go von Marius** — Stand
26.08.2026 liegt es nicht vor. Bis dahin wird an diesem Dokument gearbeitet,
nicht am Code.

Grundlage: Kapitel 6, Phase 1 in
[`Anforderungsanalyse_und_Umsetzungsplan.md`](Anforderungsanalyse_und_Umsetzungsplan.md).
Dieses Dokument übersetzt sie in Arbeitspakete, legt die Entscheidungen fest, die
sonst während der Implementierung improvisiert würden, und benennt pro Paket ein
prüfbares Abnahmekriterium. Was Phase 0 offen gelassen hat, steht in
[`todo.md`](../todo.md).

## Ziel

Am Ende der Phase kann eine Organisation ihre Veranstaltungsarbeit vollständig
über die eigene Instanz abwickeln: Reihen und Events anlegen, das Programm
planen, Anmeldungen mit Double-Opt-In und konfigurierbaren Formularfeldern
einsammeln, die Teilnehmerübersicht führen, Anmeldungen zu einzelnen
Programmpunkten verwalten und ehemalige Teilnehmende zu neuen Events einladen.

Der Nutzer-Client zeigt Startseite, Event-Landingpage, Programm und
Registrierung — alles ohne Login, weil es in Phase 1 noch keinen Nutzer-Login
gibt (FR 4.2 ist P2 und gehört in Phase 3).

**Nicht** Teil von Phase 1: Whitelabel-Einstellungen, i18n-Laufzeitwechsel und
PWA-Ausbau (Phase 2), Profile, Chat, Nachrichtenübersicht und Push (Phase 3),
die vier Plug-ins (Phase 4). Phase 1 baut nur die Stellen, an denen die späteren
Phasen andocken.

## Scope

### Drin (alle P1 dieser Phase)

| FR            | Inhalt                                                    | Arbeitspaket |
| ------------- | --------------------------------------------------------- | ------------ |
| 1.2, 1.3      | Admin-Zugänge anlegen/löschen, administrativer Login      | AP 1         |
| 2.1, 2.2      | Veranstaltungsreihen anlegen und verwalten                | AP 2         |
| 2.3           | Übersicht der Events einer Reihe (bevorstehend/vergangen) | AP 3         |
| 3.1, 3.2, 3.9 | Event anlegen/bearbeiten, Präsenz/Online/Hybrid           | AP 3         |
| 3.5 + F12     | Registrierung mit Double-Opt-In, Feld-Baukasten           | AP 4, 6, 7   |
| 3.3           | Teilnehmerübersicht **mit E-Mail-Spalte**                 | AP 5         |
| 3.7           | Programm planen                                           | AP 8         |
| 3.10          | Anmeldung für einzelne Programmpunkte                     | AP 9         |
| F21           | Raumzuordnung als plug-in-eigene Join-Tabelle             | AP 9         |
| 3.8           | Event-Dashboard mit KPI-Kacheln                           | AP 10        |
| 3.6 + F10     | Informationsdarstellung, Follow-Up, externe Medien-Links  | AP 3, AP 11  |
| 2.4           | Ehemalige Teilnehmende kontaktieren und einladen          | AP 12        |

### Bewusst draußen

- **Nutzer-Login und Profile** (4.1–4.3, P2) — Phase 3. Konsequenz für Phase 1:
  Teilnehmende brauchen für die Programmpunkt-Anmeldung einen anderen Weg als
  einen Account (siehe E11).
- **Inhaltsübersetzungen** (3.12, P2) — Phase 2. Die Tabellen
  `event_translation` und `program_item_translation` werden in Phase 1 **nicht**
  angelegt; die Felder sind zunächst einsprachig.
- **Spaltenwunsch „Profilstatus"** in der Teilnehmerübersicht (Teil von 3.3) —
  ohne Profile nicht darstellbar, kommt in Phase 3 dazu (E13).
- **Push bei Änderungen** (3.15, P2) — Phase 3.
- **Whitelabel-Einstellungsseite** (1.4) — Phase 2. Das Theming selbst läuft
  seit Phase 0; nur die Bedienoberfläche dafür fehlt.

---

## Entscheidungen, die diese Phase festlegt

Vor der ersten Zeile Code zu klären, weil jede dieser Fragen sonst mitten in
einem Arbeitspaket auftaucht und dann falsch schnell entschieden wird. Drei
davon ergänzen den Schemaentwurf 5.3 und gehören als F22–F24 ins
Entscheidungsprotokoll (siehe _Nachträge am Referenzdokument_).

**E1 — Admin-Sitzungen sind opake Tokens in einer Tabelle, kein JWT.**
`admin_session` speichert den SHA-256-Hash eines 256-Bit-Zufallstokens, das
Ablaufdatum und den letzten Zugriff. Grund: FR 1.2 erlaubt das **Löschen** von
Admin-Zugängen, und das muss laufende Sitzungen sofort beenden — ein JWT lebt
bis zum Ablauf weiter. Kosten: ein Datenbank-Lesezugriff pro Admin-Request, bei
einer Instanz mit < 20 Mitarbeitenden irrelevant. Ergänzt Schema 5.3 (→ F22).

**E2 — Das Sitzungstoken reist in einem HttpOnly-Cookie.** `HttpOnly`,
`SameSite=Lax`, `Path=/api`, `Secure` sobald `NODE_ENV=production`. Das
funktioniert in Entwicklung **und** Produktion mit denselben Flags, weil der
Angular-Dev-Server `/api` proxied (`apps/*/proxy.conf.json`) und NGINX es
produktiv tut — der Browser sieht in beiden Fällen dieselbe Origin. Kein
`SameSite=None` nötig, damit auch kein CSRF-Loch. Bedingung: **keine
zustandsändernde Operation über GET**, sonst greift der `Lax`-Schutz nicht.

**E3 — Der erste Admin kommt aus der Umgebung.**
`ADMIN_BOOTSTRAP_EMAIL` und `ADMIN_BOOTSTRAP_PASSWORD` werden beim Start
ausgewertet und **nur angelegt, wenn `admin_user` leer ist**; der Vorgang wird
laut geloggt. Passwörter mit `argon2id` (Abhängigkeit steht seit Phase 0).
Phase 2 ersetzt das durch das geführte Ersteinrichtungs-Setup; bis dahin ist
das der einzige Weg in eine frische Instanz.

**E4 — Rate Limiting global mit `@nestjs/throttler`** (MIT, AGPL-kompatibel):
ein großzügiges Standardlimit plus enge `@Throttle`-Grenzen auf Login,
Registrierung und Bestätigung. Hinter dem Reverse Proxy braucht der Tracker die
echte Client-IP, also `app.set('trust proxy', 1)` in `main.ts` — vertretbar,
weil nur NGINX einen Port veröffentlicht und `X-Forwarded-For` setzt. Nebeneffekt:
der in `todo.md` für Phase 3 vermerkte ungebremste Push-Endpunkt ist damit
früher erledigt.

**E5 — Der Double-Opt-In-Link ist signiert, nicht gespeichert.** Token =
base64url(`purpose|registrationId|expiry`) + HMAC-SHA256 mit `AUTH_SECRET`,
Gültigkeit 14 Tage. Ein eigener `TokenSigner` in `business/security/` auf Basis
von `node:crypto` — keine neue Abhängigkeit, und derselbe Signierer trägt später
E11. Damit entfällt die Spalte `registration.confirmation_token` aus dem
Schemaentwurf (→ F23). Konsequenzen, bewusst akzeptiert: ein Wechsel von
`AUTH_SECRET` entwertet noch offene Bestätigungslinks, und „Mail erneut senden"
erzeugt einfach dasselbe Token wieder.

**E5b — Bestätigt wird per POST, verlinkt per GET.** Die Mail verlinkt auf den
Nutzer-Client (`/registrations/confirm?token=…`); dort bestätigt eine
Schaltfläche per POST. Ein E-Mail-Scanner, der Links vorlädt, bestätigt so keine
Anmeldung — und der Teilnehmende sieht überhaupt eine Rückmeldung. Der Endpunkt
ist idempotent und lässt ausschließlich `pending → confirmed` zu.

**E6 — Aufzählungstypen als `varchar` mit `CHECK`-Constraint**, nicht als
PostgreSQL-`ENUM`. Einen Wert ergänzen ist dann eine Zeile Migration statt einer
Typumschreibung, und der Wert bleibt in `psql` lesbar — was zählt, wenn der
Admin einer Organisation selbst in die Datenbank sieht.

**E7 — `uuid` als Primärschlüssel** (`gen_random_uuid()`, wie
`push_subscription` seit Phase 0). Öffentliche URLs verwenden zusätzlich einen
`slug`, eindeutig je Elterndatensatz: ein geteilter Event-Link soll lesbar sein,
die ID bleibt intern.

**E8 — Zeiten als `timestamptz`, Zeitzone am Event.** `event.timezone` hält eine
IANA-Zone; der Programmplan wird in der Zeitzone des Veranstaltungsorts
gerendert, nicht in der des Betrachters. Für eine Organisation mit
internationalem Publikum ist alles andere eine Fehlerquelle.

**E9 — Uploads liegen im Volume, ausgeliefert wird nur über die API.** Datei
unter generiertem Namen in `UPLOAD_DIR`, Metadaten in `attachment` (Originalname,
MIME-Typ, Größe). Kein statisches Ausliefern des Volumes — Anhänge einer
Registrierung können Visa-Dokumente sein und gehen ausschließlich an
authentifizierte Admin-Requests. Validierung gegen eine MIME-Allowlist und ein
Größenlimit aus der Felddefinition.

**E10 — Eine E-Mail-Adresse meldet sich pro Event einmal an.** Eindeutigkeit auf
`(event_id, lower(email))`. Ein zweiter Versuch erzeugt keine zweite Zeile,
sondern verschickt die passende Mail erneut, und die API antwortet in **jedem**
Fall gleich — sonst lässt sich über das Formular die Teilnehmerliste abfragen.

**E11 — Teilnehmenden-Selbstbedienung läuft in Phase 1 über einen signierten
Link.** FR 3.10 ist P1, der Nutzer-Login aber P2 (Phase 3). Die
Bestätigungsmail enthält deshalb einen personalisierten Link auf „Meine
Anmeldung", der die Programmpunkt-Anmeldung und die Stornierung freischaltet —
dieselbe Signatur wie E5, Gültigkeit bis 30 Tage nach Eventende. Er zeigt nur
die eigenen Angaben. Phase 3 stellt den Login davor und lässt den Link
funktionieren.

**E12 — Die Überbuchungsprüfung bekommt eine versionierte Lese-Schnittstelle.**
Das Raumplanungs-Plug-in darf `program_item_signup` nicht selbst abfragen (F21).
Der Plug-in-Vertrag erhält deshalb einen schmalen Lese-Port für Anmeldezahlen;
`PLUGIN_API_VERSION` wird in der Minor-Stelle erhöht. Details in AP 9.

**E13 — Die Teilnehmerübersicht bringt in Phase 1 alle Spalten außer
„Profilstatus".** Name, **E-Mail** (die Usability-Korrektur der Thesis),
Anmeldestatus, Anmeldezeitpunkt, Newsletter-Opt-in, konfigurierbare Felder,
Anhänge. Der Profilstatus wandert als Eintrag nach `todo.md`, Phase 3.

**E14 — Löschen ist die Ausnahme, Archivieren die Regel.** Eine Reihe oder ein
Event mit bestätigten Anmeldungen lässt sich nicht löschen, nur auf `archived`
setzen; ohne bestätigte Anmeldung ist Löschen erlaubt. Eine einzelne
Registrierung kann storniert (`cancelled`) **und** gelöscht werden — Letzteres
entfernt auch ihre Anhänge und ist die Vorarbeit für die DSGVO-Funktionen in
Phase 5.

**E15 — Einladungen an ehemalige Teilnehmende brauchen einen Widerspruchsweg.**
FR 2.4 verschickt Mail an Menschen, die sich für ein _anderes_ Event angemeldet
haben. Deshalb: Adressen nur aus bestätigten Anmeldungen **derselben Reihe**,
jede Mail mit Widerspruchslink, der `registration.contact_opt_out` setzt, und
diese Adressen werden nie wieder angeschrieben. Kein Newsletter-Versandmodul —
F8 bleibt unangetastet.

**E16 — Der Admin-Schutz hängt am URL-Präfix, nicht an einem Dekorator.** Ein
global registrierter Guard verlangt für jeden Pfad unter `/api/admin` eine
gültige Sitzung; `/api/config`, `/api/health` und `/api/user/**` bleiben frei.
Grund: Plug-in-Controller werden von Plug-in-Autoren geschrieben, und ein
vergessenes `@UseGuards` wäre ein offener Endpunkt. Der bestehende Controller des
Raumplanungs-Plug-ins liegt bereits unter `admin/plugins/room-planning` und ist
damit ohne Änderung mit abgedeckt.

---

## Datenbankschema der Phase

Neue Kerntabellen, in der Reihenfolge ihrer Migrationen. Konventionen wie in
`1787702400000-InitialCoreSchema.ts`: explizites SQL statt generiertem,
`snake_case`, sprechende Constraint-Namen, `timestamptz`.

```
admin_user             (id uuid pk, email citext-ähnlich unique(lower), password_hash,
                        name, created_at, updated_at, last_login_at?)
admin_session          (id uuid pk, admin_user_id fk→admin_user ON DELETE CASCADE,
                        token_hash unique, user_agent?, created_at, last_seen_at, expires_at)

event_series           (id uuid pk, slug unique, name, description, logo_path?,
                        website_url?, contact_email?, status [draft|published|archived],
                        created_at, updated_at)
event                  (id uuid pk, series_id fk→event_series, slug, name, description,
                        logo_path?, starts_at, ends_at, timezone, event_type
                        [presence|online|hybrid], status [draft|published|archived],
                        venue_name?, venue_address?, online_url?, languages varchar[],
                        registration_opens_at?, registration_closes_at?, capacity?,
                        follow_up_body?, created_at, updated_at)
                        unique (series_id, slug)

registration_field_def (id uuid pk, event_id fk→event ON DELETE CASCADE, field_key,
                        label, type [text|select|checkbox|file], options_json,
                        required, sort, max_file_size?, accepted_mime_types?)
                        unique (event_id, field_key)
registration           (id uuid pk, event_id fk→event, email, first_name, last_name,
                        phone?, origin?, custom_fields_json jsonb, status
                        [pending|confirmed|cancelled], newsletter_opt_in,
                        contact_opt_out, confirmed_at?, created_at, updated_at)
                        unique (event_id, lower(email))
attachment             (id uuid pk, owner_type [registration|…], owner_id, file_path,
                        original_name, mime_type, size, created_at)

program_item           (id uuid pk, event_id fk→event ON DELETE CASCADE, title,
                        description?, speaker?, starts_at, ends_at,
                        registration_enabled, capacity?, sort, created_at, updated_at)
                        ← ohne room_id (F21)
program_item_signup    (id uuid pk, program_item_id fk→program_item ON DELETE CASCADE,
                        registration_id fk→registration ON DELETE CASCADE, created_at)
                        unique (program_item_id, registration_id)
media_link             (id uuid pk, event_id fk→event ON DELETE CASCADE,
                        program_item_id? fk→program_item ON DELETE CASCADE, title, url,
                        kind [stream|recording|material], sort)

-- Plug-in-eigene Tabelle, Migration des Raumplanungs-Plug-ins:
plugin_room_planning_program_item_room
                       (program_item_id fk→program_item ON DELETE CASCADE,
                        room_id fk→plugin_room_planning_room ON DELETE CASCADE,
                        pk (program_item_id, room_id))
```

Zwei Regeln, die sich aus Phase 0 ergeben und hier greifen:

- **Migrations-Zeitstempel sind global geordnet.** Die Join-Tabelle des Plug-ins
  verweist auf `program_item` und ihre Migration muss deshalb einen höheren
  Zeitstempel tragen als die Kernmigration aus AP 8. Praktisch: AP 8 zuerst, AP 9
  danach — genau die Reihenfolge der Arbeitspakete.
- **Entities kommen in `CORE_ENTITIES`**, Repository-Ports in
  `business/<modul>/ports/`, Implementierungen in
  `data-access/repositories/`, Bindung im Kompositionswurzel-Modul. Der Linter
  erzwingt das; bei einem Verstoß wird ein Port eingezogen, nicht die Regel
  gelockert.

---

## API-Oberfläche

`/api/user/**` ist teilnehmendenseitig und in Phase 1 durchgehend
unauthentifiziert; `/api/admin/**` verlangt eine Sitzung (E16).

| Methode + Pfad                                          | Zweck                             | AP  |
| ------------------------------------------------------- | --------------------------------- | --- |
| `POST /api/admin/auth/login` · `logout` · `GET auth/me` | UC 01                             | 1   |
| `GET/POST/DELETE /api/admin/admins`                     | FR 1.2                            | 1   |
| `GET/POST/PATCH/DELETE /api/admin/series[/:id]`         | FR 2.1, 2.2                       | 2   |
| `GET/POST/PATCH/DELETE /api/admin/events[/:id]`         | FR 3.1, 3.2                       | 3   |
| `GET /api/admin/events/:id/dashboard`                   | FR 3.8                            | 10  |
| `… /api/admin/events/:id/registration-fields`           | F12                               | 6   |
| `GET /api/admin/events/:id/registrations`               | FR 3.3, mit Suche und Paginierung | 5   |
| `GET /api/admin/events/:id/registrations/statistics`    | Wochen-Anmeldegrafik              | 5   |
| `PATCH/DELETE /api/admin/registrations/:id`             | Stornieren, Löschen (E14)         | 5   |
| `GET /api/admin/attachments/:id`                        | Anhang herunterladen (E9)         | 7   |
| `… /api/admin/events/:id/program-items`                 | FR 3.7                            | 8   |
| `GET /api/admin/program-items/:id/signups`              | Auslastung, FR 3.10               | 9   |
| `… /api/admin/events/:id/media-links`                   | FR 3.6, F10                       | 11  |
| `GET /api/admin/series/:id/former-participants`         | FR 2.4                            | 12  |
| `POST /api/admin/series/:id/invitations`                | FR 2.4                            | 12  |
| `GET /api/user/series[/:slug]`                          | Startseite, Reihenseite           | 2   |
| `GET /api/user/events/:slug`                            | Event-Landingpage                 | 3   |
| `GET /api/user/events/:slug/program`                    | Programmplan                      | 8   |
| `GET /api/user/events/:slug/registration-form`          | Feldsatz des Formulars            | 6   |
| `POST /api/user/events/:slug/registrations`             | FR 3.5, gedrosselt                | 4   |
| `POST /api/user/registrations/confirm`                  | Double-Opt-In (E5b)               | 4   |
| `GET /api/user/registrations/me`                        | „Meine Anmeldung" (E11)           | 9   |
| `PUT/DELETE /api/user/program-items/:id/signup`         | FR 3.10 (E11)                     | 9   |

Jeder Payload-Typ liegt in `libs/shared-models`, damit ein Vertragsbruch den
Build bricht und nicht einen Request.

---

## Arbeitspakete

Reihenfolge = Abhängigkeitsreihenfolge. Jedes Paket endet mit lauffähiger,
prüfbarer Software, eigenen Unit-Tests, mindestens einem E2E- oder
API-Vertragstest und einem Conventional Commit.

### AP 1 — Administrativer Zugang und Absicherung (FR 1.2, 1.3)

Zuerst, weil es die größte bekannte Lücke schließt: `/api/admin/**` hat heute
keinen Wächter, und mit aktiviertem Raumplanungs-Plug-in kann jeder, der die API
erreicht, Räume anlegen (`todo.md`, _Known gaps_).

Server: `business/login/` bekommt Controller, `AdminUserService`,
`SessionService`, DTOs, die Ports `AdminUserRepository` und
`AdminSessionRepository`, den `AdminGuard` (E16) und einen
`@CurrentAdmin()`-Dekorator; `business/security/token-signer.ts` (E5) entsteht
hier, weil AP 4 ihn braucht. Data Access: zwei Entities, zwei Repositories,
Migration `AdminIdentity`. `main.ts`: `cookie-parser`, `trust proxy`,
`ThrottlerModule` mit globalem Guard und `@Throttle` auf dem Login. `env.ts`:
`ADMIN_BOOTSTRAP_EMAIL`, `ADMIN_BOOTSTRAP_PASSWORD`, `SESSION_TTL_HOURS`.

Admin-Client: Login-Seite, `AuthService` mit Signal, Router-Guard,
Shell-Layout mit seitlicher Menüleiste (Mockups, 5.4), Abmelden, und ein
HTTP-Interceptor, der bei 401 zur Login-Seite führt.

**Fertig, wenn** ein unauthentifiziertes `POST` auf die Raumplanungs-Endpunkte
401 statt 201 liefert, ein gelöschter Admin-Zugang seine laufende Sitzung
verliert, und der sechste Fehlversuch in Folge gedrosselt wird.

### AP 2 — Veranstaltungsreihen (FR 2.1, 2.2)

Erste vollständige vertikale Scheibe durch alle drei Schichten und beide
Clients: `event_series` mit CRUD im Admin-Client (Liste + Formular, Pflichtfelder
Name, Beschreibung, Logo) und der echten Startseite im Nutzer-Client, die
`GET /api/user/series` anzeigt statt der Phase-0-Platzhalter.

**Fertig, wenn** eine im Admin-Client angelegte, veröffentlichte Reihe ohne Login
auf der Startseite des Nutzer-Clients erscheint und eine als `draft` markierte
nicht.

### AP 3 — Events und öffentliche Landingpage (FR 3.1, 3.2, 3.9, 2.3, Teil 3.6)

`event` mit allen Angaben aus 3.1, den drei Veranstaltungstypen (3.9) und den
Statuswerten aus E14. Admin-Client: Reihen-Detailseite mit bevorstehenden und
vergangenen Events (2.3) und Event-Formular. Nutzer-Client: Landingpage mit
Infoblock (Wo/Wann/Typ) und „Jetzt registrieren" — noch ohne Formular.

**Fertig, wenn** ein Hybrid-Event mit Ort _und_ Online-URL korrekt dargestellt
wird, ein `draft`-Event öffentlich 404 liefert, und die Zeiten in der Zeitzone
des Events erscheinen (E8).

### AP 4 — Registrierung mit Double-Opt-In (FR 3.5, Pflichtfelder)

`registration` und das Mail-Modul: `nodemailer` gegen den SMTP-Server der
Organisation, Templates für Bestätigung und Bestätigungsquittung (zunächst
Englisch und Deutsch, Dateien so ablegen, dass Phase 2 sie ohne Umbau
übersetzbar macht). Registrierungsformular im Nutzer-Client mit Name, Vorname,
E-Mail, Telefon, Herkunft, Newsletter-Checkbox (5.4), Bestätigungsseite nach
E5b.

**Fertig, wenn** eine Anmeldung eine Mail in Mailpit erzeugt, der Link die
Registrierung auf `confirmed` setzt, ein zweiter Klick nicht scheitert sondern
„bereits bestätigt" meldet, ein manipuliertes Token abgelehnt wird und eine
doppelte Anmeldung derselben Adresse keine zweite Zeile erzeugt (E10).

### AP 5 — Teilnehmerübersicht (FR 3.3) → **Meilenstein M1**

Die höchstbewertete Funktion (3,86). Tabelle mit Suche, Sortierung und
Paginierung, **E-Mail-Spalte direkt in der Tabelle**, Statusfilter, Detailansicht
einer Anmeldung, Stornieren und Löschen (E14), Anmeldestatistik pro Woche als
Grundlage der Grafik aus den Mockups.

**Fertig, wenn** die Tabelle bei 2 000 Anmeldungen ohne merkbare Verzögerung
blättert und sucht, und die E-Mail-Adresse ohne Klick sichtbar ist.

> **M1: erste Fassung für Democracy International.** Ab hier ist die Kernschleife
> vollständig — Reihe anlegen, Event anlegen, Anmeldungen einsammeln,
> Teilnehmende überblicken. Das ist der Zeitpunkt für die erste Feedbackrunde
> beim Pilotpartner (F19), nicht das Ende der Phase.

### AP 6 — Feld-Baukasten: Text, Auswahl, Checkbox (F12, Teil 1)

`registration_field_def` mit Verwaltung im Admin-Client (anlegen, umsortieren,
Pflichtfeld setzen), dynamischer Formularaufbau im Nutzer-Client, Validierung
gegen die Definition auf dem Server, Werte in `registration.custom_fields_json`,
Anzeige in der Teilnehmerübersicht.

**Fertig, wenn** ein neu definiertes Pflichtfeld eine Anmeldung ohne diesen Wert
mit 400 ablehnt und ein unbekannter Feldschlüssel nicht stillschweigend
verschwindet (die globale Validierungspipe ist bewusst auf
`forbidNonWhitelisted` gestellt).

### AP 7 — Feldtyp Datei-Upload (F12, Teil 2)

`attachment` und der Feldtyp `file` nach E9. Multipart-Annahme im Server
(prüfen, ob `multer` und `@types/multer` explizit als Abhängigkeit ergänzt
werden müssen — `@nestjs/platform-express` bringt es indirekt mit),
MIME-Allowlist und Größenlimit aus der Felddefinition, Download nur für
authentifizierte Admins, Löschen einer Registrierung entfernt die Datei.

**Fertig, wenn** eine hochgeladene Datei ohne Sitzung nicht erreichbar ist, eine
zu große oder falsch typisierte Datei abgelehnt wird, und das Upload-Volume nach
dem Löschen der Registrierung keine Waise enthält. Erledigt damit den
Phase-1-Punkt „the uploads volume is finally used" aus `todo.md`.

### AP 8 — Programmplanung (FR 3.7)

`program_item` — **ohne `room_id`** (F21). Admin-Client: Programmpunkte je Event
anlegen mit Thema, Beschreibung, Sprecher und Zeitraum, Überschneidungen
sichtbar machen. Nutzer-Client: Programm als Timeline auf der Landingpage.

**Fertig, wenn** ein Programmpunkt außerhalb des Eventzeitraums abgelehnt wird
und die Timeline in der Event-Zeitzone rendert.

### AP 9 — Programmpunkt-Anmeldung, Lese-Schnittstelle, F21 (FR 3.10, F21, E11, E12)

Drei Dinge, die zusammengehören:

1. `program_item_signup` und die Selbstbedienung über den signierten Link aus der
   Bestätigungsmail (E11): Programmpunkte an- und abmelden, eigene Anmeldung
   einsehen und stornieren. Auslastung je Programmpunkt im Admin-Client.
2. Der versionierte Lese-Port im Plug-in-Vertrag (E12): eine schmale
   Schnittstelle, über die ein Plug-in Anmeldezahlen zu Programmpunkt-IDs
   erfragt, ohne `program_item_signup` zu kennen. `PLUGIN_API_VERSION` in der
   Minor-Stelle erhöhen, Kompatibilitätstest ergänzen.
3. **F21**: das Raumplanungs-Plug-in legt
   `plugin_room_planning_program_item_room` an, Fremdschlüssel auf beide Seiten,
   `ON DELETE CASCADE` auf dem Programmpunkt, Migrations-Zeitstempel nach AP 8.
   Die Überbuchungsprüfung selbst bleibt Phase 4 — hier entsteht nur, was sie
   braucht. Im selben Zug bekommt `plugin_room_planning_room.event_id` seinen
   Fremdschlüssel: die Spalte ist seit Phase 0 ein uuid ohne Einschränkung, weil
   `event` damals nicht existierte — genau die Integritätslücke, mit der F21
   gegen eine Kernspalte entschieden wurde.

**Fertig, wenn** ein voller Programmpunkt keine weitere Anmeldung annimmt, das
Löschen eines Programmpunkts seine Raumzuordnung mitnimmt, ein Raum für ein
unbekanntes Event nicht mehr anlegbar ist, `down` des Plug-ins das Kernschema
unberührt lässt, und der Lese-Port ohne einen einzigen ORM-Import in der
Geschäftslogik des Plug-ins funktioniert.

### AP 10 — Event-Dashboard (FR 3.8)

KPI-Kacheln als Verlinkungen (registrierte Teilnehmende, in Phase 1 noch ohne
Nachrichten- und Vorschlagszahlen) plus Tabelle der letzten Anmeldungen. Die
Kacheln für Nachrichten (Phase 3) und Programmvorschläge/Forum (Phase 4)
entstehen als leere Plätze, die die späteren Module füllen — nicht als Kacheln
mit einer harten Null.

**Fertig, wenn** die Zahlen einer echten Datenlage entsprechen und jede Kachel
auf die Ansicht führt, die sie zusammenfasst.

### AP 11 — Follow-Up und Medien-Links (FR 3.6, F10)

`media_link` als Kernmodul `media-links` (steht in `CORE_MODULES`, standardmäßig
an): externe Stream-, Mediathek- und Materiallinks je Event und optional je
Programmpunkt — **nur Links, kein Upload, kein Transcoding** (F10). Dazu das
Follow-Up-Feld, das nach Eventende auf der Landingpage erscheint. Ein kleiner
`CoreModuleEnabledGuard` wird hier fällig: abgeschaltete Kernmodule sollen wie
Plug-ins 404 antworten, nicht nur aus `/api/config` verschwinden.

**Fertig, wenn** ein abgeschaltetes `media-links`-Modul 404 liefert und die
Follow-Up-Sektion erst nach `ends_at` sichtbar ist.

### AP 12 — Ehemalige Teilnehmende einladen (FR 2.4)

Adressliste aus bestätigten Anmeldungen derselben Reihe, ohne
`contact_opt_out` (E15), Auswahl im Admin-Client, Nachricht verfassen, Versand
einzeln über SMTP, Widerspruchslink in jeder Mail.

**Fertig, wenn** eine widersprochene Adresse in keiner weiteren Liste auftaucht
und der Versand an 200 Adressen nicht in einen Request-Timeout läuft.

### AP 13 — Abschluss der Phase

`todo.md`-Abschnitt „Checkable after phase 1" vollständig durchgehen und
abhaken oder mit Begründung verschieben; neue Einträge für Phase 3
(Profilstatus-Spalte, E13) und Phase 2 (Mail-Templates übersetzbar machen)
ergänzen. `docs/PHASE1.md` auf den tatsächlichen Verlauf korrigieren — so wie
`BOOTSTRAP.md` es nach Phase 0 wurde. Prüfen, ob die Umsetzung von F22–F24
abgewichen ist, und das Referenzdokument gegebenenfalls nachziehen.
Feedbackrunde mit Democracy International auswerten.

---

## Meilensteine

| Meilenstein | Nach  | Inhalt                                                                  |
| ----------- | ----- | ----------------------------------------------------------------------- |
| M0          | AP 1  | Die Instanz ist nicht mehr offen. Voraussetzung für alles Weitere.      |
| M1          | AP 5  | Kernschleife lauffähig → erste Feedbackrunde mit dem Pilotpartner (F19) |
| M2          | AP 13 | Phase 1 abgeschlossen, alle P1 dieser Phase umgesetzt und geprüft       |

## Querschnittsregeln für jedes Arbeitspaket

- **Erst der Test, dann der Code.** Unit-Tests je Service und Guard, API-Vertrag
  in `apps/server-e2e`, Oberfläche in `apps/*-e2e` (Chromium, Firefox, WebKit).
- **Schichtgrenzen nicht verhandeln.** Bei einem Linter-Verstoß wird ein Port
  eingezogen, nicht die Regel gelockert.
- **Eine Migration pro Arbeitspaket**, explizites SQL, `down` mitgeschrieben und
  einmal wirklich ausgeführt.
- **Deutsch mit Marius, Englisch im Code** — Bezeichner, Kommentare,
  Commit-Messages; Conventional Commits.
- **Kein Google-Dienst**, keine Abhängigkeit mit AGPL-inkompatibler Lizenz.
- **Nach jedem Paket** `nx run-many -t lint test build` und die E2E-Suite grün,
  dann committen.

## Risiken

| Risiko                                                                                                     | Gegenmaßnahme                                                                                                             |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Der Feld-Baukasten (F12) wächst zum eigenen Formularframework                                              | Vier Feldtypen, Ende. Kein Bedingungslogik-Editor, keine Mehrfachdateien, keine Feldgruppen in v1.                        |
| Registrierung ohne Nutzer-Login (E11) wird in Phase 3 zur Altlast                                          | Der signierte Link bleibt gültig und wird in Phase 3 zusätzlich hinter den Login gelegt — kein Umbau, nur eine Ergänzung. |
| Mail-Zustellung ist beim Pilotpartner unerprobt                                                            | In AP 4 gegen den echten SMTP-Server von Democracy International testen, nicht nur gegen Mailpit.                         |
| Die Teilnehmerübersicht ist die wichtigste Funktion und wird zuerst am Datenvolumen scheitern              | Paginierung und Indizes von Anfang an, Lasttest mit 2 000 Anmeldungen in AP 5 statt in Phase 5.                           |
| Die Zeitzonenentscheidung (E8) wird an einer Stelle vergessen und erzeugt Programmpunkte zur falschen Zeit | Eine Formatierungsfunktion in `libs/shared-models` bzw. der Client-Lib, kein `toLocaleString` an Ort und Stelle.          |

## Nachträge am Referenzdokument — erledigt

Vier der Entscheidungen dieses Plans verändern den Schemaentwurf und stehen
deshalb im Entscheidungsprotokoll von
[`Anforderungsanalyse_und_Umsetzungsplan.md`](Anforderungsanalyse_und_Umsetzungsplan.md)
(Version 1.4), nicht nur hier:

- **F22** — Admin-Sitzungen als Tabelle `admin_session` statt JWT (E1); ergänzt
  Schema 5.3.
- **F23** — Double-Opt-In-Token signiert statt gespeichert (E5); entfernt
  `registration.confirmation_token` aus Schema 5.3.
- **F24** — Einladungen an ehemalige Teilnehmende nur mit Widerspruchsweg (E15);
  ergänzt `registration.contact_opt_out` in Schema 5.3.

Bestätigt von Marius am 26.08.2026, zusammen mit E11 (Selbstbedienung über
signierten Link, keine Schemafolge). Die übrigen Entscheidungen E2–E4, E6–E10,
E12–E14 und E16 sind Umsetzungsdetails innerhalb des bereits Entschiedenen und
bleiben in diesem Dokument.

## Fortschritt

Wird pro Arbeitspaket ergänzt; Abweichungen vom Plan stehen hier, damit AP 13 sie
nicht rekonstruieren muss.

### AP 1 — Administrativer Zugang (erledigt)

Umgesetzt: `admin_user` und `admin_session` mit Migration, argon2id,
Sitzungscookie nach E2, `AdminGuard` nach E16 global am URL-Präfix,
Bootstrap-Admin aus der Umgebung, Login/Logout/„wer bin ich", Admin-Verwaltung
(FR 1.2) inklusive Oberfläche, Login-Seite mit `returnTo`, Router-Guard,
401-Interceptor und Abmelden im Admin-Client. 45 neue Unit-Tests, 31 API-Vertrags-
und 27 Browser-Tests grün.

Abweichungen und ihre Gründe:

- **Der `TokenSigner` (E5) entsteht erst in AP 4.** Der Plan hatte ihn in AP 1
  vorgesehen, aber die Sitzungen brauchen ihn nicht — sie sind opake Zufallstokens
  (E1). Ein Baustein ohne Verwendung ist unbelegt; er kommt dort, wo der
  Double-Opt-In-Link ihn tatsächlich benutzt.
- **Das Login-Limit ist 20 Versuche pro 5 Minuten statt 5**, weiterhin mit
  15 Minuten Sperre. Grund steht im Kommentar am Controller: die gesamte
  Testsuite meldet sich von einer Adresse aus an, und ein Limit, das sie nicht
  überlebt, wird für Tests gelockert — womit es gar nicht mehr geprüft wird.
  Bei 20 Versuchen und anschließender Sperre bleiben ~1 900 Versuche pro Tag
  gegen einen argon2id-Hash einer mindestens zwölfstelligen Passphrase; das ist
  kein Angriff.
- **Die Sperre selbst prüft kein automatischer Test**, sondern
  `tools/spike-verification/verify-admin-access.mjs` gegen eine laufende Instanz
  — ein automatischer Test würde die Route 15 Minuten blockieren und die Suite
  unwiederholbar machen. Vermerkt in `todo.md` unter Phase 5.
- **Erwartete Client-Fehler werden nicht mehr als Warnung protokolliert.** Jeder
  nicht angemeldete Client fragt beim Start „wer bin ich" und bekommt 401; das
  füllte das Log mit normalem Verkehr. 401 und 404 laufen jetzt auf `debug`,
  429 bleibt bewusst eine Warnung.
- **Der Admin-Client meldet sich in der E2E-Suite einmal zentral an** und teilt
  den Sitzungszustand; nur `login.spec.ts` startet aus einem frischen Kontext.
  Sonst hätten drei Browser × mehrere Tests das Limit gesprengt.

### AP 2 — Veranstaltungsreihen (erledigt)

Umgesetzt: `event_series` mit Migration, Port und Repository; zwei Controller
(`/api/admin/series` hinter dem Guard, `/api/user/series` öffentlich);
Slug-Ableitung mit deutscher Transliteration; Admin-Client mit Reihenliste,
Formular für Anlegen und Bearbeiten sowie Veröffentlichen/Zurückziehen;
Nutzer-Client mit echter Startseite und Reihen-Detailseite. 39 neue Unit-Tests,
12 neue API-Vertragstests, neue Browser-Tests in beiden Clients.

Das Abnahmekriterium ist erfüllt und in drei Browsern belegt: eine
veröffentlichte Reihe erscheint ohne Login auf der Startseite, eine als `draft`
markierte nicht — und ihre Adresse antwortet öffentlich mit 404, nicht 403.

Entscheidungen und Abweichungen:

- **Zwei Controller statt einem mit Flag.** Der öffentliche Endpunkt liefert eine
  _andere_ Nutzlast (ohne Status und Zeitstempel), nicht dieselbe mit geleerten
  Feldern. Ein Test prüft die Feldmenge, damit die Trennung nicht später
  aufweicht.
- **Der Slug wird beim Umbenennen nicht neu berechnet.** Ein geteilter Link muss
  eine Korrektur im Titel überleben; die Adresse ändert sich nur, wenn sie
  ausdrücklich mitgeschickt wird.
- **Deutsche Umlaute werden transliteriert, nicht entfernt.** „Bürgerräte" wird
  `buergerraete`, nicht `brgerrte`. Für Namen in nicht-lateinischer Schrift gibt
  es einen generischen Rückfall — die Anwendung erfindet keinen Namen.
- **Das Logo fehlt im Formular.** FR 2.1 nennt es Pflicht, aber Uploads entstehen
  erst in AP 7 (E9); die Spalte liegt schon. Bis dahin ist es optional — eine
  Pflicht, die man nicht erfüllen kann, wäre schlimmer.
- **Die Löschregel aus E14 greift erst ab AP 3.** Eine Reihe mit bestätigten
  Anmeldungen darf nur archiviert werden; geprüft werden kann das erst, wenn es
  Events gibt. Eine Prüfung gegen eine Tabelle, die es nicht gibt, wäre ein
  Kommentar, der sich als Code verkleidet.
- **Die Phase-0-Platzhalterseite des Admin-Clients ist entfallen.** Die
  Reihenliste _ist_ die Startseite; das Event-Dashboard (FR 3.8, AP 10) ist eine
  andere Seite pro Event.
- **Eine Reihen-Detailseite im Nutzer-Client** ist dazugekommen, obwohl AP 2 nur
  die Startseite verlangt: eine Liste von Links braucht ein Ziel. Ihr
  Abschnitt „Events" wird in AP 3 gefüllt.
- **Ein Wettrennen im Bearbeiten-Formular, gefunden von Firefox.** Der
  E2E-Test tippte in das Formular, bevor die geladene Reihe darin stand — und
  die späte Antwort überschrieb die Eingabe. Das kann auch einem Menschen auf
  einer langsamen Leitung passieren, deshalb ist nicht nur der Test korrigiert:
  das Formular überschreibt nichts mehr, was bereits verändert wurde.
- **Die E2E-Suite des Nutzer-Clients sät ihre Reihen über die Administrations-API**
  und räumt sie in einem Teardown wieder ab. Über die API statt über SQL, damit
  die Saat denselben Regeln unterliegt wie ein echter Veranstalter; mit Teardown,
  damit sich die Entwicklungsinstanz nicht mit Testdaten füllt.
- **Beide Browser-Suites räumen jetzt auf, und die Namen sind pro Lauf
  eindeutig.** Der erste fehlgeschlagene Lauf hinterließ eine Reihe, woraufhin
  der nächste Lauf aus einem _anderen_ Grund scheiterte (zwei passende
  Tabellenzeilen). Genau so verschwindet ein echter Fehler unter Rauschen —
  deshalb Zeitstempel im Namen und ein Teardown, der nach Präfix löscht.

## Definition of Done für Phase 1

1. Alle P1-Anforderungen aus der Scope-Tabelle sind umgesetzt und durch Tests
   belegt.
2. `todo.md`, Abschnitt Phase 1, ist abgearbeitet oder mit Begründung
   verschoben; die beiden _Known gaps_ sind geschlossen.
3. Der Fünf-Container-Stack läuft mit den neuen Migrationen aus dem Stand
   (`docker compose up`, NFR 15), einschließlich Bootstrap-Admin.
4. CI grün: Lint, Unit, E2E gegen echte Datenbank und echte Browser,
   Image-Builds.
5. Democracy International hat die Fassung aus M1 gesehen und das Feedback ist
   ausgewertet — verschoben oder umgesetzt, aber nicht unerwähnt.
6. `docs/PHASE1.md` beschreibt, was tatsächlich passiert ist, mit einem
   Abschnitt „Was anders lief".

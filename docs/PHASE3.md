# Phase 3 — Profile, Kommunikation und Community-Kern

**Status: in Arbeit** (seit 02.09.2026, AP 1 bis AP 12 erledigt, **M7 erreicht**). Der Teil oberhalb von
_Fortschritt_ ist der **Plan** und wird nicht mehr rückwirkend korrigiert; was
tatsächlich passierte, steht unten je Paket — wie in
[`PHASE1.md`](PHASE1.md) und [`PHASE2.md`](PHASE2.md). Was Marius **vor** einem
Paket am Zuschnitt ändert, wird dagegen oben eingetragen und mit Datum
gekennzeichnet: das ist keine Korrektur der Vergangenheit, sondern der Auftrag
für das Paket, das noch kommt. Bisher einmal geschehen — AP 3 hat am 02.09.2026
den Profil-Baukasten im Veranstalter-Client dazubekommen.

Grundlage: Kapitel 6, Phase 3 in
[`Anforderungsanalyse_und_Umsetzungsplan.md`](Anforderungsanalyse_und_Umsetzungsplan.md)
(FR 4.1–4.5, 4.7, 4.8, FR 3.4, FR 3.15; Entscheidungen F7–F13). Was Phase 2
offen gelassen hat, steht in [`todo.md`](../todo.md) unter _Checkable after
phase 3_ — dreizehn Einträge, jeder ist unten einem Arbeitspaket zugeordnet.

Die Entscheidungen zählen bei **E31** weiter (Phase 1: E1–E16, Phase 2:
E17–E30); Ergänzungen am Referenzdokument bekommen **F118** und folgende
(F1–F117 sind vergeben, F62 nie). Vergeben sind inzwischen F118–F128 und
F132–F136 sowie F137–F183; **F129–F131 bleiben unvergeben**, weil sich diese
reservierten Nummern in AP 6 als schon getroffene Entscheidungen entpuppt haben
— reserviert ist nach AP 12 keine mehr.

**Vier Entscheidungen hat Marius am 02.09.2026 vorab getroffen**, bevor dieser
Plan geschrieben wurde — sie sind der Rahmen, nicht Vorschläge: die Adresse ist
die Identität (E31), `searchable` ist auch das Opt-in für Kontakt (E37), die
Profilsuche sucht mit `ILIKE` wie die Teilnehmerübersicht (F126), und der
Bildaustausch ist von Anfang an Teil des Chat-Pakets (E40).

## Ziel

Am Ende der Phase ist die Instanz nicht mehr nur ein Werkzeug des Veranstalters,
sondern ein Ort für die Teilnehmenden:

- Wer sich für ein Event angemeldet hat, kann sich **ein Konto anlegen** und
  damit seine Anmeldungen sehen, ändern und stornieren — ohne den Link aus der
  Mail (FR 4.1, 4.2, 4.7).
- Ein Profil trägt Name, Bild, Sprache, Tätigkeitsbereich und die Felder, die die
  Organisation dafür vorgesehen hat (FR 4.3).
- Wer gefunden werden **will**, wird gefunden — und nur dann (FR 4.4, F13).
- Zwei Menschen, die sich auf einer Veranstaltung begegnet sind, können sich
  schreiben; ein Veranstalter kann eine Gruppe zusammenstellen. In Echtzeit, mit
  Bildern (FR 4.5, F9).
- Ein Interessent **ohne** Konto erreicht den Veranstalter über ein Formular, und
  die Antwort kommt per E-Mail (FR 3.4, UC 14, F11).
- Eine Änderung an einem Event erreicht die Angemeldeten als
  Push-Benachrichtigung (FR 3.15) — der Versand, den Phase 2 nur abschaltbar
  gemacht hat.
- Die Mails sprechen die Sprache des Empfängers, nicht die der Instanz.

**Nicht** Teil von Phase 3: die vier Plug-in-Fachlichkeiten samt
Diskussionsforum (FR 4.6, Phase 4); Lasttests, DSGVO-Werkzeuge, Monitoring und
der Usability-Test (Phase 5); Gamification (FR 4.9, bewusst nie).

## Scope

### Drin

| FR / Quelle       | Inhalt                                                               | Arbeitspaket |
| ----------------- | -------------------------------------------------------------------- | ------------ |
| 4.1 · 4.2         | Teilnehmerkonto, Double-Opt-In, Login, Sitzung, Passwort             | AP 1         |
| 4.3               | Profil verwalten: Name, Bild, Sprache, Tätigkeitsbereich, Felder     | AP 2         |
| 4.1–4.3           | Login, Registrierung und Profil im Nutzer-Client                     | AP 3         |
| 4.3               | Der Profil-Baukasten im Veranstalter-Client (Marius, 02.09.2026)     | AP 3         |
| 3.3 · 4.7         | Die Anmeldung kennt den Menschen: Profilspalte, Selbstbedienung      | AP 4         |
| 4.4               | Profilsuche mit Sichtbarkeits-Opt-in                                 | AP 5         |
| 4.5               | Gespräche, Nachrichten und Bilder — ohne Echtzeit                    | AP 6         |
| 4.5 · F9          | Echtzeit: authentifizierter Handshake, Räume, Zustellung             | AP 7         |
| 4.5               | Chat im Nutzer-Client                                                | AP 8         |
| 3.4 · UC 14 · F11 | Organisator-Kontakt ohne Registrierung, Antwort per Mail             | AP 9         |
| 3.4               | Nachrichtenübersicht im Veranstalter-Client                          | AP 10        |
| 3.15              | Push wird echt: Versand bei Event-Änderungen, Zuordnung zum Konto    | AP 11        |
| 4.7 · 4.8         | Eigene Anmeldung stornieren, Newsletter-Opt-In-Verwaltung (beide P3) | AP 12        |
| —                 | Phasenabschluss                                                      | AP 13        |

### Bewusst draußen

- **Das Diskussionsforum** (FR 4.6). Es ist ein Plug-in und gehört zu Phase 4.
  Der Chat aus AP 6/7 ist nicht seine Vorstufe: ein Forum hat einen
  Freigabe-Workflow, ein Gespräch hat keinen.
- **Ein Newsletter-Versand** (F8). Phase 3 verwaltet Opt-Ins, sie verschickt
  keine Rundmails. Das Einladen ehemaliger Teilnehmender (FR 2.4) ist
  ausdrücklich nicht dasselbe (F55) und steht seit Phase 1.
- **Eine Änderung der E-Mail-Adresse im Profil.** FR 4.3 verlangt sie nicht, und
  E31 macht sie zur Identität. Wer die Adresse wechselt, legt ein Konto an — die
  alten Anmeldungen bleiben unter der alten Adresse erreichbar, solange der Link
  aus der Mail gilt.
- **Ein Passwort-Zurücksetzen per Mail.** Es ist eine eigene, sicherheitsrelevante
  Strecke (Token, Ablauf, Drosselung, Enumeration). FR 4.2 nennt „Validierung,
  Fehleranzeige"; FR 4.3 nennt das Ändern des Passworts **im** Profil, also mit
  bekanntem alten Passwort. Das Zurücksetzen kommt in Phase 5, wo die Härtung
  ohnehin die Drosselung konfigurierbar macht — und geht bis dahin in `todo.md`.
- **Gruppen, die Teilnehmende selbst gründen.** Eine Gruppe legt der Veranstalter
  an (E39). Selbstorganisierte Gruppen brauchen Moderation, und die ist der
  Aufwand, den die Umfrage ausdrücklich minimal halten wollte.
- **Nachrichten löschen oder bearbeiten.** „Löschen ist die Ausnahme,
  Archivieren die Regel" (E14) — und eine gelesene Nachricht nachträglich zu
  ändern ist die einzige Form von Archivierung, die eine Unterhaltung falsch
  macht. Was eine Meldefunktion braucht, entscheidet der Pilotpartner.
- **Ein Video- oder Sprachanruf.** Steht in keiner Anforderung.
- **Streaming** (F10). Bleibt, was es seit Phase 1 ist: externe Links.

---

## Der Ist-Zustand, auf dem diese Phase aufbaut

Damit nicht gebaut wird, was schon steht:

- **`business/profiles/`, `business/profile-search/` und `business/chat/`
  existieren als Modulhüllen.** `profiles.module.ts` und
  `profile-search.module.ts` sind leer; `chat.gateway.ts` trägt den
  `chat:echo`-Handler aus Spike 4 und wird von `app.module.ts` schon
  eingebunden. Die drei Schlüssel `profiles`, `profile-search` und `chat` sind
  in AP 4 der Phase 2 aus `CORE_MODULES` **entfernt** worden und kehren hier
  zurück (F63) — bestehende `module_config`-Zeilen wurden nicht gelöscht, eine
  Instanz mit eingeschaltetem `chat` findet ihn also wieder eingeschaltet.
- **Der Admin-Login ist die Vorlage.** `admin_session` mit Token-Hash
  (SHA-256, 32 Byte Zufall), Idle-Ablauf mit `TOUCH_AFTER_MS`, halbtägiger
  Sweep, `httpOnly`/`SameSite=Lax`/`Path=/api`-Cookie, `PasswordHasherService`,
  `password-policy.ts`, `SessionService`, `AdminGuard`. Was Phase 3 dafür
  braucht, ist die zweite Instanz dieser Bauteile, nicht ihre Erfindung.
- **`AdminGuard` schützt am deklarierten Pfad** (E16, F69) und lässt
  ausdrücklich alles unter `/api/user` öffentlich — so steht es in seinem
  Kommentar, und so ist es gemeint: Startseite und Landingpage brauchen keinen
  Login. Für Gateways gibt er `true` zurück, mit dem Vermerk, dass der
  Chat-Handshake seine eigene Authentifizierung in Phase 3 bekommt.
- **`registration`** hat `email` (320 Zeichen) mit `unique (event_id, email)`,
  `confirmed_at`, `contact_opt_out`, `newsletter_opt_in` und
  `custom_fields_json`. Es gibt **keine** `user_id`, und es kommt keine dazu
  (E31).
- **Der Feld-Baukasten ist gebaut und generisch.** `registration_field` mit
  Schlüssel-aus-Beschriftung (F35), Typen Text/Auswahl/Checkbox/Datei,
  Reihenfolge als Ganzes geschrieben, Prüfung gegen die Definitionen statt gegen
  ein DTO, und ein generischer Port, ein generisches Repository und ein
  generisches Formularbauteil, die genau dafür `type` statt `interface`
  benutzen (F101). AP 2 ist die zweite Anwendung dieser Maschinerie.
- **Anhänge sind gelöst.** `attachment` mit echtem Fremdschlüssel,
  Signaturprüfung gegen die ersten Bytes (F38), Katalog erlaubter Typen in
  `shared-models`, `AttachmentsService.purge…` vor jeder Kaskade, und das
  Upload-Volume wird nie statisch ausgeliefert (E9).
- **Bytes werden pfadfrei ausgeliefert.** `/api/media/branding/{logo,app-icon}`,
  `/api/media/series/:id/logo`, `/api/media/events/:id/logo` — drei Routen, keine
  nimmt einen Dateinamen (F113, F115). Ein Avatar ist die vierte Anwendung
  desselben Musters.
- **Mail ist mehrsprachig, aber nicht personalisiert.** `MailCatalogue.strings()`
  liest `app_config.default_locale`; der Rückfall der Einheit „eine Mail" (E24,
  F87) funktioniert je Sprache. Was fehlt, ist die Frage nach der Sprache des
  **Empfängers** — laut `todo.md` eine Zeile.
- **`push_subscription`** existiert seit Phase 0 mit `endpoint`, `p256dh_key`,
  `auth_key`, `user_agent`; `POST/DELETE /api/user/push/subscriptions` tragen
  seit Phase 2 den `CoreModuleEnabledGuard`, `webPushPublicKey` in `/api/config`
  ist `null`, solange das Modul aus ist (F63). `PushService.broadcast()`
  existiert und **ruft niemand**. Eine `user_id` fehlt bewusst.
- **Die Selbstbedienung ist gebaut, aber unverlinkt.** `user/registrations/me`
  löst eine bestätigte Anmeldung über einen signierten Token auf (Token beim
  Lesen in der Query, beim Ändern im Rumpf, F44); `SelfServiceService.require`
  ist die eine Stelle, die einen Login lernen muss (E11). Kein Menüpunkt zeigt
  darauf, weil er heute zu einer Seite führen würde, die nach einem Token fragt.
- **Der Katalog hat 654 Schlüssel**, Transloco lädt ihn vom Server, die
  Organisation kann Sprachen anlegen (E22, E23, F70). Jeder neue Bildschirm
  dieser Phase liefert seine Schlüssel in Englisch und Deutsch mit.
- **Socket.io läuft durch NGINX** (Spike 4), `navigationUrls` des Service Workers
  schließt `/socket.io` aus.

---

## Entscheidungen, die diese Phase festlegt

**E31 — Die Adresse ist der Mensch.** `user_profile.email` ist instanzweit
eindeutig und **die** Identität eines Teilnehmerkontos. `registration` bekommt
**keine** `user_id`: die Anmeldungen einer Person werden über Adressgleichheit
gefunden, genau wie ein Widerspruch über alle Anmeldungen einer Adresse gilt
(F57). Damit gibt es keinen Verknüpfungslauf für die Zeilen, die es schon gibt,
keine zweite Wahrheit, die auseinanderlaufen kann, und keine Kerntabelle, die
angefasst wird. Der Preis ist E-Mail-Unveränderlichkeit im Profil — FR 4.3
verlangt sie nicht (Name, Profilbild, Passwort, Sprache, Tätigkeitsbereich,
konfigurierbare Felder), und eine Änderung würde die Historie kappen, statt sie
mitzunehmen.

**E32 — Ein Konto entsteht wie eine Anmeldung: mit Double-Opt-In.** Derselbe
signierte Link, dieselbe Signatur, dieselbe Mail-Maschinerie. Vor `confirmed_at`
gibt es keine Sitzung — sonst wäre die Bestätigung eine Zierde. Ein zweiter
Registrierungsversuch auf eine bekannte Adresse antwortet **wie der erste**
(E10 auf Konten angewandt): sonst ist das Formular eine Abfrage, wer hier ein
Konto hat.

**E33 — Drei Präfixe, drei Zugangsstufen.** `/api/user` ist der anonyme Besucher,
`/api/participant` der angemeldete Mensch, `/api/admin` der Veranstalter — die
Stufe steht im Pfad, und der Guard hängt am **deklarierten** Pfad, nicht an einem
Dekorator (E16); `isParticipantPath` überschätzt in dieselbe Richtung wie
`isAdminPath` (F69). `/api/user` kann den Schutz nicht bekommen: dort liegen
Startseite, Landingpage, Programm, Registrierungsformular und die tokenbasierte
Selbstbedienung, und die sind ohne Login erreichbar — Produktregel, nicht Zufall.
Deshalb ein **neuer** Präfix statt einer Ausnahmeliste unter dem alten. Das
Anlegen und Bestätigen eines Kontos bleibt bei `/api/user`, weil dabei noch
niemand angemeldet ist; alles, was ein Konto voraussetzt, liegt unter
`/api/participant`, auch die Suche nach anderen. Der `AllowAnonymous`-Dekorator
wird von zwei Guards gebraucht und wandert deshalb nach `business/common/`
(F100).

**E34 — Eine Teilnehmersitzung ist eine zweite Sitzung, keine Rolle.** Eigene
Tabelle `user_session`, eigenes Cookie `trefaro_user_session`, dieselben Flags
und dieselbe Idle-Mechanik wie beim Administrator. Eine Rollenspalte in einer
gemeinsamen Sitzungstabelle würde die Rechteprüfung in das Cookie verlegen; und
ein Veranstalter, der auch Teilnehmer ist, will beides gleichzeitig offen haben
— zwei Cookies können das, ein Cookie mit Rolle nicht.

**E35 — Der Feld-Baukasten der Profile ist instanzweit.** `profile_field` hat
**keine** Event-Bindung: ein Profil gehört der Person und nicht einem Event, und
eine Frage, die je Event anders lautet, gehört ins Anmeldeformular, das es dafür
schon gibt. Benutzt wird dieselbe Maschinerie wie bei `registration_field` —
derselbe generische Port, dasselbe Repository, dasselbe Formularbauteil (F101),
dieselbe Schlüsselregel (F35), dieselbe Prüfung gegen die Definitionen. Eine
gelöschte Profilfrage löscht keine Antworten (F34).

**E36 — Der Tätigkeitsbereich ist eine Spalte, kein Baukastenfeld.** FR 4.3 nennt
ihn getrennt von den konfigurierbaren Feldern, und FR 4.4 filtert die Suche
darauf. Ein Suchkriterium, das in `custom_fields_json` liegt, ist keines, das man
indexieren oder verlässlich vergleichen kann.

**E37 — Wer sich finden lässt, ist erreichbar.** `searchable` (F13) ist das
Opt-in für die Suche **und** für den Kontakt: ein 1:1-Gespräch kann nur mit einem
Profil beginnen, das in der Suche steht. Ein Schalter, eine Bedeutung — die
Alternative wäre ein Datenschutzschalter, der nicht aufschreibt, wer mich
erreichen kann. Wer den Schalter zurücknimmt, verschwindet aus der Suche und
kann nicht neu angeschrieben werden; **laufende Gespräche bleiben** (E14) und
sind weiter lesbar und beantwortbar. Vernetzung über Events und Reihen hinweg ist
damit möglich und gewollt — das ist das Community-Ziel der Thesis.

**E38 — Gelesen ist ein Zustand des Mitglieds, nicht der Nachricht.**
`conversation_member.last_read_at` statt `message.read_at`. Der Schemaentwurf 5.3
nennt `read_at` auf der Nachricht; in einer Gruppe ist „gelesen" aber je
Empfänger wahr, und die Spalte bräuchte eine Zeile je Nachricht **und**
Empfänger. Ungelesenes wird **gezählt**, nie gespeichert — dieselbe Regel wie
beim Versandfortschritt (F56).

**E39 — Ein Gespräch hat drei Arten, und eine davon hat nur einen Account.**
`direct` (zwei Konten), `group` (vom Veranstalter zusammengestellt, an ein Event
gebunden) und `organizer_contact` (ein Interessent ohne Konto und der
Veranstalter). Beim Kontakt ohne Konto steht die Adresse auf dem **Gespräch**
(`guest_email`), nicht auf einer erfundenen Kontozeile, und die Nachricht trägt
`sender_type = guest` ohne `sender_id`. Die Antwort des Veranstalters geht per
E-Mail hinaus (F11) und bleibt zugleich im Gespräch stehen, damit die Übersicht
den Verlauf zeigt.

**E40 — Eine Nachricht ist Text, Bild oder beides — nie nichts.** `CHECK` auf
`message`. Der Bildaustausch ist von Anfang an Teil des Chat-Pakets (Marius,
02.09.2026): `message.attachment_id` ist von der ersten Migration an echt, damit
kein zweiter Durchgang durch Gateway und Datenmodell nötig wird. Wiederverwendet
werden `attachment`, die Signaturprüfung (F38) und der Purge-Weg; erlaubt sind
nur Bildtypen, die schon im Katalog stehen.

**E41 — Der Handshake ist die Tür, nicht das Ereignis.** Der Socket
authentifiziert sich **beim Verbinden** über das Sitzungscookie; eine Verbindung
ohne gültige Sitzung wird abgelehnt, nicht später beim ersten Ereignis geprüft.
Der `chat`-Modulschalter gilt am Handshake — dass ein Client den Chat nicht
anbietet, ist keine Zusicherung. Ein Raum je Gespräch, betreten wird nur, was
die Mitgliedschaft hergibt.

**E42 — Ein Modulschalter darf eine Voraussetzung haben.** `chat` und
`profile-search` setzen `profiles` voraus. Einschalten ohne die Voraussetzung ist
ein **409** mit Nennung des fehlenden Schlüssels; Ausschalten von `profiles`,
solange ein abhängiges Modul an ist, ebenfalls — mit Nennung der Abhängigen. Die
stille Auflösung („dann schalte ich die anderen eben mit ab") wäre ein Schalter,
der mehr tut als er sagt. Der Deskriptor nennt die Voraussetzung, die
Modulverwaltung zeigt sie an.

**E43 — Ein Abonnement ohne Konto bleibt möglich.** `push_subscription.user_id`
wird nullbar. Dass ein Event verlegt wurde, ist öffentliche Information — wer die
Landingpage abonniert, ohne ein Konto zu haben, darf sie bekommen. Mit Login wird
das Abonnement dem Profil zugeordnet und trägt dann auch **persönliche**
Benachrichtigungen (eine neue Nachricht); ohne Konto bleibt es auf
Event-Änderungen beschränkt. Der Fremdschlüssel kommt mit `ON DELETE CASCADE`:
ein gelöschtes Profil nimmt seine Geräte mit.

**E44 — Eine persönliche Benachrichtigung geht nur raus, wenn niemand zusieht.**
Push bei neuer Nachricht nur, wenn das Mitglied gerade keinen offenen Socket in
diesem Gespräch hat. Sonst benachrichtigt die Anwendung jemanden über etwas, das
er in derselben Sekunde auf dem Bildschirm hat — und das ist die Sorte
Benachrichtigung, wegen der Menschen sie abschalten.

**E45 — Der Newsletter ist eine Adresse, keine Anmeldung.**
`newsletter_subscription` mit eigenem Double-Opt-In ist der Weg für die Anmeldung
**in der App** (FR 4.8), auch für Menschen ohne Event-Anmeldung.
`registration.newsletter_opt_in` bleibt, was es ist: ein Häkchen im
Anmeldeformular. Die Übersicht im Veranstalter-Client zählt beide Quellen und
sagt, aus welcher eine Adresse kommt. Kein Versand (F8) — und deshalb auch kein
Zusammenführen der beiden Quellen in eine Empfängerliste, die niemand benutzt.

---

## Datenbankschema der Phase

Eine Migration je Arbeitspaket, explizites SQL, `down` mitgeschrieben. Die
Kerntabellen aus Phase 0/1 werden nur um Spalten erweitert, nie umgebaut —
`registration` gar nicht (E31).

```
user_profile      (id, email varchar(320) NOT NULL, password_hash NOT NULL,
                   first_name varchar(100), last_name varchar(100),
                   avatar_path varchar(512)?, preferred_locale varchar(16),
                   activity_areas varchar(200)?,
                   custom_fields_json jsonb NOT NULL DEFAULT '{}',
                   searchable boolean NOT NULL DEFAULT false,
                   confirmed_at?, created_at, updated_at)
                   unique (lower(email))            ← E31: die Adresse ist die
                     Identität, und Adressen sind nicht groß-/kleinschreibungs-
                     sensitiv. Kein Fremdschlüssel auf registration
                   CHK_user_profile_avatar_path: NULL oder 'avatars/%'
                     ← dieselbe Konstruktion wie bei den Logos (F113); der
                       Nachbar eines gespeicherten Pfades sind Anhänge (E9)
                   ← searchable ist das Opt-in für Suche und Kontakt (E37)

user_session      (id, user_id → user_profile [ON DELETE CASCADE],
                   token_hash char(64) NOT NULL, expires_at, created_at,
                   last_seen_at)
                   unique (token_hash)
                   ← zweite Tabelle statt Rollenspalte (E34); Form und Sweep
                     wie admin_session

profile_field     (id, key varchar(64) NOT NULL, label varchar(200) NOT NULL,
                   type varchar(16) NOT NULL, required boolean NOT NULL,
                   sort integer NOT NULL, options_json jsonb?, created_at,
                   updated_at)
                   unique (key)                ← instanzweit, kein event_id (E35)
                   ← sort bewusst nicht eindeutig: die Reihenfolge wird als
                     Ganzes geschrieben (Regel aus Phase 1)
                   ← kein Datei-Typ in v1: eine Datei ist keine Antwort in
                     custom_fields_json (F37), und ein Anhang ohne Anmeldung
                     hätte kein Elternteil. Nur Text/Auswahl/Checkbox

conversation      (id, type varchar(24) NOT NULL [direct|group|organizer_contact],
                   event_id? → event [ON DELETE CASCADE], topic varchar(200)?,
                   guest_email varchar(320)?, guest_name varchar(200)?,
                   last_message_at?, created_at, updated_at)
                   CHK: type='group'             → event_id NOT NULL, topic NOT NULL
                        type='organizer_contact' → guest_email NOT NULL
                        type='direct'            → event_id/guest_* NULL
                   ← drei Arten, eine ohne zweiten Account (E39)
                   ← last_message_at ist die Sortierung der Übersicht; kein
                     Zähler daneben — ungelesen wird gezählt (E38, F56)

conversation_member (conversation_id → conversation [ON DELETE CASCADE],
                   member_type varchar(8) NOT NULL [admin|user],
                   member_id uuid NOT NULL, last_read_at?, joined_at)
                   PK (conversation_id, member_type, member_id)
                   ← kein Fremdschlüssel auf member_id: die Spalte zeigt je
                     nach member_type auf admin_user oder user_profile. Der
                     Preis ist bewusst — die Alternative wären zwei nullbare
                     Spalten mit einem CHECK, und die Mitgliedschaft ist keine
                     Zeile, die ohne ihr Gespräch existiert
                   ← last_read_at gehört dem Mitglied (E38)

message           (id, conversation_id → conversation [ON DELETE CASCADE],
                   sender_type varchar(8) NOT NULL [admin|user|guest],
                   sender_id uuid?, body text?,
                   attachment_id? → attachment [ON DELETE SET NULL], created_at)
                   CHK: body IS NOT NULL OR attachment_id IS NOT NULL   ← E40
                   CHK: sender_type='guest' → sender_id IS NULL
                   Index (conversation_id, created_at DESC, id)
                   ← ON DELETE SET NULL, nicht CASCADE: eine gelöschte Datei
                     löscht keine Nachricht. Wer Anhänge räumt, ruft vorher
                     AttachmentsService.purge… (Regel aus Phase 1)

newsletter_subscription (id, email varchar(320) NOT NULL,
                   event_series_id? → event_series [ON DELETE CASCADE],
                   confirmation_token_hash char(64)?,
                   double_opt_in_confirmed_at?, created_at)
                   unique (lower(email), event_series_id)
                   ← nur Opt-In-Verwaltung, kein Versand (F8, E45)

push_subscription + user_id? → user_profile [ON DELETE CASCADE]
                   ← nullbar: ein Abonnement ohne Konto bleibt möglich (E43);
                     der Constraint kommt erst jetzt, weil er jetzt kann
                     (Eintrag aus todo.md, seit Phase 0 vorgemerkt)

attachment        + registration_id wird nullbar
                   CHK_attachment_owner: genau eine Zugehörigkeit — entweder
                     registration_id (Anmeldung mit Datei, F37) oder keine, und
                     dann zeigt eine message-Zeile darauf
                   ← der einzige Eingriff in eine Kerntabelle dieser Phase, und
                     er erweitert: eine bestehende Zeile bleibt gültig. Die
                     Gegenrichtung — eine zweite Anhangstabelle für den Chat —
                     hätte Signaturprüfung, Purge-Weg und Typkatalog verdoppelt
```

Vom Schemaentwurf 5.3 weicht dieser Plan an drei Stellen ab, jede protokolliert:
`message.read_at` wird `conversation_member.last_read_at` (E38, F129);
`conversation_member` bekommt `last_read_at` und `joined_at`; `notification`
(id, user_id, type, payload_json, sent_at) wird **nicht** gebaut — eine Tabelle,
die aufschreibt, was schon verschickt wurde, hätte in v1 keinen Leser, und ein
Postfach in der Anwendung ist nicht angefordert (dafür gibt es die
Nachrichtenübersicht). Der Eintrag bleibt Entwurf, bis ihn etwas liest (Regel
„kein Feld ohne Bedeutung").

---

## API-Oberfläche

| Methode + Pfad                                     | Zweck                                                          | AP  |
| -------------------------------------------------- | -------------------------------------------------------------- | --- |
| `POST /api/user/profiles`                          | FR 4.1: Konto anlegen, antwortet immer gleich (E32)            | 1   |
| `POST /api/user/profiles/confirm`                  | Double-Opt-In über den signierten Link (E32)                   | 1   |
| `POST /api/participant/auth/login` · `logout`      | FR 4.2, `@AllowAnonymous()`, Drosselung wie beim Admin         | 1   |
| `GET /api/participant/me`                          | Wer bin ich — die Antwort, die der Client beim Start braucht   | 1   |
| `PATCH /api/participant/me`                        | FR 4.3: Name, Sprache, Tätigkeitsbereich, Felder, `searchable` | 2   |
| `PUT /api/participant/me/password`                 | FR 4.3, mit dem alten Passwort                                 | 2   |
| `PUT/DELETE /api/participant/me/avatar`            | Profilbild, Regeln wie beim Logo (F113, F38)                   | 2   |
| `GET /api/media/profiles/:id/avatar`               | öffentlich, pfadfrei, ohne Statusfilter (F113, F115)           | 2   |
| `GET/POST /api/admin/profile-fields`               | FR 4.3: der instanzweite Baukasten (E35)                       | 2   |
| `PATCH/DELETE /api/admin/profile-fields/:id`       | wie beim Anmeldeformular, Reihenfolge als Ganzes               | 2   |
| `GET /api/participant/registrations`               | FR 4.7: meine Anmeldungen, über Adressgleichheit (E31)         | 4   |
| `GET /api/participant/profiles`                    | FR 4.4: Profilsuche, nur `searchable` (E37, F126)              | 5   |
| `GET /api/participant/profiles/:id`                | ein fremdes Profil, soweit es sich zeigt                       | 5   |
| `GET /api/participant/conversations`               | FR 4.5: meine Gespräche, ungelesen gezählt (E38)               | 6   |
| `POST /api/participant/conversations`              | ein 1:1-Gespräch beginnen (E37)                                | 6   |
| `GET /api/participant/conversations/:id/messages`  | Verlauf, paginiert, ID als letztes Sortierkriterium            | 6   |
| `POST /api/participant/conversations/:id/messages` | Text und/oder Bild, `multipart/form-data` wie F39              | 6   |
| `PUT /api/participant/conversations/:id/read`      | `last_read_at` setzen (E38)                                    | 6   |
| `GET /api/media/messages/:id/attachment`           | das Bild einer Nachricht, nur für Mitglieder                   | 6   |
| Socket `/socket.io`, Namensraum `chat`             | FR 4.5: Handshake am Cookie, Raum je Gespräch (E41)            | 7   |
| `POST /api/user/series/:slug/events/:slug/contact` | FR 3.4, UC 14: Kontakt ohne Registrierung (F11, E39)           | 9   |
| `GET /api/admin/conversations`                     | FR 3.4: Nachrichtenübersicht des Veranstalters                 | 10  |
| `GET/POST /api/admin/conversations/:id/messages`   | lesen und antworten; bei Gästen geht die Antwort per Mail      | 10  |
| `POST /api/admin/events/:id/conversations`         | eine Gruppe zusammenstellen (E39)                              | 10  |
| `POST /api/user/newsletter` · `…/confirm`          | FR 4.8: Opt-In und Bestätigung (E45)                           | 12  |
| `GET /api/admin/newsletter`                        | FR 4.8: die Übersicht über beide Quellen (E45)                 | 12  |
| `DELETE /api/participant/registrations/:id`        | FR 4.7: eigene Anmeldung stornieren                            | 12  |

`GET /api/config` wächst um nichts Neues: die drei Modulschalter reisen im
schon vorhandenen `modules`-Feld, ihre Voraussetzung (E42) steht im Deskriptor.
`POST/DELETE /api/user/push/subscriptions` bleiben, wo sie sind, und ordnen ein
Abonnement dem Profil zu, **wenn** eine Sitzung mitkommt (E43).

Jeder Payload-Typ liegt in `libs/shared-models`.

---

## Arbeitspakete

Reihenfolge = Abhängigkeits- **und** Prioritätsreihenfolge. FR 4.1–4.5 sind P2,
FR 3.4 ist P2, FR 3.15 ist P2; **FR 4.7 und 4.8 sind P3** und stehen deshalb
hinten (AP 12) — der Prioritäten-Kompass sagt Eventmanagement vor
Community-Bildung, und was P3 ist, darf am Phasenende zur Debatte stehen.

Jedes Paket endet mit lauffähiger, prüfbarer Software, eigenen Unit-Tests,
mindestens einem E2E- oder API-Vertragstest und einem Conventional Commit.

### AP 1 — Teilnehmerkonto und Login (FR 4.1, 4.2)

Die Grundlage aller weiteren Pakete. Server: `business/profiles/` bekommt
`ProfilesService`, `UserSessionService`, `ParticipantGuard`,
`current-participant.decorator.ts`, `user-session-cookie.ts` und die öffentlichen
Endpunkte zum Anlegen und Bestätigen. `AllowAnonymous` und die
`AuthenticatedPrincipal`-Form ziehen nach `business/common/` (F100);
`PasswordHasherService` und `password-policy.ts` werden **geteilt**, nicht
kopiert — beide liegen heute in `business/login/` und wandern nach
`business/common/`, weil zwei Module sie brauchen. Migration: `user_profile`,
`user_session`. Modulschalter `profiles` kehrt in `CORE_MODULES` zurück (F63) mit
`CoreModuleEnabledGuard` an allen neuen Routen.

**Fertig, wenn** eine Registrierung eine Bestätigungsmail auslöst, der Link
genau einmal wirkt, ein Login vor der Bestätigung scheitert, danach gelingt,
`/api/participant/me` die Identität nennt, `/api/participant/**` ohne Cookie 401 gibt, `/api/user/**`
unverändert öffentlich ist, eine zweite Registrierung auf dieselbe Adresse
dieselbe Antwort gibt wie die erste (E32), und ein Vertragstest festhält, dass
`isParticipantPath` in derselben Richtung überschätzt wie `isAdminPath` (F69).

### AP 2 — Profil verwalten und der Baukasten dafür (FR 4.3)

Server: `PATCH /api/participant/me` mit Prüfung der Antworten gegen die Definitionen
(nicht gegen ein DTO), Passwortwechsel mit altem Passwort, Avatar-Upload mit
Signaturprüfung (F38) und pfadfreier Ausgabe (F113), `profile_field`-Verwaltung
im Admin-Bereich über die generische Maschinerie aus Phase 1 (F101). Migration:
`profile_field`, `avatar_path` mit `CHECK`. `searchable` ist in diesem Paket
schon schreibbar, wirkt aber erst mit AP 5.

**Fertig, wenn** ein Profil alle Felder aus FR 4.3 trägt, ein unbekannter
Feldschlüssel ein 400 ist, eine gelöschte Profilfrage ihre Antworten **behält**
(F34), ein Avatar mit falschen ersten Bytes abgelehnt wird und
`/api/media/profiles/:id/avatar` das Bild ohne Pfad und ohne Sitzung ausliefert.

### AP 3 — Login, Registrierung und Profil in beiden Clients (FR 4.1–4.3) → **Meilenstein M6**

Nutzer-Client: Registrierungs- und Loginseite, Bestätigungsseite,
Profilbearbeitung mit dem generischen Formularbauteil, Navigationseintrag für
den angemeldeten Zustand, Abmelden. Der Sitzungszustand ist ein Signal, das
`GET /api/participant/me` beim Start füllt — nach der Konfiguration, nicht davor (die
Startsequenz aus der Thesis bleibt: Konfiguration, Theming, dann alles andere).
Alle Texte in Englisch und Deutsch im Katalog (E22, F70, F80).

**Veranstalter-Client: die Seite für den Profil-Baukasten** — Fragen anlegen,
umformulieren, Pflicht setzen, Reihenfolge ändern, löschen, gegen die Endpunkte
aus AP 2. **Von Marius am 02.09.2026 hierher gegeben**, nachdem AP 2 gemeldet
hatte, dass der Plan diese Oberfläche keinem Paket zuweist: die Endpunkte allein
sind für die Zielgruppe dieser Anwendung keine Funktion. Vorbild und Nachbar ist
`pages/registration-fields/registration-fields-page.ts` — dieselbe Ordnung
(Liste, Formular, Reihenfolge als Ganzes), ohne Event im Pfad und ohne die
Datei-Eigenschaften (`accept`, `maxSizeBytes`), die es im Profil nicht gibt.

Zwei Dinge, die dabei nicht vorausgesetzt werden dürfen — nachgesehen am Ende von
AP 2, damit dieses Paket nicht davon ausgeht:

- **Das „generische Formularbauteil" gibt es noch nicht.** Das öffentliche
  Anmeldeformular zeichnet seine Felder **inline** in
  `pages/event-registration/event-registration-page.ts`. E35 will ein Bauteil für
  beide Baukästen; also gehört das Ausziehen in dieses Paket — ein zweites Mal
  dieselben drei Feldtypen zu zeichnen wäre genau die Kopie, die driftet.
- **Auch die Editorseite ist heute eine Seite und kein Bauteil** (821 Zeilen).
  Was sich teilen lässt, wird beim Bauen entschieden; was nicht, wird begründet.
  Geteilt wird die Regel, nie die Ähnlichkeit (F138).

**Fertig, wenn** jemand sich im Browser registrieren, bestätigen, anmelden, sein
Profil ändern und abmelden kann, mobil-zuerst, in beiden Sprachen, in allen drei
Browsern der Suite — und wenn ein Veranstalter eine Profilfrage anlegen,
umformulieren, verschieben und löschen kann, ohne die API anzufassen, wobei die
Antworten einer gelöschten Frage sichtbar erhalten bleiben (F34).
**M6: die Instanz hat Teilnehmerkonten.**

### AP 4 — Die Anmeldung kennt den Menschen (FR 3.3, 4.7; vier `todo.md`-Einträge)

Das Paket, das die Phase-1-Zusagen einlöst, die auf ein Konto gewartet haben:

- Die Teilnehmerübersicht bekommt ihre **Profilspalte** — FR 3.3 verlangt sie,
  Phase 1 ließ sie weg, statt eine Spalte zu zeigen, die immer „kein Profil"
  sagt (E13). Ein `EXISTS` über die Adresse (E31).
- `SelfServiceService.require` lernt die **Sitzung** als zweiten Weg; der
  signierte Link bleibt gültig, das war die Zusage (E11).
- **„Meine Anmeldung" kommt in die Navigation** — der Grund, warum sie fehlte,
  war die fehlende Anmeldung, und der fällt hier weg.
- **Mail in der Sprache des Empfängers**, und die Inhalte in derselben Sprache
  wie die Mail: `MailCatalogue.strings()` liest das Profil statt
  `app_config.default_locale`, und der Inhaltsübersetzungsweg aus AP 11 der
  Phase 2 wird an dieselbe Locale gehängt. Für Adressen ohne Profil bleibt es
  bei der Vorgabe der Instanz (E24).

**Fertig, wenn** ein alter Link aus einem Postfach weiter funktioniert, ein
angemeldeter Teilnehmer keinen Link braucht, die Übersicht Profile markiert, und
ein Teilnehmer mit deutschem Profil eine deutsche Mail mit dem deutschen
Eventtitel bekommt, während ein Interessent ohne Profil die Vorgabesprache
erhält.

### AP 5 — Profilsuche (FR 4.4)

Server: `business/profile-search/` mit `GET /api/participant/profiles` — serverseitig
gefiltert, sortiert, paginiert, ID als letztes Sortierkriterium, `ILIKE '%wort%'`
je Wort über Name und Tätigkeitsbereich (F32, F126), Filter auf
Tätigkeitsbereich, **nur** Zeilen mit `searchable = true` (E37, F13). Der eigene
Eintrag erscheint nicht in der eigenen Suche. Modulschalter `profile-search` mit
Voraussetzung `profiles` (E42). Nutzer-Client: Suchseite und Profilansicht.

**Fertig, wenn** ein Profil mit `searchable = false` in keiner Antwort auftaucht
— auch nicht über `/api/participant/profiles/:id` —, die Suche über zwei Wörter beide
verlangt, und `chat`/`profile-search` ohne `profiles` ein 409 mit Nennung des
fehlenden Schlüssels sind.

### AP 6 — Gespräche, Nachrichten und Bilder (FR 4.5, Teil 1)

Der fachliche Kern des Chats, noch ohne Socket: `business/chat/` bekommt
`ConversationsService`, `MessagesService`, die Zugangsregel aus E37 und die
REST-Endpunkte. Bilder sind von Anfang an dabei (E40): `multipart/form-data` wie
bei der Anmeldung mit Datei (F39), Signaturprüfung (F38), Auslieferung über
`/api/media/messages/:id/attachment` **nur für Mitglieder** — das ist die eine
Medienroute dieser Phase, die eine Berechtigung prüft, und der Unterschied zu
F115 ist der Grund: ein Chatbild ist keine Marke, sondern Inhalt. Migration:
`conversation`, `conversation_member`, `message`, `attachment.registration_id`
nullbar mit `CHECK` auf genau eine Zugehörigkeit.

**Fertig, wenn** zwei Konten ein Gespräch führen können, ein Gespräch mit einem
nicht auffindbaren Profil ein 403 ist, ein Nichtmitglied den Verlauf **und** das
Bild nicht bekommt, eine Nachricht ohne Text und ohne Bild abgelehnt wird, und
der Ungelesen-Zähler aus `last_read_at` gerechnet und nicht gespeichert ist.

### AP 7 — Echtzeit (FR 4.5, Teil 2; drei `todo.md`-Einträge) → **Meilenstein M7**

Der Gateway wird echt: Handshake gegen das Sitzungscookie (E41), Ablehnung ohne
Sitzung, `chat`-Schalter am Handshake, ein Raum je Gespräch, Beitritt nur nach
Mitgliedschaft, Zustellung neuer Nachrichten und Lesebestätigungen. Der
`chat:echo`-Handler aus Spike 4 und das Prüfskript, das ihn benutzt,
verschwinden — oder das Skript zeigt auf eine echte Nachricht.

**Fertig, wenn** eine Verbindung ohne Cookie abgewiesen wird, eine mit gültigem
Cookie einem fremden Raum nicht beitreten kann, eine Nachricht bei beiden
Teilnehmenden ohne Neuladen ankommt — geprüft durch NGINX, nicht nur gegen den
Dev-Server —, `chat:echo` nirgends mehr vorkommt, und der abgeschaltete
Modulschalter den Handshake beendet. **M7: der Chat läuft in Echtzeit.**

### AP 8 — Chat im Nutzer-Client (FR 4.5)

Gesprächsliste mit Ungelesen-Zählern, Gesprächsansicht mit Verlauf und
Nachladen, Bildversand mit Vorschau, Verbindungszustand sichtbar (der ehrliche
Umgang mit `navigator.onLine` aus F110 gilt hier genauso), Katalogschlüssel in
beiden Sprachen.

**Fertig, wenn** ein Gespräch auf einem Telefon benutzbar ist, ein Bild sichtbar
ankommt, der Zähler beim Lesen verschwindet und ein Verbindungsverlust angezeigt
statt verschwiegen wird.

### AP 9 — Organisator-Kontakt ohne Registrierung (FR 3.4, UC 14, F11)

Auf der Event-Landingpage ein Kontaktformular ohne Login: es legt ein
`organizer_contact`-Gespräch mit `guest_email` an (E39), die erste Nachricht
trägt `sender_type = guest`. Drosselung und die immer gleiche Antwort wie beim
Registrierungsformular (E10), damit das Formular keine Auskunft gibt. Eine
Benachrichtigungsmail an die Organisation, damit die Übersicht aus AP 10 nicht
gepollt werden muss.

**Fertig, wenn** ein Interessent ohne Konto den Veranstalter erreicht, das
Gespräch in der Übersicht auftaucht und das Formular bei unbekannter wie
bekannter Adresse dasselbe antwortet.

### AP 10 — Nachrichtenübersicht im Veranstalter-Client (FR 3.4)

Veranstalter-Client: eine Übersicht über alle Gespräche, an denen die
Organisation beteiligt ist — Kontaktanfragen und Gruppen —, mit Verlauf und
Antwortfeld. Antworten an ein Gast-Gespräch gehen **per E-Mail** hinaus (F11) und
bleiben im Verlauf stehen. Gruppen werden hier zusammengestellt: Mitglieder aus
den bestätigten Anmeldungen eines Events (E39).

**Fertig, wenn** eine Antwort an einen Gast in Mailpit landet und im Verlauf
steht, eine Gruppe mit drei Angemeldeten entsteht und deren Mitglieder das
Gespräch im Nutzer-Client sehen.

### AP 11 — Push wird echt (FR 3.15; vier `todo.md`-Einträge)

`PushService.broadcast()` bekommt seine Aufrufer: eine Änderung an Zeit, Ort
oder Status eines Events benachrichtigt die Angemeldeten; eine neue Nachricht
benachrichtigt das Mitglied, **wenn** niemand zusieht (E44). Migration:
`push_subscription.user_id` nullbar mit Fremdschlüssel (E43). Der Client erklärt
die Berechtigung, **bevor** er den Browserdialog auslöst (NFR 4 zielt auf Menschen
mit rudimentären IT-Kenntnissen). Dazu die Gerätematrix aus Spike 3 von Hand:
Chrome und Firefox am Desktop, Chrome auf Android über HTTPS und **iOS Safari
mit installierter PWA** — der Fall, von dem F7 abhängt.

**Fertig, wenn** eine verschobene Session auf einem echten Gerät als
Benachrichtigung ankommt, der Klick auf den Pfad aus der Nutzlast navigiert, die
vier Zeilen der Matrix abgehakt sind (oder mit Datum und Gerät als gescheitert
protokolliert), und ein Abonnement ohne Konto weiter funktioniert.

### AP 12 — Die zwei P3-Zugaben (FR 4.7, 4.8)

Eigene Anmeldung stornieren (FR 4.7) — die Storno-Regel ist schon da, sie
bekommt hier nur den zweiten Weg über die Sitzung. Newsletter-Opt-In-Verwaltung
(FR 4.8, E45): Anmeldung in der App mit Double-Opt-In, Übersicht über beide
Quellen im Veranstalter-Client, **kein** Versand (F8). Migration:
`newsletter_subscription`.

**Fertig, wenn** ein angemeldeter Teilnehmer seine Anmeldung ohne Link
stornieren kann, eine Newsletter-Anmeldung erst nach dem Klick im Postfach zählt,
und die Übersicht sagt, welche Adresse aus dem Anmeldeformular und welche aus der
App kommt. **Dieses Paket darf gestrichen werden**, wenn die Phase eng wird — es
ist das einzige, dessen Anforderungen P3 sind. Gestrichen heißt: mit Begründung
nach `todo.md`, nicht stillschweigend.

### AP 13 — Abschluss der Phase → **Meilenstein M8**

Wie AP 13 der Phase 2: `todo.md` unter _Checkable after phase 3_ durcharbeiten
(dreizehn Einträge), die Nachträge F118–F136 im Referenzdokument eintragen,
E31–E45 gegen die Umsetzung prüfen, `docs/rules/` um das ergänzen, was diese
Phase gelernt hat, `CLAUDE.md` auf den neuen Stand, dieses Dokument von Plan auf
Protokoll ziehen, den Fünf-Container-Stack aus leerem Volume hochfahren und alle
Prüfskripte gegen genau diese Instanz laufen lassen — einschließlich der
Socket-Prüfung, die in AP 7 umgebaut wurde.

**Fertig, wenn** die Definition of Done unten in allen sechs Punkten erfüllt ist.

## Meilensteine

| Meilenstein | Nach  | Inhalt                                                                   |
| ----------- | ----- | ------------------------------------------------------------------------ |
| M6          | AP 3  | Die Instanz hat Teilnehmerkonten: registrieren, anmelden, Profil pflegen |
| M7          | AP 7  | Chat in Echtzeit, authentifiziert, mit Bildern — durch NGINX geprüft     |
| M8          | AP 13 | Phase 3 abgeschlossen, Push auf echten Geräten belegt                    |

**M6 ist der zweite sinnvolle Zeitpunkt für die Rückmeldungsrunde mit Democracy
International**, die seit Phase 1 offen ist: ab hier kann der Pilotpartner die
Anwendung als Teilnehmender erleben, nicht nur als Veranstalter. Vorschlag,
keine Zusage — wann sie stattfindet, entscheidet Marius.

## Querschnittsregeln für jedes Arbeitspaket

- **Erst der Test, dann der Code.** Unit-Tests je Service und Guard, API-Vertrag
  in `apps/server-e2e`, Oberfläche in `apps/*-e2e` (Chromium, Firefox, WebKit).
- **Schichtgrenzen nicht verhandeln.** Bei einem Linter-Verstoß wird ein Port
  eingezogen, nicht die Regel gelockert. Ein von zwei Modulen geteilter Port
  gehört nach `business/common/ports/` (F100).
- **Eine Migration pro Arbeitspaket**, explizites SQL, `down` mitgeschrieben und
  einmal wirklich ausgeführt. `registration` wird nicht angefasst (E31).
- **Kein neuer Schalter, der nichts liest** (E21) und kein neuer Wert, den
  `infra/docker-compose.yml` nicht durchreicht.
- **Jeder neue Bildschirm liefert seine Katalogschlüssel** in Englisch und
  Deutsch mit (E22, F70, F80) — kein Text im Template.
- **Nichts, das den Zustand ändert, ist ein GET.** Die Cookies dieser Phase
  tragen `SameSite=Lax` und ersparen damit einen CSRF-Token — solange diese Regel
  hält.
- **Englisch mit Marius, Englisch im Code**; Conventional Commits. (Die
  Sprache des Gesprächs hat Marius am 03.09.2026 auf Englisch umgestellt —
  eingetragen nach der Regel dieses Dokuments, dass ein Auftrag von ihm oben
  mit Datum vermerkt wird. Die Pakete bis AP 7 liefen auf Deutsch, und in
  `PHASE1.md`/`PHASE2.md` bleibt die alte Zeile stehen: das ist Historie,
  keine Anweisung. Die **Dokumentation** dieses Repositories bleibt Deutsch.)
- **Nach jedem Paket** `nx run-many -t lint test build` und die E2E-Suiten grün,
  dann committen. Wer „grün" sagt, hat den Stack hochgefahren.

## Risiken

| Risiko                                                                                                                                | Gegenmaßnahme                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Der Chat ist der größte Scope-Zuwachs der Phase** — F9 nennt Gruppen, CLAUDE.md Bilder, und beides in einem Paket                   | Drei Pakete statt einem: Fachlichkeit (AP 6), Echtzeit (AP 7), Oberfläche (AP 8). Die Bilder bleiben in AP 6, weil ein zweiter Durchgang durch Datenmodell und Gateway teurer wäre (E40)          |
| **Eine zweite Authentifizierung ist eine zweite Angriffsfläche.** Registrierung, Login und Kontaktformular sind neue offene Endpunkte | Alle drei antworten immer gleich (E10, E32), alle drei unter der globalen Drosselung, `/api/participant` deny by default am Pfad (E33), und ein Vertragstest je Endpunkt, der die Gleichheit hält |
| Der Socket-Handshake liest ein Cookie — und Cookies erreichen Gateways anders als HTTP-Handler                                        | AP 7 beginnt mit der kleinsten Prüfung, die das zeigt, **bevor** Räume oder Zustellung gebaut werden; Spike 4 hat den Weg durch NGINX schon belegt                                                |
| `member_id` hat keinen Fremdschlüssel (zwei mögliche Elterntabellen)                                                                  | Bewusst (siehe Schema): die Zeile existiert nie ohne ihr Gespräch, und die Geschäftslogik prüft die Existenz beim Anlegen. Ein Test hält fest, dass eine unbekannte Id ein 400 ist                |
| Ein Chatbild ist Inhalt, keine Marke — die Medienroute braucht eine Berechtigung, anders als alle bisherigen                          | Eigene Route mit eigenem Guard (AP 6), und `docs/rules/api-contracts.md` bekommt den Unterschied zu F115 als eigene Zeile, damit die nächste Medienroute nicht die falsche Vorlage nimmt          |
| Push auf echten Geräten ist der eine Punkt, den keine Suite dieses Repositories prüfen kann — und F7 hängt davon ab                   | AP 11 hat die Matrix als Abnahmekriterium, nicht als Nachtrag; ein gescheiterter Fall wird mit Gerät und Datum protokolliert, nicht weggelassen                                                   |
| Die Phase ist mit 13 Paketen die längste bisher; FR 4.7 und 4.8 sind P3 und könnten sie überziehen                                    | AP 12 ist ausdrücklich streichbar, und AP 4 räumt die Phase-1-Zusagen früh weg, damit am Ende nicht Altlast und Neubau gleichzeitig offen sind                                                    |
| Ein Teilnehmerkonto ändert die Bedeutung von „meine Anmeldung", und Phase 1 hat dafür einen Link in Postfächern hinterlassen          | Der Link bleibt gültig — das war die Zusage (E11). `SelfServiceService.require` bekommt einen zweiten Weg, keinen anderen, und ein Test fährt den alten Weg nach dem Umbau noch einmal            |

## Nachträge am Referenzdokument — geplant

Wird beim jeweiligen Paket eingetragen, nicht am Ende gesammelt:

| Nr.  | Inhalt                                                                                              | AP  |
| ---- | --------------------------------------------------------------------------------------------------- | --- |
| F118 | Die Adresse ist die Identität; `registration` bekommt keine `user_id` (E31, Bezug F57)              | 1   |
| F119 | `/api/participant` ist der geschützte Präfix, `/api/user` bleibt öffentlich (E33, Bezug E16, F69)   | 1   |
| F120 | Eine Teilnehmersitzung ist eine zweite Sitzung, keine Rollenspalte (E34, Bezug F22)                 | 1   |
| F121 | Ein Konto entsteht mit Double-Opt-In und antwortet immer gleich (E32, Bezug E10)                    | 1   |
| F122 | Der Feld-Baukasten der Profile ist instanzweit; Ergänzung zu Schema 5.3 (E35, Bezug F35, F101)      | 2   |
| F123 | Der Tätigkeitsbereich ist eine Spalte, weil die Suche darauf filtert (E36)                          | 2   |
| F124 | Ein Avatar liegt in `avatars/`, und die Datenbank hält das fest (Bezug F113, E9)                    | 2   |
| F125 | Was eine Mail-Locale ist, wenn der Empfänger eine hat — und wenn nicht (E24 fortgeschrieben)        | 4   |
| F126 | Die Profilsuche sucht wie die Teilnehmerübersicht: `ILIKE` je Wort, keine Volltextsuche (Bezug F32) | 5   |
| F127 | `searchable` ist das Opt-in für Suche **und** Kontakt (E37, Bezug F13)                              | 5   |
| F128 | Ein Modulschalter darf eine Voraussetzung haben — und löst sie nicht still auf (E42, Bezug F63)     | 5   |
| F129 | Gelesen gehört dem Mitglied: `conversation_member.last_read_at` statt `message.read_at` (E38)       | 6   |
| F130 | Eine Nachricht ist Text, Bild oder beides — nie nichts (E40, Bezug F39, F38)                        | 6   |
| F131 | Eine Medienroute mit Berechtigung: warum ein Chatbild anders ist als ein Logo (Bezug F115)          | 6   |
| F132 | Der Handshake ist die Tür, nicht das Ereignis (E41, Bezug Spike 4)                                  | 7   |
| F133 | Der Gast im Gespräch: `organizer_contact` ohne zweiten Account (E39, Bezug F11)                     | 9   |
| F134 | Ein Abonnement ohne Konto bleibt möglich; `user_id` ist nullbar (E43, Bezug F7)                     | 11  |
| F135 | Eine persönliche Benachrichtigung geht nur raus, wenn niemand zusieht (E44)                         | 11  |
| F136 | Der Newsletter ist eine Adresse, keine Anmeldung — und `notification` wird nicht gebaut (E45, F8)   | 12  |
| F137 | Was mit der `module_config`-Zeile eines zurückkehrenden Schlüssels passiert (Bezug F63, F71)        | 1   |

Die Nummern sind reserviert, nicht garantiert: was sich beim Bauen als dieselbe
Entscheidung entpuppt, wird zusammengelegt, und die freigewordene Nummer bleibt
unvergeben (wie F62). **F137** war nicht geplant — die Zeile fiel in AP 1 auf und
bekam ihre eigene Nummer, weil sie noch zweimal auftreten wird. **F138** und
**F139** kamen in AP 2 dazu: was zwei Baukästen wirklich teilen (die Regel, nicht
den Port) und was ein Passwortwechsel mit den anderen Sitzungen macht. **F140
bis F147** kamen in AP 3 dazu, **F148** und **F149** in AP 4 — wie eine Sitzung
eine Anmeldung beansprucht und was die Profilspalte behauptet; F125 war für
dieses Paket reserviert und ist vergeben. In AP 5 sind die drei reservierten
Nummern **F126–F128** vergeben und drei neue dazugekommen (**F150–F152**): was
ein fremdes Profil trägt, wo das Opt-in steht — und wer dafür sorgt, dass ein
nicht auffindbares Profil nirgends auftaucht. AP 6 hat **F153–F159** vergeben und
seine drei reservierten Nummern **nicht** gebraucht: `last_read_at` als
Mitgliedszustand ist F56, „Text, Bild oder beides“ ist E40 selbst, und die
Medienroute mit Berechtigung wurde F156 — F129, F130 und F131 bleiben deshalb
unvergeben, wie F62. AP 7 hat die für ihn reservierte **F132** vergeben und fünf
neue dazugelegt (**F160–F164**); AP 8 sechs neue (**F165–F170**); AP 9 seine
reservierte **F133** und zwei neue (**F171**, **F172**); AP 10 drei neue
(**F173–F175**); AP 11 seine reservierten **F134** und **F135** und drei neue
(**F176–F178**). AP 12 hat die letzte reservierte Nummer vergeben — **F136**,
was der Newsletter ist — und fünf neue dazugelegt (**F179–F183**): das Verb des
Stornos, die drei Abweichungen vom Schemaentwurf, was das Formular antwortet, wo
es steht, und wie man eine Zustimmung zurücknimmt. Von den reservierten Nummern
ist damit **keine** mehr offen; unvergeben bleiben F62 und F129–F131.

## Definition of Done für Phase 3

1. **Jedes Arbeitspaket hat sein Abnahmekriterium nachweislich erfüllt**;
   `nx run-many -t lint test build`, die Server-Unit-Tests, die
   API-Vertragstests und beide Browsersuiten sind grün — nacheinander gefahren,
   nie zusammen (die globale Drosselung).
2. **Ein Mensch, der auf einer Veranstaltung war, kann die Instanz benutzen,
   ohne den Veranstalter zu fragen:** Konto anlegen, Profil pflegen, entscheiden,
   ob er gefunden wird, jemanden anschreiben, Bilder schicken, seine Anmeldungen
   sehen und stornieren — mobil, in seiner Sprache.
3. **Ein Interessent ohne Konto erreicht den Veranstalter**, und die Antwort
   kommt bei ihm per E-Mail an. Am laufenden Stack mit Mailpit durchgespielt.
4. **Eine Event-Änderung erreicht ein echtes Gerät** als Push-Benachrichtigung,
   und die vier Zeilen der Gerätematrix aus Spike 3 sind abgehakt oder mit Gerät
   und Datum als gescheitert protokolliert.
5. **`todo.md` unter _Checkable after phase 3_ ist durchgearbeitet** und
   F118–F139 stehen im Referenzdokument. Verschobene Einträge tragen eine
   Begründung, gestrichene ebenfalls.
6. **Dieses Dokument ist von Plan auf Protokoll korrigiert** und hat je Paket
   einen Abschnitt „erledigt" sowie am Ende ein phasenweites _Was anders lief_.

---

## Fortschritt

Je Paket ein Abschnitt „erledigt" mit dem, was tatsächlich passierte —
Abweichungen vom Plan stehen hier, damit AP 13 sie nicht rekonstruieren muss.

### AP 1 — Teilnehmerkonto und Login (erledigt, 02.09.2026)

Umgesetzt:

- **`business/common/`** — der Umzug aus AP 1: `password-policy.ts` (die
  Konstanten heißen jetzt `MIN_PASSWORD_LENGTH`/`MAX_PASSWORD_LENGTH`, nicht mehr
  `…ADMIN…`, weil zwei Modulfamilien sie lesen), `password-hasher.service.ts`,
  `session-token.ts` (`newSessionToken`, `hashSessionToken`),
  `allow-anonymous.ts` (Dekorator **und** `allowsAnonymous(reflector, context)`,
  damit beide Guards dieselben drei Zeilen lesen), `login-throttle.ts` mit
  `LOGIN_ATTEMPTS_PER_WINDOW`, `resolved-session.ts` und ein schmales
  `CommonModule`, das nur den Hasher bereitstellt.
- **`shared-models`** — `lib/profiles/` mit `PROFILES_MODULE_KEY`,
  `PROFILE_CONFIRMATION_PATH`, `PROFILE_LOGIN_PATH`, `ParticipantAccount`,
  `ParticipantLoginRequest`, `ParticipantSessionInfo`,
  `ProfileRegistrationRequest`, `ProfileRegistrationAcknowledgement`,
  `ProfileConfirmation`.
- **Server** — Migration `UserAccounts` (`user_profile` mit
  `UQ_user_profile_email` über `lower(email)`, `user_session` mit
  `ON DELETE CASCADE` und Ablaufindex), zwei Entities, zwei Ports, zwei
  TypeORM-Repositories, `ProfilesService` (anlegen, bestätigen,
  `checkCredentials`), `UserSessionService`, `ParticipantGuard` +
  `isParticipantPath`, `CurrentParticipant`, `user-session-cookie.ts`, drei
  Controller (`POST /api/user/profiles`, `…/confirm`,
  `POST /api/participant/auth/login`·`logout`, `GET /api/participant/me`), vier
  DTO-Dateien. `profiles` steht wieder in `CORE_MODULES` (`enabledByDefault:
true`), alle neuen Routen tragen `CoreModuleEnabledGuard`.
- **Mail** — zwei Templates (`profileConfirmation`, `profileExists`), neun
  Katalogschlüssel in Englisch und Deutsch, `modules.profiles.title` dazu:
  Katalog **654 → 664**. Vierter Tokenzweck `profile-confirmation`.

Nachweise: 47 neue Server-Unit-Tests (770 → **817**), 15 neue API-Vertragstests
(381 → **396**), Browsersuiten unverändert grün (266 Veranstalter, 197 Nutzer).
Das `down` der Migration einmal wirklich gefahren und wieder hochgezogen.
**F118–F121** stehen im Referenzdokument, dazu **F137**, das der Plan nicht
vorhergesehen hatte.

Was anders lief:

- **Der Präfix heißt `/api/participant`, nicht `/api/me`** — schon vor dem Bauen
  im Spec-Review korrigiert (E33), weil `GET /api/me/profiles` „meine Profile"
  gelesen hätte und die Suche nach anderen gemeint war.
- **Eine zweite Mail war nötig, die der Plan nicht nannte.** E32 verlangt eine
  immer gleiche Antwort; ohne eine Nachricht „für diese Adresse gibt es schon
  ein Konto" bekommt derjenige, der schon eines hat, **gar nichts** und steht
  vor einer Sackgasse. Daraus wurde zugleich eine Regel: auch der **Fehlschlag**
  muss gleich aussehen — ein unerreichbarer Mailserver antwortet für die
  bekannte wie für die unbekannte Adresse mit demselben 503.
- **Ein Login vor der Bestätigung antwortet 403, nicht 401.** Nur bei
  **richtigem** Passwort: wer es kennt, weiß bereits, dass das Konto existiert,
  und „falsche Adresse oder Passwort" hätte ihn ohne Ausweg zurückgelassen.
- **Der zurückkehrende Modulschalter brachte eine Altlast mit.** Jede Instanz,
  die die Attrappenliste aus Phase 1/2 gesehen hat, trägt `profiles = false` in
  `module_config` — ein Vorgabewert aus einer Zeit, in der der Schalter nichts
  tat. Er hätte den Deskriptor stillschweigend überstimmt, und der Veranstalter
  hätte Profile abgeschaltet gefunden, ohne sie abgeschaltet zu haben. Die
  Migration löscht deshalb die **`false`**-Zeilen der drei zurückkehrenden
  Schlüssel; `true` bleibt stehen, wie Phase 2 es zugesagt hat. Gilt noch für
  `chat` (AP 6) und `profile-search` (AP 5) — die Regel steht in
  `docs/rules/api-contracts.md`.
- **`user_session` hat kein `user_agent`.** Anders als `admin_session`: die
  Spalte dort existiert für eine Sitzungsliste, die es für Teilnehmer nicht gibt.
- **Die gemeinsame Sitzungsform heißt `ResolvedSession`, nicht
  `AuthenticatedPrincipal`.** Geteilt sind die drei Felder der Sitzung
  (`sessionId`, `lastSeenAt`, `expiresAt`); wem sie gehört, hängt jede Seite
  selbst an (`admin` bzw. `profile`). Ein gemeinsamer Kontotyp hätte einen Guard
  ermöglicht, der beide lesen kann — genau das, was E34 verhindert.
- **Zwei Testfallen kosteten je eine Runde** und stehen jetzt in
  `docs/rules/`: eine nachträglich ergänzte Migration läuft nicht erneut
  (`tooling-traps.md`), und ein Fehlerkörper trägt einen Zeitstempel, der zwei
  identische Antworten ungleich macht (`e2e-tests.md`). Dazu ein Fund ohne
  eigenen Fehler: die Entwicklungsdatenbank trug Demo-Seed-Farben, weshalb zwei
  Browsertests nach einem Theming-Fehler aussahen.

Offen aus diesem Paket: `AP 3` baut die Seiten zu
`PROFILE_CONFIRMATION_PATH` und `PROFILE_LOGIN_PATH` — bis dahin zeigen die
Links beider Mails auf Adressen, die der Nutzer-Client noch nicht bedient.

### AP 2 — Profil verwalten und der Baukasten dafür (erledigt, 02.09.2026)

Umgesetzt:

- **Migration `ProfileFields`** — `user_profile` bekommt `avatar_path` (mit
  `CHK_user_profile_avatar_path`: `NULL` oder `avatars/%`), `activity_areas`,
  `custom_fields_json` (`NOT NULL DEFAULT '{}'`) und `searchable`
  (`NOT NULL DEFAULT false`); dazu die Tabelle `profile_field` mit
  `UQ_profile_field_key` — **instanzweit**, ohne `event_id`.
- **`business/common/` wächst um zwei geteilte Stücke** (F138): `field-kit.ts`
  (Antwortprüfung, Schlüsselableitung, Beschriftung, Auswahllisten — jetzt von
  **beiden** Baukästen benutzt, `RegistrationFieldsService` inbegriffen) und
  `ImageFileService` samt `image-upload.ts` (die vier Uploadprüfungen, Schreiben
  und Lesen je Teilbaum). `LogoImageService` delegiert und behält nur, was Zeilen
  kennt; `logo-upload.ts` ist weg, die beiden Logo-Controller lesen
  `IMAGE_UPLOAD_OPTIONS`. `FileArea` hat einen vierten Wert: `avatars`.
- **`business/profiles/`** — `ProfileFieldsService` (Definitionen **und** Prüfung
  der Antworten), `ProfilesService` um `updateProfile`, `changePassword`,
  `setAvatar`, `removeAvatar` und `readAvatar` erweitert, `avatar-url.ts`,
  `UserSessionService.revokeOthers`, ein neuer Port
  (`PROFILE_FIELD_REPOSITORY`), `setAvatarPath` und `deleteForUserExcept` an den
  zwei bestehenden, drei neue Controller.
- **Endpunkte** — `PATCH /api/participant/me`, `PUT /api/participant/me/password`,
  `PUT`/`DELETE /api/participant/me/avatar`,
  `GET /api/participant/profile-fields`, `GET`/`POST /api/admin/profile-fields`,
  `PUT /api/admin/profile-fields/order`,
  `PATCH`/`DELETE /api/admin/profile-fields/:id`,
  `GET /api/media/profiles/:id/avatar`. Alle tragen `CoreModuleEnabledGuard`.
- **`shared-models`** — `lib/profiles/profile-field.ts` (`ProfileFieldType`,
  `PROFILE_FIELD_TYPES`, `MAX_PROFILE_FIELDS`, `MAX_ACTIVITY_AREAS_LENGTH`,
  `ProfileField`, `…Public`, `…Input`, `…Change`, `…Order`); `ParticipantAccount`
  um `avatarUrl`, `activityAreas`, `customFields` und `searchable` erweitert,
  dazu `ParticipantProfileUpdate`, `ParticipantPasswordChange`, `AvatarImage`.

Nachweise: 62 neue Server-Unit-Tests (817 → **879**), 32 neue API-Vertragstests
(396 → **428**), Browsersuiten unverändert grün (266 Veranstalter, 197 Nutzer),
`nx run-many -t lint test build` über alle 13 Projekte fehlerfrei. Das `down` der
Migration einmal wirklich gefahren — Tabelle weg, Constraint weg, vier Spalten
weg, `user_profile` genau wieder in dem Zustand, den `UserAccounts` hinterlässt —
und danach mit dem vollen Vertragslauf wieder hochgezogen. **F122–F124** stehen
im Referenzdokument, dazu **F138** und **F139**, die der Plan nicht vorhergesehen
hatte. Der Katalog bleibt bei **664** Schlüsseln: dieses Paket hat keinen
Bildschirm und keine Mail.

Was anders lief:

- **E35 verspricht mehr, als sich einlösen ließ.** „Derselbe generische Port,
  dasselbe Repository" ist für zwei Feldtabellen nicht machbar: die eine filtert
  nach `event_id` und ist je Event eindeutig, die andere hat keins und ist
  instanzweit eindeutig, und die eine kennt einen Datei-Typ, den die andere nicht
  haben darf. Geteilt wird deshalb **die Regel** (`business/common/field-kit.ts`,
  von beiden Diensten benutzt), nicht der Port — **F138**. Dieselbe Frage stellte
  das Bild ein zweites Mal, und dort war die Antwort umgekehrt: beim **dritten**
  wortgleichen Exemplar derselben vier Uploadprüfungen ist Teilen richtig, also
  gibt es jetzt `ImageFileService`.
- **`profile_field` hat ein `help_text`, das im Plan nicht stand.** Ohne die
  Spalte wären die beiden Baukästen strukturell verschieden — und dann hätte das
  eine Formularbauteil, das E35 gemeinsam benutzen will, in AP 3 zwei Fassungen
  gebraucht.
- **Die Öffentlichkeit der Avatarroute brauchte eine eigene Begründung.** Der
  Plan sagte „wie F115"; zwei der drei Argumente dort greifen aber nicht (ein
  Avatar _ist_ ein Teilnehmerdatum, und eine Veranstalter-Vorschau gibt es
  nicht). Getragen wird die Entscheidung von der uuid **und** von E34: ein
  sitzungsgeschützter Avatar bräuchte einen Guard, der beide Cookies akzeptiert,
  oder zwei Routen zu denselben Bytes. Steht als **F124** samt der Auflage für
  AP 5, die Id eines nicht gezeigten Profils auch nicht herauszugeben.
- **Ein Passwortwechsel beendet die anderen Sitzungen** (**F139**). Nicht im Plan,
  aber ohne diesen Teil wäre die Funktion eine halbe Maßnahme — wer sein Passwort
  ändert, weil ein Gerät nicht mehr sein eigenes ist, hat etwas über das Gerät
  gesagt. Die eigene Sitzung bleibt.
- **`PATCH` ist oben teilweise und unten ganz.** `customFields` ist, wenn es
  mitkommt, die vollständige Antwortmenge — sonst ließe sich „Pflichtfrage" nicht
  beurteilen. Wer nur seinen Namen korrigiert, scheitert deshalb **nicht** an
  einer Frage, die nach seiner letzten Bearbeitung gestellt wurde; die Prüfung
  gilt dem Formular, nicht dem gespeicherten Profil.
- **`GET /api/participant/profile-fields` steht nicht in der API-Tabelle des
  Plans.** Der Client braucht die Definitionen, um das Formular zu zeichnen, und
  sie in `GET /api/participant/me` mitzuliefern hätte die Zusage dieses
  Endpunkts gebrochen, keine Abfrage zu kosten — er läuft bei jedem Start.
- **Ein Vorgabewert war die eigentliche Arbeit.** `searchable NOT NULL DEFAULT
false` ist eine Zeile SQL und die wichtigste dieser Migration: ein
  Aktivistenprofil, das durch eine Migration auffindbar wird, ist der Unfall,
  den E37 verhindert.

Offen aus diesem Paket, und schon entschieden: **der Veranstalter-Client hat
keine Seite für den Profil-Baukasten.** Die Endpunkte stehen, die Fragen ließen
sich nur über die API anlegen — der Plan nennt für AP 2 ausdrücklich nur den
Server und gab die Oberfläche keinem Paket. **Marius hat sie am 02.09.2026 AP 3
zugewiesen**; der Abschnitt dort trägt sie samt zwei Voraussetzungen, die man
nicht annehmen darf (das gemeinsame Formularbauteil existiert noch nicht, und die
Editorseite des Anmeldeformulars ist heute eine Seite und kein Bauteil).

### AP 3 — Login, Registrierung und Profil in beiden Clients (erledigt, 02.09.2026) → **Meilenstein M6**

Umgesetzt:

- **Nutzer-Client, vier Seiten** — `pages/profile-register/`,
  `pages/profile-confirm/`, `pages/profile-login/`, `pages/profile/`. Die Routen
  `profile/confirm` und `profile/login` sind die beiden, auf die eine Mail zeigt;
  ihre Adressen stehen als `PROFILE_CONFIRMATION_PATH` und `PROFILE_LOGIN_PATH`
  in `shared-models`, und `app.routes.spec.ts` prüft, dass dieser Client sie
  wirklich routet — ein geteilter Konstantenname verhindert nur eine Abweichung,
  wenn ihn beide Seiten benutzen.
- **`features/auth/`** — `ParticipantSessionService` (Sitzungssignal,
  `restore`, `register`, `confirm`, `logIn`, `logOut`, `adopt`, `clear` und
  `accountsEnabled` aus dem Modulschalter), `provideParticipantSession()` als
  Startschritt **hinter** der Konfiguration, `participantSessionGuard` /
  `participantAnonymousGuard`, `sessionExpiredInterceptor`.
- **`features/fields/`** — `custom-field.ts`, das **eine** Bauteil für beide
  Baukästen (F140), dazu `field-answers.ts` (`syncAnswers`, `fillAnswers`,
  `validatorsFor`). Das öffentliche Anmeldeformular zeichnet seine drei
  Werttypen jetzt damit und behält nur den Dateizweig — 105 Zeilen weg, 62 neu,
  und `register.choose` heißt `fields.choose`, weil der Schlüssel dem Bauteil
  gehört und nicht der Seite, auf der er zuerst stand.
- **`features/profiles/`** — `ParticipantProfileService` (Fragen, `PATCH`,
  Passwort, Avatar) und `avatar-field.ts`: rundes Bild, Initialen als
  Platzhalter, Zwei-Schritt-Geste, lokale Typ- und Größenprüfung. Eigenes
  Bauteil und nicht das des Veranstalter-Clients — die Begründung steht in
  **F145**.
- **Die Navigation trägt den angemeldeten Zustand** — Profil und Abmelden, oder
  eine Einladung zum Anmelden, und nichts von beidem auf einer Instanz mit
  abgeschaltetem `profiles`-Modul. Abmelden ist ein Knopf, kein Link.
- **Veranstalter-Client: `pages/profile-fields/`** — Fragen anlegen,
  umformulieren, Pflicht setzen, verschieben, löschen, gegen die Endpunkte aus
  AP 2, erreichbar über einen eigenen Navigationseintrag (`/profile-form`). Die
  Seite sagt auf dem Bildschirm, dass Löschen die Antworten behält (F34), und
  fragt es noch einmal nach.
- **Geteilt zwischen den beiden Editorseiten** (F144): `features/fields/field-editing.ts`
  („eine Auswahl pro Zeile") und `fieldTypeKey()` in `features/i18n/labels.ts`.
  Die Editorseite des Anmeldeformulars benutzt jetzt beides.
- **`shared-models`** — `AnswerableField` und `AnswerableFieldType` als der
  Vertrag, den beide Baukästen erfüllen (`ProfileFieldPublic` **ist** er);
  `MIN_PASSWORD_LENGTH` und `MAX_PASSWORD_LENGTH` sind hierher gewandert
  (**F141**), der Server re-exportiert sie und entscheidet weiter.

Nachweise: 63 neue Unit-Tests im Nutzer-Client (53 → **116**), 9 im
Veranstalter-Client (159 → **168**), Serverseite unverändert (**879** Units,
**428** Vertragstests). Browsersuiten: **204** Nutzer (197 → 203 grün, einer in
WebKit übersprungen) und **300** Veranstalter (266 → 274 grün, 26 übersprungen —
die Profilfragen sind instanzweit und laufen nur in Chromium). Der Katalog
wächst um 85 Schlüssel auf **749**, en und de vollständig.
`nx run-many -t lint test build` über alle 13 Projekte fehlerfrei; keine
Migration in diesem Paket, weil AP 2 sie schon geschrieben hat. Neue
Entscheidungen: **F140–F147**.

Was anders lief:

- **Der Startlauf fragte bei jedem öffentlichen Seitenaufruf nach einer
  Sitzung — und bekam 401.** Gefunden hat es `start-up.spec.ts` mit „ohne
  Konsolenfehler": bei einem Client, dessen Normalzustand anonym ist, ist der
  Sitzungsprobe-401 kein Ausnahmefall, sondern die Regel. Weder ein neuer
  Endpunkt noch eine gelockerte Prüfung, sondern ein **Hinweis** in
  `localStorage`: gefragt wird nur, wenn dieser Browser schon einmal angemeldet
  war. Das Cookie bleibt die Autorität (**F143**).
- **`searchable` ist bewusst nicht auf der Profilseite** (**F142**). Die Spalte
  ist seit AP 2 schreibbar; ein Kästchen mit der Aufschrift „andere
  Teilnehmende können Sie finden und Ihnen schreiben" wäre aber ein Schalter,
  den nichts liest — und bei einer Zusage über Sichtbarkeit ist das die falsche
  Richtung, in die man falsch liegt. **AP 5 schuldet ihn**, zusammen mit der
  Suche, die er steuert; als Punkt in `todo.md`.
- **Das Formularbauteil trägt nur drei der vier Feldarten.** E35 sagt „ein
  Bauteil für beide Baukästen", und so weit trägt es auch — die Datei bleibt beim
  Anmeldeformular, weil ihre Antwort Bytes im Request sind (F37) und ihr
  Eingabefeld kein Control hat, das ein Formular besitzen kann. Das Control wird
  dem Bauteil **übergeben** statt über `formControlName` aus der Umgebung geholt
  (**F140**).
- **Die Profilseite wartete zuerst auf die Fragen, bevor sie den Namen füllte.**
  Ein Ausfall von `GET /api/participant/profile-fields` machte damit ein
  Pflichtfeld leer und das ganze Formular unabsendbar. Jetzt zwei Effekte: die
  eigenen Felder, sobald das Profil da ist, die Antworten, wenn auch die Fragen
  da sind. Dazu die Kehrseite derselben Regel: `customFields` wird **gar nicht**
  gesendet, wenn die Definitionen nicht gelesen werden konnten — ein `{}` hätte
  jede bisherige Antwort gelöscht (**F146**).
- **Die Passwortregel stand fünfmal im Code.** Zwei Seiten im
  Veranstalter-Client trugen je ein `const MIN_PASSWORD_LENGTH = 12` mit dem
  Kommentar, dass der Server die Autorität sei; Registrierung und
  Passwortwechsel hätten zwei weitere gebraucht. Die Zahl liegt jetzt in
  `shared-models` (**F141**) — der dritte Aufrufer ist der, bei dem man auszieht.
- **Der Aufräumcode der Browsersuite löschte die Konten der anderen Engines.**
  Drei Engines, eine Instanz, kein Löschendpunkt für ein Konto: abgeräumt wird
  per SQL nach Adressmuster, und mit einer gemeinsamen Maildomain löschte die
  erste fertige Engine die laufenden Konten der beiden anderen — deren
  Sitzungszeilen gingen mit, die nächste Anfrage antwortete 401, und der
  Interceptor schob sie mitten im Test auf die Loginseite. Es sah eine Stunde
  lang nach einem kaputten Login aus (**F147**). Dieselbe Klasse: ein
  `<section>` ohne `aria-labelledby` ist keine `region`, und `allInnerTexts()`
  wartet nicht.
- **Zwei Volldurchläufe der Nutzer-Suite in fünf Minuten reißen das
  Registrierungsbudget.** 60 Registrierungen je fünf Minuten (E4), und drei
  Suiten melden je Engine an; ab dem zweiten Durchlauf antwortet der Endpunkt
  429, und die Tests scheitern beim Warten auf eine Mail, die nie verschickt
  wurde. Steht jetzt in `docs/rules/e2e-tests.md`, weil es zweimal wie ein
  Fehler im Code aussah.
- **Der Veranstalter-Client hat keine zweite Editorseite bekommen, sondern eine
  zweite Seite** (**F144**). Es ist der zweite Aufrufer, nicht der dritte, und
  die Unterschiede sitzen in der Gestalt des Bearbeiteten — kein Event darüber,
  kein Datei-Typ darunter. Geteilt wird, was ein Veranstalter nicht zweimal
  lernen darf.

Offen aus diesem Paket: **das Opt-in für die Auffindbarkeit** (F142, AP 5) und
**die Frage, ob es eine geteilte Bibliothek für Oberflächenbauteile geben soll**
(F145) — beides in `todo.md`, das zweite ist eine Stack-Entscheidung und gehört
Marius.

### AP 4 — Die Anmeldung kennt den Menschen (erledigt, 02.09.2026)

Umgesetzt:

- **Die Sitzung ist der zweite Anspruch auf dieselbe Anmeldung** (**F148**).
  `SelfServiceService.require` nimmt einen `SelfServiceClaim` — Token aus der
  Mail **oder** Sitzung plus Anmelde-Id, aufgelöst über Adressgleichheit (E31).
  Ab der Statusprüfung ist es derselbe Code; die Links in den Postfächern
  funktionieren unverändert, und ein Vertragstest fährt genau das nach.
- **`GET /api/participant/registrations`** — meine Anmeldungen, nach Eventstart
  absteigend, Id als letztes Kriterium, paginiert (10, höchstens 50), jeder
  Zustand dabei. Dazu `GET /…/:id` (dieselbe Ansicht wie der Link öffnet) und
  `PUT`/`DELETE /…/:id/program-items/:itemId/signup` für die Plätze (FR 3.10).
  Alle vier hinter dem `profiles`-Schalter (F53) und ohne eigene Drosselung: ein
  Token ist im Prinzip erratbar, eine Sitzung nicht.
- **Kein Storno über die Sitzung** — die Regel hat noch keinen zweiten Weg, der
  Link kann es heute, und **AP 12 schuldet ihn** (F148, FR 4.7 ist P3). Die
  Detailseite zeigt den Knopf deshalb nur mit Token, statt einen anzubieten, der
  nicht funktioniert.
- **Ein Port für eine Adresse** (**F149**): `ProfileDirectory` in
  `business/common/ports/` mit `withAccount(emails)` und `localeFor(email)` —
  zwei Fragen, zwei Module (Übersicht und Mail), kein Zugriff auf ein Profil.
- **Die Teilnehmerübersicht hat ihre Profilspalte** (FR 3.3, die Lücke aus
  E13): ein Ja/Nein über ein **bestätigtes** Konto, einmal je Seite gefragt,
  ohne Id und ohne Namen (F124). Auch im Detailpanel, dort als Wort.
- **Mail in der Sprache des Empfängers** (**F125**): `MailCatalogue.strings()`
  bekommt die Adresse und fragt den Port nach der gewählten Sprache; die Kette
  ist Empfänger → Instanzvorgabe → Englisch, der Rückfall aus E24 bleibt
  unangetastet. Und der **Inhalt folgt derselben Entscheidung**: `MailService`
  nimmt statt eines Kontextes eine Funktion (`MailContent<T>`) und ruft sie mit
  der Sprache auf, in der der Brief wirklich steht. Vier Mails übersetzen so
  ihren Eventtitel; die Einladung löst je Sprache einmal auf, nicht je
  Empfänger.
- **`EventsService.locateMany`** (plus `findByIds` an zwei Repositories und
  `EventSeriesService.slugsOf`/`nameOf`) — eine Liste von Anmeldungen nennt ihre
  Events in drei Abfragen statt in drei je Zeile (F49).
- **Nutzer-Client: `pages/my-registrations/`** — die Liste, die ein Token nicht
  öffnen kann, mit „Mehr anzeigen" statt einer Seitennummerierung. Die
  Detailseite `pages/my-registration/` beantwortet jetzt beide Wege: `token` aus
  der Query oder `id` aus dem Pfad, ein Bauteil, eine Regelstrecke. **Der
  Navigationseintrag „Meine Anmeldungen" ist da** — der Grund, warum er fehlte,
  war die fehlende Anmeldung.

Nachweise: 31 neue Unit-Tests im Server (879 → **910**) und eine neue
Vertragssuite `api/my-registrations.spec.ts` mit 16 Fällen (428 → **444**), die
beide Hälften der Zusage nachfährt: ein Link aus einem Postfach funktioniert
weiter, und eine Sitzung braucht keinen. 12 neue Unit-Tests im Nutzer-Client
(116 → **128**), der Veranstalter-Client unverändert (**168**). Browsersuiten:
Nutzer **203** grün (1 in WebKit übersprungen) — die Strecke „meine Anmeldungen"
läuft im bestehenden Test von `profile.spec.ts` mit, weil eine eigene Datei drei
weitere Anmeldungen gekostet hätte (E4) — und Veranstalter **277** grün (274 →
277, 26 übersprungen). Der Katalog wächst um 9 Schlüssel auf **758**, en und de
vollständig. `nx run-many -t lint test build` über alle 13 Projekte fehlerfrei.
**Keine Migration in diesem Paket:** AP 4 fasst kein Schema an — genau das ist
E31 (`registration` bekommt keine `user_id`), und die Mail-Locale steht in einer
Spalte, die AP 1 schon geschrieben hat. Neue Entscheidungen: **F125**, **F148**,
**F149**.

Was anders lief:

- **`forbidNonWhitelisted` prüft die ganze Query gegen das Query-DTO.** Ein
  Endpunkt mit Objekt-Query **und** `?locale=` antwortet 400, bevor ein Handler
  ihn sieht — das erste Mal in diesem Repository, dass beides zusammenkam. Der
  Ausweg ist ein deklariertes `locale` im DTO, gelesen wird es weiter durch
  `LocaleQueryPipe`, weil dort die Regel liegt (F94). Steht in
  `docs/rules/api-contracts.md`.
- **Ein Backtick in einem Angular-Template-Kommentar**, wieder — diesmal in der
  Teilnehmerübersicht. Der Compiler meldete `NG1002` und fünf Folgefehler an
  ganz anderen Stellen. Die Regel stand schon in
  `docs/rules/angular-clients.md`; sie stand nur nicht im Kopf.
- **Ein Client-Test, der Dateien liest, hängt am Arbeitsverzeichnis.** `nx test
user-client` aus einem Unterordner gestartet ließ die beiden PWA-Suiten
  scheitern (Iconliste, Manifest-Adresse) — acht rote Tests, die nichts mit der
  Änderung zu tun hatten. Steht jetzt in `docs/rules/tooling-traps.md`.
- **Die Zusicherung über eine Tabellenzelle musste eine Zelle sein.** „Die Zeile
  enthält Ja" war grün, bevor es die Spalte gab: die Newsletter-Spalte daneben
  sagt für dieselbe Person dasselbe. Die Browsersuite liest jetzt die Zelle an
  der Position, die der Kopfzeilentest festhält.

Offen aus diesem Paket: **das Storno über die Sitzung** (F148) — es gehört zu
FR 4.7 und damit zu **AP 12**; in `todo.md` vermerkt, damit AP 13 es abhaken
kann.

### AP 5 — Profilsuche (erledigt, 02.09.2026)

Umgesetzt:

- **`business/profile-search/` mit zwei Lesezugriffen** (**F126**):
  `GET /api/participant/profiles` — serverseitig gefiltert, sortiert (Nachname,
  Vorname, Id als letztes Kriterium), gezählt und gefenstert (20, höchstens 50)
  — und `GET /api/participant/profiles/:id`. Zwei Suchfelder statt eines mit
  Syntax: das erste über Namen **und** Tätigkeitsbereich, das zweite allein über
  den Tätigkeitsbereich (E36). Ein `ILIKE '%wort%'` je Wort, alle mit `AND`, kein
  `pg_trgm` (F32). Beide Felder dürfen leer sein — dann ist es das Verzeichnis.
  Der eigene Eintrag fehlt in der eigenen Suche, und zwar in der Abfrage.
- **Das Opt-in kann nichts umgehen** (**F152**). `SearchableProfileRepository`
  hat keine Methode, die ein verborgenes Profil zurückgeben könnte: beide
  Anweisungen tragen `searchable = true` **und** `confirmed_at IS NOT NULL`.
  Verborgen, unbestätigt und unbekannt sind **eine** Antwort — ein wortgleiches
  404 —, weil wer eine Id herausgibt, das Profilbild mit herausgibt (F124). Ein
  eigener schmaler Port statt `UserProfileRepository`, aus dem Grund, der schon
  `ProfileDirectory` trägt (E33).
- **Was ein fremdes Profil trägt** (**F150**): Trefferzeile mit Name, Bild und
  Tätigkeitsbereich, Einzelansicht zusätzlich mit den Antworten auf die
  instanzweiten Fragen (E35). **Keine Adresse** in keiner der beiden — Kontakt
  ist ein Gespräch (AP 6), nie ein Postfach, das eine Antwort herausgegeben hat
  (F55). Ein Vertragstest prüft das stumpf: kein `@` im ganzen Rumpf.
- **Ein Modulschalter mit Voraussetzung** (**F128**, E42): `profile-search`
  braucht `profiles`, der Deskriptor nennt es, `ModuleSummary.requires` trägt es
  zum Client, und die Modulverwaltung zeigt es **als Namen** in der Zeile.
  Einschalten ohne Voraussetzung ist ein 409 mit dem fehlenden Schlüssel,
  Ausschalten der Voraussetzung unter einem laufenden Abhängigen ein 409 mit den
  Abhängigen — beides **vor** dem Schreiben, ein verweigerter Klick ändert
  nichts. Standardmäßig **an**, wie `profiles`: die Entscheidung, die ein Profil
  schützt, ist die des Menschen (**F127**), und die steht auf „unsichtbar" —
  eine frische Instanz bietet also eine Suche an, die niemanden findet, und das
  ist die richtige Richtung.
- **Das Opt-in ist auf der Profilseite** (**F151**, schließt F142) — aber nur,
  wenn `profile-search` an ist, mit einem Satz, der nennt, was sichtbar wird und
  was das Zurücknehmen bedeutet. Und die wichtigere Hälfte: das Formular schickt
  `searchable` **nur**, wenn es danach gefragt hat.
- **Nutzer-Client: `pages/people/`** — die Suchseite (zwei Felder, „Mehr
  anzeigen" statt Seitennummern, erste Seite noch vor der ersten Eingabe) und
  ein fremdes Profil mit beschrifteten Antworten. Wer sucht und selbst nicht
  auffindbar ist, liest dort einen Satz mit Link ins Profil. Beide Routen hinter
  Sitzung **und** Modul (`profileSearchGuard`), der Navigationseintrag
  „Teilnehmende finden" hängt am selben Schalter.
- **`business/common/search-terms.ts`** — der dritte Aufrufer war da (F138),
  siehe unten.

Nachweise: 21 neue Unit-Tests im Server (910 → **931**), eine neue
Vertragssuite `api/profile-search.spec.ts` mit 17 Fällen und zwei neue in
`api/modules.spec.ts` für beide Richtungen der Voraussetzung (444 → **463**).
13 neue Unit-Tests im Nutzer-Client (128 → **141**), einer im
Veranstalter-Client (168 → **169**). Browsersuiten: Nutzer **203** grün (1 in
WebKit übersprungen) — die Strecke „Teilnehmende finden" läuft wieder im
bestehenden Test von `profile.spec.ts` mit, aus demselben Grund wie in AP 4
(E4) — und Veranstalter **280** grün (277 → 280, 26 übersprungen). Der Katalog
wächst um 22 Schlüssel auf **780**, en und de vollständig.
`nx run-many -t lint test build` über alle 13 Projekte fehlerfrei. **Keine
Migration in diesem Paket:** AP 5 fasst kein Schema an, und die `false`-Zeile
des zurückkehrenden Schlüssels hat die Migration aus AP 1 schon mitgelöscht.
Neue Entscheidungen: **F126**, **F127**, **F128**, **F150**, **F151**, **F152**.

Was anders lief:

- **Der dritte Aufrufer war da — und die beiden ersten waren nicht gleich.**
  `searchTerms` stand zweimal im Code (Teilnehmerübersicht, Kontaktliste), und
  eine der beiden Fassungen kappte bei fünf Wörtern, die andere nicht. Genau das
  ist der Drift, den F138 meint: drei Kopien sind zwei Verhaltensweisen. Der
  Splitter liegt jetzt in `business/common/search-terms.ts`, mit der Kappung für
  alle drei.
- **Ein Kästchen, das nicht auf dem Bildschirm steht, schickt trotzdem seinen
  Wert.** Das `searchable`-Control liegt im Formular, unabhängig vom
  Modulschalter — ein Speichern hätte auf einer Instanz mit abgeschalteter Suche
  `searchable: false` geschrieben und jemandem still die Sichtbarkeit genommen,
  die er einmal gewählt hat. Beim Bauen aufgefallen, mit Test festgehalten
  (F151), und als Angular-Falle nach `docs/rules/`.
- **Zwei Fixture-Zustände haben keinen Weg durch die API.** „Auffindbar, aber
  unbestätigt" lässt sich nicht über Endpunkte herstellen — `searchable` ist nur
  hinter einer Sitzung schreibbar, und eine Sitzung gibt es erst nach der
  Bestätigung (E32) —, und genau diese Zeile darf im Verzeichnis nicht
  auftauchen. Deshalb `seedProfile` in `support/database.ts`, mit der Begründung
  daneben.
- **`formatAnswer` antwortet englisch.** Beim Zeichnen der Antworten eines
  fremden Profils aufgefallen: die Funktion in `shared-models` gibt „yes" und
  „no" zurück, und der Veranstalter-Client zeigt das unübersetzt in seinem
  Detailpanel (NFR 4). Der Nutzer-Client benutzt sie deshalb **nicht** und
  buchstabiert das Häkchen selbst (`common.yes`/`common.no`); der fremde
  Bildschirm ist nicht Teil dieses Pakets und steht als Punkt in `todo.md`.
- **Eine Voraussetzung muss in der richtigen Reihenfolge zurückgesetzt werden.**
  Der Vertragstest schaltet beide Schalter aus und wieder ein — und das
  Zurücksetzen verweigert sich selbst, wenn es mit dem Abhängigen beginnt. Steht
  in `docs/rules/e2e-tests.md`.

Offen aus diesem Paket: nichts. `chat` bekommt seine Voraussetzung in **AP 6**,
zusammen mit seinem Modul — ein Deskriptor entsteht mit dem Code dahinter (E21),
und deshalb konnte AP 5 nur die eine Hälfte des Abnahmekriteriums zeigen.

### AP 6 — Gespräche, Nachrichten und Bilder (erledigt, 02.09.2026)

Umgesetzt:

- **`business/chat/` mit zwei Diensten und sechs Endpunkten.**
  `ConversationsService` besitzt die Zugangsregel, `MessagesService` die Zeilen
  und das Bild. `GET/POST /api/participant/conversations`,
  `GET/POST …/:id/messages`, `PUT …/:id/read` und
  `GET /api/media/messages/:id/attachment`. Der Gateway aus Spike 4 bleibt
  unangetastet — er wird in AP 7 echt.
- **Die Zugangsregel hat zwei Hälften, und sie sind nicht dieselbe Prüfung**
  (**F157**). Ein Gespräch **beginnen** fragt nach `searchable` — über den Port
  aus AP 5, der jetzt in `business/common/ports/` liegt, weil zwei Module ihn
  lesen (F100). Alles **danach** fragt nur nach Mitgliedschaft: wer den Schalter
  zurücknimmt, verschwindet aus der Suche und kann nicht neu angeschrieben
  werden, **laufende Gespräche bleiben lesbar und beantwortbar** (E14, E37) — für
  beide Seiten. Codes: 403 für jede Verweigerung des Beginns, wortgleich (F124);
  400 nur für die **eigene** Id; 404 für „nicht deins", mit dem Wortlaut einer
  unbekannten Id.
- **Zwei Menschen haben genau ein Gespräch, und das garantiert die Datenbank**
  (**F153**). `conversation.direct_key` mit `UNIQUE`, gesetzt genau für
  `type = 'direct'`; der Port fügt mit `ON CONFLICT DO NOTHING` ein und liest
  zurück. Die einzige Abweichung vom Schemaentwurf dieser Phase, und ihre
  Begründung ist eine Rennsituation, die der Entwurf nicht ausdrücken konnte.
- **Ungelesen wird gezählt, nie gespeichert** (E38, F56).
  `conversation_member.last_read_at` ist der einzige Zustand; die Zahl entsteht
  als korrelierte Unterabfrage in derselben Anweisung, die die Zeile liest — eine
  Abfrage je Seite, nicht je Zeile (F49). Gezählt wird nur, was **jemand anderes**
  geschrieben hat.
- **Der Verlauf paginiert über einen Cursor** (**F154**) — die eine Liste dieser
  Anwendung, die es tut, weil sie beim Lesen hinten wächst. `?before=<Id>`,
  Vergleich über `(created_at, id)`, `hasMore` statt `total`, und eine Id aus
  einem fremden Gespräch ergibt ein leeres Fenster statt eines Fehlers.
- **Eine Nachricht ist Text, Bild oder beides — nie nichts** (E40). 400 mit einem
  Satz, bevor `CHK_message_content` es sagen muss; ein Rumpf aus Leerzeichen ist
  nichts. Bild und Text kommen in **einer** Anfrage: `multipart/form-data`, Text
  im Feld `body`, Bild im Teil `image` — **ohne** `payload`-Teil, denn F39
  braucht einen nur, weil eine Anmeldung verschachtelte Felder hat. Derselbe
  Endpunkt nimmt reines JSON für eine Nachricht ohne Bild.
- **Das Bild ist ein `attachment` in einem eigenen Teilbaum** (**F155**).
  `messages/` als fünfter `FileArea`, `ImageFileService` als vierter Aufrufer
  seiner vier Prüfungen (F38) und erster mit einer **eigenen** Obergrenze (4 MB
  statt 512 KB: ein Logo ist Beiwerk, ein Chatbild kommt aus einer
  Telefonkamera). `registration_id` und `field_key` werden gemeinsam nullbar
  (`CHK_attachment_owner`), `CHK_attachment_area` hält die beiden Arten
  auseinander — und `GET /api/admin/attachments/:id` bedient seither **nur**
  Anmeldungsdateien, weil ein Veranstalter sonst mit einer Id an ein Bild aus
  einem privaten Gespräch käme.
- **Die eine Medienroute mit Berechtigung** (**F156**). Adressiert über die
  **Nachricht**, nicht über die Datei; Sitzung über `@RequiresParticipant()`,
  einen Dekorator, der nur verschärfen kann; ein wortgleiches 404 für „keine
  Nachricht", „kein Bild" und „fremdes Gespräch"; `private, immutable` ohne `?v=`,
  weil eine Nachricht nicht bearbeitet werden kann (E14). Der Veranstalter liest
  dieselben Bytes nicht hier — sein Fenster kommt mit AP 10, unter seinem Präfix.
- **Modulschalter `chat` mit Voraussetzung `profiles`** (E42) — womit die zweite
  Hälfte des Abnahmekriteriums von AP 5 jetzt geprüft ist. **Nicht**
  `profile-search` als Voraussetzung: ohne Verzeichnis lässt sich kein neues
  Gespräch beginnen, die bestehenden bleiben lesbar, und eine Voraussetzung hätte
  etwas Stärkeres und Falsches behauptet. Standardmäßig **an**, wie die beiden
  Nachbarn: niemand ist erreichbar, bis er `searchable` selbst einschaltet.
- **Migration `Conversations1787790700000`**: `conversation` (drei Arten, Form je
  Art als **ein** `CHECK`), `conversation_member` (Primärschlüssel aus drei
  Spalten, kein Fremdschlüssel auf `member_id` — E39), `message` (Index
  `(conversation_id, created_at DESC, id DESC)`, eindeutiger Index auf
  `attachment_id`), dazu die beiden neuen `attachment`-Constraints. `down`
  einmal von Hand gefahren, mit 4 Gesprächen, 22 Nachrichten und 10 Bildern in
  der Datenbank, und danach `up` wieder — beides fehlerfrei.

Nachweise: Server-Units **966** (+35), Vertragstests **495** (+32, alle
in der neuen Suite `api/chat.spec.ts`; die beiden Voraussetzungs-Tests in
`modules.spec.ts` decken jetzt beide Schlüssel ab),
`shared-models` **92** (+4), Nutzer-Client 141, Veranstalter-Client 169.
Browsersuiten grün: 203 (+1 übersprungen) und 280 (+26 übersprungen) — der
Veranstalter-Client zeigt die neue Zeile und ihre Voraussetzung, geprüft in
`modules.spec.ts`. Katalog **781** (`modules.chat.title`, en und de).
`nx run-many -t lint test build` über alle 13 Projekte fehlerfrei. Neue
Entscheidungen: **F153**–**F159**.

Was anders lief:

- **Zwei Constraints trafen sich, und zusammen sagen sie mehr** (**F158**).
  `message.attachment_id` ist `ON DELETE SET NULL`, damit eine gelöschte Datei
  keine Nachricht löscht; `CHK_message_content` verlangt Text oder Bild. Also
  lässt sich das Bild einer Nachricht **ohne** Text nicht löschen — die Zeile
  wäre leer. Gefunden hat es der Aufräumcode der Vertragssuite, nicht der
  Entwurf. Die Regel daraus ist eine Reihenfolge: Anhangs-Ids merken, Gespräch
  löschen, dann die Anhänge.
- **Der sechste Aufrufer zog die Paginierung um** (**F159**), und wie in AP 5 war
  der Fund nicht die Wiederholung, sondern der Drift: vier von fünf Kopien wiesen
  eine gebrochene Seitenzahl ab, die der Teilnehmerübersicht las `2.7` als Seite 2. Beobachtbar war das nie, weil jedes DTO `@IsInt()` trägt — und genau deshalb
  hielt es fünf Kopien durch. Jetzt `business/common/page-window.ts`.
- **Eine Route brauchte eine Sitzung, ohne es im Pfad sagen zu können.** Der
  Präfix für gespeicherte Bytes ist `/api/media` (E19), der Guard hängt am
  deklarierten Pfad (E33) — und ein Chatbild darf nicht öffentlich sein. Statt
  die Route zu verschieben oder einen Guard mit zwei Cookies zu bauen (was E34
  verbietet) gibt es `@RequiresParticipant()`: ein Dekorator, der **nur**
  verschärfen kann, weshalb er das Argument von F69 nicht aufhebt. Mit zwei
  Guard-Tests festgehalten.
- **Zwei Anmeldungen für drei Menschen.** Das Login-Budget ist instanzweit
  (20 je 5 min, E4) und die Kontosuiten verbrauchen schon vierzehn. Die dritte
  Person der Chat-Suite ist deshalb geseedet: sie ist auffindbar und meldet sich
  nie an, was für die Nichtmitglied-Fälle genügt — geschrieben wird **zu** ihr.
- **Rohes SQL für zwei Lesezugriffe.** Die Ungelesen-Zahl ist eine korrelierte
  Unterabfrage, die auf `cm.last_read_at` der äußeren Abfrage zeigt; ein
  Query-Builder, der aliasqualifizierte Namen umschreibt, ist für eine Abfrage,
  bei der genau das die Aussage ist, das falsche Werkzeug. Bewusste Ausnahme in
  dieser Schicht, mit Begründung an der Konstante.
- **Die Beispielzeile eines Tests war plötzlich falsch.**
  `core-module-registry.service.spec.ts` benutzte `chat` als Beispiel für „ein
  Schlüssel, dessen Deskriptor diese Version nicht ausliefert". Seit diesem Paket
  gibt es den Deskriptor. Umgestellt auf `newsletter` — den einen Schlüssel, der
  nie zurückkommt (F8).

Offen aus diesem Paket: **der Purge der Bilder eines Gesprächs.** Das Löschen
eines **Events** kaskadiert über `conversation` bis `message`, und eine Kaskade
löscht Zeilen, keine Dateien (E9). Gruppengespräche entstehen erst in **AP 10**,
also kann heute keine solche Zeile existieren; der Purge gehört dorthin, wo er
gegen eine echte Gruppe geprüft werden kann. Steht in `todo.md`, und die
Reihenfolge, die er braucht, steht in F158.

### AP 7 — Echtzeit (erledigt, 03.09.2026) → **Meilenstein M7**

Umgesetzt:

- **Der Handshake ist die Tür** (**F132**, E41). Die Prüfung hängt in einer
  socket.io-Namensraum-Middleware und läuft damit _während_ der Handshake
  stattfindet: eine Verbindung ohne gültige Sitzung entsteht nicht, sie kommt
  beim Client als `connect_error` mit dem Satz des Servers an. Gefragt werden
  Sitzung **und** `chat`-Schalter, in der Reihenfolge der HTTP-Seite — dieselbe
  Reihenfolge, aus der dort ein 401 vor einem 404 kommt. Die Sitzung löst
  `UserSessionService` auf, derselbe Dienst wie im globalen Teilnehmer-Guard;
  dafür importiert `ChatModule` seit diesem Paket `ProfilesModule`, und **nur**
  dafür. Ein Nest-`@UseGuards` auf einem Gateway wäre die späte Prüfung
  gewesen, die E41 ausschließt: es läuft je Nachricht.
- **Der Socket ist unter `/api` umgezogen** (**F160**). Das Sitzungscookie
  trägt `Path=/api`, also hängt ein Browser es an einen Handshake nur innerhalb
  dieses Pfades — die Entscheidung aus Spike 4, den Standardpfad zu behalten,
  war nach E41 nicht mehr haltbar. `REALTIME_PATH` in `shared-models` ist die
  eine Schreibweise für Server, beide Clients, den Proxy und das Prüfskript;
  im Reverse Proxy steht dafür `location /api/socket.io/`, das nach der
  Längster-Präfix-Regel vor `/api/` gewinnt, und in beiden Dev-Proxys eine
  Regel **vor** `/api` (die Reihenfolge entscheidet dort).
- **Zwei Räume, zwei Fragen** (**F161**). `conversation:<id>` trägt die Zeile
  und wird nur auf `chat:join` betreten, nur von einem Mitglied — entschieden
  von demselben Dienst, der es für den REST-Verlauf entscheidet, über seinen
  nicht werfenden Zwilling, sodass „nicht deins“, „gibt es nicht“ und „ist
  keine Id“ ein `{ joined: false }` sind (F157). `member:user:<id>` wird am
  Handshake betreten, ohne Prüfung: ein Socket muss nicht fragen, um über sich
  selbst informiert zu werden. Daher zwei Ereignisse — `chat:message` für einen
  offenen Verlauf, `chat:conversation` für die Liste, die auch von einem
  Gespräch erfahren muss, das niemand offen hat. Beide Raumnamen tragen ein
  Präfix, weil in socket.io jeder Socket ein Raum mit seiner Id ist.
- **Zugestellt wird von einem eigenen Dienst** (**F162**). `ChatRealtimeService`
  weiß nichts über Mitgliedschaft und hängt an nichts, weshalb der Kreis
  „Gateway braucht Gespräche, Gespräche brauchen Zustellung“ gar nicht entsteht
  und kein `forwardRef` nötig ist. Er nimmt vom Gateway einen schmalen
  Ausschnitt des Namensraums (`to(room).emit(…)`) statt des ganzen Objekts.
  Speichern ist verbindlich, Zustellen ist bestes Bemühen: ein Fehler beim
  Senden wird protokolliert, nicht zur Antwort — und zugestellt wird **außerhalb**
  der Kompensation, weil das Bild verworfen wird, wenn die Zeile scheiterte,
  und eine Zustellung eine geschriebene Zeile nicht zurücknehmen kann.
- **Die Empfänger kommen aus dem Schreiben** (**F163**). `append` antwortet mit
  der Zeile **und** den Mitgliedern, gelesen in derselben Transaktion. Ein
  `membersOf(conversationId)` am Port hätte genau die Fähigkeit hinzugefügt,
  die dieser Port bewusst nicht hat (F152): „wer schreibt mit wem“, für jede
  Id, für jeden Aufrufer. Lesebestätigungen brauchen sie nicht — dort ist der
  Leser der Fragende.
- **`chat:echo` kommt nirgends mehr vor.** Der Handler, `ChatEchoReply`,
  `RealtimeClient.echo`, der Knopf auf der Diagnoseseite und `verify-socket.mjs`
  sind weg. Der Client hat stattdessen die Oberfläche, die AP 8 braucht:
  `join`/`leave`, drei Ströme und ein Verbindungszustand — dazu ein Gedächtnis,
  das nach einem Reconnect wieder betritt, was gefolgt wurde, denn ein neuer
  Socket ist in keinem Raum. Abschnitt 4 der Diagnoseseite sagt jetzt, was eine
  Verbindung voraussetzt, statt eine Antwort zu messen, die es nicht mehr gibt.
- **`verify-chat.mjs` prüft den Satz des Abnahmekriteriums.** Zwei Konten über
  die API und Mailpit, zwei Sockets, eine Nachricht über REST — und die Frage,
  ob sie bei beiden ohne Neuladen ankommt, gestellt **durch den Proxy**. Es
  räumt hinterher auf (Gespräch, dann Konten — die Reihenfolge aus F158) und
  braucht dafür `docker exec`, weil es für ein Teilnehmerkonto bewusst keinen
  Löschendpunkt gibt. `verify-proxy.mjs` behält seine Socket-Prüfung und hat
  dafür jetzt das bessere Sondierungsmittel: die **Ablehnung** ohne Cookie ist
  der Satz des Servers, angekommen über den Socket — also derselbe Beweis, den
  das Echo geliefert hat, ohne einen Handler, der nur für den Test existiert.
- **Migration: keine.** Das Paket hat kein Schema angefasst — die einzige
  Ausnahme unter den bisher sieben, und die Erklärung steht in AP 6: die
  Tabellen des Chats sind von der ersten Migration an vollständig, damit für
  Echtzeit kein zweiter Durchgang durchs Datenmodell nötig wird (E40).

Nachweise: Server-Units **996** (+30), Vertragstests **508** (+13, alle in der
neuen Suite `api/chat-realtime.spec.ts`), `shared-models` **95** (+3),
`shared-http` **30** (+13 — `RealtimeClient` hatte keinen Test), Nutzer-Client
141, Veranstalter-Client 169. Browsersuiten grün: **203** (+1 übersprungen) und
**280** (+26 übersprungen). Katalog **780** — zum ersten Mal **kleiner**: zwei
Schlüssel des Echos sind weg, einer für die Voraussetzung einer Verbindung ist
dazugekommen. `nx run-many -t lint test build` über alle 13 Projekte fehlerfrei.
Neue Entscheidungen: **F132**, **F160**–**F164**.

**Und am laufenden Stack, weil der wichtigste Satz des Abnahmekriteriums es
verlangt.** Fünf Container gebaut und gestartet
(`docker compose -f infra/docker-compose.yml -p trefaro-ap7 up -d --build`,
Mailpit an dessen Netz gehängt), dann durch NGINX:
`verify-chat.mjs` **14 von 14 grün** — Handshake ohne Cookie abgewiesen mit dem
Satz des Servers, beide Sitzungen verbunden auf `websocket`, ein fremder Raum
verweigert, die Nachricht bei **beiden** ohne Neuladen, beide über die Bewegung
ihrer Liste informiert, die Lesebestätigung bei der anderen Seite; danach hat
das Skript seine zwei Konten und das Gespräch wieder gelöscht.
`verify-proxy.mjs` vollständig grün, inklusive der drei neuen Socketzeilen.
Dabei fiel eine Kleinigkeit auf, die zum Umzug gehört: `ngsw-config.json` schloss
`/socket.io/**` von den Navigationsadressen aus — eine Adresse, die es nicht mehr
gibt. Der neue Pfad liegt unter dem `!/api/**`, das schon dort steht; die alte
Zeile ist weg und `verify-proxy.mjs` prüft jetzt `/api/socket.io/`. (Ein Service
Worker fängt ohnehin keine WebSocket-Verbindung ab, es war also nie ein Risiko,
sondern eine falsche Behauptung in einer Datei, die man beim nächsten Umzug
liest.) **Und im Entwicklungsmodus von Hand:** `nx serve server` plus
`nx serve user-client`, ein Socket-Client gegen `http://localhost:4200` mit
`path: /api/socket.io` — die Ablehnung kommt über `websocket` zurück, also
leitet auch der Dev-Proxy das Upgrade an der neuen Adresse weiter. Das war die
eine Stelle, die keine Suite dieses Repositories anfasst: die Regel steht in
den Dev-Proxys **vor** `/api`, und wäre sie es nicht, hätte AP 8 einen Chat
gebaut, der nur im Container funktioniert.

Was anders lief:

- **Der Plan nannte den Pfad, das Cookie widersprach.** Die API-Tabelle oben
  sagt „Socket `/socket.io`“, und das kann mit E41 nicht funktionieren: das
  Sitzungscookie gilt für `/api`, also reist es an einen Handshake auf
  `/socket.io` nicht mit. Aufgefallen, bevor eine Zeile Gateway geschrieben war,
  und beantwortet mit F160 — die Tür muss dort stehen, wo der Schlüssel passt.
  Die Alternativen wären gewesen, das Cookie auf `Path=/` zu erweitern (die
  Sitzung reist dann mit jedem Bild) oder das Token in die Query zu geben (dann
  ist es für JavaScript lesbar, also nicht mehr `HttpOnly`).
- **Der Kreis war vor dem ersten Test da.** Gateway → Gespräche → Zustellung →
  Gateway; Nest hätte ein `forwardRef` verlangt, und die Regel dagegen steht
  seit F103 im Repository. Die Auflösung war nicht ein Ausweg, sondern eine
  Frage: was ist das Geteilte? „Emit in einen Raum“, und das kennt keine
  Mitgliedschaft (F162).
- **AP 6 hatte eine Kopie stehen gelassen — in dem Paket, das die Regel
  ausgelöst hat.** `pageWindow` zog aus, weil der Chat der sechste Aufrufer war
  (F159), und `conversations.service.ts` behielt trotzdem seine eigenen
  `positive`/`clamp`. Beobachtbar war nichts, die Zahlen waren gleich — aber es
  war die siebte Kopie, und sie stand ausgerechnet dort. Jetzt benutzt der Chat
  den Helfer, den er verursacht hat.
- **Eine Zusicherung, die auf der Seitenleiste grün wurde.** Die
  Teilnehmerübersicht der Veranstalter-Suite prüfte
  `getByRole('complementary')` **ohne Namen** — und auf dieser Seite gibt es
  zwei Landmarken dieser Rolle: die Seitenleiste der Arbeitsfläche und das
  Detailfeld. Solange das Feld noch nicht offen war, traf der Locator nur die
  Seitenleiste, und die enthält den Navigationseintrag „Profilformular“, in dem
  das gesuchte Wort „Profil“ steckt. War es offen, war es eine
  Strict-Mode-Verletzung. Also mal grün aus dem falschen Grund, mal rot — genau
  die Klasse, die F149 schon einmal getroffen hat („eine Zusicherung über eine
  Tabellenzelle muss eine Zelle sein“). Der Nachbartest in derselben Datei
  wusste die Antwort bereits und benennt seine Landmarke; diese Zeile tut es
  jetzt auch.
- **Drei Sitzungen und keine Anmeldung** (**F164**). Die Echtzeit-Suite braucht
  beide Seiten eines Gesprächs und eine dritte Person, die außen steht — bei
  sechzehn vergebenen Anmeldungen von zwanzig je fünf Minuten (E4) wären das
  neunzehn gewesen. Eine Sitzung ist eine Zeile mit dem SHA-256 des
  Cookie-Werts, also schreibt die Suite sie: `seedSession` neben `seedProfile`.
  Was das aufgibt, führt `chat.spec.ts` mit echten Anmeldungen schon.
- **`extraHeaders` trägt das Cookie nur außerhalb des Browsers.** Beide
  Prüfwege — Vertragssuite und Skript — sind Node-Clients und müssen das Cookie
  selbst setzen; im Browser hängt es der Browser an, und genau deshalb steht
  F160 dort, wo es steht. Hätte der Weg nicht funktioniert, wäre das Paket ohne
  automatisierten Nachweis für den wichtigsten Satz seines
  Abnahmekriteriums geblieben.

- **Die CI des AP-6-Pushes war rot, und beide Gründe gehören hierher.** Der
  eine ist die Landmarke von oben: dieselbe Zeile, dieselbe
  Strict-Mode-Verletzung, und Playwrights Fehlermeldung nennt die Lösung sogar
  selbst (`getByRole('complementary', { name: 'Amina Okonkwo' })`). Der andere
  ist der `quality`-Job: `nx format:check` beanstandete `todo.md` — obwohl
  `nx format:write --uncommitted` vor dem Commit gelaufen war und die Datei
  **aufgelistet** hatte. Nachgestellt: `--uncommitted` schreibt sie nicht,
  gestaged wie ungestaged; `--files todo.md` und `prettier --write` schon. Das
  Tor ist also `nx format:check`, und das steht jetzt in
  `docs/rules/tooling-traps.md`.

Offen aus diesem Paket: **der Handshake trägt keine Drosselung.**
`@nestjs/throttler` sieht HTTP-Routen, und ein socket.io-Handshake wird von
engine.io bedient, bevor Nests Router ihn sieht — die eine Anfrage, die jetzt
eine Sitzungsauflösung kostet, ist damit die eine, die nichts zählt. Gehört zur
konfigurierbaren Drosselung, die Phase 5 ohnehin owed; steht in `todo.md` und
in den offenen Punkten von Spike 4.

### AP 8 — Chat im Nutzer-Client (erledigt, 03.09.2026)

Umgesetzt:

- **Zwei Seiten, zwei Wächter.** `/messages` ist die Gesprächsliste,
  `/messages/:id` das Gespräch; beide hinter `participantSessionGuard` **und**
  `chatGuard` — dem Zwilling von `profileSearchGuard`, aus demselben Grund
  (F53, E42): die Sitzung entscheidet, ob jemand die Seite sehen darf, der
  Schalter, ob es sie auf dieser Instanz gibt. Ein Lesezeichen, das den
  Schalter überlebt, landet auf der Startseite und nicht in einer Liste, die
  auf 404 wartet. Der Navigationseintrag hängt an derselben Bedingung.
- **Der Weg hinein ist die Teilnehmersuche** (E37). Der Knopf „Nachricht
  schreiben" steht auf dem fremden Profil — dort, wo jemand sich entscheidet,
  eine Person anzusprechen —, und weil `POST /api/participant/conversations`
  idempotent ist (F153), heißt er „zu unserem Gespräch" und nicht „ein neues
  anfangen". Sein **403 ist eine Rücknahme, kein Fehler**: dieselbe
  Zurücknahme, die ein Profil aus der Suche nimmt, macht es unerreichbar — ein
  Schalter, zwei Wirkungen —, also bekommt er einen eigenen Satz und keine
  Fehlermeldung.
- **Eine Route mehr am Server, aber keine Fähigkeit mehr** (**F165**).
  `GET /api/participant/conversations/:id` gibt die Zeile, die die Übersicht
  zeichnet, für eine Id. Die Gesprächsansicht braucht sie, um zu sagen, wessen
  Gespräch sie zeigt: der Verlauf trägt Nachrichten, und ein Name je Nachricht
  hieße, die Mitglieder in jede Zeile zu kopieren. Beantwortet wird sie von
  `ConversationRepository.overviewFor`, das die Frage seit AP 6 kann und die
  Mitgliedschaft in derselben Anweisung führt (F152) — es kommt also eine
  Route dazu, keine Portmethode. Aus der Liste hätte ein Client sich blättern
  müssen, und die Seite, auf der eine Zeile steht, ändert sich mit jeder
  Nachricht. „Nicht deins" ist derselbe 404 wie eine unbekannte Id (F157).
- **Der Socket gehört der Sitzung, nicht dem Bildschirm** (**F166**).
  `ChatConnection` hängt in der Shell und verbindet, solange jemand angemeldet
  ist und `chat` an ist; abgemeldet wird getrennt. Zwei Gründe, und der zweite
  ist der wichtige: die Liste muss sich bewegen, während jemand ein Event
  liest (dafür ist der Mitgliedsraum aus F161 da, betreten am Handshake) — und
  **eine Verbindung je Seite hätte E44 gebrochen.** Push geht nur raus, wenn
  das Mitglied keinen offenen Socket **in diesem Gespräch** hat; wäre die
  Verbindung an den Chatbildschirm gebunden, hieße „sieht jemand zu?" nur noch
  „ist der Chat offen?". Der Raum des Gesprächs wird deshalb allein von der
  Gesprächsansicht betreten.
- **Eine gesendete Nachricht kommt zweimal an und wird einmal gezeichnet**
  (**F167**). Die Antwort des POST macht das Senden unmittelbar, der Socket
  macht es richtig — beide Wege laufen durch dasselbe Einfügen, das über die
  **Id** entscheidet und danach nach `(created_at, id)` sortiert, also nach
  demselben Schlüssel wie der Cursor (F154). Nicht zuzuhören wäre die
  Alternative gewesen: dann fehlte nach einem Reconnect genau die eigene Zeile.
- **Der Verlauf wird einmal umgedreht, hier.** Der Endpunkt antwortet neueste
  zuerst, weil das das Ende ist, von dem ein Cursor zurückblättert; ein
  Gespräch liest sich nach unten. Alles danach — anhängen, voranstellen,
  entdoppeln — arbeitet in der Reihenfolge, die ein Leser sieht.
- **Lesen ist Ansehen** (E38). Geöffnet wird als gelesen markiert, und eine
  Zeile, die ankommt, während der Verlauf offen ist, ebenfalls — nur nicht die
  eigene, denn eine Lesebestätigung für sich selbst ist eine Anfrage, die
  nichts ändert. Der Zähler in der Liste ist damit weg, wenn jemand
  zurückkommt.
- **Die Liste frischt das Fenster auf, das auf dem Bildschirm steht**
  (**F170**). `chat:conversation` trägt bewusst keine Zeile (F161), weil
  „ungelesen" ohnehin neu gezählt werden muss — also fragt die Seite noch
  einmal, mit **einer** Anfrage über so viele Zeilen wie gezeigt werden
  (gedeckelt auf die 50 des Endpunkts), und mischt über die Id. Ohne das
  Mischen stünde eine Zeile, die nach oben gesprungen ist, auch noch an ihrem
  alten Platz.
- **Bildversand mit Vorschau** (E40). Gewählt wird, dann gesendet — die
  Vorschau ist die letzte Gelegenheit, das zu sehen, was alle sehen werden, und
  eine Nachricht ist danach nicht bearbeitbar (E14). Typ und Größe werden
  vorher lokal geprüft (F38 prüft der Server ohnehin, an den ersten Bytes): wer
  auf dem Telefon ein 12-Megapixel-Foto wählt, erfährt es vor dem Upload und
  nicht danach. Das Bild einer fremden Nachricht zeichnet ein `<img>` auf die
  Medienroute — das Sitzungscookie reist mit, weil die Route unter `/api`
  liegt, also aus demselben Grund, aus dem der Socket dort wohnt (F156, F160).
- **Ein Zeitstempel im Chat gehört seinem Leser** (**F168**). Format folgt der
  Sprache des Lesers (F78) — die **Zone** aber ist hier seine eigene und nicht
  die eines Events (E8): eine Nachricht gehört zu keinem Event, und „18:40"
  heißt die Uhrzeit auf dem Telefon, das sie zeigt. Kein „heute"/„gestern",
  obwohl jeder Messenger es hat: das wären zwei Katalogschlüssel und ein
  Tagesbegriff, der veraltet, während der Bildschirm offen ist — die
  Tagesüberschrift beantwortet dieselbe Frage in einer Form, die auf jeder
  Zeile gleich ist.
- **Der Verbindungszustand ist ein Bauteil, und er lügt nicht** (**F169**).
  `trefaro-live-status` sagt auf beiden Seiten einen von vier Sätzen: es kommt
  von selbst an, wird verbunden, keine Live-Verbindung, oder — nur in der
  Gesprächsansicht — dieses Gespräch wird nicht live aktualisiert, wenn der
  `join` abgelehnt wurde. Denn ein Chat, der still die Verbindung verloren hat,
  sieht genauso aus wie ein Chat, in dem niemand schreibt. Dazu ist der
  Handshake-Timeout des Clients von socket.ios zwanzig auf **acht Sekunden**
  gesetzt: zwanzig Sekunden „wird verbunden" sind ein verschwiegener
  Fehlschlag, und der ehrliche Satz ist einer, mit dem jemand etwas anfangen
  kann.
- **`initialsOf` ist ausgezogen** (F138, vierte Kopie). Profilbildwähler,
  Suche, fremdes Profil und jede Zeile des Chats zeichnen denselben Kreis; die
  Regel liegt jetzt in `features/profiles/initials.ts` und nimmt die **Felder**
  statt eines Strings, damit ein zweiteiliger Vorname nicht den Nachnamen
  verdrängt.
- **Katalog: 37 Schlüssel mehr**, Englisch und Deutsch (`chat.*` und die drei
  `people.detail.write*`), 780 → **817**.
- **Migration: keine.** Das zweite Paket der Phase ohne Schemaänderung, und aus
  demselben Grund wie AP 7: die Tabellen des Chats sind seit AP 6 vollständig
  (E40).

Nachweise: Nutzer-Client **208** (+67), Server-Units **999** (+3),
Vertragstests **512** (+4, alle in `api/chat.spec.ts`), `shared-http` 30,
`shared-models` 95, Veranstalter-Client 169. Browsersuiten grün: **209**
(+6, ein übersprungener) und **280** (+26 übersprungene).
`nx run-many -t lint test build` über alle 13 Projekte fehlerfrei.
Neue Entscheidungen: **F165**–**F170**.

**Die Browsersuite dieses Pakets fährt das Abnahmekriterium als einen Gang**
(`apps/user-client-e2e/src/chat.spec.ts`), **auf einem Telefon**: Viewport
390 × 844, Suche → fremdes Profil → „Nachricht schreiben" → Gespräch, Text und
Bild in einer Nachricht, und das Bild wird nicht nur _sichtbar_, sondern über
`naturalWidth > 0` als _angekommen_ geprüft (ein kaputtes Bild ist auch
sichtbar, und die Medienroute ist die eine mit Berechtigungsprüfung). Danach
antwortet **die andere Seite über HTTP aus dem Testprozess**, mit ihrer eigenen
geseedeten Sitzung — nichts im Browser hat danach gefragt, und die Zeile muss
trotzdem erscheinen. Das ist der Live-Nachweis **durch den Dev-Proxy**, also
über die eine Stelle des Socketpfads, die AP 7 nur von Hand belegen konnte.
Dann: der Zähler erscheint, wenn die nächste Nachricht kommt, während die Liste
offen ist, und verschwindet durch Lesen. Und zuletzt prüft die Seite, dass auf
diesem Telefon nichts seitlich heraussteht. **Kein Login** in der ganzen Datei
(F164): drei Konten pro Engine sind geseedet, das Cookie legt
`signInWithSeededSession` in den Kontext — bei zwanzig Anmeldungen je fünf
Minuten für die ganze Instanz wären drei Engines × ein Login der Tropfen, der
eine fremde Suite mit 429 rot macht.

Was anders lief:

- **Die Gesprächsansicht konnte nicht sagen, mit wem sie ist.** Der Plan nennt
  „Gesprächsansicht mit Verlauf und Nachladen" — und die fünf Endpunkte aus
  AP 6 geben für eine Id keinen Gesprächskopf her: `POST` antwortet mit einer
  Zusammenfassung, `GET` nur mit einer Seite der Liste. Die Alternativen waren,
  die Zeile über den Router-State mitzugeben (nach einem Reload weg) oder die
  Liste zu durchblättern (die Seite einer Zeile ändert sich mit jeder
  Nachricht). Also eine Route mehr, F165 — der Port konnte die Frage schon.
- **Ein `FormData.set` mit drittem Argument kopiert die Datei.** Der erste
  Entwurf gab `message.image.name` mit, und der Test verglich die Identität der
  Datei: `File` in, anderes `File` drin. Eine `File` trägt ihren Namen selbst,
  das dritte Argument ist für `Blob` da. Steht in
  `docs/rules/angular-clients.md`, weil der nächste Upload es wieder tut.
- **Die Regel gegen Backticks in Template-Kommentaren hat sich sofort
  bezahlt.** Ein Kommentar im Verlaufs-Template erklärte, dass das Cookie für
  `/api` gilt — mit Backticks um den Pfad, was das Template-Literal beendet.
  Der Compiler meldete daraufhin `TS2362` und „Cannot find name 'api'" an einer
  Zeile weit davor; die Datei in `docs/rules/` nennt genau diese Klasse, und
  der Fehler war in einer Minute gefunden statt in einer halben Stunde.
- **`setOffline` kappt keine offene WebSocket-Verbindung.** Der erste Versuch,
  den Verbindungsverlust im Browser zu zeigen, schaltete das Netz ab: der
  Offline-Banner erschien sofort (F20), der Socketstatus blieb aber zehn
  Sekunden lang „es kommt von selbst an" — richtig, denn eine bestehende
  Verbindung merkt den Ausfall erst am Heartbeat, und der braucht bis zu 45 s.
  Zwei Erkenntnisse daraus: die zwei Banner sind **nicht** dasselbe (Netz und
  Socket), und geprüft wird der Fehlschlag, den Spike 4 gemeint hat — ein Proxy,
  der das Upgrade weiterleitet und dann alles schluckt. Das stellt
  `page.routeWebSocket` mit einem Handler ohne `connectToServer` nach, und dass
  der Client es in acht statt zwanzig Sekunden zugibt, ist F169.
- **Eine Suite des Veranstalter-Clients war einmal rot und im zweiten,
  cachefreien Lauf grün** — welche, ist nicht mehr feststellbar: der
  Playwright-Report hält nur den letzten Lauf, und die Ausgabe des ersten war
  schon durchgelaufen. Nicht weggelassen, sondern hiermit protokolliert; falls
  es wiederkommt, ist der Verdacht dieselbe Klasse wie die Landmarke aus AP 7.

Offen aus diesem Paket: **die Navigation trägt keinen Ungelesen-Zähler.** Wer
gerade nicht auf `/messages` steht, erfährt von einer neuen Nachricht erst
dort — oder, ab AP 11, per Push (E44 ist genau dafür da, und F166 ist die
Voraussetzung). Ein Zähler in der Leiste bräuchte die Summe ohne die Seite,
also eine Anfrage bei jedem Anmelden; die Entscheidung gehört zum Pilotpartner
und steht in `todo.md`. **Gruppen** sieht diese Oberfläche schon (Titel,
mehrere Gegenüber), **angelegt** werden sie in AP 10.

### AP 9 — Organisator-Kontakt ohne Registrierung (erledigt, 03.09.2026)

Umgesetzt:

- **Ein Formular auf der Landingpage, ohne Konto und ohne Login** (FR 3.4,
  UC 14). `trefaro-event-contact-form` steht hinter dem Anmeldeknopf: erst der
  Weg, den die meisten Leser suchen, dann der für die, die eine Frage haben.
  Ein eigenes Bauteil und kein weiterer Block in der Landingpage — die hat
  schon 648 Zeilen, und hier hängen ein Formular, eine Anfrage, drei Zustände
  und eine eigene Spezifikation dran. Drei Felder (Name, Adresse, Nachricht),
  die Grenzen als `maxlength` **aus `shared-models`**, damit niemand fünf
  Minuten tippt und ein 400 bekommt; `<fieldset [disabled]>`, solange die
  Anfrage läuft (sonst verlöre der Weitertippende sein Getipptes beim Reset);
  und danach **ein Zustand statt einer Meldung**: „die Antwort kommt an
  ⟨Adresse⟩" plus der Knopf für die nächste Frage. Der Satz ist das
  eigentliche Ergebnis — F11 verspricht die Antwort per Mail, und ein „danke"
  ohne Adresse verspricht nichts.
- **Sichtbar auch für ein Event, das vorbei ist** — anders als der
  Anmeldeknopf. „Wo ist die Aufzeichnung" ist eine Frage zu etwas, das
  stattgefunden hat; der Server prüft dieselbe Sichtbarkeit wie die
  Landingpage (`getPublic`, also 404 für einen Entwurf, F26) und **nicht** das
  Datum.
- **Ein Endpunkt, immer dieselbe Antwort** (E10).
  `POST /api/user/series/:seriesSlug/events/:eventSlug/contact` antwortet
  **202** mit der Adresse, die der Aufrufer selbst geschickt hat. Es gibt hier
  keinen Zweig, der eine bekannte von einer unbekannten Adresse unterscheiden
  **könnte**: nichts wird gegen die Konten oder die Anmeldungen nachgesehen.
  Eigene Drosselung (30 je 5 min), weil `/api/user/**` für jeden erreichbar ist
  (E4) — enger als die 60 des Anmeldeformulars, denn eine angenommene Anfrage
  schreibt in die Übersicht der Organisation **und** schickt ihr eine Mail.
- **Das Gespräch einer Kontaktanfrage** (**F133**): `organizer_contact`, die
  Adresse auf dem Gespräch statt auf einer erfundenen Kontozeile (E39), die
  erste Zeile mit `sender_type = 'guest'` ohne `sender_id`, das **Event** ja
  und ein **Betreff** nein — worum es geht, ist das Event —, und **je Anfrage
  ein eigenes Gespräch**, weil nichts die Adresse authentifiziert.
  `createOrganizerContact` schreibt beides in **einer** Transaktion: eine
  `organizer_contact`-Zeile ohne Nachricht sagt nur, dass jemand einen Knopf
  gedrückt hat.
- **Und keine Mitgliedszeile für die Veranstalterseite** (auch F133). Die
  Organisation ist keine Person: `member_type = 'admin'` müsste eine
  Administratorzeile nennen, und beim Kontaktformular ist niemand angemeldet.
  Die **Art** des Gesprächs sagt, wessen es ist. Nebenwirkung, die AP 10 kennen
  muss: für die Veranstalterseite gibt es damit kein `last_read_at` und keine
  gerechnete Ungelesen-Zahl — sein Abnahmekriterium braucht sie nicht, und wenn
  sie kommt, ist sie eine Zeile mehr und keine andere Entscheidung. Ein
  Teilnehmer sieht diese Gespräche nicht: seine Liste kommt aus der
  Mitgliedschaft, und die gibt es hier nicht.
- **Das Kontaktformular hängt nicht am `chat`-Schalter** (**F171**). FR 3.4 ist
  P1, der Chat ein abschaltbares P2-Modul, und `chat` setzt `profiles` voraus
  (E42): eine Instanz ohne Teilnehmerkonten wäre mit dem Schalter davor **nicht
  erreichbar**. Der Schalter entscheidet, ob die Menschen **in** einer Instanz
  einander schreiben dürfen — nicht, ob die Organisation angeschrieben werden
  kann. Der Code liegt trotzdem in `business/chat/`, weil dieses Modul die
  Gespräche besitzt; ein zweites Modul mit demselben Port hätte den Port nach
  F100 nach `business/common/ports/` verschoben, ohne dass etwas daran richtiger
  geworden wäre. Deshalb trägt dieser eine Controller kein
  `@CoreModuleController(CHAT_MODULE_KEY)` — und das steht als Absatz in seinem
  Kopf, damit es niemand „nachträgt".
- **Kein Bild.** Der einzige Endpunkt des Chats, der keines nimmt: E40 gilt für
  Nachrichten mit einem Konto dahinter, und ein öffentlicher Endpunkt, der
  Bytes von Unbekannten annimmt, wäre eine zweite Uploadfläche für nichts. Aus
  demselben Grund ist er JSON und nicht `multipart` — eine unbekannte
  Eigenschaft im Rumpf ist ein 400 (`forbidNonWhitelisted`), was der
  Vertragstest ausnutzt.
- **Die siebte Mail** (**F172**). Sie geht an die **Kontaktadresse der Reihe** —
  die Adresse, die die Reihenseite schon öffentlich als `mailto:` zeigt —, sonst
  an die Mailbox aus `SMTP_FROM` (ohne Anzeigenamen), und dann steht im Log,
  dass die Reihe keine hat. Sprache: die **Vorgabe der Instanz**, weil der
  Empfänger kein Konto hat (F125); Inhalt in derselben Sprache, weil er in der
  Rückruffunktion geholt wird. Sie **grüßt niemanden** — das einzige `mail.`
  ohne `mail.greeting`, denn ein geteiltes Postfach hat keinen Vornamen. Der
  Text des Gasts wird maskiert wie die Absätze einer Einladung: das ist die
  einzige Mail, deren Inhalt ein **Fremder** geschrieben hat. Und **an den Gast
  geht keine Mail** — der einzige Brief dieses offenen Endpunkts landet im
  eigenen Postfach der Organisation, er taugt also nicht dazu, Fremden Mail zu
  schicken. Scheitert er, bleibt die Anfrage gespeichert und die Antwort 202
  (ein 503 wäre die Auskunft, die E10 verbietet).
- **`PublicLinks` kennt jetzt zwei Ursprünge.** `adminUrl(path)` für die eine
  Mail, die an die Organisation geht — gebaut über dasselbe `publicUrl`, weil
  genau eine der beiden konfigurierten Adressen auf einen Schrägstrich enden
  wird.
- **Katalog: 17 Schlüssel mehr**, Englisch und Deutsch (fünf `mail.contactRequest.*`,
  zwölf `contact.*`), 817 → **834**. Damit sind es sieben Mails und 35
  `mail.`-Schlüssel.
- **Migration: keine.** Das dritte Paket der Phase ohne Schemaänderung, und
  dieses ohne jeden Zweifel: `CHK_conversation_shape` hat die Gestalt, die AP 9
  gewählt hat, schon in AP 6 erlaubt — Event und Betreff waren dort ausdrücklich
  offen gelassen, und `guest_email`/`guest_name` sind seit derselben Migration
  da.

Nachweise: Server-Units **1017** (+18: elf für den Dienst, sieben für die Mail),
Vertragstests **520** (+8, `api/organizer-contact.spec.ts`), Nutzer-Client
**217** (+9), Browsersuite des Nutzer-Clients **218** (+9 — drei Tests × drei
Engines, ein übersprungener), Browsersuite des Veranstalter-Clients unverändert
**280** (26 übersprungene, diesmal ohne den unbestimmten Flake aus AP 8),
Veranstalter-Client-Units und die übrigen Bibliotheken unverändert.
`nx run-many -t lint test build` über alle 13 Projekte fehlerfrei. Neue
Entscheidungen: **F133**, **F171**, **F172**.

**Der Vertragstest entscheidet den Teil, der eine Regel ist**, nicht eine
Runde: dass eine bekannte Adresse (ein geseedetes Konto) und eine unbekannte
dieselbe Antwort bekommen; dass die Antwort auch dieselbe bleibt, wenn die
Benachrichtigung nirgends hingehen kann; dass ein Entwurf 404 ist und **nichts**
speichert; dass die Zeile die Gestalt aus F133 hat, Mitgliederzahl **0**
inklusive; und dass das Formular arbeitet, **während `chat` aus ist** — samt der
Gegenprobe mit einer geseedeten Sitzung, dass `/api/participant/conversations`
in demselben Moment 404 antwortet (ohne Cookie wäre es 401, und das bewiese
nichts, weil der Teilnehmer-Guard global vor dem Controller-Guard läuft).
Die Browsersuite fährt den Gang: Landingpage → Formular ausfüllen → abschicken
→ der Satz mit der Adresse → **die Mail in Mailpit**, mit dem Betreff des
Events, dem Namen und dem Text des Gasts.

Was anders lief:

- **„Das Gespräch taucht in der Übersicht auf" ist nur zur Hälfte prüfbar** —
  die Übersicht **ist** AP 10. Geprüft ist deshalb die Zeile in der Gestalt, die
  AP 10 lesen wird (Art, Event, Adresse, Gastnachricht, keine Mitgliedszeile),
  plus die Benachrichtigungsmail, die genau dafür da ist, dass niemand auf einen
  Bildschirm warten muss. Der Bildschirm selbst ist AP 10s Abnahmekriterium, und
  dessen Suite muss ihn zeigen. Nicht als erfüllt gebucht, sondern hier benannt.
- **Die längste Entscheidung war die Mitgliedszeile**, nicht das Formular. Die
  Alternative wäre gewesen, beim Anlegen für **jeden** Administrator eine
  `conversation_member`-Zeile zu schreiben; sie scheitert an beidem, was Zeit
  hat: wer morgen dazukommt, sähe die Anfrage von heute nicht, und `member_id`
  hat keinen Fremdschlüssel (E39), also bliebe die Zeile eines gelöschten Kontos
  stehen. Die Art des Gesprächs kostet nichts und altert nicht.
- **Der Handlungsknopf der Mail zeigt auf den Client, nicht auf das Gespräch.**
  Ein Deep-Link in eine Übersicht, die es noch nicht gibt, wäre ein Versprechen
  über einen Bildschirm — also `ANSWER_PATH = '/'`, eine Konstante mit dem
  Grund darüber, und ein Eintrag in `todo.md` für AP 10.
- **`waitForMailTo` musste den Rumpf lesen können.** Drei Browserengines, ein
  Postfach, ein Betreff: die Empfängerin dieser Mail ist die Organisation und
  nicht die Person, die der Test spielt — die Kopfzeilen unterscheiden die drei
  Nachrichten also gar nicht. Der Helfer nimmt jetzt zusätzlich ein `text`-Muster
  und holt die Rümpfe nur für die Nachrichten, die Adresse und Betreff schon
  gefiltert haben. Steht in `docs/rules/e2e-tests.md`.
- **Die Fixtur-Reihe der Browsersuite hat jetzt eine Kontaktadresse.** Ohne sie
  ginge die Benachrichtigung an die Absenderadresse der Instanz, und die könnte
  die Suite nur aus der Konfiguration erraten. Aufräumen muss die Suite nichts:
  eine Kontaktanfrage hängt an ihrem Event (`FK_conversation_event ON DELETE
CASCADE`), und der globale Teardown entfernt die geseedete Reihe mit allem
  darunter — Anmeldungen legt diese Datei keine an, also pinnt sie die Reihe
  nicht (E14).
- **Punkt 3 der Definition of Done ist damit halb erledigt:** „Ein Interessent
  ohne Konto erreicht den Veranstalter" steht, am laufenden Stack mit Mailpit
  durchgespielt. „Und die Antwort kommt bei ihm per E-Mail an" ist AP 10.

Offen aus diesem Paket: nichts außer dem Deep-Link der Mail (AP 10). Die
Adresse eines Gasts bleibt **unbestätigt** — das ist die Eigenschaft jedes
Kontaktformulars, gedrosselt und vom Veranstalter gelesen, bevor er antwortet;
ein Double-Opt-In davor hätte die niedrigste Schwelle der Thesis verdoppelt.

### AP 10 — Nachrichtenübersicht im Veranstalter-Client (erledigt, 03.09.2026)

Umgesetzt:

- **Eine Übersicht über alles, woran die Organisation beteiligt ist** (FR 3.4):
  `/messages` im Veranstalter-Client, Kontaktanfragen und Gruppen in **einer**
  Liste, neueste Bewegung oben, je Zeile wer geschrieben hat, wann, worum es
  geht und die letzte Zeile als Vorschau. Ein Bildschirm und nicht zwei, weil
  ein Veranstalter „seine Nachrichten" öffnet und keinen Filter. Die Vorschau
  wird **im Server** auf 160 Zeichen geschnitten (`MESSAGE_PREVIEW_LENGTH`) —
  sonst trüge eine Seite mit zwanzig Zeilen zwanzig ganze Nachrichten, um
  zwanzig erste Zeilen zu zeigen. Dazu `/messages/:id` mit Verlauf,
  Mitgliedern und Antwortfeld.
- **Ein zweiter Port statt einer neuen Methode am ersten** (F173). Der Port der
  Teilnehmenden ist so gebaut, dass Mitgliedschaft der einzige Ausweis ist, den
  er kennt (F152) — und die Organisation hat keine (F133). Ihn zu benutzen hieße
  also, genau die „lies irgendein Gespräch"-Methode nachzurüsten, ohne die er
  entworfen wurde. `OrganizerConversationRepository` trägt die Regel stattdessen
  in jeder Anweisung: `type IN ('group', 'organizer_contact')`. Ein
  `direct`-Gespräch **kommt dort nicht heraus** — nicht aus der Liste, nicht
  über die Id, nicht als Mitgliederliste. Die Vertragssuite prüft beides: es
  fehlt in der Liste, und seine Id antwortet 404 wie eine unbekannte.
- **Statt einer Ungelesen-Zahl steht dort „wartet auf Antwort"** (F133, F173).
  Die Organisation hat kein `last_read_at` und keinen Ort dafür. `awaitsAnswer`
  liest, **wer zuletzt geschrieben hat** — eine Funktion in `shared-models`, aus
  der Zeile gerechnet, damit die zwei Angaben nicht auseinanderlaufen können. Für
  ein Postfach, das mehrere Menschen lesen, ist das ohnehin die nützlichere
  Frage: „hat hier jemand geantwortet" statt „habe ich es angesehen". Eine
  Gruppe, in die noch niemand geschrieben hat, wartet auf nichts.
- **Die Antwort an einen Gast geht per Mail hinaus und bleibt stehen** (F11,
  F174) — beides, denn jedes allein hält das Versprechen nur zur Hälfte: die
  Mail ist, wie ein Mensch ohne Konto etwas erfährt, die Zeile ist, woran der
  nächste Veranstalter sieht, dass es beantwortet wurde. **Erst speichern, dann
  senden**, und das Schicksal der Mail steht in der Antwort: `delivery` ist
  `none` (eine Gruppe liest in der App), `sent` oder `failed`. Der Bildschirm
  sagt den Unterschied — vorher, wohin die Antwort gehen wird, hinterher, ob sie
  ging. Das ist **das Gegenteil von F172, aus dem entgegengesetzten Grund**: dort
  darf ein Fehlschlag nicht sichtbar sein (E10), hier muss er es sein, sonst
  glaubt der Veranstalter, er habe jemandem geantwortet, der nie etwas gehört
  hat.
- **Die achte Mail.** Sie grüßt mit dem Namen, den der Gast getippt hat (die
  siebte grüßt niemanden — beide Ausnahmen zusammen sind die Regel), trägt den
  Event-Block mit Zeit und Link, **keinen** Handlungsknopf (die einzige
  sinnvolle Adresse ist die Veranstaltungsseite, die der Block schon verlinkt)
  und die Worte des Veranstalters maskiert wie die einer Einladung. Ihre Sprache
  ist die Vorgabe der Instanz, weil der Empfänger kein Konto hat — es sei denn,
  die Adresse hat doch eines, dann bekommt sie die gewählte (F125, die Regel und
  nicht ihre Ausnahme). Katalog: 834 → **890** Schlüssel.
- **Gruppen werden hier zusammengestellt** (E39): Reihe → Veranstaltung →
  Betreff → Mitglieder, in der Reihenfolge, die die Daten verlangen. Angeboten
  werden die **bestätigten** Anmeldungen der Veranstaltung, die ein
  **bestätigtes** Konto haben, über die Adresse verbunden (E31) — eine Anmeldung
  trägt keine Profil-Id. Wer kein Konto hat, fehlt, und der Bildschirm sagt
  warum: eine Mitgliedschaft zeigt auf ein Profil, und alle anderen erreicht die
  Einladung (FR 2.4). Getippt werden kann **niemand**.
- **Wer in eine Gruppe darf, entscheidet der `INSERT`** und nicht sein Aufrufer:
  `INSERT … SELECT` über dieselbe Menge, eingeschränkt auf die gewählten Ids.
  Eine Id von woanders wählt nichts aus, fügt also niemanden hinzu — und dann
  entsteht die Gruppe **gar nicht**, denn eine Gruppe ohne die Leute, für die sie
  zusammengestellt wurde, ist schlechter als keine. Dabei ist ein Fehler
  aufgefallen, den erst die Vertragssuite fand: ein `return null` **im**
  Transaktions-Callback von TypeORM committet — es muss geworfen werden. Steht
  als Warnung in `docs/rules/tooling-traps.md`.
- **Der Modulschalter hängt an zwei Routen statt an der Klasse** (F175). Lesen
  und Antworten sind P1 und müssen auch auf einer Instanz **ohne** Chat
  funktionieren, sonst kommen die Kontaktanfragen aus AP 9 nirgends an; eine
  Gruppe anzulegen ist FR 4.5, und eine Gruppe, deren Mitglieder keine
  Endpunkte zum Lesen haben, wäre totgeboren. Der Guard konnte das immer (er
  liest den Handler vor der Klasse), dazu kam `CoreModuleRoute` als
  Methoden-Dekorator. Die Vertragssuite schaltet `chat` aus und prüft **beide**
  Hälften — die Übersicht antwortet weiter, die Gruppe nicht, und die
  Teilnehmenden bekommen ihren 404 (mit Sitzung, damit es der des Moduls ist und
  nicht der des Guards).
- **Das Bild einer Nachricht hat für den Veranstalter eine eigene Route**, und
  das ist keine Bequemlichkeit: `/api/media/messages/:id/attachment` entscheidet
  über **Mitgliedschaft** (F156), die die Organisation nicht hat. Also
  `GET /api/admin/conversations/:id/messages/:messageId/image`, hinter dem
  Admin-Guard, mit der Zugangsregel dieses Pakets — und der Client **holt** die
  Bytes und zeigt sie aus einem Blob, wie er es mit der Datei einer Anmeldung
  schon tut (E9). Die Kommentare in `message-image-media.controller.ts` hatten
  das in AP 6 so vorhergesagt.
- **Der Purge der Bilder eines Gesprächs** (F158, der `todo.md`-Eintrag für
  dieses Paket). Anders als dort vermutet konnte es **nicht**
  `AttachmentsService.purgeForEvent` erweitern: die Löschmethoden des
  Attachment-Ports sind absichtlich auf Zeilen **mit** Anmeldung eingeschränkt,
  damit von dort niemand an ein Bild in einem Gespräch kommt. Also ein eigener
  schmaler Port (`ConversationPurgeRepository`, im Attachment-Modul, weil dessen
  Aufgabe „eine Datei, deren Besitzer weg ist" ist und weil es von nichts
  abhängt — der Chat importiert die Events, umgekehrt wäre ein Kreis). Die
  **Reihenfolge** ist die Operation: Ids merken, Gespräche löschen (der Cascade
  nimmt die Nachrichten), dann die `attachment`-Zeilen, dann die Dateien.
  Umgekehrt scheitert es an `CHK_message_content`, weil
  `FK_message_attachment ON DELETE SET NULL` eine Nachricht ohne Text und ohne
  Bild hinterlassen würde. Erreichbar ist der Fall eng, aber echt: eine
  Veranstaltung mit bestätigten Anmeldungen lässt sich nicht löschen (E14), also
  trifft es die, deren Anmeldungen wieder storniert wurden.
- **Die Benachrichtigung zeigt jetzt auf die Anfrage** (F172, der zweite
  `todo.md`-Eintrag): `organizerConversationPath` in `shared-models` ist die
  eine Schreibweise für die Route des Clients und den Link der Mail.
- **Nichts daran ist live**, und das ist entschieden, nicht vergessen: der
  Handshake authentifiziert eine **Teilnehmer**-Sitzung (F132), die Organisation
  hat keine Mitgliedschaft, an die zugestellt würde (F133), und die
  Benachrichtigungsmail ist genau dafür da, dass niemand einen Bildschirm
  beobachten muss (F172). Eine Antwort in eine Gruppe erreicht deren Mitglieder
  dagegen sofort — über den Weg, der seit AP 7 steht.

Belegt (Beweise, nicht Absichten):

- Server-Units **1051** (+34): `organizer-conversations.service.spec.ts` mit 25
  Tests — der eine 404, „gespeichert und gemeldet", `none` für eine Gruppe, der
  Rückzieher bei einer nicht berechtigten Person, die vier Zustände der
  Bildroute —, dazu sechs für die achte Mail und drei für den Purge. In
  `shared-models` **98** (+3): die Teilmenge der zwei Arten als Teilmenge
  geprüft, die vier Antworten von `awaitsAnswer` und die eine Schreibweise der
  Gesprächsadresse.
- Vertragssuite **545** (+25): `organizer-conversations.spec.ts`. Darin die drei
  Teile des Abnahmekriteriums — die Antwort **in Mailpit** und im Verlauf, die
  Gruppe aus drei Angemeldeten, und **ihre Mitglieder sehen sie** über
  `/api/participant/conversations` mit echter Sitzung — plus das
  `direct`-Gespräch, das nicht auftaucht, der Schalter in beiden Hälften und der
  Purge gegen eine echte Datenbank.
- Veranstalter-Client **207** Unit-Tests (+27) über vier Dateien;
  Browsersuite **289** (+9, also drei Tests in drei Engines): die Frage finden,
  beantworten, den Satz über die Mail lesen, die Gruppe zu dritt anlegen und in
  ihrem Verlauf landen.
  Die Suite liest **kein** Postfach — dass die Mail wirklich ankommt, entscheidet
  die Vertragssuite gegen Mailpit; was nur ein Browser entscheiden kann, ist, ob
  der Bildschirm es sagt.
- Migration: **keine**. `conversation`, `conversation_member` und `message`
  stehen seit AP 6, `CHK_conversation_shape` erlaubt eine Gruppe mit Event und
  Betreff, und `IDX_conversation_event` wurde damals ausdrücklich „für die
  Übersicht des Veranstalters (AP 10)" angelegt.

Drei Fallen, die Zeit gekostet haben und jetzt in `docs/rules/` stehen: ein
`return` im Transaktions-Callback von TypeORM **committet** (oben schon
genannt); `[maxlength]` ist kein Angular-Binding, sondern `[attr.maxlength]`,
und der Fehler fällt erst im `build` auf, weil `tsc --noEmit` keine Templates
liest; und ein Modulschalter, den ein Test in der Tabelle umlegt, wirkt nicht —
der Server hält die Flags in einem Cache, also wird in Tests über
`PATCH /api/admin/modules/:key` geschaltet. Dazu eine vierte, die nur ein
Fixture betraf: PostgreSQL leitet **einen** Typ je Platzhalter ab, und dasselbe
`$5` als Wert einer `varchar(16)`-Spalte **und** im Vergleich mit einem
Textliteral ist „inconsistent types deduced for parameter $5".

Offen aus diesem Paket, alles in `todo.md`:

- **Wer aus der Organisation geantwortet hat, steht in der Zeile, aber nicht auf
  dem Bildschirm.** `sender_id` trägt das Administratorkonto; der Client
  erkennt nur die **eigenen** Zeilen (über die Id der Sitzung) und nennt alles
  andere „deine Organisation". Den Namen einer Kollegin zu zeigen wäre ein
  vierter Lesezugriff auf `admin_user` durch einen neuen Port — machbar, aber
  nicht in diesem Abnahmekriterium.
- **Die Kachel „neue Nachrichten" auf dem Event-Dashboard** (der Klammerzusatz
  im Plug-in-Eintrag von `todo.md`) ist **nicht** gebaut: sie bräuchte eine
  Ungelesen-Zahl, die es für die Organisation nicht gibt (F133). Was ginge, wäre
  „N Gespräche zu dieser Veranstaltung" — eine andere Kachel als die im Mockup,
  also eine Produktfrage und keine Implementierungslücke.
- **Ein Bild kann der Veranstalter nicht senden**, nur sehen. Eine Antwort muss
  auch als Mail funktionieren, und ein Anhang wäre ein zweiter Zustellweg für
  etwas, das FR 3.4 nicht verlangt.
- **Die Antwort eines Gasts auf die Antwort** kommt als gewöhnliche Mail im
  Postfach der Organisation an, nicht in der Übersicht. Mail zu **empfangen**
  ist kein Ziel dieser Anwendung (F8 hält den Versand schon klein); wer weiter
  in der App bleiben will, braucht ein Konto.

### AP 11 — Push wird echt (erledigt, 03.09.2026)

Umgesetzt:

- **Die Spalte, die seit Phase 0 vorgemerkt war** (F134, E43). `push_subscription`
  entstand, bevor es `user_profile` gab, und eine `user_id` ohne Fremdschlüssel
  wäre eine Spalte gewesen, die die Datenbank nicht sauber halten kann — die
  Entity sagte das in einem Kommentar, `todo.md` trug den Eintrag mit. Jetzt
  beides: **nullbar** und `ON DELETE CASCADE`. Nullbar ist dabei nicht die
  Ausnahme, sondern das Merkmal: dass ein Event verlegt wurde, ist öffentliche
  Information, und wer von einer Landingpage aus abonniert, darf sie bekommen,
  ohne sich anzumelden. Dazu zwei partielle Indizes, einer je Hälfte der
  Zielgruppe. Migration: **eine** (`PushSubscriptionOwner`), das `down` löscht
  keine Zeilen — ein Abonnement war auch ohne diese Spalte gültig.
- **Ein Abonnement folgt seiner Sitzung, und der Endpunkt bleibt die Identität**
  (F134). Der Client schickt sein Abonnement beim **Anmelden** erneut, der
  Server bindet es an die Sitzung; beim **Abmelden** erneut, der Server bindet
  es an niemanden. Dieselbe Route, derselbe Rumpf — was entscheidet, ist das
  Cookie, das mitreist. Zwei Zeilen für einen Endpunkt hießen zwei
  Benachrichtigungen für ein Gerät, und das geteilte Tablet im Büro würde
  weitermelden, was der letzte Benutzer bekommt. Der Endpunkt liest die Sitzung
  **optional**: der globale Teilnehmer-Guard kennt nur erlauben oder ablehnen,
  und hier ist keins von beidem richtig. Er war damit der dritte Ort, der
  `request.cookies[USER_SESSION_COOKIE]` von Hand las — jetzt gibt es
  `participantSessionFromRequest` neben dem Namen des Cookies, und alle drei
  benutzen sie (E34).
- **Die Zielgruppe einer Event-Änderung ist eine Anweisung des Ports** (F134,
  F152, F173): eine `UNION` aus den Geräten der **bestätigten Angemeldeten**
  (über die Adresse mit dem Konto verbunden, weil eine Anmeldung keine `user_id`
  hat, E31) und **jedem Gerät ohne Konto**. Die beiden Hälften sind nicht
  einzeln abfragbar, also kann kein Aufrufer versehentlich nur die zweite
  erwischen — das wäre jeder Browser, den diese Instanz je gesehen hat. Ein
  Konto, das angemeldet und für dieses Event nicht registriert ist, gehört nicht
  dazu: Benachrichtigungen sind kein Newsletter (F8). `findAll()` ist **weg** —
  es gab eine Benachrichtigung („alle") und keine Möglichkeit, etwas engeres zu
  sagen; jetzt gibt es zwei Zielgruppen und keine Methode, die eine dritte
  beantworten würde.
- **Was an einem Event eine Benachrichtigung wert ist** (F176): Zeit, Ort, und
  dass es nicht stattfindet. Davor zwei Bedingungen — das Event **war
  veröffentlicht** und ist **nicht vorbei**. Ein Entwurf ist niemandes Plan, das
  Veröffentlichen eines Entwurfs ist eine Ankündigung (die diese Anwendung nicht
  verschickt, F8), und das Archivieren der letztjährigen Konferenz ist Aufräumen
  — „findet nicht wie geplant statt" wäre dort eine Lüge über etwas, das
  stattgefunden hat. Zurückziehen und Archivieren sind **eine** Nachricht, weil
  sie von außen dieselbe Tatsache sind. Beschreibung, Nachtrag, Titel,
  Übersetzung: nichts. **Löschen** benachrichtigt ebenfalls nicht, und zwar
  ohne eigene Regel: gelöscht werden darf nur ein Event ohne bestätigte
  Anmeldungen (E14), also hat niemand einen Plan darauf gebaut — wer „findet
  nicht statt" sagen will, archiviert, und das ist genau der Weg, der
  benachrichtigt. Die Prüfung liegt in `EventsService`, wo beide Fassungen
  der Zeile vorliegen, und **gewartet wird nicht** — wer speichert, wartet nicht
  auf den Push-Dienst eines Browserherstellers und sieht auch keinen Fehler von
  ihm.
- **Eine neue Nachricht benachrichtigt nur, wer nicht zusieht** (F135, E44) —
  und „zusieht" ist der **Raum des Gesprächs**, nicht die Verbindung. Genau
  deshalb war F166 (der Socket gehört der Sitzung, nicht dem Bildschirm) die
  Voraussetzung: mit einem Socket je Bildschirm hätte die Frage „ist jemand da"
  nur „ist die App offen" geheißen. `ChatRealtimeService` bekam dafür seine
  **zweite** Frage — wer ist gerade in diesem Raum —, was die kleinste
  Erweiterung ist, mit der E44 überhaupt beantwortbar wird. Zugestellt wird von
  einem eigenen Dienst neben der Live-Zustellung, den **beide** Schreiber
  aufrufen: die Nachricht eines Teilnehmenden und die Antwort der Organisation
  aus AP 10. Nichts davon kann eine Nachricht scheitern lassen.
- **Die Worte kommen aus dem Katalog** (F177, E22): sechs Schlüssel, die Sprache
  ist die des Empfängers und die Vorgabesprache der Instanz für ein Gerät ohne
  Konto (F125), gruppiert **nach Sprache** statt je Gerät. E24 gilt hier
  ausdrücklich nicht — zwei Zeilen, deren Kette ohnehin bei Englisch endet, und
  gar nicht zu benachrichtigen wäre ein verlegtes Event, von dem niemand
  erfährt. Der Titel einer Event-Benachrichtigung ist der **Name des Events**;
  eine Nachrichten-Benachrichtigung trägt **keinen Absender und keinen Text**
  (NFR 7). Alle sechs Sätze kommen ohne die zweite Person aus, weil ein
  Sperrbildschirm nicht weiß, ob er neben dem _du_ der Mails oder dem _Sie_ der
  Oberfläche steht.
- **Der Client erklärt, bevor der Browser fragt** (F178, NFR 4). Das Angebot
  steht in der Hülle neben dem Installationshinweis — Benachrichtigbarkeit ist
  eine Eigenschaft des Clients, und ein Browser ohne Konto hat keine eigene
  Seite (E43) —, der **Schalter** auf der Profilseite, weil nur dort ein Ort
  ist, der einem Menschen gehört. Die Berechtigung wird **gelesen**
  (`Notification.permission`) und nicht durch einen Dialog erfragt, den jemand
  schon mit „nein" beantwortet hat; ein „jetzt nicht" gilt dauerhaft
  (`localStorage`, wie F109); angeboten wird nur, wo es gehen kann. Der Schalter
  sagt auch, **warum** es nichts zu schalten gibt — die iPhone-Zeile ist der
  Fall, von dem F7 abhängt, und ein Bildschirm, der dazu schweigt, sieht kaputt
  aus.
- **Beide Schalter werden gefragt, und zwar im Dienst selbst** (E21, F63): kein
  VAPID-Paar oder `push` aus, und es geht nichts raus — obwohl die Abonnements
  noch da sind, denn Ausschalten löscht nie Daten. Der Guard kann das hier nicht
  übernehmen: eine Benachrichtigung entsteht nicht aus einer Anfrage, also fragt
  niemand die Flagge für sie.
- **Das Prüfskript kennt die neue Hälfte** (`verify-push.mjs`): ein Abonnement
  ohne Sitzung ist gespeichert und gehört niemandem.

Was anders lief:

- **`web-push` spricht immer TLS.** Der Plan für die Vertragssuite war ein
  lokaler HTTP-Server als Push-Dienst — die Bibliothek benutzt aber
  `https.request`, egal was im Endpunkt steht, und antwortet mit
  „wrong version number" aus OpenSSL. Ein TLS-Sink bräuchte ein Zertifikat, dem
  der Serverprozess traut: entweder eine mitgelieferte CA in seiner Umgebung
  oder ein Agent, der die Prüfung überspringt. Beides wäre ein Test als Grund
  dafür, dass Produktionscode ein ungeprüftes Zertifikat annehmen kann. Also
  ist der Push-Dienst jetzt **ein lauschender Socket je Gerät**, und eine
  „Zustellung" ist die Verbindung: das beantwortet die Frage, die dieses Paket
  entscheidet — **wer** wird benachrichtigt —, während _was_ eine
  Benachrichtigung sagt gegen die mitgelieferten Kataloge geprüft wird und das
  Aufräumen bei `410 Gone` gegen eine gemockte Bibliothek.
- **Eine Suite darf nur zurücklegen, was sie gelesen hat.** Die neue
  Vertragssuite merkte sich die Modulschalter, um sie wiederherzustellen — mit
  `= true` als Anfangswert. Ein früher Absturz im `beforeAll` (ein Tippfehler in
  der Gestalt von `GET /api/admin/modules`) ließ das `afterAll` diesen **Rat**
  schreiben, und damit blieb `push` in der Entwicklungsinstanz an. Kaputt ging
  davon eine ganz andere Suite: der eine schreibende Test der Modulverwaltung im
  Veranstalter-Client klickt „einschalten" und fand nichts zum Klicken —
  dreißig Sekunden Timeout, gemeldet an der Stelle im `finally`, an der die Uhr
  ablief. Nachgewiesen mit einem Worktree auf `HEAD`: derselbe Fehler ohne dieses
  Paket. Der Anfangswert ist jetzt `null`, und wiederhergestellt wird nur, was
  wirklich gelesen wurde.
- **Ein abgelehnter Rumpf sieht wie ein Aufräumen aus.** `modules.spec.ts` in der
  Vertragssuite abonnierte ein Gerät und räumte es hinterher weg — mit dem
  Rumpf des Abonnierens, den `DELETE` aber ablehnt, weil die API unbekannte
  Felder zurückweist statt sie zu verwerfen (F44). Jeder Lauf ließ also eine
  Zeile zurück: **58** waren es. Unsichtbar, solange niemand die Abonnements
  liest — und ab diesem Paket ist jede davon ein Endpunkt, den die Instanz bei
  jeder Event-Änderung anzusprechen versucht. Der Status des `DELETE` wird jetzt
  geprüft.
- **Die Warnung sagt jetzt, was schiefging.** „Push delivery failed with status
  unknown" war der Satz, mit dem ein Push-Dienst mit 500 und eine Nutzlast, die
  die Bibliothek nicht verschlüsseln kann, gleich aussehen — und nur das zweite
  ist ein Defekt. Ohne den Grund im Log wäre der TLS-Fund oben eine Stunde
  Rätselraten geblieben.
- **Nicht von diesem Paket:** `profile-fields.spec.ts` („moves a question")
  scheiterte einmal in drei Läufen. Der Baukasten ist instanzweit und drei
  Engines ordnen ihn gleichzeitig um; in AP 10 war es dieselbe Zeile. Als
  bekannte Flakiness in `todo.md`, mit der Ursache.

Zahlen: Server-Units **1098** (+47), `shared-models` **99** (+1),
Nutzer-Client **239** (+32), Vertragssuite **561** (+16, davon 16 neu in
`push-notifications.spec.ts`), Veranstalter-Browsersuite **289** (unverändert),
Nutzer-Browsersuite **218** (unverändert, die neuen Prüfungen liegen im langen
Profil-Durchlauf). Katalog **890 → 911** (6 Sätze für den Server, 15 für den
Client). CI bekommt ein **Wegwerf-VAPID-Paar**, damit die Vertragssuite eine
Instanz hat, die überhaupt signieren kann; es ist kein Geheimnis und darf auf
keiner Instanz stehen.

Offen aus diesem Paket, alles in `todo.md`:

- **Die Gerätematrix ist nicht abgehakt.** Vier Zeilen — Chrome und Firefox am
  Desktop, Chrome auf Android über HTTPS, **iOS Safari mit installierter PWA** —
  brauchen einen Produktionsbuild, HTTPS und vier Geräte, und der iOS-Fall ist
  der, von dem F7 abhängt. Das Verfahren steht in
  [`docs/spikes/03-web-push.md`](spikes/03-web-push.md#still-to-be-checked-by-hand),
  jetzt mit dem Weg über eine **verschobene Session** statt über einen
  Testversand, den es bewusst nicht gibt. **Für Marius**, mit Datum und Gerät zu
  protokollieren — auch ein Fehlschlag.
- **Ein Gerät ohne Konto kann Benachrichtigungen nur im Browser abschalten.** Es
  gibt keine Seite, die ihm gehört, und die Website-Einstellungen jedes Browsers
  können es. Der Text des Angebots sagt, dass man es zurücknehmen kann.
- **Ein Gerät ohne Konto hört von den Änderungen aller öffentlichen Events.**
  Der Preis von E43: ein Browser hat keine Adresse und hat nichts darüber
  gesagt, was ihn interessiert. Für eine kleine NGO mit einer Handvoll Events
  vertretbar; ob es so bleiben soll, ist eine **Frage an den Pilotpartner** —
  die Alternative wäre ein Abonnement je Event, also eine Tabelle, die der
  Phasenplan nicht vorsieht.
- **Ein neues Event benachrichtigt niemanden** (F176, F8). Das ist die
  Entscheidung und keine Lücke; wenn der Pilotpartner es anders will, ist es
  eine Ankündigung und braucht einen eigenen Zuschnitt.
- **Der Handshake trägt weiter keine Drosselung** (aus AP 7, Phase 5) — davon
  ist hier nichts besser geworden.

### AP 12 — Die zwei P3-Zugaben (erledigt, 04.09.2026)

Umgesetzt:

- **Das Storno über die Sitzung** (FR 4.7, F148, F179) — und es war kein neuer
  Regelsatz, sondern eine zweite Route auf denselben. `SelfServiceService.cancel`
  nahm seit AP 4 einen `SelfServiceClaim`; was fehlte, war der Weg dorthin ohne
  Token. Das ist genau, was F148 vorhergesagt hatte: „zwei Ansprüche, eine
  Regelstrecke". Der Plan hatte `DELETE /api/participant/registrations/:id`
  vorgesehen, geworden ist es **`POST …/:id/cancellation`** (F179): eine Zeile
  höher löscht `DELETE /api/admin/registrations/:id` eine Anmeldung **endgültig**
  — so antwortet eine Organisation auf ein Löschverlangen —, und ein Verb, das
  im einen Präfix „weg" und im anderen „storniert, aber aufgehoben" heißt (F23),
  ist eine API, die man nicht lesen kann. Es ist auch die Gestalt, die der
  Mail-Link seit Phase 1 hat, also liest sich die eine Operation über beide
  Ansprüche gleich. Im Client wurde `cancel(token, locale)` zu
  `cancel(access, locale)` — dieselbe Umformung, die `signOff` in AP 4 bekam —
  und die Knopfleiste hängt nicht mehr an `linkToken()`.
- **Der Newsletter ist eine Adresse** (FR 4.8, E45, F136). Eine Migration:
  `newsletter_subscription`, nullbare Reihe mit `ON DELETE CASCADE`, eindeutig
  über `(lower(email), event_series_id)` — mit **`NULLS NOT DISTINCT`** (F180),
  ohne das PostgreSQL die instanzweite Zustimmung einer Adresse beliebig oft
  erlaubt hätte. Zwei weitere Abweichungen vom Schemaentwurf 5.3, beide
  protokolliert: **kein `confirmation_token_hash`** (Token sind signiert und
  werden nirgends gespeichert, F23) und `confirmed_at` statt
  `double_opt_in_confirmed_at` (so heißt dieser Augenblick in `registration` und
  `user_profile`).
- **Zwei Quellen, eine Liste, eine Zeile je Zustimmung** (F136). Die Übersicht
  ist eine `UNION` aus dem Häkchen im Anmeldeformular und der Anmeldung in der
  App, und drei Regeln stehen in der SQL des Ports statt in einem Aufrufer
  darüber (F152, F173): nur **bestätigte** Zustimmungen sind überhaupt
  abfragbar, ein **Widerspruch** (`contact_opt_out`, F24) nimmt eine Adresse aus
  **beiden** Quellen, und die Formular-Hälfte ist je Adresse und Reihe
  gruppiert. Zusammengeführt wird nichts: ohne Versand hätte eine Empfängerliste
  keinen Leser (F8), und eine gemeinsame Zeile behauptete, die beiden
  Zustimmungen bedeuteten dasselbe. Dazu vier Zahlen statt einer — Zustimmungen,
  je Quelle, und **verschiedene Adressen**, was jemand meint, wenn er fragt, wie
  viele Menschen die Neuigkeiten bekommen.
- **Die neunte Mail** (F181): der Double-Opt-In einer Anmeldung. Sie **grüßt
  niemanden** (es wurde kein Name erfragt), sagt, ob es um die Instanz oder um
  eine Reihe geht, und sagt, dass **ohne den Klick nichts passiert** — ein
  öffentliches Formular nimmt jede Adresse an, also kann dieser Brief jemanden
  erreichen, der nie etwas wollte. Ihre Sprache kommt aus der Kette von F125;
  das Formular schickt keine, weil eine Anmeldung keine Zeile hat, auf der eine
  Sprache stehen könnte.
- **Das Formular antwortet immer gleich** (F181, E32 wörtlich): neue,
  unbestätigte, längst bestätigte Adresse — 200 mit der Adresse. Wer nie
  bestätigt hat, bekommt den Link noch einmal; wer schon dabei ist, bekommt
  **nichts**. Und der **Fehlschlag der Mail wird geschluckt**, nicht gemeldet:
  ein 503 für die eine und ein 200 für die nächste Adresse wäre genau die
  Auskunft, die dieses Formular nicht geben darf.
- **Zwei Platzierungen, ein Bauteil** (F182, wie F178): die Startseite ohne
  Reihe (instanzweit) und die Seite einer Reihe mit ihrem Slug. Damit haben
  beide Zweige der nullbaren Spalte einen Schreiber und die Übersicht für sie
  einen Leser (F42). Ein Slug, den keine veröffentlichte Reihe trägt, ist 404 —
  eine Auskunft über eine Reihe, nicht über eine Adresse.
- **Zurücknehmen geht über die Organisation** (F183): `DELETE
/api/admin/newsletter/:id`, nur für die App-Quelle, denn nur sie ist eine
  eigene Zeile. Gelöscht statt archiviert — der Nachweis einer Einwilligung, die
  es nicht mehr gibt, ist das Gegenteil dessen, worum gebeten wurde (der Fall,
  für den E14 Raum lässt). Ein Häkchen im Anmeldeformular gehört zu seiner
  Anmeldung, und die Zeile sagt das, statt einen Knopf anzubieten, der etwas
  anderes täte.
- **Der Schalter heißt `newsletter-opt-in` und ist aus.** F63 hatte ihm einen
  eigenen Schlüssel versprochen, falls die Opt-In-Verwaltung in Phase 3 kommt —
  `newsletter` kommt nie zurück, weil es keinen Versand zu schalten gibt (F8).
  Aus by default, und das ist der einzige Deskriptor mit diesem Grund: eine
  Instanz, die den Schalter an hat, verspricht Neuigkeiten, die sie von woanders
  schickt. **Keine Voraussetzung** (E42), und das ist ebenfalls eine Aussage:
  eine Anmeldung fragt nach einer Adresse und nicht nach einem Konto, also ist
  dieses Modul auf einer Instanz mit ausgeschaltetem `profiles` am nützlichsten.

Was anders lief:

- **Ein Verb war schon vergeben.** Die API-Tabelle des Plans sagte `DELETE` auf
  der Anmeldung; im Admin-Präfix bedeutet genau dieses `DELETE` seit Phase 1
  „für immer weg". Die Abweichung steht als F179 mit Begründung im
  Referenzdokument — es ist die erste dieser Phase, die eine Zeile der
  API-Tabelle korrigiert statt sie zu ergänzen.
- **`ON CONFLICT` und `NULLS NOT DISTINCT`** mussten nachgesehen werden: ob
  PostgreSQL einen so deklarierten Index als Konfliktziel erkennt, stand in
  keiner Regel. Er tut es (gegen die Entwicklungsinstanz geprüft: zweimal
  dieselbe Adresse in verschiedener Schreibweise, eine Zeile, dieselbe Id).
- **Ein Prüfskript war seit AP 6 falsch.** `verify-api.mjs` behauptete, eine
  frische Instanz habe `media-links` und `profiles` an — `profile-search` (AP 5)
  und `chat` (AP 6) kamen dazu, ohne dass es jemand nachtrug, und das Skript
  wäre gegen jede Instanz seither rot gewesen. Jetzt nennt es die vier und sagt,
  welche zwei ausdrücklich aus sind. Gefunden beim Nachsehen, ob dieses Paket ein
  Skript anfassen muss.
- **Ein `test.skip` im Testrumpf hält die Hooks nicht auf.** Beide neuen
  Browsersuiten lasen und stellten den Modulschalter **je Engine** wieder her,
  also schaltete die erste, die fertig war, ihn aus, während die anderen noch
  arbeiteten — mit dem Ergebnis, dass eine Suite ihre eigene Übersicht mit 404
  beantwortet bekam. `beforeAll`/`afterAll` fragen jetzt selbst nach
  `browserName`. Das ist die Ergänzung zur Regel „nur Chromium, und
  wiederherstellen, was gefunden wurde".
- **Eine Zusicherung war zu genau.** `event-landing.spec.ts` verglich **alle**
  `<h2>` der Reihenseite mit `['Upcoming events', 'Past events']`; das
  Anmeldeformular bringt eines mit, sobald sein Modul an ist. Sie zählt jetzt
  die Überschriften der Reihe selbst (`article > h2`) — die bessere Zusicherung,
  und keine, die beim nächsten Abschnitt wieder bricht.
- **Keine zweite Mail für eine Adresse, die schon dabei ist.** E32s Muster
  („die immer gleiche Antwort braucht eine Mail, die den Unterschied trägt")
  hätte eine zehnte Mail bedeutet — „du stehst schon auf der Liste". Sie hätte
  nichts enthalten, was man tun kann; stattdessen sagt das Formular von sich
  aus, dass eine Mail nur kommt, wenn die Adresse noch nicht dabei ist. Damit
  bleibt der Unterschied unsichtbar, ohne einen Brief zu erfinden.

Zahlen: Katalog 911 → **956** Schlüssel (fünf für die neunte Mail, einer für den
Modulnamen, dreizehn für Formular und Bestätigungsseite im Nutzer-Client,
sechzehn für die Übersicht im Veranstalter-Client). Server-Unit-Tests 1121,
Vertragssuite 586 (+25), Nutzer-Client 251, Veranstalter-Client 213. Eine
Migration. Ein neues Geschäftslogik-Modul (`business/newsletter/`) mit einem
Port, zwei Controllern und einem Dienst.

Offen aus diesem Paket, alles in `todo.md`:

- **Es gibt keinen Selbstabmelde-Link.** Von hier geht kein Newsletter raus
  (F8), also trägt das Werkzeug der Organisation seinen eigenen Abmeldeweg; wer
  von der Liste will, schreibt der Organisation (das Kontaktformular aus AP 9
  kann das ohne Konto) und die nimmt die Zeile heraus. Ob eine Instanz mit
  eigener Liste einen Link braucht, ist eine **Frage an den Pilotpartner**.
- **Die Liste kennt keine Sprache.** Eine Organisation, die zweisprachig
  versendet, müsste wissen, welche Adresse welche Sprache liest. Speicherbar
  wäre es nur für die App-Quelle — für die Formular-Hälfte gibt es keine Spalte
  —, und eine Übersicht, die für die Hälfte ihrer Zeilen „unbekannt" sagt, ist
  keine Auskunft. Offen, mit diesem Grund.
- **Es gibt keinen Export.** Die Übersicht ist eine Seite mit Blättern; wer
  hundert Adressen in ein anderes Werkzeug bringen will, kopiert sie. Eine
  CSV-Route wäre klein, aber sie ist nicht angefordert (FR 4.8 ist P3) —
  **Frage an den Pilotpartner**, zusammen mit der Sprache.

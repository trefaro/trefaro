# Phase 3 — Profile, Kommunikation und Community-Kern

**Status: in Arbeit** (seit 02.09.2026, AP 1 bis AP 4 erledigt, **M6 erreicht**). Der Teil oberhalb von
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
(F1–F117 sind vergeben, F62 nie). Vergeben sind inzwischen F118–F125 sowie
F137–F149; **F126–F136 bleiben reserviert** für die Pakete, die noch kommen.

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
- **Deutsch mit Marius, Englisch im Code**; Conventional Commits.
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
dieses Paket reserviert und ist vergeben.

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

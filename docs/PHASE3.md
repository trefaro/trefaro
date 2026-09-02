# Phase 3 — Profile, Kommunikation und Community-Kern

**Status: geplant** (02.09.2026). Kein Arbeitspaket ist begonnen. Dieses
Dokument ist der **Plan**; er wird ab AP 1 nicht mehr rückwirkend korrigiert,
sondern unten unter _Fortschritt_ fortgeschrieben — wie in
[`PHASE1.md`](PHASE1.md) und [`PHASE2.md`](PHASE2.md).

Grundlage: Kapitel 6, Phase 3 in
[`Anforderungsanalyse_und_Umsetzungsplan.md`](Anforderungsanalyse_und_Umsetzungsplan.md)
(FR 4.1–4.5, 4.7, 4.8, FR 3.4, FR 3.15; Entscheidungen F7–F13). Was Phase 2
offen gelassen hat, steht in [`todo.md`](../todo.md) unter _Checkable after
phase 3_ — dreizehn Einträge, jeder ist unten einem Arbeitspaket zugeordnet.

Die Entscheidungen zählen bei **E31** weiter (Phase 1: E1–E16, Phase 2:
E17–E30); Ergänzungen am Referenzdokument bekommen **F118** und folgende
(F1–F117 sind vergeben, F62 nie).

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

| FR / Quelle       | Inhalt                                                             | Arbeitspaket |
| ----------------- | ------------------------------------------------------------------ | ------------ |
| 4.1 · 4.2         | Teilnehmerkonto, Double-Opt-In, Login, Sitzung, Passwort           | AP 1         |
| 4.3               | Profil verwalten: Name, Bild, Sprache, Tätigkeitsbereich, Felder   | AP 2         |
| 4.1–4.3           | Login, Registrierung und Profil im Nutzer-Client                   | AP 3         |
| 3.3 · 4.7         | Die Anmeldung kennt den Menschen: Profilspalte, Selbstbedienung    | AP 4         |
| 4.4               | Profilsuche mit Sichtbarkeits-Opt-in                               | AP 5         |
| 4.5               | Gespräche, Nachrichten und Bilder — ohne Echtzeit                  | AP 6         |
| 4.5 · F9          | Echtzeit: authentifizierter Handshake, Räume, Zustellung           | AP 7         |
| 4.5               | Chat im Nutzer-Client                                              | AP 8         |
| 3.4 · UC 14 · F11 | Organisator-Kontakt ohne Registrierung, Antwort per Mail           | AP 9         |
| 3.4               | Nachrichtenübersicht im Veranstalter-Client                        | AP 10        |
| 3.15              | Push wird echt: Versand bei Event-Änderungen, Zuordnung zum Konto  | AP 11        |
| 4.7 · 4.8         | Eigene Anmeldung stornieren, Newsletter-Opt-In-Verwaltung (beide P3) | AP 12      |
| —                 | Phasenabschluss                                                    | AP 13        |

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

| Methode + Pfad                                    | Zweck                                                          | AP  |
| ------------------------------------------------- | -------------------------------------------------------------- | --- |
| `POST /api/user/profiles`                         | FR 4.1: Konto anlegen, antwortet immer gleich (E32)            | 1   |
| `POST /api/user/profiles/confirm`                 | Double-Opt-In über den signierten Link (E32)                   | 1   |
| `POST /api/participant/auth/login` · `logout`              | FR 4.2, `@AllowAnonymous()`, Drosselung wie beim Admin          | 1   |
| `GET /api/participant/me`| Wer bin ich — die Antwort, die der Client beim Start braucht    | 1   |
| `PATCH /api/participant/me`                       | FR 4.3: Name, Sprache, Tätigkeitsbereich, Felder, `searchable` | 2   |
| `PUT /api/participant/me/password`                    | FR 4.3, mit dem alten Passwort                                  | 2   |
| `PUT/DELETE /api/participant/me/avatar`               | Profilbild, Regeln wie beim Logo (F113, F38)                   | 2   |
| `GET /api/media/profiles/:id/avatar`              | öffentlich, pfadfrei, ohne Statusfilter (F113, F115)           | 2   |
| `GET/POST /api/admin/profile-fields`              | FR 4.3: der instanzweite Baukasten (E35)                       | 2   |
| `PATCH/DELETE /api/admin/profile-fields/:id`      | wie beim Anmeldeformular, Reihenfolge als Ganzes               | 2   |
| `GET /api/participant/registrations`                       | FR 4.7: meine Anmeldungen, über Adressgleichheit (E31)         | 4   |
| `GET /api/participant/profiles`                            | FR 4.4: Profilsuche, nur `searchable` (E37, F126)              | 5   |
| `GET /api/participant/profiles/:id`                        | ein fremdes Profil, soweit es sich zeigt                        | 5   |
| `GET /api/participant/conversations`                       | FR 4.5: meine Gespräche, ungelesen gezählt (E38)               | 6   |
| `POST /api/participant/conversations`                      | ein 1:1-Gespräch beginnen (E37)                                 | 6   |
| `GET /api/participant/conversations/:id/messages`          | Verlauf, paginiert, ID als letztes Sortierkriterium            | 6   |
| `POST /api/participant/conversations/:id/messages`         | Text und/oder Bild, `multipart/form-data` wie F39              | 6   |
| `PUT /api/participant/conversations/:id/read`              | `last_read_at` setzen (E38)                                     | 6   |
| `GET /api/media/messages/:id/attachment`          | das Bild einer Nachricht, nur für Mitglieder                    | 6   |
| Socket `/socket.io`, Namensraum `chat`            | FR 4.5: Handshake am Cookie, Raum je Gespräch (E41)            | 7   |
| `POST /api/user/series/:slug/events/:slug/contact`| FR 3.4, UC 14: Kontakt ohne Registrierung (F11, E39)           | 9   |
| `GET /api/admin/conversations`                    | FR 3.4: Nachrichtenübersicht des Veranstalters                  | 10  |
| `GET/POST /api/admin/conversations/:id/messages`  | lesen und antworten; bei Gästen geht die Antwort per Mail       | 10  |
| `POST /api/admin/events/:id/conversations`        | eine Gruppe zusammenstellen (E39)                               | 10  |
| `POST /api/user/newsletter` · `…/confirm`         | FR 4.8: Opt-In und Bestätigung (E45)                            | 12  |
| `GET /api/admin/newsletter`                       | FR 4.8: die Übersicht über beide Quellen (E45)                  | 12  |
| `DELETE /api/participant/registrations/:id`                | FR 4.7: eigene Anmeldung stornieren                             | 12  |

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

### AP 3 — Login, Registrierung und Profil im Nutzer-Client (FR 4.1–4.3) → **Meilenstein M6**

Nutzer-Client: Registrierungs- und Loginseite, Bestätigungsseite,
Profilbearbeitung mit dem generischen Formularbauteil, Navigationseintrag für
den angemeldeten Zustand, Abmelden. Der Sitzungszustand ist ein Signal, das
`GET /api/participant/me` beim Start füllt — nach der Konfiguration, nicht davor (die
Startsequenz aus der Thesis bleibt: Konfiguration, Theming, dann alles andere).
Alle Texte in Englisch und Deutsch im Katalog (E22, F70, F80).

**Fertig, wenn** jemand sich im Browser registrieren, bestätigen, anmelden, sein
Profil ändern und abmelden kann, mobil-zuerst, in beiden Sprachen, in allen drei
Browsern der Suite. **M6: die Instanz hat Teilnehmerkonten.**

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

| Meilenstein | Nach  | Inhalt                                                                     |
| ----------- | ----- | -------------------------------------------------------------------------- |
| M6          | AP 3  | Die Instanz hat Teilnehmerkonten: registrieren, anmelden, Profil pflegen   |
| M7          | AP 7  | Chat in Echtzeit, authentifiziert, mit Bildern — durch NGINX geprüft       |
| M8          | AP 13 | Phase 3 abgeschlossen, Push auf echten Geräten belegt                     |

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

| Risiko                                                                                                                                   | Gegenmaßnahme                                                                                                                                                                              |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Der Chat ist der größte Scope-Zuwachs der Phase** — F9 nennt Gruppen, CLAUDE.md Bilder, und beides in einem Paket                       | Drei Pakete statt einem: Fachlichkeit (AP 6), Echtzeit (AP 7), Oberfläche (AP 8). Die Bilder bleiben in AP 6, weil ein zweiter Durchgang durch Datenmodell und Gateway teurer wäre (E40)   |
| **Eine zweite Authentifizierung ist eine zweite Angriffsfläche.** Registrierung, Login und Kontaktformular sind neue offene Endpunkte      | Alle drei antworten immer gleich (E10, E32), alle drei unter der globalen Drosselung, `/api/participant` deny by default am Pfad (E33), und ein Vertragstest je Endpunkt, der die Gleichheit hält   |
| Der Socket-Handshake liest ein Cookie — und Cookies erreichen Gateways anders als HTTP-Handler                                            | AP 7 beginnt mit der kleinsten Prüfung, die das zeigt, **bevor** Räume oder Zustellung gebaut werden; Spike 4 hat den Weg durch NGINX schon belegt                                          |
| `member_id` hat keinen Fremdschlüssel (zwei mögliche Elterntabellen)                                                                      | Bewusst (siehe Schema): die Zeile existiert nie ohne ihr Gespräch, und die Geschäftslogik prüft die Existenz beim Anlegen. Ein Test hält fest, dass eine unbekannte Id ein 400 ist          |
| Ein Chatbild ist Inhalt, keine Marke — die Medienroute braucht eine Berechtigung, anders als alle bisherigen                              | Eigene Route mit eigenem Guard (AP 6), und `docs/rules/api-contracts.md` bekommt den Unterschied zu F115 als eigene Zeile, damit die nächste Medienroute nicht die falsche Vorlage nimmt    |
| Push auf echten Geräten ist der eine Punkt, den keine Suite dieses Repositories prüfen kann — und F7 hängt davon ab                       | AP 11 hat die Matrix als Abnahmekriterium, nicht als Nachtrag; ein gescheiterter Fall wird mit Gerät und Datum protokolliert, nicht weggelassen                                             |
| Die Phase ist mit 13 Paketen die längste bisher; FR 4.7 und 4.8 sind P3 und könnten sie überziehen                                        | AP 12 ist ausdrücklich streichbar, und AP 4 räumt die Phase-1-Zusagen früh weg, damit am Ende nicht Altlast und Neubau gleichzeitig offen sind                                              |
| Ein Teilnehmerkonto ändert die Bedeutung von „meine Anmeldung", und Phase 1 hat dafür einen Link in Postfächern hinterlassen              | Der Link bleibt gültig — das war die Zusage (E11). `SelfServiceService.require` bekommt einen zweiten Weg, keinen anderen, und ein Test fährt den alten Weg nach dem Umbau noch einmal      |

## Nachträge am Referenzdokument — geplant

Wird beim jeweiligen Paket eingetragen, nicht am Ende gesammelt:

| Nr.  | Inhalt                                                                                                | AP  |
| ---- | ----------------------------------------------------------------------------------------------------- | --- |
| F118 | Die Adresse ist die Identität; `registration` bekommt keine `user_id` (E31, Bezug F57)                | 1   |
| F119 | `/api/participant` ist der geschützte Präfix, `/api/user` bleibt öffentlich (E33, Bezug E16, F69)              | 1   |
| F120 | Eine Teilnehmersitzung ist eine zweite Sitzung, keine Rollenspalte (E34, Bezug F22)                   | 1   |
| F121 | Ein Konto entsteht mit Double-Opt-In und antwortet immer gleich (E32, Bezug E10)                      | 1   |
| F122 | Der Feld-Baukasten der Profile ist instanzweit; Ergänzung zu Schema 5.3 (E35, Bezug F35, F101)        | 2   |
| F123 | Der Tätigkeitsbereich ist eine Spalte, weil die Suche darauf filtert (E36)                            | 2   |
| F124 | Ein Avatar liegt in `avatars/`, und die Datenbank hält das fest (Bezug F113, E9)                      | 2   |
| F125 | Was eine Mail-Locale ist, wenn der Empfänger eine hat — und wenn nicht (E24 fortgeschrieben)          | 4   |
| F126 | Die Profilsuche sucht wie die Teilnehmerübersicht: `ILIKE` je Wort, keine Volltextsuche (Bezug F32)   | 5   |
| F127 | `searchable` ist das Opt-in für Suche **und** Kontakt (E37, Bezug F13)                                | 5   |
| F128 | Ein Modulschalter darf eine Voraussetzung haben — und löst sie nicht still auf (E42, Bezug F63)       | 5   |
| F129 | Gelesen gehört dem Mitglied: `conversation_member.last_read_at` statt `message.read_at` (E38)         | 6   |
| F130 | Eine Nachricht ist Text, Bild oder beides — nie nichts (E40, Bezug F39, F38)                          | 6   |
| F131 | Eine Medienroute mit Berechtigung: warum ein Chatbild anders ist als ein Logo (Bezug F115)            | 6   |
| F132 | Der Handshake ist die Tür, nicht das Ereignis (E41, Bezug Spike 4)                                    | 7   |
| F133 | Der Gast im Gespräch: `organizer_contact` ohne zweiten Account (E39, Bezug F11)                       | 9   |
| F134 | Ein Abonnement ohne Konto bleibt möglich; `user_id` ist nullbar (E43, Bezug F7)                       | 11  |
| F135 | Eine persönliche Benachrichtigung geht nur raus, wenn niemand zusieht (E44)                           | 11  |
| F136 | Der Newsletter ist eine Adresse, keine Anmeldung — und `notification` wird nicht gebaut (E45, F8)     | 12  |

Die Nummern sind reserviert, nicht garantiert: was sich beim Bauen als dieselbe
Entscheidung entpuppt, wird zusammengelegt, und die freigewordene Nummer bleibt
unvergeben (wie F62).

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
   F118–F136 stehen im Referenzdokument. Verschobene Einträge tragen eine
   Begründung, gestrichene ebenfalls.
6. **Dieses Dokument ist von Plan auf Protokoll korrigiert** und hat je Paket
   einen Abschnitt „erledigt" sowie am Ende ein phasenweites _Was anders lief_.

---

## Fortschritt

Noch kein Arbeitspaket begonnen. Je Paket kommt hier ein Abschnitt „erledigt"
mit dem, was tatsächlich passierte — Abweichungen vom Plan stehen hier, damit
AP 13 sie nicht rekonstruieren muss.

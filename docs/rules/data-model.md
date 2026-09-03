# Regeln des Datenmodells

Die Formentscheidungen des Schemas, jede einzeln gegen eine naheliegende
Alternative entschieden.

Ein Schema ist die einzige Schicht, die man nicht refaktorieren kann,
ohne Daten anzufassen. Die Begründungen stehen als F-Nummern im
Entscheidungsprotokoll (`docs/Anforderungsanalyse_und_Umsetzungsplan.md`).

- **Löschen ist die Ausnahme, Archivieren die Regel** (E14). Reihe/Event mit
  bestätigten Anmeldungen: 409. Eine **einzelne** Anmeldung ist immer löschbar
  (DSGVO-Vorarbeit). Deaktivieren löscht nie Daten — nur `down`-Migrationen
  entfernen Tabellen. `DATABASE_SYNCHRONIZE` bleibt im Zielbetrieb aus.
- **Zeiten sind absolute Zeitpunkte, die Zone hängt am Event** (E8). Formatiert
  wird ausschließlich über die Helfer in `shared-models`, auch beim Aggregieren
  (F33). Ein Programmpunkt hat keine eigene Zone; Timeline-Tage über
  `groupProgramByDay`, Uhrzeiten über `formatProgramTime`.
- **Der Feldschlüssel ist nicht die Beschriftung** (F35): aus ihr abgeleitet, je
  Event eindeutig, danach **unveränderlich** — genau deshalb lässt sich eine Frage
  umformulieren, ohne die Antworten von ihr zu lösen. Typ ebenfalls fest. Sechs
  Schlüssel sind für den Kern reserviert.
- **Eine gelöschte Formularfrage löscht keine Antworten** (F34). Die Werte bleiben
  in `custom_fields_json`, die Übersicht zeigt sie unter ihrem Schlüssel. Kein
  409 — das wäre eine Sackgasse ohne Archiv-Flag. Gilt für **beide** Baukästen:
  auch eine gelöschte Profilfrage lässt stehen, was Menschen über sich
  geschrieben haben — die Definition war nur die Frage.
- **Die Reihenfolge des Formulars wird als Ganzes geschrieben**, nie als „ein Feld
  nach unten": eine Liste aller Ids, `sort` in einer Transaktion neu vergeben.
  Deshalb ist `sort` bewusst nicht eindeutig.
- **Antworten werden gegen die Definitionen geprüft, nicht gegen ein DTO** — und
  vor dem Schreiben. Unbekannter Feldschlüssel = 400, kein stilles Verwerfen.
- **Eine Datei ist keine Antwort in `custom_fields_json`** (F37), sondern eine
  `attachment`-Zeile mit echtem Fremdschlüssel auf `registration`, zugeordnet über
  den Feldschlüssel. Ein Wert unter einem Datei-Schlüssel ist ein 400. Eine
  Anmeldung mit Datei ist **eine** Anfrage (F39): `multipart/form-data`, Felder
  als JSON im Teil `payload`, jede Datei im Teil mit dem Namen ihres
  Feldschlüssels; geschrieben wird erst, wenn alles geprüft ist.
- **Dem Content-Type wird nicht geglaubt** (F38): geprüft werden die ersten Bytes
  gegen den behaupteten Typ. Die erlaubten Typen sind ein Katalog in
  `shared-models` — ein neuer Typ braucht dort einen Eintrag **und** eine Signatur
  in `file-signature.ts`.
- **Das Upload-Volume wird nie statisch ausgeliefert** (E9). Zu einer
  **Anmeldungsdatei** führt genau ein Weg: `GET /api/admin/attachments/:id`,
  immer als `attachment`-Download, und der Port dahinter sieht nichts anderes
  (F155). Seit AP 6 liegt in derselben Tabelle auch das Bild einer
  Chatnachricht — in einem **eigenen** Teilbaum `messages/`, mit einer eigenen
  Route, die über die Nachricht auflöst und Mitgliedschaft prüft (F156). Die
  beiden Arten sind nirgends verwechselbar: nicht im Pfad, nicht in der Spalte
  (`CHK_attachment_area`) und nicht in einem Verzeichnislisting.
- **Kaskaden löschen Zeilen, keine Dateien.** Wer Anmeldungen (mittelbar) löscht —
  Anmeldung, Event, Reihe — ruft vorher `AttachmentsService.purge…`, solange die
  Zeilen noch sagen können, welche Dateien gemeint sind.
- **Ein Programm ist nach der Uhr sortiert, nicht nach einer Spalte** (F40).
  `program_item` hat kein `sort`; Gleichstand bricht `(starts_at, ends_at, id)`.
  Es gibt deshalb kein „nach oben" im Editor — eine Session verschiebt man, indem
  man ihre Zeit ändert.
- **Überschneidungen werden angezeigt, nicht abgelehnt** (F41) — zwei Sessions zur
  gleichen Zeit sind ein zweigleisiger Kongress. Abgelehnt (400) wird nur, was
  außerhalb des Eventzeitraums liegt, und **nur beim Schreiben** geprüft: sonst
  könnte ein Veranstalter, der das Event verschoben hat, die Punkte nicht mehr
  nachziehen. Der Editor markiert die außerhalb liegenden.
- **Ein Programmpunkt braucht eine Dauer** (`ends_at > starts_at`, strikt in der
  DB), ein Event nicht — das darf ein einzelner Zeitpunkt sein.
- **Kein Feld ohne Bedeutung.** Ein Flag, das nichts liest, sieht aus wie eine
  Funktion, die es gibt (`registration_enabled`/`capacity` kamen erst mit
  `program_item_signup`).
- **Anmeldung ist je Programmpunkt, aus, und eine Kapazität braucht sie** (F42):
  `capacity` ohne `registration_enabled` ist ein 400 **und** ein `CHECK`.
  Abschalten setzt die Kapazität zurück und löscht **keine** Anmeldungen.
- **Ein Platz existiert oder nicht.** `program_item_signup` hat keine
  Statusspalte; abmelden löscht die Zeile und ist **immer** erlaubt, auch nach dem
  Abschalten und nach Beginn — eine Regel, die Menschen in einer Liste festhält,
  macht die Liste falsch statt kürzer.
- **Die Art ist die Reihenfolge** (F52): `MEDIA_LINK_KINDS` ist die Menge der
  gültigen Werte _und_ ihre Sequenz; `media_link` hat kein `sort`.
- **Zugehörigkeit garantiert die Datenbank** (F54): der Fremdschlüssel ist das
  Paar `(program_item_id, event_id)`. Die Geschäftslogik prüft es zusätzlich,
  damit daraus ein 400 wird und kein Constraint-Fehler.
- **Ein Empfänger ist eine Anmeldung, keine Adresse** (F55): `invitation_recipient`
  hat keine Adressspalte; eine Auswahl nennt Ids, und jede wird erneut durch
  denselben Filter gelesen (bestätigt, diese Reihe, kein Widerspruch).
- **Ein Widerspruch gehört dem Menschen, nicht der Zeile** (F57): `contact_opt_out`
  wird auf **allen** Anmeldungen einer Adresse in der ganzen Instanz gesetzt; nur
  die noch nicht widersprochenen werden gezählt.
- **Die Adresse ist der Mensch** (E31): `user_profile.email` ist instanzweit
  eindeutig (`lower(email)`) und **die** Identität eines Teilnehmerkontos.
  `registration` bekommt **keine** `user_id` — die Anmeldungen einer Person
  werden über Adressgleichheit gefunden, wie ein Widerspruch über alle
  Anmeldungen einer Adresse gilt (F57). Kein Verknüpfungslauf für bestehende
  Zeilen, keine zweite Wahrheit. Preis: die Adresse ist im Profil
  **unveränderlich** — `UserProfileChanges` kennt sie nicht.
- **Eine Teilnehmersitzung ist eine zweite Tabelle, keine Rollenspalte** (E34).
  `user_session` neben `admin_session`, gleiche Form, gleicher Sweep, ohne
  `user_agent` (nichts zeigt einem Teilnehmer seine Sitzungen). Eine gemeinsame
  Tabelle mit Rolle hätte die Rechteprüfung ins Cookie verlegt.
- **`confirmed_at` ist der Double-Opt-In, nicht ein Statusfeld** (E32): `NULL`
  heißt „noch nicht bestätigt", und vor dem Datum wird **keine** Sitzung
  ausgegeben. Ein erneuter Registrierungsversuch auf eine **unbestätigte**
  Adresse darf Name und Passwort überschreiben (es gab noch keine Sitzung); auf
  eine **bestätigte** darf er nichts anfassen — der Endpunkt ist öffentlich.
- **Eine Übersetzung hängt an einem echten Fremdschlüssel** (F93): drei Tabellen
  mit `(elternteil_id, locale)` und `ON DELETE CASCADE`, keine polymorphe
  `(entity_type, entity_id)`-Tabelle. Jede Textspalte nullbar — `NULL` heißt „nimm
  das Original", nicht „leer". Eine geleerte Übersetzung **löscht** ihre Zeile,
  Schreiben **ersetzt** (F98) — alles, was übersetzte Sprachen zählt, zählt Zeilen.
- **Nicht übersetzt werden Adresse, Personenname, Zeit und `languages`** (F61,
  E25): eine übersetzte Straße schickt Menschen an den falschen Ort, und in
  welchen Sprachen eine Veranstaltung _stattfindet_, ist eine Tatsache über sie.
- **Ein Zeilen-Logo liegt in `logos/`, und die Datenbank hält das fest** (F113):
  `CHK_event_series_logo_path` und `CHK_event_logo_path` lassen `NULL` oder
  `logos/%` zu — dieselbe Konstruktion wie bei den Branding-Spalten, und aus
  demselben Grund: die Nachbarn eines gespeicherten Pfades sind Anmeldungsanhänge
  (E9). Geschrieben wird die Spalte **nur** über `setLogoPath`, nie über
  `EventSeriesChanges`/`EventChanges` — ein Formular, das eine Pfadspalte leeren
  kann, leert sie irgendwann versehentlich (F116).
- **Der Profil-Baukasten ist instanzweit, das Anmeldeformular je Event** (F122,
  E35). `profile_field` hat **kein** `event_id`, sein Schlüssel ist instanzweit
  eindeutig, und die Routen sind eine flache Sammlung. Sonst gelten dieselben
  Regeln wie bei `registration_field` — Schlüssel aus der Beschriftung und dann
  unveränderlich, Typ fest, Reihenfolge als Ganzes, `sort` nicht eindeutig. **Kein
  Datei-Typ:** eine Datei ist eine `attachment`-Zeile (F37), und ein Profil hat
  keine Anmeldung, an der eine hängen könnte. `help_text` gibt es trotzdem —
  ohne die Spalte wären die beiden Baukästen strukturell verschieden.
- **Geteilt wird die Regel, nie die Tabelle** (F138). Was eine Antwort gültig
  macht, wie ein Schlüssel aus einer Beschriftung entsteht und was die Auswahl
  einer Auswahlliste ist, liegt einmal in `business/common/field-kit.ts`. Ein
  gemeinsamer _Port_ für zwei Feldtabellen wäre dagegen ein Typ, der für sich
  nichts bedeutet — die eine filtert nach Event, die andere nicht.
- **Der Tätigkeitsbereich ist eine Spalte** (F123, E36), weil die Profilsuche
  darauf filtert (FR 4.4). Geleert heißt `NULL`, nicht `''`: eine Bedingung statt
  zwei, und kein Profil behauptet, sein Mensch arbeite an nichts.
- **`searchable` ist aus, bis sein Mensch es einschaltet** (E37, F13) — und es
  ist das Opt-in für Suche **und** Kontakt. Der Vorgabewert ist der Punkt: ein
  Aktivistenprofil, das durch eine Migration auffindbar wird, ist genau der
  Unfall, den dieses Projekt nicht haben darf.
- **Ein Profilbild liegt in `avatars/`, und die Datenbank hält das fest** (F124):
  `CHK_user_profile_avatar_path` lässt `NULL` oder `avatars/%` zu — dieselbe
  Konstruktion wie bei den Logos (F113), und geschrieben wird die Spalte **nur**
  über `setAvatarPath`, nie über `UserProfileChanges` (F116). Eigener Teilbaum
  und nicht eine Ecke von `logos/`: ein Logo ist eine Marke, ein Avatar das Bild
  eines Menschen, und ein Operator muss das mit `ls` unterscheiden können.
- **Zwei Menschen haben genau ein Gespräch, und das garantiert die Datenbank**
  (F153). `conversation.direct_key` trägt die beiden Profil-Ids sortiert, ist
  `UNIQUE` und laut `CHK_conversation_direct_key` genau für `type = 'direct'`
  gesetzt; der Port fügt mit `ON CONFLICT DO NOTHING` ein und liest zurück.
  „Lesen, dann schreiben" ist die Rennsituation, die zwei gleichzeitige Klicks
  in zwei Gespräche verwandelt. Gebaut wird der Schlüssel **nur** in der
  Datenzugriffsschicht.
- **Gelesen ist ein Zustand des Mitglieds, nicht der Nachricht** (E38).
  `conversation_member.last_read_at`, kein `message.read_at`: in einer Gruppe
  ist „gelesen" je Empfänger wahr. Ungelesenes wird **gezählt**, nie gespeichert
  (F56) — und gezählt wird nur, was jemand **anderes** geschrieben hat.
- **Eine Mitgliedschaft hat keinen Fremdschlüssel auf ihr Mitglied** (E39):
  `member_id` zeigt je nach `member_type` auf `admin_user` oder `user_profile`.
  Der Preis ist bewusst — die Alternative wären zwei nullbare Spalten mit einem
  `CHECK` und ein Coalesce in jeder Abfrage. Folge, die man kennen muss: ein
  gelöschtes Profil nimmt seine Gespräche **nicht** mit (es gibt bis Phase 5
  keinen Weg, ein Profil zu löschen), und wer per SQL aufräumt, nennt die
  Gespräche ausdrücklich.
- **Das Gespräch einer Kontaktanfrage hat keine Mitgliedszeile** (F133, E39).
  `type = 'organizer_contact'`, `guest_email` (und `guest_name`) auf dem
  **Gespräch** statt auf einer erfundenen Kontozeile, `event_id` gesetzt,
  `topic` leer, die erste Nachricht mit `sender_type = 'guest'` ohne
  `sender_id` (`CHK_message_sender_id`) — und in `conversation_member`
  **nichts**. Die Veranstalterseite ist die Organisation, und die ist kein
  Konto: `member_type = 'admin'` müsste eine Administratorzeile nennen, wo
  niemand angemeldet ist, und wer morgen dazukommt, wäre für die Anfrage von
  heute blind. Die **Art** des Gesprächs sagt, wessen es ist; die Übersicht des
  Veranstalters liest danach, nie über eine Mitgliedschaft. Zwei Folgen: für
  die Veranstalterseite gibt es kein `last_read_at` (also keine gerechnete
  Ungelesen-Zahl — wer sie will, legt eine Zeile an und entscheidet nichts neu),
  und ein Teilnehmer sieht diese Gespräche nie, weil seine Liste aus der
  Mitgliedschaft kommt. Gespräch und erste Zeile entstehen in **einer**
  Transaktion, und je Anfrage ein neues Gespräch: nichts authentifiziert
  `guest_email`, also hieße Zusammenfassen zu behaupten, zwei Anfragen kämen
  von derselben Person.
- **Eine Nachricht ist Text, Bild oder beides — nie nichts** (E40).
  `CHK_message_content`, dazu `CHK_message_body` gegen einen Rumpf aus
  Leerzeichen. Kein `updated_at`, kein Lösch-Flag: eine Nachricht, die nach dem
  Lesen umgeschrieben werden kann, macht das Gespräch darüber zu einem anderen.
- **Das Bild einer Nachricht ohne Text lässt sich nicht löschen** (F158), und
  das ist kein Fehler, sondern was zwei Klauseln zusammen sagen:
  `message.attachment_id` ist `ON DELETE SET NULL` (eine gelöschte Datei löscht
  keine Nachricht), und `CHK_message_content` verlangt Text oder Bild. Also
  darf ein Bild von einer Nachricht **mit** Worten weg, und eine Nachricht kann
  nicht geleert werden. Wer aufräumt, hält die Reihenfolge: Anhangs-Ids merken,
  Gespräch löschen (kaskadiert die Nachrichten), dann die Anhänge. **Seit AP 10
  tut das jemand:** `AttachmentsService.purgeConversationsForEvent` (und
  `…ForSeries`), aufgerufen dort, wo die Anmeldungsdateien schon aufgeräumt
  werden — aber über einen **eigenen** Port
  (`ConversationPurgeRepository`), denn die Löschmethoden des Attachment-Ports
  sind absichtlich auf Zeilen **mit** Anmeldung eingeschränkt, damit von dort
  niemand an ein Bild in einem Gespräch kommt. Erreichbar ist das eng, aber
  echt: eine Veranstaltung mit bestätigten Anmeldungen lässt sich nicht löschen
  (E14), also trifft es die, deren Anmeldungen wieder storniert wurden.
- **Die Organisation liest ihre Gespräche über einen zweiten Port** (F173).
  `ConversationRepository` kennt Mitgliedschaft als einzigen Ausweis — jede
  Methode nimmt das fragende Mitglied (F152) —, und die Organisation hat keine
  (F133). Also nicht dort eine „lies irgendein Gespräch"-Methode nachrüsten,
  sondern `OrganizerConversationRepository` daneben, dessen **jede Anweisung**
  `type IN ('group', 'organizer_contact')` trägt: ein `direct`-Gespräch kommt
  dort nicht heraus. Zwei Ports über zwei Tabellen sind kein Duplikat, wenn die
  Zugangsregel der Unterschied ist. Dieselbe Bauweise entscheidet, **wer in eine
  Gruppe darf**: das `INSERT … SELECT` leitet die berechtigten Personen aus den
  bestätigten Anmeldungen der Veranstaltung ab, statt eine geprüfte Liste zu
  bekommen. **Vorsicht bei TypeORM:** ein `return null` im
  Transaktions-Callback **committet** — der Rückzieher muss geworfen werden
  (siehe [Werkzeug-Fallen](tooling-traps.md)).
- **Das Bild einer Nachricht ist ein `attachment` in `messages/`** (F155, E40):
  `registration_id` und `field_key` sind **gemeinsam** nullbar
  (`CHK_attachment_owner`) — ein Chatbild beantwortet keine Formularfrage —, und
  `CHK_attachment_area` erlaubt einer Anmeldungsdatei nur `attachments/%`, einem
  Chatbild nur `messages/%`. Dieselbe dritte Schicht wie bei den Logos (F113),
  und hier trägt sie mehr als Ordnung: die Zusage von E9 über `attachments/`
  („wird nie ausgeliefert") muss weiter gelten, während ein Chatbild
  ausgeliefert wird — an Mitglieder.
- **Ein Event erbt das Logo seiner Reihe nicht** (F114). Jede Zeile zeigt ihr
  eigenes oder keines; der Rückfall ist die Kopfzeile, die das Organisationslogo
  ohnehin auf jeder Seite trägt. Eine Kette hätte dasselbe Bild zweimal auf eine
  Seite gebracht, und „ich habe das Event-Logo entfernt, jetzt erscheint das der
  Reihe" hat niemand angefordert.

- **`push_subscription.user_id` ist nullbar, und das ist die Zusage** (F134,
  E43): ein Browser ohne Konto behält sein Abonnement. `ON DELETE CASCADE` —
  ein gelöschtes Profil nimmt seine Geräte mit. Die **Identität der Zeile bleibt
  der Endpunkt** (unique): ein Gerät wird umgehängt, nie verdoppelt, sonst hieße
  ein geteiltes Tablet zwei Benachrichtigungen für einen Bildschirm. Die Spalte
  fehlte seit Phase 0 mit Absicht — ohne `user_profile` hätte sie keinen
  Fremdschlüssel gehabt, und eine Spalte, die die Datenbank nicht sauber halten
  kann, ist schlimmer als keine.
- **Zwei partielle Indizes statt einem** auf derselben Spalte, weil die
  Zielgruppe zwei Hälften hat: `WHERE user_id IS NOT NULL` für die Geräte eines
  Kontos, `WHERE user_id IS NULL` für die ohne. Ein gewöhnlicher Index über eine
  Spalte, die zur Hälfte `NULL` ist, beantwortet die zweite Frage nicht.

Siehe auch: [Schichten und Ports im Server](server-layers.md), [Ausgehende Mail](mail.md).

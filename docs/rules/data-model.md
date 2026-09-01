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
  409 — das wäre eine Sackgasse ohne Archiv-Flag.
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
- **Das Upload-Volume wird nie statisch ausgeliefert** (E9). Einziger Weg zu den
  Bytes: `GET /api/admin/attachments/:id`, immer als `attachment`-Download.
  `/api/media` ist für Branding und ausdrücklich nicht dafür.
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
- **Ein Event erbt das Logo seiner Reihe nicht** (F114). Jede Zeile zeigt ihr
  eigenes oder keines; der Rückfall ist die Kopfzeile, die das Organisationslogo
  ohnehin auf jeder Seite trägt. Eine Kette hätte dasselbe Bild zweimal auf eine
  Seite gebracht, und „ich habe das Event-Logo entfernt, jetzt erscheint das der
  Reihe" hat niemand angefordert.

Siehe auch: [Schichten und Ports im Server](server-layers.md), [Ausgehende Mail](mail.md).

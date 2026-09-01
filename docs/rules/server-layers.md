# Schichten und Ports im Server

Die Schichtentrennung des Servers ist keine Konvention, sondern durchgesetzt —
und die Antwort auf jeden Verstoß ist ein Port, nie eine gelockerte Regel.

Die Thesis verlangt, dass ein Datenbankwechsel allein durch Austausch
der Datenzugriffsschicht möglich bleibt (NFR). Jede Abkürzung, die die
Geschäftslogik direkt an TypeORM, `fs` oder ein Fremdmodul hängt, kostet genau
diese Eigenschaft.

- **Layer-Grenzen sind ESLint-Regeln** in `apps/server/eslint.config.mjs`. Bei
  Verstoß **einen Port einziehen**, nicht die Regel lockern.
- Die Datenzugriffsschicht darf nur auf `ports/` zugreifen. Ein von mehreren
  Modulen geteilter Port gehört deshalb nach `business/common/ports/` (F100).
- **Dateien sind Datenzugriff.** `FileStore` ist ein Port wie ein Repository; die
  Geschäftslogik weiß, _dass_ eine Datei bleibt, nicht _wo_. Kein `fs`-Import in
  der Geschäftslogik.
- **Zählen statt Lesen:** wer nur Zahlen braucht, bekommt einen eigenen schmalen
  Port (`RegistrationTally`, `ProgramTally`) statt Zugriff auf die Zeilen. Einen
  zählenden Port bekommt, was groß oder unbegrenzt ist; dreißig winzige
  Felddefinitionen werden in der Geschäftslogik gezählt (F49).
- **Eine Zusammensetzung gehört über ihre Teile.** `business/dashboard`,
  `business/content-translations` und `business/manifest` importieren ihre
  Quellen; im Elternmodul hätte derselbe Service den Kreis geschlossen und einen
  `forwardRef` gebraucht (F49, F100, F103). Jeder gefragte Service löst das Event
  **selbst** auf — drei Primärschlüssel-Lesezugriffe sind der Preis dafür, dass
  jedes Modul seine 404-Regel behält.
- **Unteilbarkeit gehört in die Datenzugriffsschicht, die Regel in die
  Geschäftslogik** (F43): die Platzgrenze entscheidet die Datenbank, in einer
  Anweisung, unter `FOR UPDATE` auf der Programmpunkt-Zeile; der Port nimmt die
  Kapazität mit und antwortet `created` / `already-signed-up` / `full`. Wer eine
  zweite Grenze braucht, zieht denselben Schnitt — **nicht** „erst zählen, dann
  schreiben".
- **Ein Plug-in liest Kerndaten nur über den Vertrag** (E12, F45).
  `PluginProgramReads` liefert fünf Felder je Programmpunkt und Anmeldezahlen,
  nichts sonst; bereitgestellt vom globalen `PluginHostModule`. Ein Plug-in
  importiert ausschließlich aus `plugin-api`. Neue Fähigkeit = Minor am
  `PLUGIN_API_VERSION` **plus** ein Fall im Kompatibilitätstest.
- Ein Plug-in bringt **eigene** Entities und Migrationen mit; Kerntabellen werden
  nie angefasst. Raumzuordnung von Programmpunkten = plug-in-eigene Join-Tabelle
  (F21) — `program_item` hat **kein** `room_id`.
- **`type` statt `interface` für generische Nutzlasten** (F101): nur ein
  Objekt-`type` bekommt eine implizite Indexsignatur, und daran hängen der eine
  generische Port, das eine generische Repository und das eine Formularbauteil.

Siehe auch: [Verträge der Endpunkte](api-contracts.md), [Regeln des Datenmodells](data-model.md).

# Stille Fallen in TypeORM und den Testrunnern

Zwei Fallen, die keinen Fehler werfen, sondern ein falsches Ergebnis liefern.

Beide sind einmal als Anwendungsfehler gesucht worden, bevor klar war,
dass das Werkzeug etwas anderes tut als erwartet.

- **Ein UPDATE über `repository.query()` antwortet `[rows, rowCount]`** — zwei
  Elemente, immer. `rows.length` meldet also „zwei Zeilen geändert", auch wenn
  nichts geändert wurde. Wer eine Anzahl braucht, nimmt den Query-Builder und
  `result.affected`.
- **Jest und Vitest starten aus verschiedenen Verzeichnissen.** `process.cwd()`
  ist unter Vitest (`libs/*`) der Arbeitsbereich und unter Jest (`apps/server`)
  das Projektverzeichnis. Wer in einem Servertest eine Datei des Arbeitsbereichs
  liest, **sucht sie nach oben**, statt einen Pfad zu raten.

Siehe auch: [Browsersuiten und E2E-Tests](e2e-tests.md), [Schichten und Ports im Server](server-layers.md).

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
- **Und beide starten aus dem Verzeichnis, aus dem `nx` gestartet wurde.**
  `nx test user-client` aus einem Unterordner heraus ließ die zwei PWA-Suiten
  scheitern, die Dateien lesen (Iconliste gegen `public/`, Manifest-Adresse
  gegen `index.html`) — acht rote Tests, die mit der Änderung nichts zu tun
  hatten, und `nx` merkt sich den Lauf danach als „flaky". Testläufe gehören in
  die **Wurzel des Arbeitsbereichs**.
- **Eine einzelne Suite fährt man mit dem Runner, nicht mit `nx`.** `--filter`
  von Jest meint **Module**, keinen Testnamen, und die Nx-Schemata lehnen
  positionale Pfade ab. Für den Server:
  `npx jest -c jest.config.cts --testPathPatterns=<teil>` aus `apps/server`
  (die Datei heißt `.cts`, nicht `.ts`). Playwright nimmt `--grep`.

- **Eine schon gelaufene Migration läuft nicht erneut.** Es gibt kein
  Migrations-CLI in diesem Repository — der Server migriert beim Start. Wer eine
  Migration des laufenden Arbeitspakets **nachträglich ergänzt**, sieht die
  Ergänzung nie: der Name steht schon in `migrations`. Zurückrollen heißt hier,
  das eigene `down` von Hand zu fahren
  (`docker exec trefaro-postgres psql -U trefaro -d trefaro`) und die Zeile aus
  `migrations` zu löschen. Das ist zugleich die einzige Stelle, an der `down`
  wirklich geprüft wird — die Regel „einmal wirklich ausgeführt" meint genau das.

Siehe auch: [Browsersuiten und E2E-Tests](e2e-tests.md), [Schichten und Ports im Server](server-layers.md).

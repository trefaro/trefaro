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

- **`nx format:write --uncommitted` überspringt still.** Es hat `todo.md`
  aufgelistet und **nicht** geschrieben — gestaged wie ungestaged —, während
  `npx nx format:check` und `prettier --check` die Datei beide beanstanden. Der
  Lauf sieht damit erfolgreich aus, und der Fehlschlag kommt erst im
  `quality`-Job der CI (`nx format:check`), also nach dem Push. Reproduziert
  am 03.09.2026 mit einem umgebrochenen Inline-Code-Span. **Das Tor ist
  `nx format:check`** — vor dem Commit laufen lassen, und was es nennt, mit
  `npx nx format:write --files <pfad>` (oder `npx prettier --write <pfad>`)
  richten; nur diese beiden haben die Datei tatsächlich angefasst.
- **Und `--base/--head` sieht nur, was **committet** ist.** Bei uncommitteter
  Arbeit prüft `nx format:check --base=<sha> --head=HEAD` die Dateien, die
  zwischen den beiden **Commits** geändert wurden — also nichts, und der Lauf
  ist grün, während `prettier --check` auf denselben Dateien vier Verstöße
  nennt. Reproduziert am 03.09.2026 in AP 10. Für die Arbeit im Arbeitsbaum
  also: `npx prettier --check <dateien>` (oder `nx format:check --files …`);
  `--base/--head` ist das Tor **nach** dem Commit, so wie CI es fährt.
- **Eine schon gelaufene Migration läuft nicht erneut.** Es gibt kein
  Migrations-CLI in diesem Repository — der Server migriert beim Start. Wer eine
  Migration des laufenden Arbeitspakets **nachträglich ergänzt**, sieht die
  Ergänzung nie: der Name steht schon in `migrations`. Zurückrollen heißt hier,
  das eigene `down` von Hand zu fahren
  (`docker exec trefaro-postgres psql -U trefaro -d trefaro`) und die Zeile aus
  `migrations` zu löschen. Das ist zugleich die einzige Stelle, an der `down`
  wirklich geprüft wird — die Regel „einmal wirklich ausgeführt" meint genau das.

- **Ein `return` im Transaktions-Callback von TypeORM committet.**
  `manager.transaction(async (m) => { … return null })` schreibt alles, was der
  Callback getan hat — der Rückgabewert ist der Rückgabewert, nicht das Urteil.
  Wer zurückrollen will, **wirft**; die Ausnahme wird eine Ebene höher gefangen
  und in das übersetzt, was der Port versprochen hat. Gefunden in AP 10 der
  Phase 3: eine Gruppe, deren Mitglieder nicht alle berechtigt waren, sollte
  „nichts geschrieben" bedeuten, und lag hinterher als Gespräch ohne Mitglieder
  in der Tabelle. Gefunden hat es die Vertragssuite, weil sie **nach** dem 400
  noch einmal gezählt hat — ein Test, der nur den Statuscode prüft, hätte das
  nie gesehen.
- **Ein Modulschalter, den ein Test in der Tabelle umlegt, wirkt nicht.** Der
  Server hält die Flags in `ModuleFlagCache`; eine Zeile hinter seinem Rücken
  bedeutet nichts, bis der Cache nachlädt — der Test ist also erst eine Weile
  grün aus dem falschen Grund und dann rot aus dem richtigen. In Tests wird über
  `PATCH /api/admin/modules/:key` geschaltet (`setModuleEnabled` aus dem
  Datenbank-Helfer ist für Zustände, die kein Endpunkt herstellt).
- **`[maxlength]` ist kein Angular-Binding.** Auf `<input>` und `<textarea>` ist
  es ein **Attribut**: `[attr.maxlength]`. Der Fehler ist ein
  Kompilierfehler (`NG8002`), fällt aber erst im `build` auf — `tsc --noEmit`
  sieht Templates nicht.

- **Eine Warnung, die nur den Statuscode nennt, sagt nichts.** „Push delivery
  failed with status unknown" war derselbe Satz für einen Push-Dienst mit 500 und
  für eine Nutzlast, die die Bibliothek nicht verschlüsseln kann — und nur das
  zweite ist ein Defekt. Der Grund gehört ins Log; ohne ihn wäre in AP 11 der
  TLS-Fund oben eine Stunde Rätselraten geblieben.

- **`nx serve server` im Watch-Modus kann stehen bleiben, und `/api/health`
  sagt es nicht.** Zwei Dateiänderungen kurz nacheinander (AP 4 der Phase 4:
  ein Import und die Registrierung im selben Verzeichnis) ließen Nx „Recursive
  task invocation detected" melden und mit „Build failed, waiting for changes to
  restart…" stehen — **nachdem** webpack „compiled successfully" gemeldet
  hatte. Danach startet nichts mehr neu, aber der **alte** Prozess läuft weiter
  und antwortet auf `/api/health` mit `up`. Wer so auf eine Migration wartet,
  wartet auf den falschen Beweis: die Frage ist die Tabelle `migrations`
  (`docker exec trefaro-postgres psql -U trefaro -d trefaro -tAc "select name
from migrations order by timestamp desc limit 1"`), nicht der Health-Endpunkt.
  Abhilfe: den Serve-Prozess beenden und neu starten. **Und die Umkehrung**
  (AP 5 der Phase 4): `nx e2e` fährt den Server als Abhängigkeit im Watch-Modus
  hoch — wer währenddessen eine Datei unter `apps/server/` oder `libs/` schreibt
  (es war eine README), löst einen Neustart aus, und das `globalSetup` der
  Browsersuite läuft in `ECONNREFUSED`. Der Fehlschlag steht im Seed und sieht
  nach einem kaputten Fixture aus. Solange eine Suite läuft, schreibt man nur
  außerhalb des Baums, den ihr Server beobachtet (`docs/`, `todo.md`).

- **`gh run watch --exit-status` ist kein Urteil.** Auf einen Lauf, der noch
  läuft, angesetzt, endete es mit **0**, während der Lauf als `failure`
  abschloss: GitHub setzt `status: completed`, bevor `conclusion` steht, und wer
  in dieses Fenster fällt, sieht keine Fehlschläge mehr. Dasselbe Kommando auf
  denselben, jetzt abgeschlossenen Lauf endet mit 1. Also: nach dem Warten
  **den Abschluss lesen** — `gh run view <id> --json conclusion,jobs`, oder
  dasselbe Kommando mit `--exit-status` —, und erst dann „grün" sagen. Genau so
  ist der rote Abschluss der Phase 3 einmal als grün gemeldet worden.
- **„Cannot configure the test module when the test module has already been
  instantiated"** — ein Angular-Unit-Test unter Vitest, der in **einem** `it`
  zweimal rendert (zweimal `TestBed.configureTestingModule`). Ein `it`, ein
  Render; wer zwei Zustände prüfen will, schreibt zwei Tests oder setzt am
  einen Fixture einen Input neu. Zweimal hineingelaufen (AP 5 und AP 6 der
  Phase 4), deshalb hier.

Siehe auch: [Browsersuiten und E2E-Tests](e2e-tests.md), [Schichten und Ports im Server](server-layers.md).

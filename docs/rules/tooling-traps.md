# Stille Fallen in TypeORM und den Testrunnern

Zwei Fallen, die keinen Fehler werfen, sondern ein falsches Ergebnis liefern.

Beide sind einmal als Anwendungsfehler gesucht worden, bevor klar war,
dass das Werkzeug etwas anderes tut als erwartet.

- **Nx lädt `.env.<zielname>` für eine Task dieses Namens — und das ist
  benutzbar.** Für `projekt:ziel` liest Nx der Reihe nach
  `.env.<ziel>.local`, `.env.<ziel>`, `.env.local`, `.env` — erst im
  Projektverzeichnis, dann in der Wurzel; früher geladene gewinnen. Ein Ziel
  namens `serve-e2e` bekommt damit `apps/server/.env.serve-e2e` und
  `nx serve server` bekommt sie nicht, ohne dass irgendwo ein Schalter steht.
  Genau darauf ruht das Drosselprofil der Phase 5 (E61). Zwei Dinge dazu:
  **`dependsOn` kennt keine Konfiguration** — `{"projects": [...], "target": "x"}`
  hat kein `configuration`-Feld, also wird aus „dieselbe Task mit anderer
  Konfiguration" ein **eigenes Ziel**; und **`@nx/js:node` hat keine
  `env`-Option**, der Umweg über die Datei ist also nicht Geschmackssache.
  Nachgemessen statt geglaubt: `nx run server:serve-e2e` schreibt die sechs
  Profilzeilen, `nx run server:serve` keine einzige.
- **Ein Kommentarschlüssel in `project.json` muss eine Eigenschaft des Objekts
  benennen, in dem er steht.** Steht er in `targets`, ist er ein **Ziel** — und
  der Projektgraph scheitert dann komplett (`Failed to process project graph`),
  nicht etwa mit einer Warnung an der betroffenen Stelle. Also `"// targets"`
  neben `targets` auf Projektebene, `"// dependsOn"` neben `dependsOn` **im**
  Ziel. Diese Falle hat in Phase 5 zweimal zugeschlagen, in AP 1 und in AP 2,
  und beim zweiten Mal stand sie schon in dieser Datei.
- **Ein UPDATE oder DELETE über `repository.query()` antwortet
  `[rows, rowCount]`** — zwei Elemente, immer, und **auch mit `RETURNING`**.
  `rows.length` meldet also „zwei Zeilen geändert", auch wenn nichts geändert
  wurde, und `result.map(row => row.id)` gibt zwei `undefined` statt der
  zurückgegebenen Ids. Der zweite Teil dieses Satzes hat in AP 6 der Phase 5
  eine Aufräumbedingung stillgelegt und drei Zählwerte in einer Logzeile zu
  „2, 2, 2" gemacht — der Eintrag stand da schon, nur eben für `UPDATE`. Wer
  eine Anzahl braucht, nimmt den Query-Builder und `result.affected`; wer die
  Zeilen braucht, packt `result[0]` **einmal** in einen Helfer aus, nicht an
  jeder Aufrufstelle.
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

- **Eine `playwright.config.*` erzeugt still ein `e2e`-Target.** Das
  `@nx/playwright/plugin` in `nx.json` leitet aus **jeder** solchen Datei ein
  Target mit dem konfigurierten Namen ab — auch aus einer, die nie in
  `nx run-many -t e2e` landen soll. Ein neues Projekt, das gegen den
  Container-Stack läuft, war damit sofort Teil des `e2e`-Jobs der CI und wäre
  dort gegen einen Stack gelaufen, den niemand gestartet hat. Ein eigener
  Target-Name in `project.json` genügt **nicht**, weil die Ableitung danebensteht;
  das Projekt muss im Plugin-Eintrag ausgeschlossen werden
  (`"exclude": ["apps/stack-e2e/**"]`). Geprüft wird das mit
  `npx nx show projects --with-target e2e` — nach einem `nx reset`, sonst
  antwortet der Projektgraph aus dem Cache. Gefunden in AP 1 der Phase 5.
- **Ein Kommentarschlüssel in `project.json` muss eine echte Eigenschaft
  benennen.** `"// targets"` ist erlaubt, `"// e2e-stack"` nicht — Nx meldet
  „contains extension with invalid name" und die Zeile steht ab da in jedem
  Build-Log. Der Kommentar gehört in den Wert des Schlüssels, den er erklärt.
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
- **Ein npm-Paket kann sich im Browser anders verhalten als in Node**, und ein
  Testläufer entscheidet, welche Hälfte er auflöst. `qrcode` zeichnet über
  seinen Browser-Einstiegspunkt SVG und über seinen Node-Einstiegspunkt
  standardmäßig ein Bild aus **Blockzeichen für ein Terminal**; der Unit-Test
  des Bündels fand deshalb kein `<svg>`, während der echte Build eines
  lieferte. Abhilfe ist nicht, den Läufer zu konfigurieren, sondern die
  Absicht auszuschreiben (`type: 'svg'`) — eine Zeile, und beide Wege liefern
  dasselbe. Allgemein: was ein `browser`-Feld in der `package.json` umbiegt,
  ist eine Verzweigung, die kein Typ zeigt.
- **Ein CommonJS-Paket in einem Angular-Bündel braucht
  `allowedCommonJsDependencies`.** Sonst warnt der Build je Import über
  „optimization bailouts" — kein Fehler, aber eine Warnung, die bei jedem
  Bauen mitläuft und die nächste echte verdeckt. Der Eintrag steht in den
  `options` des Build-Targets, nicht in der Konfiguration.
- **Derselbe Platzhalter kann in PostgreSQL nicht Enum und Vergleichswert
  sein.** `VALUES (…, $5, CASE WHEN $5 = 'pending' THEN NULL ELSE now() END)`
  scheitert mit `inconsistent types deduced for parameter $5`: einmal soll er
  der Enum-Typ der Spalte sein, einmal `text`. Entweder casten
  (`$5::text = 'pending'`) oder — besser in einem Fixture — die Entscheidung im
  aufrufenden Code treffen und den Wert als eigenen Parameter schicken.
- **`noPropertyAccessFromIndexSignature` macht ein `Record<string, string>` im
  Test unbenutzbar mit Punktzugriff.** Die Wortsammlung eines Bündels als
  `Record<string, string>` zu typisieren zwingt jeden Test zu
  `STRINGS['remove']` — und dabei ist ein Tippfehler `undefined` statt eines
  Fehlers, also ein Test, der aus dem falschen Grund grün wird. Die Sammlung
  wird deshalb als Literal geschrieben und mit `as const satisfies
Record<string, string>` festgenagelt: der Punktzugriff funktioniert, und ein
  Schlüssel, den es nicht gibt, ist ein Build-Fehler.
- **Das `unzip` von Debian kann kein Unicode.** Info-ZIP 6.00 ist ohne
  `UNICODE_SUPPORT` gebaut und liest einen UTF-8-Namen, als wäre er CP437: aus
  `lebenslauf-öäü.txt` wird beim Entpacken eine Datei mit einem anderen Namen
  auf der Platte, obwohl das Archiv korrekt ist und Bit 11 gesetzt hat. Ein
  Test, der ein selbst geschriebenes ZIP prüft, nimmt deshalb Pythons
  `zipfile` — es ehrt das Flag und prüft nebenbei jede CRC.
- **Ein tiefer Typ-Import in ein Paket hinein löst sich für den Build auf und
  für die Spec-Übersetzung nicht.** `typeorm-content-translation.repository.ts`
  holte `QueryDeepPartialEntity` über
  `typeorm/query-builder/QueryPartialEntity`; `tsconfig.app.json` fand den Pfad,
  die Jest-Übersetzung nicht. Die Folge sah nach etwas ganz anderem aus: **jede**
  Spec, die irgendwie bis zur Zusammensetzung reichte — in AP 9 der Phase 5 ein
  Inventar, das `AppModule` importieren wollte —, scheiterte mit `TS2307` in
  einer Datei, mit der sie nichts zu tun hatte, und ein Build hätte es nie
  gezeigt. Der Ausweg ist, den Typ aus dem Ausdruck abzuleiten, der ihn braucht
  (`Parameters<typeof insert.values>[0]`), statt ihn aus dem Inneren eines
  Pakets zu importieren.
- **`pkill -f <muster>` trifft seine eigene Kommandozeile.** Die Shell, die den
  Befehl ausführt, trägt das Muster im Argument — also erlegt sie sich selbst
  und liefert 144, während das eigentliche Ziel durchaus getroffen wurde. Zwei
  Mal passiert (AP 10 und AP 11 der Phase 5), beide Male sah es aus, als wäre
  der Befehl gescheitert. Wer einen Hintergrundprozess beenden will, nimmt die
  **PID**, die beim Start ausgegeben wurde, und prüft danach mit `ss -ltn`, ob
  der Port frei ist.
- **Ein Prüfskript unter `tools/` veraltet lautlos**, weil keine Suite es
  fährt. In AP 11 der Phase 5 hat `verify-plugin-toggle.mjs` vier Ablehnungen
  im **Satz** des Servers gesucht (`body.message` enthält den Schlüssel) — seit
  AP 5 derselben Phase reist eine Ablehnung als **Code mit Werten** (E64), also
  meldeten vier Prüfungen rot an einem Server, der sich völlig richtig verhielt.
  Dieselbe Klasse von Befund wie in AP 6 der Phase 4. Wer ein Skript dort
  anfasst, fährt es einmal ganz gegen eine laufende Instanz — und wer eine
  Antwortgestalt ändert, sucht in `tools/` danach.

Siehe auch: [Browsersuiten und E2E-Tests](e2e-tests.md), [Schichten und Ports im Server](server-layers.md).

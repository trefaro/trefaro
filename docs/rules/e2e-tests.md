# Browsersuiten und E2E-Tests

Wie die Browsersuiten dieses Repositories geschrieben werden, und welche
Fehlschläge nach einem kaputten Fixture aussehen, aber keines sind.

Drei Browser × zwei Suiten laufen parallel gegen **eine** Instanz mit
**einer** `app_config`-Zeile und einer globalen Drosselung. Fast jeder
Flake dieses Repositories kam daher, nicht aus dem Anwendungscode.

- **Playwrights `name` vergleicht Teilstrings**, nicht ganze Namen:
  `getByRole('link', { name: 'Participants' })` traf auch „All participants".
  Wo eine Seite zwei Wege zur selben Ansicht anbietet, braucht der Test
  `exact: true`. Ebenso: `getByText('0%')` trifft die Null in „20 %", und zwei
  Tabellen auf einer Seite brauchen `aria-label`, sonst trifft ein
  Zeilen-Locator die Kopfzeile der anderen.
- **Fixture-Namen tragen keine Uhrzeit.** `fixtureLabel()` bildet
  `<scope>-<pid>-<n>`; ein Playwright-Arbeiter ist ein Prozess, seine pid trennt
  ihn von allen anderen. `Date.now()` kollidierte am eindeutigen Slug-Index.
- **Zwei Suiten dürfen nicht denselben Slug ableiten** — derselbe Fehlschlag.
- **Eine Browsersuite meldet sich einmal pro Lauf an**, nicht pro Fixture: der
  Login erlaubt 20 Versuche in fünf Minuten (E4), und ein 429 im Seed sagt nichts
  über den Test. Beide Suiten legen die Sitzung in eine Datei im Temp-Verzeichnis.
- **Aufräumcode muss mit einem 404 rechnen** — wer über eine Liste iteriert,
  findet Einträge, die es beim zweiten Zugriff nicht mehr gibt.
- **`test.skip(browserName !== 'chromium')` verhindert kein Rennen _innerhalb_
  einer Datei.** Playwright verteilt auch die Tests einer Datei auf mehrere
  Arbeiter (`fullyParallel` im Nx-Preset); die CI läuft mit einem Arbeiter und
  sieht es nie. Zwei Tests, die denselben instanzweiten Zustand schreiben, gehören
  in `test.describe.configure({ mode: 'serial' })` — oder nach `apps/server-e2e`.
- **Instanzweiter Zustand gehört nach `apps/server-e2e`** (dort läuft eine Suite
  allein, `maxWorkers: 1`): Modulschalter mit Fernwirkung, ein dritter Eintrag im
  Sprachumschalter, alles mit `module_config`. Im Browser gilt: nur Chromium, und
  **wiederherstellen, was gefunden wurde**. Die Suiten schreiben **keine Farbe**
  (`start-up.spec.ts` prüft `#1f6f5c` in beiden Clients) und schalten **nicht**
  `media-links` (zwei andere Suiten benutzen es parallel).
- **Die Suiten nennen Schlüssel, keine Wörter.** `t(key, params, locale)` aus
  `support/catalogue.ts` liest die mitgelieferten Kataloge von der Platte und
  **wirft** bei einem unbekannten Schlüssel, statt Schlüssel gegen Schlüssel zu
  vergleichen; `tPattern()` für Sätze, deren Parameter ein Test nicht nachbauen
  kann; `expectNoRawKeys(page)` findet jede Lücke der Extraktion auf einer
  besuchten Seite — **nicht** auf der Sprachverwaltung, die zeigt Schlüssel als
  Funktion. Verglichen werden **ganze** Textknoten. Literal bleibt nur
  Fixture-Text, ein Bezeichner, eine Uhrzeit — oder eine **Server**meldung (F77).
- **Ein Aufräumcode, der über alle Katalogschlüssel läuft, wächst mit dem
  Katalog.** `resetLocale()` schickte ein `DELETE` je Schlüssel und lief bei 149
  in den Timeout; es **fragt** jetzt, welche Schlüssel eine Zeile haben.
- **Eine Prozentzahl über hunderte Schlüssel bewegt sich nicht** — ein Test zählt
  („1 von 598 Schlüsseln") statt zu runden.
- **Nie `nx run-many -t e2e` über beide Browsersuiten.** Sechs Browser gegen einen
  Server, alle von `::1`, reißen die globale Drosselung (300 Anfragen/min):
  `/api/i18n/:locale` antwortet 429, beide Clients zeichnen rohe Schlüssel, und
  der Fehlschlag sieht nach kaputtem Katalog aus. Erst `user-client-e2e`, dann
  `admin-client-e2e`, wie in der CI.
- **Playwright emuliert Offline in WebKit nicht** — `context.setOffline()` wirkt in
  Chromium und Firefox; dort mit Begründung überspringen.

- **Ein Fehlerkörper trägt einen Zeitstempel.** Wer zwei Fehlerantworten auf
  Gleichheit prüft — weil ein Endpunkt für zwei Zustände dasselbe sagen soll
  (E10, E32) —, vergleicht `message` und `statusCode`, nie den ganzen Rumpf: die
  Millisekunde dazwischen macht den Test rot und sagt nichts.
- **Der Teilnehmer-Login hat sein eigenes Drosselbudget** — 20 Versuche in fünf
  Minuten, getrennt vom Admin-Login (der Zähler hängt an Route **und** Adresse).
  Die fünf Kontosuiten in `apps/server-e2e` verbrauchen davon vierzehn
  (`my-registrations.spec.ts` kam in AP 4 mit einer dazu, `profile-search.spec.ts`
  in AP 5 mit einer — dort braucht nur der **Suchende** eine Sitzung, die
  Gefundenen sind geseedet), die Browsersuite des
  Nutzer-Clients drei (einer je Engine, `profile.spec.ts` meldet sich genau
  einmal an und beweist das neue Passwort in `server-e2e`); wer eine weitere
  schreibt, zählt vorher nach. Ein 429 sieht dort aus wie ein Anmeldefehler und
  ist keiner. **Deshalb wächst `profile.spec.ts` statt Nachbarn zu bekommen:**
  „meine Anmeldungen" (AP 4) und die Profilsuche (AP 5) laufen in dessen einem
  Test mit, weil jede eigene Datei drei weitere Anmeldungen gekostet hätte.
- **Was instanzweit ist, muss eine Suite selbst wieder abräumen.** Der
  Profil-Baukasten (`profile_field`) hat kein Event, an dem er hängt: eine
  liegengebliebene **Pflichtfrage** lässt jedes `PATCH /api/participant/me`
  anderer Suiten scheitern, und ein liegengebliebener Schlüssel schickt den
  nächsten Lauf der eigenen Suite in den „nummeriere um die Kollision"-Zweig.
  `deleteProfileFields(prefix)` in `support/database.ts`, und jede Frage
  bekommt einen Schlüssel mit Lauf-Präfix. Dasselbe gilt für Konten: die Adresse
  ist instanzweit eindeutig (E31), also `deleteProfiles(domain)` im `afterAll`.
- **Ein `afterAll`, das nach Muster löscht, löscht die Fixtures der anderen
  Engines mit** (F147). Für ein Teilnehmerkonto gibt es bewusst keinen
  Löschendpunkt, also räumt die Suite per SQL nach Adressmuster ab — mit einer
  gemeinsamen Maildomain löschte die erste fertige Engine die **laufenden**
  Konten der beiden anderen, deren Sitzungszeilen gingen per Fremdschlüssel mit,
  und der Interceptor schob sie mitten im Test auf die Loginseite. Der Fehlschlag
  sah wie ein kaputter Login aus. Also: je Engine eine eigene Domain
  (`@<engine>.profiles.example.org`), und generell muss ein Muster, nach dem
  gelöscht wird, den eigenen Lauf tragen.
- **Was instanzweit sichtbar ist, sehen alle drei Engines.** Die Profilfragen
  hängen an keinem Event, also stehen auf der Profilseite auch die Fragen der
  beiden anderen Engines — eine Erläuterung mit demselben Wortlaut trifft dann
  dreimal. Der Lauf gehört in den **Wortlaut**, nicht nur in den Schlüssel.
  Aus demselben Grund seedet keine Browsersuite eine **Pflicht**frage: sie ließe
  jedes `PATCH /api/participant/me` der anderen Engines scheitern.
- **Eine Zusicherung über eine Tabellenzelle muss eine Zelle sein.** „Die Zeile
  enthält _Ja_" war grün, **bevor** es die Profilspalte gab: die
  Newsletter-Spalte daneben sagt für dieselbe Person dasselbe. Wer eine neue
  Spalte prüft, liest `getByRole('cell')` an der Position, die der
  Kopfzeilentest festhält — und ergänzt diesen zuerst, sonst prüfen beide Tests
  nichts.
- **`allInnerTexts()` wartet nicht.** Nach einem `reload()` steht die Liste noch
  nicht, und die Zusicherung vergleicht ein leeres Array — was als „die
  Reihenfolge stimmt nicht" gemeldet wird. Vorher auf eine Zeile warten, dann
  die Texte lesen.
- **Ein Server, der zwischen den Läufen stehen bleibt, sammelt die
  Drosselzähler.** `nx e2e` startet den Server als Abhängigkeit — wer aber
  daneben ein eigenes `nx serve server` laufen lässt (etwa zum Debuggen), lässt
  **einen** Prozess über alle Durchläufe hinweg zählen. Nach wenigen
  Volldurchläufen reißen dann zwei Budgets, und beide sehen nach einem
  Codefehler aus: das **Registrierungsbudget** (60 je 5 min, E4) lässt die
  mailbasierten Tests auf eine Nachricht warten, die nie verschickt wurde — es
  sieht nach kaputter Mail aus; das **Login-Budget** (20 je 5 min, danach 15
  Minuten Sperre) lässt das Loginformular stehen, wo es steht, und der Test
  meldet „URL ist noch `/profile/login`". Die Zähler liegen im Speicher, also
  ist die Abhilfe die aus `decisions.md`: **den Server neu starten**, nicht die
  Drosselung anfassen und nicht abwarten. Beim Arbeiten an einer einzelnen
  Stelle hilft `--grep`.
- **Ein Schalterpaar wird in der umgekehrten Reihenfolge zurückgesetzt.** Wer
  eine Voraussetzung testet (E42, F128), schaltet den Abhängigen aus, dann die
  Voraussetzung — und muss im `finally` die **Voraussetzung zuerst** wieder
  einschalten. Andernfalls verweigert sich das Zurücksetzen selbst, mit genau dem
  409, den der Test beweisen wollte.
- **Ein Fixture, das die API nicht herstellen kann, wird geseedet — mit
  Begründung.** „Auffindbar, aber unbestätigt" hat keinen Weg durch die
  Endpunkte: `searchable` ist nur hinter einer Sitzung schreibbar, und eine
  Sitzung gibt es erst nach dem Double-Opt-In (E32). Genau diese Zeile darf im
  Verzeichnis nicht auftauchen, also gehört sie in die Suite — `seedProfile` in
  `apps/server-e2e/src/support/database.ts`,
  `seedSearchableProfile` in der Browsersuite. Der Passwort-Hash ist dort
  Unsinn: nach so einer Zeile wird **gesucht**, mit ihr wird nie angemeldet, und
  ein Login würde ein Budget verbrauchen (E4).
- **Die Entwicklungsdatenbank ist nicht die Werksvorgabe.** Wer einmal
  `tools/demo-seed/` laufen ließ, hat Organisationsname und Primärfarbe der
  Demo in `app_config` — und die Browsersuiten erwarten `#1f6f5c` aus der ersten
  Migration. Zwei Fehlschläge in `start-up.spec.ts`, die nach einem
  Theming-Fehler aussehen, sind in Wahrheit der Seed. Zurücksetzen, nicht den
  Test anpassen.

Siehe auch: [Fallen in den Angular-Clients](angular-clients.md), [Deployment und Prüfung](deployment.md).

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

Siehe auch: [Fallen in den Angular-Clients](angular-clients.md), [Deployment und Prüfung](deployment.md).

# Was im Protokoll steht — und was nicht

Diese Datei ist in AP 10 der Phase 5 entstanden, mit der
Fehlerprotokollierung und den Betriebsmetriken (NFR 10, NFR 11). Sie hat einen
Satz als Mitte, und alles andere folgt daraus:

> **Ein Betreiber muss aus dem Protokoll erkennen können, was schiefging —
> ohne eine Adresse darin zu finden.**

Das sind zwei Forderungen, die sich widersprechen, solange man Fehlersuche für
dasselbe hält wie Nachvollziehen, wer etwas getan hat. Die Auflösung ist die
**Fehlerkennung**: acht Hexadezimalstellen, die derselbe Fehler in der Antwort
und in der Logzeile trägt. Wer vor dem Bildschirm sitzt, liest sie vor; wer das
Protokoll liest, findet damit genau einen Eintrag — und niemand musste
aufschreiben, wer gefragt hat.

## Die fünf Regeln

- **Eine Logzeile nennt eine Zeile bei ihrer Id, nie den Menschen dahinter.**
  Eine Id ist außerhalb dieser Datenbank bedeutungslos, und genau das macht sie
  in einer Mail an einen Betreuer unbedenklich. Durchgesetzt mechanisch:
  [`apps/server/src/app/log-hygiene.spec.ts`](../../apps/server/src/app/log-hygiene.spec.ts)
  liest jede `logger.*`-Aufrufstelle im Quelltext und lässt keine
  Interpolation durch, die eine Adresse, einen Vor- oder Nachnamen, ein
  Passwort, ein Token, eine Geräteadresse oder einen Suchbegriff benennt. Die
  Ausnahmeliste hat **einen** Eintrag (das Ersteinrichtungs-Token, das genau
  deshalb gedruckt wird) — das ist die Zahl, bis zu der eine Ausnahmeliste ohne
  eigenes Argument auskommt.
- **Was der Aufrufer in die Adresse geschrieben hat, wird nicht protokolliert.**
  Der Pfad bleibt, die **Werte** der Query-Zeichenkette gehen
  (`core/filters/redact-path.ts`), die Schlüssel bleiben stehen. Der Unterschied
  ist „eine Suche ist gescheitert" gegen „irgendwas ist gescheitert". Der Grund:
  die Teilnehmerübersicht sucht nach Nachname und Adresse (F32), und ein
  Bestätigungslink trägt ein signiertes Token. Das gilt auch für den Rumpf der
  Fehlerantwort — den kopiert jemand in einen Fehlerbericht.
- **Eine Kennung bekommt nur ein 5xx.** Ein 404 oder ein abgelehntes Feld
  braucht keine Untersuchung, und eine Kennung darauf erzieht Menschen dazu,
  eine Nummer zu nennen, die nirgendwohin führt.
- **Der Protokollpegel ist eine Entscheidung** (`core/config/log-levels.ts`),
  kein Vorgabewert — siehe die Falle unten. `LOG_LEVEL` kennt `warn`, `log`,
  `debug` und `verbose`; **leiser als `warn` gibt es nicht**, denn die Zeilen,
  die sagen, dass eine Grenze erhöht (E60) oder Mail unverschlüsselt
  weitergegeben wird (E62), sind Warnungen — eine Instanz, die sie nicht
  drucken kann, ist eine, die aus ihrem eigenen Protokoll nicht prüfbar ist.
- **Zahlen stehen nicht im Protokoll, sondern hinter einer Sitzung.**
  `/api/health` ist öffentlich und sagt zwei Wörter, weil ein Proxy sich nicht
  anmelden kann. Alles darüber hinaus — Laufzeit, Speicher,
  Datenbank-Umlaufzeit, Antworten nach Klasse, der letzte Fehler, die Mail —
  steht unter `/api/admin/operations` und damit hinter dem administrativen
  Wächter (E16). Der Verkehrsschnitt einer Instanz ist nichts zum
  Veröffentlichen.

## Die zwei Fallen, die keinen Fehler werfen

- **Nests Vorgabelogger hat jeden Pegel an — auch in der Produktion.**
  `DEFAULT_LOG_LEVELS` in `@nestjs/common` zählt alle sechs Pegel auf, und
  `NestFactory.create(AppModule)` ohne `logger`-Option nimmt genau das. Der Ausnahmefilter schreibt einen erwarteten 401 oder 404
  bewusst auf `debug` — „keine Warnungen: jeder Client, der nicht angemeldet
  ist, fragt zuerst, wer er ist" —, und mit der Vorgabe landete diese Zeile
  trotzdem in jedem Produktionsprotokoll. Ein Protokoll, das mit den Besuchern
  wächst statt mit den Problemen, ist eines, das niemand mehr liest.
- **TypeORM hängt an eine gescheiterte Abfrage ihre Parameter.**
  `AbstractLogger.logQueryError` schreibt
  `query failed: … -- PARAMETERS: ["jemand@example.org"]`, und zwar auf dem
  Pegel `error`, den jede Umgebung dieses Servers anhat. Ein Schluckauf der
  Datenbank während einer Anmeldung schrieb damit eine Adresse ins Protokoll,
  ein Passwort-Reset das Token dazu. Deshalb hat der Server einen eigenen
  Logger (`data-access/database-logger.ts`): dieselbe Anweisung, dieselbe
  Fehlermeldung, statt der Werte ihre **Anzahl** — und alles im selben Strom
  und Format wie der Rest, statt einmal durch Nest und einmal direkt auf die
  Konsole.

## Wer zählt was

Die Zählung hat drei Schreiber, und die Aufteilung ist keine Ordnungsliebe:

| Schreiber                   | Zählt                                | Warum nicht der andere                                                          |
| --------------------------- | ------------------------------------ | ------------------------------------------------------------------------------- |
| `RequestOutcomeInterceptor` | jede Antwort, die geklappt hat       | Ein Filter sieht keinen Erfolg                                                  |
| `AllExceptionsFilter`       | jede Antwort, die nicht geklappt hat | Ein Wächter wirft **vor** jedem Interceptor — ein 401 oder 429 käme dort nie an |
| `MailService`               | was rausging und was nicht           | Mail ist der Teil, der aufhört zu funktionieren, ohne dass jemand es merkt      |

Die Zähler stehen im Speicher und werden bei einem Neustart null. Das ist
ehrlich und keine Einschränkung: der Neustart ist meistens genau das Ereignis,
nach dem gefragt wird, und ein Zähler, der ihn überlebt, verdeckt ihn.

## Lasttests

Ein Lasttest gegen eine Instanz mit den ausgelieferten Grenzen misst die
Drosselung: `GLOBAL_REQUESTS_PER_MINUTE` liegt bei **300**, also fünf pro
Sekunde. Seit AP 10 ist auch diese sechste Grenze Konfiguration — die fünf
anderen wurden es in AP 2 — und der Weg ist derselbe: **in eine `.env`, nie in
eine Zeile Code** (E60). `tools/load-test/load.mjs` bricht mit Rückgabewert `3`
ab, sobald auch nur eine 429 kommt, statt eine Zahl der Drosselung als Messwert
auszugeben.

Und: **Zahlen ohne Aufbau und Datum sind keine Messung.**
`tools/load-test/measure.sh` druckt PostgreSQL-Version, Docker-Version, Kerne,
RAM, Kernel und Node, bevor es misst — und es fährt den Stack selbst hoch, weil
ein Aufbau, der in jemandes Shell-Verlauf steht, kein Aufbau ist, den ein
zweiter Mensch nachstellen kann.

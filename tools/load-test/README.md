# Load test

Misst, was diese Anwendung unter Last tut (NFR 12) — und beantwortet die eine
Frage, die `todo.md` seit AP 5 der Phase 1 offen hält: ob die
Teilnehmerübersicht bei einer Organisation eine Größenordnung über allem
bisher Gemessenen `pg_trgm` braucht (F32).

```bash
# alles auf einmal: Wegwerf-Stack, Daten, Lauf, pg_trgm-Vergleich, Abbau
tools/load-test/measure.sh

# 50 000 Anmeldungen statt 20 000, und eine Minute je Szenario
COUNT=50000 LOAD_SECONDS=60 tools/load-test/measure.sh

# gegen eine Instanz, die schon läuft (die Grenze muss dort erhöht sein)
BASE=http://localhost:8080 EVENT_ID=… ADMIN_EMAIL=… ADMIN_PASSWORD=… \
  node tools/load-test/load.mjs
```

## Fünf Teile

| Datei                    | Was es tut                                                                   |
| ------------------------ | ---------------------------------------------------------------------------- |
| `measure.sh`             | Der ganze Aufbau: Stack hoch, vorbereiten, füllen, messen, `down -v`         |
| `prepare.mjs`            | Eine Reihe und ein Event über die API, idempotent                            |
| `seed-registrations.mjs` | So viele Anmeldungen, wie die Frage braucht — per SQL, mit `--remove` zurück |
| `load.mjs`               | Sechs Leseszenarien (`scenarios.mjs`), Perzentile, Statusverteilung          |
| `trigram-measure.mjs`    | Dieselbe Suche mit und ohne `pg_trgm`, dreimal, und danach wieder wie vorher |

## Warum die Grenze hochgesetzt wird — und wo

Jede Anfrage zählt gegen `GLOBAL_REQUESTS_PER_MINUTE`, und eine Instanz liefert
**300** aus: fünf pro Sekunde. Ein Lasttest dagegen misst den Zähler und nicht
den Server. `measure.sh` setzt den Wert deshalb in der `.env` des
Wegwerf-Stacks hoch — **in einer `.env`, nie in einer Zeile Code** (E60) — und
der Stack ist danach weg.

Läuft der Test gegen eine Instanz, die jemand anders gestartet hat, dann gilt
dasselbe dort: Wert in die `.env`, Server neu starten, messen, Wert wieder
herausnehmen. Der Server sagt beim Start laut, dass er erhöht ist, und
`load.mjs` bricht mit Rückgabewert **3** ab, sobald auch nur eine 429 kommt —
eine Zahl, die der Drosselung gehört, wird hier nicht als Messwert ausgegeben.

## Was es nicht tut

- **Schreiben.** Alle sechs Szenarien sind Lesezugriffe. Die beiden Schreibwege,
  die zählen — Anmeldung und Bestätigung — sind absichtlich gedrosselt und mit
  Double-Opt-In gebaut; ein Lasttest darauf misst den Zähler und hinterlässt
  Zeilen, die niemand bestellt hat.
- **Über die API füllen.** `seed-registrations.mjs` schreibt SQL, und das ist
  der einzige Punkt, an dem dieses Werkzeug von `demo-seed/` abweicht: 20 000
  Anmeldungen durch die Drosselung und den Double-Opt-In wären Stunden und wären
  eine Messung des Zählers. Die Zeilen haben dieselbe Form wie die der API, sie
  tragen alle das Präfix `load-test-`, und `--remove` nimmt genau die wieder weg.
- **Über die Erweiterung entscheiden.** `trigram-measure.mjs` liefert Zahlen.
  Ob eine kleine Organisation auf einer gemanagten PostgreSQL `CREATE EXTENSION`
  überhaupt darf, ist das Argument, auf dem F32 steht (NFR 15) — und das kann
  keine Messung beantworten.

## Rückgabewerte von `load.mjs`

| Code | Bedeutung                                                                         |
| ---- | --------------------------------------------------------------------------------- |
| `0`  | Jedes Szenario hat geantwortet, nichts wurde gedrosselt                           |
| `3`  | Die Drosselung hat zugeschlagen — die Zahlen beschreiben sie, nicht den Server    |
| `1`  | Der Lauf konnte nicht stattfinden (Instanz nicht erreichbar, Anmeldung abgelehnt) |

## Der Lauf gehört ins Protokoll

Zahlen ohne Aufbau und Datum sind keine Messung. `measure.sh` druckt beides,
bevor es misst — PostgreSQL-Version, Docker-Version, Kerne, RAM, Kernel,
Node —, und der Abschnitt zu AP 10 in [`../../docs/PHASE5.md`](../../docs/PHASE5.md)
hält den Lauf fest, der dort steht.

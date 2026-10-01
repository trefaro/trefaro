# Bestätigte Zuschnitt-Entscheidungen

Acht Entscheidungen sind getroffen und **bestätigt**; der jetzige Zustand _ist_
die Entscheidung, also nichts davon „auf Verdacht" umsetzen. Zwei davon tragen
seit AP 14 der Phase 5 ihren Abschluss — die Zahl der Pilotpartner-Fragen und
`CONTRIBUTING.md` —, und das ist der Grund, warum diese Datei zu einem
Phasenabschluss gehört: eine bestätigte Entscheidung, deren Stand veraltet ist,
wird erneut diskutiert.

Jede davon wurde schon einmal diskutiert; ein erneutes Aufrollen kostet
Zeit und endet beim gleichen Ergebnis.

- **Die Zahlen der Drosselung bleiben, wie sie sind** (28.08.2026): 20 Logins,
  60 Registrierungen, 60 Bestätigungen, 20 Newsletter-Anmeldungen je 5 min je
  Client-Adresse; global 300 Anfragen/min. **Nicht für Tests entfernen oder
  lockern** (E4) — eine fehlende Drosselung hat kein Symptom, und eine für Tests
  gelockerte Grenze wird nicht mehr geprüft. Wer beim Entwickeln in eine Sperre
  läuft, **startet den Server neu** (Zähler liegen im Speicher).
  **Seit AP 2 der Phase 5 sind das Vorgaben, keine Konstanten** (E60): jede der
  fünf Zahlen kommt aus der Umgebung, die Vorgabe ist exakt die bisherige, und
  jeder Wert **über** seiner Vorgabe erzeugt beim Start eine `WARN`-Zeile. Das
  ändert nichts an der Regel, sondern schärft sie: eine Lockerung steht jetzt
  sichtbar in einer `.env` statt unsichtbar im Code, und ein Testprofil ist nie
  das, was eine Instanz ausliefert (E61). Dazu kam der **fünfte Zähler je
  Empfängeradresse** (`MAILS_PER_RECIPIENT_PER_WINDOW`, Vorgabe 5) — die
  anderen vier zählen den Aufrufer, und der sucht sich seine Adresse aus.
  **Insgesamt sind es sieben**, gezählt in AP 14 der Phase 5: dazu die Grenze
  für Rücksetz-Links (AP 4) und die globale (AP 10, `GLOBAL_REQUESTS_PER_MINUTE`,
  Vorgabe 300). Die maßgebliche Liste ist `RATE_LIMIT_DEFAULTS` in
  `apps/server/src/app/core/config/rate-limits.ts` — wer eine Zahl sucht, zählt
  dort und nicht hier.
- **Die Fragen an den Pilotpartner** (Democracy International) bleiben offen,
  gesammelt in `todo.md` unter _Questions for the pilot partner_. Sie werden
  erst an einem weiter entwickelten Stand gestellt (28.08.2026); keine
  blockiert. Blockiert doch etwas, klärt Marius den einzelnen Punkt vorher.
  **Es sind einundzwanzig**, seit AP 14 der Phase 5 die Phasenlisten
  durchgearbeitet hat — fünf aus dieser Phase sind dazugekommen, weil ihre
  Antwort niemand in diesem Repository geben kann. Die Zahl stand hier bei fünf
  und war seit Phase 3 falsch.
- **`CONTRIBUTING.md` wird gegen die fertige v1.0 geschrieben, nicht vorher** —
  **erledigt in AP 13 der Phase 5.** Vier Dinge, die vorher nie entschieden
  waren, stehen jetzt darin: keine Pull Requests vor dem Tag, DCO statt CLA, ein
  namentlich genannter Maintainer, und dass der kuratierte Plug-in-Satz vor v1.0
  geschlossen bleibt (F241, F242).
- **Schriftarten sind ein mitgelieferter Katalog, kein Upload** (E18) — als
  Startpunkt bestätigt; der Upload ist zurückgestellt, nicht verworfen
  (`todo.md`).
- **Mails übersetzten keine Inhalte — bis Phase 3** (E24): solange die Sprache
  einer Mail niemand gewählt hatte, wäre ein in diese Sprache übersetzter Inhalt
  eine halbe Entscheidung gewesen. **Seit AP 4 der Phase 3 gilt das Gegenteil**,
  und zwar aus demselben Grund: der Empfänger _hat_ eine Sprache gewählt, also
  folgt der Inhalt der Sprache des Briefes (F125). Unverändert bleibt, wie grob
  der Rückfall greift — Einheit ist eine ganze Mail (E24, F87).
- **Kein Newsletter-Versand in v1** (F8, seit AP 12 auch gebaut). FR 4.8 ist die
  **Opt-In-Verwaltung**: eine Liste, die eine Organisation exportiert, und zwei
  Quellen, die sie unterscheiden kann (E45, F136). Ein Versandmodul ist damit
  nicht „noch nicht", sondern nicht vorgesehen — was daran hängt, hängt auch
  daran: kein Selbstabmelde-Link (es gibt keinen Brief, in den er gehörte,
  F183), keine zusammengeführte Empfängerliste (sie hätte keinen Leser) und
  keine Sprache je Adresse (nur eine der beiden Quellen könnte sie füllen,
  F181). Das Einladen ehemaliger Teilnehmender ist ausdrücklich **nicht**
  dasselbe (F55): dort sind die Empfänger Anmeldungen, nie Adressen.

- **Der Plug-in-Vertrag ist bei `PLUGIN_API_VERSION` 1.3.0 geschlossen**
  (E69, 24.09.2026). Bis v1.0 kommt keine Fähigkeit mehr dazu. Zwei sind für
  diesen letzten Schritt abgewogen und **nicht** gebaut worden, beide mit
  Begründung im Referenzdokument: die zweite Hälfte von E55 — „der Plan zeigt
  an, wo ich einen Platz habe" — braucht zwei Port-Fähigkeiten für eine Marke,
  die dort, wo der Platz gebucht wird, **schon steht** (F236); und ein
  Lese-Port, mit dem der Datenexport erführe, was ein Plug-in über einen
  Menschen speichert, wäre die erste Fähigkeit in umgekehrter Richtung (E59)
  und legte den Ausfall eines Plug-ins in einen Bildschirm, auf dem jemand ein
  Recht ausübt (F237). Wer eines von beiden nach v1.0 will, plant 1.4.0 als
  eigenes Paket mit seinem Füller (E46) — nicht als Zeile in einem anderen.
- **Ein Plug-in zeichnet geplante Zeiten in der Zone des Events** (E8, E69,
  24.09.2026) und „wann etwas passiert ist" in der Uhr des Lesers. Die Zone
  reist am Port neben den Zeiten, zu denen sie gehört, nie am Einhängepunkt:
  nur eine Seite kennt ein Event, und eine zugesagte Eigenschaft, die manchmal
  fehlt, hat als Rückfall die Browser-Zone — also den Fehler (F235).

Siehe auch: die Regel zur Arbeitspaket-Freigabe (`CLAUDE.md`), [Ausgehende Mail](mail.md).

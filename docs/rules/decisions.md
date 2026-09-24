# Bestätigte Zuschnitt-Entscheidungen

Acht Entscheidungen sind getroffen und **bestätigt**; der jetzige Zustand _ist_
die Entscheidung, also nichts davon „auf Verdacht" umsetzen.

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
- **Die fünf Fragen an den Pilotpartner** (Democracy International) bleiben
  offen, gesammelt in `todo.md` unter _Questions for the pilot partner_. Sie
  werden erst an einem weiter entwickelten Stand gestellt (28.08.2026); keine
  blockiert. Blockiert doch etwas, klärt Marius den einzelnen Punkt vorher.
- **`CONTRIBUTING.md` wird geschrieben, wenn alle Phasen durch sind** — gegen die
  fertige v1.0, nicht vorher. Erinnerung steht in `todo.md` unter Phase 5.
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

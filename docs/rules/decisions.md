# Bestätigte Zuschnitt-Entscheidungen

Fünf Entscheidungen sind getroffen und **bestätigt**; der jetzige Zustand _ist_
die Entscheidung, also nichts davon „auf Verdacht" umsetzen.

Jede davon wurde schon einmal diskutiert; ein erneutes Aufrollen kostet
Zeit und endet beim gleichen Ergebnis.

- **Drosselung bleibt, wie sie ist** (28.08.2026): 20 Logins, 60 Registrierungen,
  60 Bestätigungen je 5 min je Client-Adresse; global 300 Anfragen/min. **Nicht
  für Tests entfernen oder lockern** (E4) — eine fehlende Drosselung hat kein
  Symptom, und eine für Tests gelockerte Grenze wird nicht mehr geprüft. Wer beim
  Entwickeln in eine Sperre läuft, **startet den Server neu** (Zähler liegen im
  Speicher). Konfigurierbar (strenge Vorgaben + Startwarnung bei Lockerung) wird
  das in **Phase 5**, zusammen mit dem zweiten Zähler je Empfängeradresse.
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

Siehe auch: die Regel zur Arbeitspaket-Freigabe (`CLAUDE.md`), [Ausgehende Mail](mail.md).

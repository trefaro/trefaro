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
- **Mails übersetzen keine Inhalte** (bis Phase 3): die Sprache einer Mail wählt
  niemand (E24), und einen Inhalt in eine nicht gewählte Sprache zu übersetzen
  ist eine halbe Entscheidung.

Siehe auch: die Regel zur Arbeitspaket-Freigabe (`CLAUDE.md`), [Ausgehende Mail](mail.md).

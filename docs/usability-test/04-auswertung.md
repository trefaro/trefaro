# Auswertung

Was nach der letzten Sitzung passiert, und wohin ein Befund geht. Kurz, weil
eine Auswertung, die einen Tag kostet, nicht stattfindet.

## In einem Zug, innerhalb einer Woche

Die Sitzungen liegen nicht lange gut. Die Bögen sind Stichworte, und die
Erinnerung, die sie ergänzt, hält etwa eine Woche.

### 1. Die Zahlen nebeneinanderlegen

Eine Tabelle, sieben Zeilen, so viele Spalten wie Sitzungen — nur für **Teil A**,
weil nur er vergleichbar ist. Die Spalte von 2024 steht hier schon, aus Anhang I
der Thesis:

| Aufgabe                                 | 2024 (E1 · E2 · E3) | Ø 2024   | P1  | P2  | P3  | P4  | Ø heute |
| --------------------------------------- | ------------------- | -------- | --- | --- | --- | --- | ------- |
| A1 — wann hat sich jemand angemeldet    | 4 · 4 · 4           | **4,00** |     |     |     |     |         |
| A2 — wo bearbeitet man ein Event        | 4 · 4 · 3           | 3,67     |     |     |     |     |         |
| A3 — ein neues Event anlegen            | 4 · 3 · 4           | 3,67     |     |     |     |     |         |
| A4 — E-Mail einer interessierten Person | 3 · 2 · 2           | **2,33** |     |     |     |     |         |
| A5 — sich registrieren                  | 4 · 4 · 4           | **4,00** |     |     |     |     |         |
| A6 — eine Uhrzeit im Programm           | 4 · 4 · 4           | **4,00** |     |     |     |     |         |
| A7 — den Veranstalter kontaktieren      | 4 · 4 · 4           | **4,00** |     |     |     |     |         |
| **Gesamt**                              |                     | **3,67** |     |     |     |     |         |

**Interessant ist nicht der Schnitt, sondern die Differenz** — und zwei Zeilen
sind vorab verdächtig, in entgegengesetzte Richtungen:

- **A4 ist die Zeile, auf die es ankommt.** 2,33 war 2024 der einzige Ausreißer
  nach unten, und daraus kam die einzige Korrektur, die die Thesis an ihrem
  eigenen Entwurf gefordert hat: die E-Mail-Adresse gehört auch bei angemeldeten
  Teilnehmenden in die Tabelle. Sie ist umgesetzt. **Bleibt A4 unter 4, hat diese
  eine Änderung nicht gereicht** — und das ist der wichtigste Einzelsatz, den
  diese Auswertung schreiben kann. Dabei die Irrwege mitlesen: wenn wieder zuerst
  in der Teilnehmerübersicht gesucht wird, ist die Erwartung stabil, und die
  Frage lautet nur noch, wie schnell von dort der Weg zu den Nachrichten führt.
- **A3 ist eine Falle.** Die 3 von 2024 kam vom Werkzeug und nicht vom Entwurf
  — _„Das Event habe ich angelegt, es ist aber nirgendwo sichtbar"_, weil Mockups
  nichts speichern. Diese Instanz speichert. Eine 4 ist hier also der Wegfall
  eines Artefakts und **kein** Fortschritt; sie wird so notiert und nicht
  mitgefeiert.

Eine Aufgabe, die 2024 mit 4 bewertet wurde und heute mit 2, ist dagegen ein
echter Befund über die Umsetzung — der Entwurf war an dieser Stelle ja schon
abgenommen. Und umgekehrt gilt für A1, A5, A6 und A7, dass 4 die Messlatte ist
und nicht das Ziel: **weniger ist dort eine Verschlechterung gegenüber dem
Bogen.**

Dazu drei Zahlen über alle Sitzungen: **wie viele Aufgaben ohne Hilfe gelöst
wurden, wie viele mit, wie viele nicht.** Die gab es 2024 nicht — am Mockup
wurde nur bewertet, nicht beobachtet —, und sie sind deshalb keine
Vergleichszahl, sondern die neue.

### 2. Die Irrwege zusammenlegen

Das eigentliche Ergebnis. Alle _Irrwege_- und _Hinweis_-Felder untereinander
schreiben und gruppieren: **welcher Irrweg ist mehr als einer Person passiert?**

Ein Irrweg, den zwei von vier Personen gehen, ist ein Befund. Einer, den eine
Person geht, ist eine Beobachtung — er wird notiert und nicht behoben. Die Thesis
hat es 2024 genauso gemacht, und deshalb kam aus sieben Aufgaben **eine**
Korrektur.

### 3. Die Zitate sortieren

Aus den wörtlichen Notizen und aus Teil C. Nach Thema, nicht nach Person. Ein
Satz wie „ich dachte, das hätte schon gespeichert" ist mehr wert als drei Zeilen
Zusammenfassung — und er überlebt den Weg in ein Protokoll, eine Zusammenfassung
nicht.

### 4. Die eine Frage beantworten

**„Würdet ihr eure nächste Veranstaltungsreihe darauf fahren — und was müsste
vorher da sein?"** Die Antworten aus Teil C nebeneinander, und daraus **eine
Liste**: was fehlt bis dahin, geordnet danach, wie oft es genannt wurde.

Diese Liste ist das Ergebnis des Tests. Alles andere ist Material dafür.

## Wohin ein Befund geht

Nichts davon landet automatisch in diesem Repository. Wer die Nacharbeit macht,
trägt es ein — **von Hand und mit Begründung**, wie jeden anderen Punkt auch.

| Art des Befunds                                                      | Wohin                                                                                                                           |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Bedienung**: ein Weg, den mehrere gesucht und nicht gefunden haben | `todo.md`, mit der Zahl dahinter („zwei von vier suchten X unter Y")                                                            |
| **Fehler**: etwas hat nicht funktioniert                             | `todo.md` unter _Known gaps in the current state_ — sofort, nicht erst in der Auswertung                                        |
| **Fehlende Funktion**, die jemand erwartet hat                       | `todo.md`, und wenn sie eine Entscheidung braucht: _Questions for the pilot partner_                                            |
| **Widerspruch zur Anforderungsanalyse**                              | `docs/Anforderungsanalyse_und_Umsetzungsplan.md` als Nachtrag (F-Nummer) — der Plan ist maßgeblich, aber er ist nicht unfehlbar |
| **Der Ablauf des Tests selbst** war schlecht                         | in dieses Bündel, damit die nächste Runde es besser hat                                                                         |
| **Die Antwort auf die eine Frage**                                   | in `todo.md` unter _On a device — waiting for Marius_, wo die Zeile für diesen Test steht                                       |

Und die Regel, die für alles gilt, was aus einem Test kommt: **eine Beobachtung
ist keine Aufgabe.** Was zwei Leute gestört hat, wird notiert; was daraus gebaut
wird, entscheidet jemand danach — mit dem Prioritäten-Kompass daneben
(Teilnehmerübersicht vor Nachhaltigkeit vor intuitiver Bedienung vor
Info-Darstellung vor Registrierung; Eventmanagement vor Community-Bildung).

## Was nicht in die Auswertung gehört

- **Namen.** Die Bögen tragen Kürzel, die Auswertung auch.
- **Wie viele Leute etwas gut fanden.** Vier Personen sind keine Stichprobe.
  Prozentangaben aus vier Sitzungen sind eine Zahl, die genauer aussieht, als sie
  ist.
- **Erklärungen, warum etwas so ist.** Die gehören in die Antwort auf einen
  Befund, nicht in seine Beschreibung. Ein Bericht, in dem hinter jedem Problem
  steht, warum es keins ist, ist kein Bericht.

# Usability-Test mit dem Pilotpartner

Dieses Bündel ist alles, was ein Mensch braucht, um mit Democracy International
e. V. einen moderierten Usability-Test zu fahren — ohne dieses Repository dabei
noch einmal zu fragen.

**Gefahren wird der Test von Menschen, nicht von einem Paket.** Phase 5 hat das
vorab entschieden: ein Arbeitspaket kann einen Test vorbereiten, aber nicht
abhalten, und ein Meilenstein, der an einem Termin bei einem Dritten hängt, hält
eine Phase an. Was hier liegt, ist deshalb übergabefähig und nicht erledigt.

| Datei                                              | Inhalt                                                                     |
| -------------------------------------------------- | -------------------------------------------------------------------------- |
| [01-aufgaben.md](01-aufgaben.md)                   | Das Skript: die sieben Aufgaben der Thesis und die Anwendungsfälle danach  |
| [02-beobachtungsbogen.md](02-beobachtungsbogen.md) | Der Bogen, den die mitschreibende Person führt — einer je Sitzung          |
| [03-instanz.md](03-instanz.md)                     | Die Instanz: hochfahren, füllen, Zugänge, was an ist und was bewusst nicht |
| [04-auswertung.md](04-auswertung.md)               | Was nach der letzten Sitzung passiert, und wohin ein Befund geht           |

**Woher die sieben Aufgaben kommen:** wörtlich aus **Anhang H** der Thesis, die
Bewertungen von 2024 aus **Anhang I**, die Auswertung dazu aus **Kapitel 6**. Die
Thesis selbst liegt nicht in diesem Repository (Entscheidung vom 26.08.2026) —
die PDF darf lokal unter `docs/thesis/` liegen, wo `.gitignore` sie fernhält.
Alles, was dieses Bündel daraus braucht, steht hier; nachschlagen muss niemand.

## Die Frage, die der Test beantworten soll

Nicht „ist die Anwendung gut". Drei Fragen, in dieser Reihenfolge:

1. **Hält das, was die Bögen versprochen haben, als laufende Anwendung?** Die
   Thesis hat 2024 interaktive Mockups mit drei Fachleuten getestet, sieben
   Aufgaben, Skala 1 bis 4, überwiegend 4/4 — und genau **eine** Korrektur
   gefunden: die E-Mail-Adresse muss in der Teilnehmerübersicht stehen. Dieselben
   sieben Aufgaben an echter Software, mit derselben Skala, sind die einzige
   Messung, die mit 2024 vergleichbar ist. Ein Bogen lügt nicht, aber er wartet
   auch nie, lädt nie nach und lehnt nie etwas ab.

2. **Trägt dieselbe Bedienlogik das, was seitdem dazugekommen ist?** Konten,
   Profile, Teilnehmersuche, Chat und fünf Plug-ins sind nach 2024 entstanden
   und **nie von jemandem getestet worden, der sie nicht gebaut hat.** Sie sind
   aus derselben Anforderungsanalyse abgeleitet — aber abgeleitet ist nicht
   geprüft.

3. **Würde diese Organisation ihre nächste Veranstaltungsreihe darauf fahren —
   und was fehlt bis dahin?** Die ehrlichste Frage und die einzige, deren Antwort
   „nein, weil …" lauten darf, ohne dass etwas schiefgelaufen ist. Sie gehört ans
   Ende jeder Sitzung und wird wörtlich notiert.

## Wer, wie viele, wie lange

|                  |                                                                                                                                                                                                                                                                                                                                              |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Teilnehmende** | Vier bis sechs Personen aus der Organisation. Die Thesis hatte drei; mehr macht die Zahlen nicht genauer, aber die Sitzungen unterschiedlicher. Mindestens **zwei**, die tatsächlich Veranstaltungen organisieren, und mindestens **zwei**, die an ihnen teilnehmen — die Aufgaben sind nach diesen beiden Rollen getrennt.                  |
| **Vom Testteam** | Zwei: eine Person moderiert, eine schreibt mit. Eine Person allein kann nicht beides, und was dabei verloren geht, sind immer die Irrwege.                                                                                                                                                                                                   |
| **Dauer**        | 75 bis 90 Minuten je Sitzung. Teil A (die sieben Aufgaben) kostet etwa 40 Minuten, Teil B vier ausgewählte Aufgaben etwa 30, der Abschluss 10.                                                                                                                                                                                               |
| **Geräte**       | Teilnehmenden-Aufgaben auf dem **eigenen Telefon** der Person, Veranstalter-Aufgaben am **Laptop**. Das ist keine Bequemlichkeit: der Nutzer-Client ist mobile-first bei 390 Pixeln entworfen, der Veranstalter-Client desktop-first mit einem Boden bei 768 — und ein Test, der beides auf einem Bildschirm fährt, prüft keinen von beiden. |
| **Ort**          | Egal, aber alle in einem Raum. Ein geteilter Bildschirm zeigt die Hände nicht.                                                                                                                                                                                                                                                               |

## Wie moderiert wird

- **Die Aufgabe wird vorgelesen und dann nicht erklärt.** Wenn jemand fragt „wo
  muss ich da klicken?", ist die richtige Antwort „was würdest du probieren?".
- **Laut denken lassen.** Einmal am Anfang darum bitten, danach nur noch bei
  Stille erinnern: „Was suchst du gerade?"
- **Eine Aufgabe ist gelöst, wenn sie ohne Hinweis gelöst wurde.** Sobald das
  Testteam einen Hinweis gibt, wird die Aufgabe als _mit Hilfe_ gewertet, auch
  wenn sie danach gelingt. Der Hinweis wird wörtlich notiert — er ist der Befund.
- **Nach spätestens drei Minuten Feststecken abbrechen.** Das ist kein
  Scheitern, das ist das Ergebnis. Danach den Weg zeigen und weitermachen.
- **Nicht verteidigen.** „Das ist eigentlich logisch, weil …" beendet eine
  Sitzung inhaltlich, auch wenn sie weiterläuft.
- **Nichts vorher zeigen.** Keine Tour, keine Einführung, kein „hier oben ist
  das Menü".

## Was vorher zu klären ist

- **Einverständnis**, mündlich und vor der ersten Aufgabe: dass mitgeschrieben
  wird, dass die Notizen keinen Namen tragen, dass jederzeit abgebrochen werden
  kann. Aufzeichnung nur, wenn ausdrücklich zugestimmt wird — der Bogen kommt
  auch ohne aus.
- **Der Bogen trägt keine Namen**, sondern ein Kürzel je Person (P1, P2, …). Die
  Zuordnung bleibt beim Testteam und wird nicht Teil der Auswertung.
- **Die Instanz enthält nur erfundene Daten.** Jede Adresse liegt unter
  `example.org` und kann keine Post empfangen. Es werden **keine echten
  Teilnehmendendaten** der Organisation eingespielt, auch nicht „nur zum
  Anschauen" — siehe [03-instanz.md](03-instanz.md).
- **Die Instanz ist danach wegzuwerfen.** Sie hat ein gemeinsames Passwort für
  zehn Konten; das ist für eine Demonstration richtig und für alles andere
  falsch.

## Was dieser Test nicht beantwortet

Damit es nicht versucht wird:

- **Push-Benachrichtigungen und die Installation als App.** Beides braucht einen
  Produktionsbuild auf einem echten Gerät und steht in `todo.md` unter _On a
  device — waiting for Marius_. Die Instanz hat Push deshalb bewusst aus.
- **Die Kamera am Einlass.** Die QR-Aufgabe wird mit getippten Codes gefahren;
  eine Kamera am Einlass ist eine Zeile der Gerätematrix, kein Usability-Befund.
- **Zustellbarkeit von E-Mail.** Alles läuft gegen einen lokalen Briefkasten. Ob
  Post bei einem echten Anbieter ankommt, entscheidet der Betrieb, nicht die
  Bedienung.
- **Ob die Software fehlerfrei ist.** Findet der Test einen Fehler, ist das ein
  Nebenprodukt. Er wird notiert und geht in `todo.md`, nicht in die Auswertung.

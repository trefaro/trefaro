# 9 Architekturentscheidungen

Dieses Projekt führt keine ADR-Sammlung. Es hat zwei Entscheidungsregister, die
älter sind als dieser Abschnitt und vollständig gepflegt werden — **sie sind die
Architekturentscheidungen**, und arc42 legt keine dritte Kopie daneben (E70).

## 9.1 Die zwei Register

| Register                             | Wo                                                                                                                                         | Was darin steht                                                                                                           |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| **F1–F237** — Entscheidungsprotokoll | [Kapitel 7 des Referenzdokuments](../Anforderungsanalyse_und_Umsetzungsplan.md)                                                            | Jede geklärte offene Frage, mit Frage, Antwort und Begründung. Beim Bauen vergeben, nummeriert und nie umgewidmet.        |
| **E1–E71** — Phasenentscheidungen    | Je Phasenprotokoll: [PHASE1](../PHASE1.md), [PHASE2](../PHASE2.md), [PHASE3](../PHASE3.md), [PHASE4](../PHASE4.md), [PHASE5](../PHASE5.md) | Die Entscheidungen, die eine ganze Phase festlegt — im Plan getroffen, am Ende der Phase **gegen die Umsetzung geprüft**. |

Die Zählung von E läuft über die Phasen durch, und **welche Nummern zu welcher
Phase gehören, steht in [`docs/rules/README.md`](../rules/README.md)** — dort
wird sie gepflegt, samt der Nummern, die nie vergeben wurden. Eine zweite
Tabelle hier wäre die erste, die veraltet.

Dazu die **bestätigten Entscheidungen** in
[`docs/rules/decisions.md`](../rules/decisions.md): die kurze Liste dessen, was
schon einmal in Frage gestellt und begründet bestätigt wurde. Wer eine davon
noch einmal aufmachen will, liest zuerst dort nach, warum sie so ist.

## 9.2 Wie man darin sucht

- **Eine Nummer ist ein Anker.** `E55` oder `F200` steht im Code, in den
  Regeldateien und in den Protokollen; `grep -rn "F200" docs apps libs` findet
  die Entscheidung und jede Stelle, die sich auf sie beruft.
- **Eine vergebene Nummer wird nie umgewidmet.** `F62` ist nie vergeben worden,
  und sie wird auch nicht nachträglich besetzt — sonst zeigte ein alter Verweis
  plötzlich auf etwas anderes. Dasselbe gilt für `F129–F131`.
- **Eine reservierte Nummer ist keine geschriebene.** Zweimal ist eine
  Entscheidung umgesetzt und die Zeile nicht geschrieben worden; beide Male hat
  der Phasenabschluss es gefunden. Wer ein Paket abschließt, zählt nach.

## 9.3 Die Entscheidungen, die diese Architektur tragen

Keine Wiederholung, sondern ein Wegweiser: wer verstehen will, **warum es so
aussieht**, liest diese zuerst.

| Frage                                              | Entscheidung            | Und in arc42                                                         |
| -------------------------------------------------- | ----------------------- | -------------------------------------------------------------------- |
| Wie werden Schichten durchgesetzt?                 | Lint-Regeln, F21        | [4.1](04-loesungsstrategie.md), [5.2](05-bausteinsicht.md)           |
| Wie kommt ein Plug-in an Kerndaten?                | E12, F45, E59           | [4.2](04-loesungsstrategie.md), [8](08-querschnittliche-konzepte.md) |
| Wie oft darf der Plug-in-Vertrag sich bewegen?     | E46, F47, E69           | [8](08-querschnittliche-konzepte.md)                                 |
| Wie kommt das Design zu einem Plug-in?             | Custom Properties, F222 | [4.3](04-loesungsstrategie.md)                                       |
| Was passiert beim Löschen eines Kontos?            | E65                     | [6.5](06-laufzeitsicht.md)                                           |
| In welcher Zone steht eine Uhrzeit?                | E8, E69                 | [8.1](08-querschnittliche-konzepte.md)                               |
| Wie begründet der Server eine Ablehnung?           | E64                     | [8.1](08-querschnittliche-konzepte.md)                               |
| Woher kommen Grenzwerte?                           | E60, E61                | [4.5](04-loesungsstrategie.md)                                       |
| Was macht eine Instanz mit einem defekten Plug-in? | NFR 10, Spike 1         | [6.1](06-laufzeitsicht.md)                                           |
| Wer setzt den Tag auf v1.0?                        | E71                     | [11](11-risiken-und-technische-schulden.md)                          |

## 9.4 Wo eine neue Entscheidung hingehört

Damit dieser Abschnitt nicht anfängt, ein drittes Register zu werden:

- Eine **Frage, die beim Bauen aufkam** → als `F<n>` in Kapitel 7 des
  Referenzdokuments, mit Frage, Antwort und Begründung.
- Eine **Festlegung für eine ganze Phase** → als `E<n>` in den Plan der Phase,
  und am Phasenende gegen die Umsetzung geprüft.
- Eine **Regel, die man beim nächsten Mal wieder braucht** → nach
  [`docs/rules/`](../rules/README.md), nicht hierher.
- Eine **Änderung an der Architektur selbst** → in den betroffenen Abschnitt
  dieser Sammlung, und die Entscheidung dazu in eines der beiden Register.

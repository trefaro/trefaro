# Architekturdokumentation nach arc42

Die Architektur von Trefaro in den zwölf Abschnitten von arc42 — auf Deutsch wie
die übrige Dokumentation dieses Repositories, weil sie zur Thesis gehört.

Diese Sammlung ist **der Einstieg für jemanden, der dieses Repository zum ersten
Mal öffnet.** Sie beantwortet in dieser Reihenfolge: wofür das hier gebaut wird,
was dabei nicht zur Wahl stand, was außen herum liegt, wie die Lösung geschnitten
ist, woraus sie besteht, wie sie sich zur Laufzeit verhält, wo sie läuft, was
überall gilt, warum es so ist, wie gut es sein muss, was daran offen ist und was
die Wörter bedeuten.

## Die Regel dieser Sammlung

**arc42 erzählt nichts nach** (E70). Jeder Abschnitt sagt entweder etwas Neues
oder er **verweist** — auf das Referenzdokument, auf `docs/rules/`, auf die
Phasenprotokolle, auf `todo.md`. Eine zweite Kopie einer Regel ist eine Regel,
die auseinanderläuft; genau deshalb sind die Abschnitte 8, 9 und 11 kurz und
bestehen fast nur aus Verweisen.

Der einzige größere Text, der hier **neu** entsteht, ist der
**Plug-in-SDK-Leitfaden** in [Abschnitt 8](08-querschnittliche-konzepte.md) —
weil es ihn noch nirgends gab und weil ein fremder Autor sonst eine der fünf
kuratierten Umsetzungen lesen müsste, um ein Plug-in zu bauen.

## Die zwölf Abschnitte

| #                                           | Abschnitt                       | Worum es geht                                                                    |
| ------------------------------------------- | ------------------------------- | -------------------------------------------------------------------------------- |
| [1](01-einfuehrung-und-ziele.md)            | Einführung und Ziele            | Aufgabenstellung, Qualitätsziele, Stakeholder                                    |
| [2](02-randbedingungen.md)                  | Randbedingungen                 | was nicht zur Wahl stand: Technik, Lizenz, eine Instanz je Organisation          |
| [3](03-kontextabgrenzung.md)                | Kontextabgrenzung               | Nachbarsysteme und was über die Grenze geht                                      |
| [4](04-loesungsstrategie.md)                | Lösungsstrategie                | die fünf Grundentscheidungen und was sie kosten                                  |
| [5](05-bausteinsicht.md)                    | Bausteinsicht                   | Nx-Projekte, Server-Module, die sieben geteilten Bibliotheken                    |
| [6](06-laufzeitsicht.md)                    | Laufzeitsicht                   | Client-Start, Double-Opt-In, Chat-Handshake, Plug-in-Montage, Löschung           |
| [7](07-verteilungssicht.md)                 | Verteilungssicht                | fünf Container, ein veröffentlichter Port, zwei Volumes                          |
| [8](08-querschnittliche-konzepte.md)        | Querschnittliche Konzepte       | Verweise auf `docs/rules/` — **und der Plug-in-SDK-Leitfaden**                   |
| [9](09-architekturentscheidungen.md)        | Architekturentscheidungen       | wo E1–E71 und F1–F237 stehen und wie man darin sucht                             |
| [10](10-qualitaetsanforderungen.md)         | Qualitätsanforderungen          | die fünfzehn NFR als Qualitätsbaum, mit Szenarien und ihrem Nachweis             |
| [11](11-risiken-und-technische-schulden.md) | Risiken und technische Schulden | Verweis auf `todo.md`, und die vier Dinge, die v1.0 offen lässt                  |
| [12](12-glossar.md)                         | Glossar                         | Reihe, Event, Programmpunkt, Plug-in, Slot, Einhängepunkt, Bündel — zweisprachig |

## Wo sonst noch Wissen liegt

Diese Sammlung ersetzt keines der bestehenden Dokumente, sie ordnet sie:

- **[`docs/Anforderungsanalyse_und_Umsetzungsplan.md`](../Anforderungsanalyse_und_Umsetzungsplan.md)**
  — die Anforderungen und das Entscheidungsprotokoll F1–F237. Maßgeblich; wo
  arc42 und das Referenzdokument sich widersprächen, gilt das Referenzdokument.
- **[`docs/rules/`](../rules/README.md)** — was man beim Bauen braucht.
  Dreizehn Dateien, je eine pro Bereich. Kurz gesagt: was dort steht, ist schon
  einmal schiefgegangen.
- **[`docs/INSTALL.md`](../INSTALL.md)** — Installation und Betrieb, auf
  Englisch, weil es das Dokument des Betreibers ist.
- **[`docs/PHASE1.md`](../PHASE1.md) … [`PHASE5.md`](../PHASE5.md)**,
  [`BOOTSTRAP.md`](../BOOTSTRAP.md), [`spikes/`](../spikes/README.md) — was in
  welcher Phase passierte und warum.
- **[`todo.md`](../../todo.md)** — was offen ist.
- **[`CLAUDE.md`](../../CLAUDE.md)** — die Kurzfassung, die in jeder Sitzung
  gilt.

## Pflege

Ein Abschnitt hier wird geändert, wenn sich die **Architektur** ändert — nicht,
wenn sich eine Regel ändert. Eine Regel hat ihren Ort in `docs/rules/`, eine
Entscheidung im Referenzdokument, der Stand eines Pakets in seinem
Phasenprotokoll. Wer hier etwas schreibt, das anderswo schon steht, hat die eine
Regel dieser Sammlung gebrochen.

# Regeln

Destillat der Entscheidungen, die beim Bauen an Trefaro immer wieder gebraucht
werden — je eine Datei pro Bereich. Kurz gesagt: **was hier steht, ist schon
einmal schiefgegangen.**

Das ist keine zweite Anforderungsanalyse. Die Begründung jeder Entscheidung steht
ausführlich woanders und wird hier nur mit ihrer Nummer zitiert:

- **F1–F194 und F202** — Entscheidungsprotokoll in
  [`docs/Anforderungsanalyse_und_Umsetzungsplan.md`](../Anforderungsanalyse_und_Umsetzungsplan.md)
  (F62 wurde nie vergeben; F70 beantwortet, was für sie geplant war. **F129–F131
  sind unvergeben** — AP 6 hat sie als schon getroffene Entscheidungen
  wiedererkannt. **F134 und F135** kamen mit AP 11, **F136 und F179–F183** mit
  AP 12, **F184 und F185** mit AP 13; **F186–F188** mit AP 1,
  **F189–F192** mit AP 2 und **F193, F194 sowie F202** mit AP 3 der Phase 4.)
- **E1–E16** — Phase 1, [`docs/PHASE1.md`](../PHASE1.md).
- **E17–E30** — Phase 2, [`docs/PHASE2.md`](../PHASE2.md) (die Zählung läuft über
  die Phasen weiter).
- **E31–E45** — Phase 3, [`docs/PHASE3.md`](../PHASE3.md).
- **E46–E59** — Phase 4, [`docs/PHASE4.md`](../PHASE4.md) (im Plan festgelegt;
  jedes Paket prüft die seinen gegen die Umsetzung). **F195–F201** sind dort
  reserviert und noch nicht vergeben; **F202** ist ein Nachtrag aus AP 3,
  weil der reservierte Block schon belegt war.
- **NFR / FR** — nummeriert wie im Anforderungsdokument.

## Vor der Arbeit an … zuerst lesen

| Bereich                                                | Datei                                    |
| ------------------------------------------------------ | ---------------------------------------- |
| Servercode strukturieren, Module schneiden             | [server-layers.md](server-layers.md)     |
| einen Endpunkt anlegen oder ändern                     | [api-contracts.md](api-contracts.md)     |
| eine Entity oder Migration schreiben                   | [data-model.md](data-model.md)           |
| ausgehende Mail                                        | [mail.md](mail.md)                       |
| Übersetzungsschlüssel, Inhaltsübersetzungen            | [i18n.md](i18n.md)                       |
| Client-Templates, Formulare, berechnete Beschriftungen | [angular-clients.md](angular-clients.md) |
| eine Browsersuite anfassen                             | [e2e-tests.md](e2e-tests.md)             |
| Farben, Branding-Dateien, Icons, Manifest              | [whitelabel-pwa.md](whitelabel-pwa.md)   |
| Umgebungsvariablen, Proxy, TLS, Prüfskripte            | [deployment.md](deployment.md)           |
| Ports, Plug-in-Schalter, geteilte Bibliotheken         | [infrastructure.md](infrastructure.md)   |
| unerklärliche Zählwerte oder Pfade in Tests            | [tooling-traps.md](tooling-traps.md)     |
| eine schon getroffene Entscheidung in Frage stellen    | [decisions.md](decisions.md)             |

## Pflege

Eine neu gelernte Regel kommt **hierher**, nicht in `CLAUDE.md` — dort steht nur,
was in jeder Sitzung gilt. Eine Regel gehört in diese Sammlung, wenn sie beide
Bedingungen erfüllt:

1. Sie ist aus dem Code **nicht ablesbar** (eine Konvention, eine Falle, ein
   bewusst nicht gegangener Weg).
2. Sie hat schon einmal Zeit gekostet oder würde es beim nächsten Mal tun.

Was nur ein Detail der Umsetzung war, gehört ins Phasenprotokoll. Was jede
Sitzung braucht, gehört in `CLAUDE.md`.

Und die Regel, die `CLAUDE.md` zweimal gebraucht hat: **der Stand einer Phase
gehört in ihr Protokoll, nicht in die Kurzfassung.** Phase 3 hat `CLAUDE.md` je
Arbeitspaket einen Absatz angehängt — dreizehn Absätze, 255 Zeilen, jede Tatsache
darin ein drittes Mal aufgeschrieben (Protokoll, Referenzdokument, hier) — und
damit die Datei von 178 auf 414 Zeilen gebracht, die jede Sitzung vollständig
liest. Ein abgeschlossenes Paket bekommt dort **keinen** Absatz: die Phasenliste
nennt Datum, Meilenstein und das Dokument, die Zahlen stehen in einer Zeile
darunter, und alles andere hat schon einen Ort.

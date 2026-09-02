# Regeln

Destillat der Entscheidungen, die beim Bauen an Trefaro immer wieder gebraucht
werden — je eine Datei pro Bereich. Kurz gesagt: **was hier steht, ist schon
einmal schiefgegangen.**

Das ist keine zweite Anforderungsanalyse. Die Begründung jeder Entscheidung steht
ausführlich woanders und wird hier nur mit ihrer Nummer zitiert:

- **F1–F152** — Entscheidungsprotokoll in
  [`docs/Anforderungsanalyse_und_Umsetzungsplan.md`](../Anforderungsanalyse_und_Umsetzungsplan.md)
  (F62 wurde nie vergeben; F70 beantwortet, was für sie geplant war. **F129–F136
  sind reserviert, aber noch nicht vergeben** — sie gehören zu Arbeitspaketen der
  Phase 3, die noch kommen.)
- **E1–E16** — Phase 1, [`docs/PHASE1.md`](../PHASE1.md).
- **E17–E30** — Phase 2, [`docs/PHASE2.md`](../PHASE2.md) (die Zählung läuft über
  die Phasen weiter).
- **E31–E45** — Phase 3, [`docs/PHASE3.md`](../PHASE3.md).
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

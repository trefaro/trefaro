# 10 Qualitätsanforderungen

Die fünfzehn nicht funktionalen Anforderungen der Thesis (Tabelle 21) sind
vollständig gültig und stehen im Wortlaut in
[Kapitel 4 des Referenzdokuments](../Anforderungsanalyse_und_Umsetzungsplan.md).
Dieser Abschnitt ordnet sie als **Qualitätsbaum** und gibt jedem Ast ein
**Szenario** mit seinem Nachweis — das ist das Neue hier, nicht die Liste.

## 10.1 Qualitätsbaum

```
Trefaro
├── Datenschutz und Vertrauen
│   ├── NFR 7  Datenschutz — Daten nur für den eigenen Betrieb
│   ├── NFR 9  keine Drittanbieter mit Datenschutzrisiko
│   └── NFR 5  Transparenz — Open Source, Modifikationsrecht
├── Betreibbarkeit
│   ├── NFR 15 Installierbarkeit — ein `docker compose up`
│   ├── NFR 14 Kosteneffizienz — ressourcenschonende Container
│   ├── NFR 8  Dokumentation — Installation, Betrieb, Plug-in-Entwicklung
│   └── NFR 11 Fehlerhandling — abfangen und protokollieren
├── Bedienbarkeit
│   ├── NFR 4  Nutzerfreundlichkeit — auch für rudimentäre IT-Kenntnisse
│   ├── NFR 6  Zugänglichkeit — geräte- und systemunabhängig, responsiv
│   └── Mehrsprachigkeit — Englisch + Landessprache, pflegbar
├── Wandelbarkeit
│   ├── NFR 2  Erweiterbarkeit — Plug-in-Architektur, stabile Schnittstellen
│   ├── NFR 1  Angemessenheit — nur anbieten, was gebraucht wird
│   ├── NFR 3  Nachhaltigkeit — LTS-Technologien, breite Community
│   └── NFR 13 Einsatzgebiet — für NGOs jedes Tätigkeitsbereichs
└── Verlässlichkeit
    ├── NFR 10 Stabilität — ein Fehler bringt das System nicht zu Fall
    └── NFR 12 Performance — gute Antwortzeiten auch unter Last
```

## 10.2 Szenarien

Jedes Szenario ist so formuliert, dass man sehen kann, **ob es erfüllt ist** —
und die letzte Spalte sagt, wer das prüft.

### Datenschutz und Vertrauen

| #   | Szenario                                                                                                                                              | Nachweis                                                                                                       |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Q1  | Eine Seite dieser Anwendung wird geladen; **keine Anfrage** verlässt die Instanz zu einem fremden Host.                                               | CSP-Kopfzeilen am Proxy (alles `'self'`, `frame-src 'none'`), Schriften und Icons lokal, Prüfskript des Proxys |
| Q2  | Ein Profil ist **nicht** `searchable`; es taucht in keiner Suche, keiner Liste und keinem fremden Profil auf.                                         | Unit-Tests der Profilsuche + Vertragssuite                                                                     |
| Q3  | Ein Mensch verlangt Export und Löschung. Was von ihm bleibt, weil es jemand anderes schrieb, **trägt seinen Namen nicht mehr**.                       | [6.5](06-laufzeitsicht.md), Unit-Tests `privacy`, Vertragssuite                                                |
| Q4  | Eine Logzeile wird geschrieben, während etwas schiefgeht. Sie enthält **keine personenbezogenen Daten** und trotzdem genug, um den Vorgang zu finden. | `log-hygiene.spec.ts`, Fehlermarke statt Name                                                                  |
| Q5  | Zwei Organisationen wollen dieselbe Instanz nutzen. **Sie können es nicht** — es gibt keinen Mandanten.                                               | Architektur, [Abschnitt 2](02-randbedingungen.md)                                                              |

### Betreibbarkeit

| #   | Szenario                                                                                                                    | Nachweis                                                                    |
| --- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Q6  | Jemand ohne IT-Abteilung startet eine leere Instanz: `.env` ausfüllen, `docker compose up`, erster Administrator per Token. | `stack-e2e` aus **leerem Volume**, [`INSTALL.md`](../INSTALL.md)            |
| Q7  | Eine neue Version kommt. Migrationen laufen **beim Start**, es gibt keinen zweiten Schritt.                                 | `migrationsTransactionMode: 'each'`, `synchronize` in Produktion verweigert |
| Q8  | Der Betreiber will wissen, wie es der Instanz geht — ohne ein Monitoring-System zu betreiben.                               | Betriebszahlen und Health, [`observability.md`](../rules/observability.md)  |
| Q9  | Ein Plug-in-Autor von außen will ein Plug-in bauen. Er kommt ohne Lektüre fremden Codes aus.                                | [Abschnitt 8](08-querschnittliche-konzepte.md)                              |

### Bedienbarkeit

| #   | Szenario                                                                                                                                     | Nachweis                                                                          |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Q10 | Der Nutzer-Client wird auf einem Telefon bei **390** Pixeln bedient; alles ist mit dem Daumen erreichbar.                                    | Gestaltungsprojekt in Playwright, Mockup-Tabelle aus AP 7 der Phase 5             |
| Q11 | Der Veranstalter-Client wird auf einem Tablet bei **768** Pixeln bedient; die Seitenleiste wird zur Lade, Tabellen scrollen in ihrem Rahmen. | AP 8 der Phase 5, F223/F225                                                       |
| Q12 | Eine Organisation braucht eine dritte Sprache und hat keinen Entwickler. Sie pflegt sie **in der Anwendung**.                                | Sprachen- und Übersetzungsseiten des Veranstalter-Clients, `translation_override` |
| Q13 | Der Server lehnt etwas ab. Die Begründung erscheint **in der Sprache der Seite**, nicht in der des Servers.                                  | E64: Code mit Werten, Übersetzung im Katalog; Vertragssuite behauptet den Code    |

### Wandelbarkeit

| #   | Szenario                                                                                                        | Nachweis                                                               |
| --- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Q14 | Eine Organisation braucht das Forum nicht. Es ist **aus** und erscheint nirgends — auch nicht als leere Kachel. | Schalter je Modul und Plug-in, Deskriptor fehlt in `/api/config`       |
| Q15 | Ein Plug-in, das gegen **1.2.0** gebaut wurde, wird auf einem 1.3.0-Wirt montiert und funktioniert weiter.      | `isCompatiblePluginApiVersion`, Kompatibilitätstest je Erweiterung     |
| Q16 | Die Datenbank soll gewechselt werden. Nur die Datenzugriff-Schicht wird ausgetauscht.                           | Ports und Lint-Regeln, [`server-layers.md`](../rules/server-layers.md) |
| Q17 | Eine Erweiterung wird gebraucht, die es nicht gibt. Sie wird ein **Plug-in**, kein Fork.                        | Vier Einhängepunkte, drei Lese-Ports, eigene Tabellen                  |

### Verlässlichkeit

| #   | Szenario                                                                                                                                                     | Nachweis                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Q18 | Ein Plug-in-Bündel liefert 404, wirft beim Auswerten oder definiert sein Element nie. **Die Anwendung startet ohne es**, und die Modulverwaltung sagt warum. | Lader-Tests, darunter „ein funktionierendes Plug-in überlebt ein kaputtes Geschwister"           |
| Q19 | Ein Fremder klopft wiederholt an Login, Registrierung oder Bestätigung. Die Drosselung greift, **und sie wird nie für Tests gelockert**.                     | E4, E60, E61 — Grenzwerte aus der Umgebung, Testprofil in einer Datei, die das Image nicht kennt |
| Q20 | Ein Event hat zwanzigtausend Anmeldungen. Die Teilnehmerübersicht bleibt bedienbar.                                                                          | Lasttest mit protokolliertem Aufbau und Datum (AP 10 der Phase 5), F32                           |
| Q21 | Ein Fehler tritt auf, der in der Entwicklung nicht vorkommt, weil er nur im Containerbetrieb entsteht.                                                       | `stack-e2e` — ein CI-Auftrag, der die fünf Container aus leerem Volume fährt                     |

## 10.3 Wo diese Sammlung schweigt

Drei Qualitäten sind **nicht** durch eine Testsuite dieses Repositories belegbar,
und das steht hier, damit niemand „grün" für mehr hält, als es ist:

- **Zustellbarkeit von Mail** (Posteingang statt Spam) hängt an SPF, DKIM und
  DMARC in der DNS-Zone der Organisation. E63 trennt die beiden Hälften
  ausdrücklich; die zweite ist eine Prüfliste in [`INSTALL.md`](../INSTALL.md).
- **Die Gerätematrix** — welche echten Geräte und Browser die PWA installieren
  und Push empfangen — braucht Geräte in der Hand. Sie steht in
  [`todo.md`](../../todo.md) unter _On a device_.
- **Nutzerfreundlichkeit** ist erst nach dem Usability-Test mit dem Pilotpartner
  eine Aussage. Vorbereitet wird er, gefahren wird er von Menschen.

# 4 Lösungsstrategie

Fünf Grundentscheidungen tragen den Entwurf. Vier stammen aus der Thesis, die
fünfte ist beim Bauen dazugekommen. Jede steht hier mit dem, was sie **kostet** —
eine Strategie ohne Preis ist eine Behauptung.

## 4.1 Strenge Schichtung im Server

Geschäftslogik über Datenzugriff über Datenbank. **Nur die Datenzugriff-Schicht
spricht mit PostgreSQL**; ein Datenbankwechsel muss allein durch Austausch dieser
Schicht möglich bleiben.

Umgesetzt mit NestJS-Dependency-Injection: die Geschäftsschicht kennt
**Ports** — Interfaces mit einem Injection-Token —, die Datenzugriff-Schicht
liefert die Implementierung. Die Geschäftsschicht importiert weder `typeorm` noch
`pg` noch irgendetwas unter `data-access/`.

**Durchgesetzt als ESLint-Regeln, nicht als Verabredung.** Vier absichtlich
gepflanzte Verstöße haben in Phase 0 bestätigt, dass die Regeln wirklich
auslösen. Bei einem Verstoß wird **ein Port eingezogen, nie die Regel gelockert**.

_Preis:_ Für jede neue Lesart entsteht ein Interface, ein Token, eine
Implementierung und eine Bindung im Modul — auch wenn es um ein einziges Feld
geht. Zuletzt in AP 11 der Phase 5: ein Port mit einer Methode, nur um die
Zeitzone eines Events zu lesen. Das ist teurer als ein direkter Repository-Aufruf
und der Grund, warum die Schichten nach fünf Phasen noch halten.

→ [`docs/rules/server-layers.md`](../rules/server-layers.md)

## 4.2 Plug-in-Muster in Server **und** Clients

Ein Server-Plug-in ist ein NestJS-`DynamicModule` mit drei Teilen gegen
definierte Schnittstellen — API, Geschäftslogik, Datenzugriff — mit **eigenen
Entities und eigenen Migrationen**. **Kerntabellen werden nie angefasst.** Ein
Client-Plug-in ist eine **Webkomponente**, die zur Laufzeit nachgeladen und an
einem der vier Einhängepunkte montiert wird.

Drei Regeln halten das zusammen:

- **Der Vertrag ist versioniert** (`PLUGIN_API_VERSION`, aktuell **1.3.0** und
  für v1.0 geschlossen). Ein Plug-in deklariert, gegen welche Version es gebaut
  wurde; ein zu altes wird nicht montiert.
- **Der Kern fragt ein Plug-in nichts** (E59). Was der Kern über ein Plug-in
  weiß, steht in dessen Deskriptor. Es gibt keine Rückrichtung, in der der Kern
  eine Methode eines Plug-ins aufruft.
- **Ein Plug-in liest Kerndaten nur durch schmale Lese-Ports** — Programm,
  Registrierungen, Teilnehmende —, nie durch ein Repository des Kerns.

_Preis:_ Jede Fähigkeit, die ein Plug-in braucht und der Vertrag nicht hat, ist
ein Versionsschritt und damit eine Entscheidung. Zweimal wurde eine gewünschte
Fähigkeit deshalb **nicht** gebaut, mit schriftlicher Begründung statt
stillschweigend.

→ [Abschnitt 8](08-querschnittliche-konzepte.md), der Plug-in-SDK-Leitfaden

## 4.3 Whitelabel über CSS Custom Properties

Primärfarbe, Akzentfarbe, Logo und Schriftart stehen in der Konfiguration. Der
Client rechnet die Abstufungen und schreibt sie als `--trefaro-*` auf das
Wurzelelement des Dokuments; **beide Clients und alle Plug-ins** erben sie.

Das ist mehr als eine Bequemlichkeit: Custom Properties überqueren die Grenze des
Shadow DOM von allein. Genau deshalb kann ein Plug-in eine Webkomponente ohne
eigenes CSS sein und trotzdem in den Farben der Organisation erscheinen — **ohne
eine Zeile Übergabecode und ohne Neubau**. Die Abstufungen entstehen als
`color-mix(in oklab, …)` im Browser, bleiben also abgeleitet statt eingefroren;
nur die Textfarbe wird gerechnet, weil Kontrast sich nicht mischen lässt.

_Preis:_ Was kein `--trefaro-*` ausliefert, darf kein Bauteil nennen — und eine
CSS-Deklaration, deren Custom Property niemand setzt, fällt still aus. Die
Design-Seite prüft deshalb Kontraste, und es gibt eine Regel dafür.

→ [`docs/rules/whitelabel-pwa.md`](../rules/whitelabel-pwa.md)

## 4.4 Zwei getrennte Clients gegen einen Server

Nutzer-Client **mobile-first** (entworfen bei 390 CSS-Pixeln, benutzbar bis
1280), Veranstalter-Client **desktop-first** (entworfen bei 1280, benutzbar ab
768). Getrennte Apps, kein Rollenschalter in einer Oberfläche.

Der Grund ist nicht Technik, sondern Nutzung: die beiden Rollen haben
unterschiedliche Geräte, unterschiedliche Aufgaben und unterschiedliche
Sitzungslängen. Eine Oberfläche für beide wäre für beide die falsche.

Was sie teilen, teilen sie als Bibliothek — HTTP, Konfiguration, Theming,
Modelle, i18n, der Plug-in-Einhängepunkt. Sieben Bibliotheken, aufgezählt in
[Abschnitt 5](05-bausteinsicht.md).

_Preis:_ Zwei Container, zwei Build-Ziele, zwei Browsersuiten — und jede
gemeinsame Änderung muss in beiden angesehen werden.

## 4.5 Alles, was konfigurierbar ist, ist es zur Laufzeit

Die fünfte Entscheidung, die beim Bauen entstand. Design, Sprachen,
Übersetzungen, Module, Plug-ins, Registrierungs- und Profilformulare, Grenzwerte:
nichts davon verlangt einen Neubau, die meisten nicht einmal einen Neustart.

Der Grund steht in [Abschnitt 2](02-randbedingungen.md): es gibt keinen
Anbieter. Was nur per Serverkonfiguration ginge, ist für eine NGO ohne
IT-Abteilung nicht konfigurierbar — und was einen Neubau verlangte, wäre für sie
gar nicht erreichbar.

Dazu gehört die **Client-Start-Sequenz**: erst die Konfiguration, dann das
Theming, dann die Plug-in-Bündel. Sie ist in
[Abschnitt 6](06-laufzeitsicht.md) beschrieben, weil sie sonst wie ein Detail
aussieht — sie ist aber der Mechanismus, der diese Entscheidung trägt.

_Preis:_ Jeder Schalter muss **etwas lesen** (E21), sonst ist er eine Attrappe;
jeder neue Wert muss durch `infra/docker-compose.yml` durchgereicht werden, sonst
ist er keine Konfiguration; und eine gelockerte Grenze muss beim Start laut
protokolliert werden, sonst merkt es niemand.

## 4.6 Wie Qualität erreicht wird

| Qualitätsziel                | Der Mechanismus, nicht die Absicht                                                                                                                                     |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Datenschutz (NFR 7/9)        | Systemgrenze nach [Abschnitt 3](03-kontextabgrenzung.md); CSP ohne Ausnahme; Opt-in für Auffindbarkeit; Logzeilen ohne Personenbezug                                   |
| Stabilität (NFR 10)          | Plug-in-Isolation im Client — ein Bündel, das 404 liefert oder wirft, wird übersprungen, die Anwendung startet ohne es                                                 |
| Erweiterbarkeit (NFR 2)      | Versionierter Plug-in-Vertrag, schmale Lese-Ports, kuratierte Liste statt Verzeichnis-Erkennung                                                                        |
| Installierbarkeit (NFR 15)   | Migrationen laufen beim Start, `synchronize` ist in Produktion verweigert, die Ersteinrichtung geht über einen Token, ein CI-Auftrag fährt den Stack aus leerem Volume |
| Nutzerfreundlichkeit (NFR 4) | Mockup-Abgleich als eigenes Paket, drei feste Breiten, ein Gestaltungsprojekt in Playwright                                                                            |
| Performance (NFR 12)         | Lasttest mit protokolliertem Aufbau und Datum; Paginierung durch **eine** geteilte Funktion; je Bildschirm gelesen, nicht je Zeile                                     |

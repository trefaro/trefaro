# 2 Randbedingungen

Was nicht zur Wahl stand. Manches kommt aus der Thesis, manches ist eine
Entscheidung von Marius, die ebenso bindend ist — die Spalte sagt, welches von
beidem.

## 2.1 Organisatorische und rechtliche Randbedingungen

| Randbedingung                          | Herkunft           | Folge für die Architektur                                                                                                                                              |
| -------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AGPL-3.0-or-later**                  | Entscheidung (F17) | Verschärft die GPL-Vorgabe der Thesis: auch wer die Anwendung als Dienst betreibt, muss den Quelltext herausgeben. Jede Abhängigkeit muss lizenzkompatibel sein.       |
| **Eine Instanz je Organisation**       | Thesis, NFR 7      | **Keine Mandantenfähigkeit.** Es gibt keine Organisation als Entität, keinen Tenant-Schlüssel in einer Tabelle und keine Zeile, die zwei Organisationen sehen könnten. |
| **Open Source, öffentlich entwickelt** | Thesis (NFR 5)     | Kein Geheimnis darf im Repository liegen. Kein Schlüssel, kein Zertifikat, keine Zugangsdaten — auch nicht in einem Test.                                              |
| **Kein Budget beim Betreiber**         | Thesis (NFR 14)    | Kein bezahlter Fremddienst darf Voraussetzung sein: kein Firebase für Push, kein Mailversanddienst, kein Karten-API-Schlüssel, kein Objektspeicher.                    |
| **Die Thesis ist die Referenz**        | Thesis             | Wo der Bau von den Mockups oder den Diagrammen abweicht, wird die Abweichung **entschieden und protokolliert** (E66), nicht stillschweigend hingenommen.               |

## 2.2 Technische Randbedingungen

Der Stack ist festgelegt und wird nicht ohne Rücksprache geändert. Die
Begründung je Baustein steht in
[Kapitel 5.2 des Referenzdokuments](../Anforderungsanalyse_und_Umsetzungsplan.md);
hier stehen die Versionen, gegen die tatsächlich gebaut wird.

| Bereich    | Festlegung                                                                                                  |
| ---------- | ----------------------------------------------------------------------------------------------------------- |
| Monorepo   | **Nx 23**, ein Repository für Server, beide Clients, fünf Plug-in-Bündel und sieben geteilte Bibliotheken   |
| Frontend   | **Angular 22**, zoneless, Standalone Components, Signals, SCSS; **zwei** getrennte Apps                     |
| PWA        | `@angular/pwa` im Nutzer-Client, ab v1 installierbar                                                        |
| Server     | **NestJS 11** auf Node LTS, TypeScript 6                                                                    |
| ORM / DB   | **TypeORM** auf **PostgreSQL 17**, Migrationen versioniert und beim Start ausgeführt, `JSONB` für Baukästen |
| Echtzeit   | **socket.io** über NestJS-Gateways, unter `/api/socket.io/`                                                 |
| Push       | **Web Push API** (VAPID), selbst gehostet                                                                   |
| E-Mail     | SMTP-Server der Organisation, mehrsprachige Templates, signierte Links                                      |
| i18n       | **Transloco** zur Laufzeit; Inhalte über Übersetzungstabellen                                               |
| Karten     | **OpenStreetMap/Leaflet**, niemals ein Google-Dienst — und in v1 gar keine Karte (F14)                      |
| Verteilung | **Docker Compose, fünf Container**, NGINX als Reverse Proxy                                                 |
| Tests      | Jest (Server), Vitest über `@angular/build:unit-test` (Clients), **Playwright 1.6x** für Oberfläche         |
| CI         | GitHub Actions: Lint, Unit, E2E, Container-Builds, und ein Auftrag, der den Stack aus leerem Volume fährt   |

Drei dieser Zeilen sind **Abweichungen von der Thesis**, alle drei begründet:
PostgreSQL statt MySQL (die Datenbank läuft nur als vorkonfigurierter Container,
also entfällt das Administrationsargument), AGPL statt GPL, und der Chat in
erweitertem Umfang mit Gruppen und Bildern (Wunsch aus dem Experteninterview).

## 2.3 Konventionen

- **Conventional Commits**, ein Paket pro Commit.
- **Englisch** in Code, Bezeichnern, Kommentaren und Commit-Messages;
  **Deutsch** in der Dokumentation dieses Repositories, weil sie zur Thesis
  gehört. Die eine Ausnahme ist [`docs/INSTALL.md`](../INSTALL.md): sie richtet
  sich an Betreiber und ist deshalb englisch.
- **Jedes Feature mit Unit-Tests**, jede Oberfläche mit Playwright, jeder
  Endpunkt mit einem Vertragstest in `apps/server-e2e`.
- **Schichtgrenzen sind Lint-Regeln**, keine Verabredung. Bei einem Verstoß wird
  ein Port eingezogen, nie die Regel gelockert.
- **Eine Lockerung steht in einer `.env`, nie in einer Zeile Code** — für
  Grenzwerte wie für Zertifikatsprüfung.

## 2.4 Was daraus folgt und oft überrascht

- **Es gibt keinen Anbieter.** Niemand betreibt „Trefaro" für andere. Alles, was
  Konfiguration ist, muss deshalb in der Anwendung selbst konfigurierbar sein —
  Farben, Logo, Schrift, Sprachen, Grenzwerte, Module. Was nur per
  Serverkonfiguration ginge, ist für diese Zielgruppe nicht konfigurierbar.
- **Mandantenfähigkeit nachzurüsten ist kein Ausbau, sondern ein anderes
  Produkt.** Keine Tabelle trägt einen Organisationsschlüssel, keine Abfrage
  filtert danach, und die Whitelabel-Konfiguration ist instanzweit und
  einzeilig.
- **Push funktioniert auf iOS nur in der installierten PWA.** Bewusst
  akzeptiert: die Alternative wäre Firebase gewesen, und das verbietet NFR 9.

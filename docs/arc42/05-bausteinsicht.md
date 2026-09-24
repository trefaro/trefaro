# 5 Bausteinsicht

Die Bausteinsichten der Thesis liegen als Originale unter
[`docs/thesis/diagramme/`](../thesis/diagramme/) — `Bausteinsicht 0.drawio.png`,
`Bausteinsicht Server.png`, `Bausteinsicht Clients.png` und
`Bausteinsicht Modulstruktur.png`. Dieser Abschnitt beschreibt, **was daraus
geworden ist**.

## 5.1 Ebene 1 — der Nx-Arbeitsbereich

Ein Repository, neunzehn Projekte. `npx nx show projects` zählt sie auf, `npx nx
graph` zeichnet die Abhängigkeiten.

| Projekt                                                                                                                 | Art                    | Aufgabe                                                                        |
| ----------------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------ |
| `server`                                                                                                                | NestJS-App             | Die gesamte Fachlichkeit, die API, die Plug-in-Wirte, die Datenzugriffsschicht |
| `user-client`                                                                                                           | Angular-App, PWA       | Nutzer- und Interessentensicht, mobile-first, an `/`                           |
| `admin-client`                                                                                                          | Angular-App            | Veranstaltersicht, desktop-first, an `/admin/`                                 |
| `plugin-program-proposals`, `plugin-forum`, `plugin-room-planning`, `plugin-qr-checkin`, `plugin-personal-program`      | Angular-App ohne Shell | Je ein **Bündel**: eine Webkomponente, kein eigenes CSS, kein `index.html`     |
| `shared-models`, `shared-http`, `shared-config`, `shared-theming`, `shared-i18n`, `shared-plugins`, `shared-plugin-kit` | Bibliothek             | Siehe 5.4                                                                      |
| `server-e2e`                                                                                                            | Jest                   | API-Vertragstests gegen einen laufenden Server                                 |
| `user-client-e2e`, `admin-client-e2e`                                                                                   | Playwright             | Die beiden Browsersuiten, je drei Browser                                      |
| `stack-e2e`                                                                                                             | Playwright             | Der Lauf gegen den **ausgelieferten** Fünf-Container-Stack aus leerem Volume   |

Zwei Grenzen sind hier wichtiger als die Aufzählung:

- **Der Server importiert genau eine geteilte Bibliothek**, `shared-models`.
  Deshalb ist ein gebrochener Vertrag ein Übersetzungsfehler und keine
  fehlgeschlagene Anfrage — und deshalb darf in `shared-models` nichts von
  Angular stehen.
- **Ein Plug-in-Bündel importiert keine Bibliothek des Wirts.** Es darf
  `shared-models` und `shared-plugin-kit` benutzen und sonst nichts; `shared-
plugins` gehört dem Wirt und spritzt dessen Angular-Dienste ein.

## 5.2 Ebene 2 — der Server

```
apps/server/src/
├── main.ts                 Bootstrap, globale Pipes/Filter, statische Bündel, OpenAPI
├── app/
│   ├── core/               was quer liegt: Konfiguration, Health, Drosselung,
│   │                       Filter, WebSocket-Adapter, Validierung, Betriebszahlen
│   ├── business/           die Fachlichkeit — Controller, Services, Ports
│   └── data-access/        Entities, Repositories, Migrationen, Speicher, Plug-in-Persistenz
└── plugins/                die fünf kuratierten Plug-ins, je mit allen drei Teilen
```

Die **Schichtgrenze** verläuft zwischen `business/` und `data-access/` und ist
eine Lint-Regel: `business/**` importiert weder `typeorm` noch `@nestjs/typeorm`
noch `pg` noch irgendetwas unter `data-access/`; `data-access/**` importiert
keinen Service der Geschäftsschicht, sondern nur deren Ports.
→ [`docs/rules/server-layers.md`](../rules/server-layers.md)

### Die Module der Geschäftsschicht

| Modul                                          | Wofür                                                                                       |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `login`, `security`, `setup`                   | Sitzungen für beide Rollen, Passwortregeln, Rücksetzen, die tokengeschützte Ersteinrichtung |
| `config`                                       | Design, Sprachen, **Kernmodul- und Plug-in-Schalter** — die eine Quelle von `/api/config`   |
| `event-series`, `events`, `program`            | Reihen, Events, Programmpunkte samt Anmeldung zu einem Programmpunkt                        |
| `registration`, `participants`, `self-service` | Registrierung mit Feld-Baukasten, Teilnehmerübersicht, die Selbstbedienungsseite            |
| `profiles`, `profile-search`                   | Konten, Profil-Baukasten, Auffindbarkeit nur mit Opt-in                                     |
| `chat`                                         | 1:1- und Gruppengespräche, Bilder, das Gateway                                              |
| `mail`, `invitations`, `newsletter`            | Ausgehende Mail, Einladung ehemaliger Teilnehmender, Opt-in-Verwaltung                      |
| `push`                                         | Web-Push-Abonnements und Zustellung                                                         |
| `i18n`, `content-translations`                 | Der Katalog der Oberfläche und die Übersetzungen von Inhalten                               |
| `media-links`, `logo-files`, `attachments`     | Externe Links, Logos je Reihe/Event, hochgeladene Dateien                                   |
| `dashboard`, `manifest`                        | Das Event-Dashboard des Veranstalters, das PWA-Manifest                                     |
| `privacy`                                      | Datenexport und Kontolöschung (E65)                                                         |
| `common`                                       | Was mehrere brauchen: Seitenfenster, `?locale=`-Pipe, gemeinsame Ports                      |
| **`plugin-api`**                               | **Der Vertrag.** Was ein Plug-in importieren darf — und nichts sonst vom Wirt               |
| **`plugin-manager`**                           | Wirt und Register: montiert die kuratierten Plug-ins, kennt ihren Schalter                  |

Sechs dieser Fachlichkeiten sind **Kernmodule mit Schalter** — `profiles`,
`profile-search`, `chat`, `media-links`, `push`, `newsletter-opt-in` —, die
übrigen sind immer an. Was ein Schalter darf und was er mit den Abhängigkeiten
anderer macht, steht in
[`docs/rules/api-contracts.md`](../rules/api-contracts.md).

### Der Datenzugriff

`data-access/` enthält Entities, Repositories (die Implementierungen der Ports),
die Migrationen, den Dateispeicher und `plugin-data-access/` — die **einzige**
Stelle, an der die Entity- und Migrationsbeiträge eines Plug-ins auf
ORM-Typen zurückgeführt werden. Der Vertrag typisiert sie als `unknown[]`, weil
die Geschäftsschicht die ORM nicht kennen darf.

## 5.3 Ebene 2 — die Clients

Beide Clients sind gleich geschnitten:

```
apps/<client>/src/app/
├── app.config.ts    Provider, darunter die Start-Sequenz aus 4.5
├── app.routes.ts    die Seiten
├── pages/           je Route eine Seite (Ansicht)
└── features/        je Fachlichkeit ein Ordner (Dienste, Modelle, Bauteile)
```

Das ist der MVC-Gedanke der Thesis in Angular-Begriffen: das Template ist die
View, die Komponentenklasse mit ihren Signals der Controller, die Dienste und
Modelle unter `features/` das Model — und die Modelle sind über Ansichten
wiederverwendbar, weil sie in `shared-models` liegen.

Der Nutzer-Client hat achtzehn Seiten, der Veranstalter-Client neunzehn. Die
Zahlen sind hier nur ein Größenhinweis; welche Seite wie aussehen soll, steht in
den Mockups und in der Mockup-Tabelle von AP 7 der Phase 5.
→ [`docs/rules/angular-clients.md`](../rules/angular-clients.md)

## 5.4 Ebene 2 — die sieben geteilten Bibliotheken

Der ursprüngliche Plan nannte vier. Drei sind beim Bauen dazugekommen, jede
mit einem Grund:

| Bibliothek          | Inhalt                                                                                                                                                                                       | Wer sie benutzt                              |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `shared-models`     | Die Nutzlasttypen jedes Endpunkts und die reinen Funktionen, die kein Client nachbauen darf — Zeiten in der Zone des Events, öffentliche Event-Adresse, Gruppierung des Programms nach Tagen | Server **und** beide Clients, und die Bündel |
| `shared-http`       | Der typisierte `ApiClient`, `ApiError`, die socket.io-Verbindung                                                                                                                             | beide Clients                                |
| `shared-config`     | Die Start-Sequenz: `/api/config` holen, Theme anwenden, Bündel laden                                                                                                                         | beide Clients                                |
| `shared-theming`    | Die Abstufungen der zwei Markenfarben, der Schreiber auf das Wurzelelement, die mitgelieferten Schriften                                                                                     | beide Clients                                |
| `shared-i18n`       | Die mitgelieferten Kataloge (`en.json` ist die Schlüsselliste) und die Transloco-Anbindung                                                                                                   | beide Clients                                |
| `shared-plugins`    | Die **Wirtsseite** des Plug-in-Mechanismus: Lader und `<trefaro-plugin-slot>`                                                                                                                | beide Clients                                |
| `shared-plugin-kit` | Die **Bündelseite**: die Worte aus dem Slot, Zeiten in der Sprache des Lesers, eigene Routen über `fetch`                                                                                    | nur die fünf Bündel                          |

Die letzte ist die erste Bibliothek, die **kein Client** benutzt — sie entstand,
als das dritte Bündel dieselben Zeilen ein drittes Mal kopiert hätte.

## 5.5 Ebene 3 — ein Plug-in

Jedes der fünf kuratierten Plug-ins hat dieselben zwei Hälften:

```
apps/server/src/plugins/<key>/
├── <key>.plugin.ts        der Deskriptor: Schlüssel, Versionen, Modul,
│                          Persistenz, Voraussetzungen, Client-Beitrag
├── <key>.module.ts        das NestJS-Modul
├── api/                   Controller und DTOs
├── business/              Service und **eigene Ports**
└── data-access/           eigene Entities, eigenes Repository, eigene Migrationen

apps/plugins/<key>/
├── src/main.ts            registriert die Webkomponente
└── src/app/               die Komponente, ihre API-Aufrufe, ihre Worte
```

Die Schichtung gilt **innerhalb** eines Plug-ins genauso wie im Kern: auch das
Geschäftslogik-Verzeichnis eines Plug-ins darf die ORM nicht importieren.

Wie man das selbst baut, steht in
[Abschnitt 8](08-querschnittliche-konzepte.md) — vollständig genug, dass man
keines dieser fünf lesen muss.

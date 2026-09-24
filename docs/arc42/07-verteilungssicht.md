# 7 Verteilungssicht

Die Verteilungssicht der Thesis (`Verteilungssicht.png` unter
[`docs/thesis/diagramme/`](../thesis/diagramme/)) ist unverändert umgesetzt:
**fünf Container je Instanz**, einer davon veröffentlicht einen Port.

Wie man das aufsetzt, betreibt, sichert und aktualisiert, steht vollständig in
[`docs/INSTALL.md`](../INSTALL.md) — auf Englisch, weil es das Dokument des
Betreibers ist. Dieser Abschnitt sagt nur, **warum** es so geschnitten ist.

## 7.1 Die fünf Container

| Container      | Image / Bau                 | Aufgabe                                                                |
| -------------- | --------------------------- | ---------------------------------------------------------------------- |
| `nginx`        | `nginx:1.29-alpine`         | Reverse Proxy, TLS-Abschluss, der **einzige** veröffentlichte Port     |
| `user-client`  | gebaut, `BASE_HREF=/`       | Statisches Angular-Bundle des Nutzer-Clients, PWA                      |
| `admin-client` | gebaut, `BASE_HREF=/admin/` | Statisches Angular-Bundle des Veranstalter-Clients                     |
| `server`       | gebaut                      | NestJS: API, WebSocket, Mailversand, Push, Migrationen, Plug-in-Bündel |
| `postgres`     | `postgres:17-alpine`        | Die Datenbank                                                          |

Zwei benannte Volumes: **`pgdata`** für die Datenbank und **`uploads`** für
Logos, Profilbilder, Chat-Bilder und Registrierungsanhänge. Beides gehört ins
Backup; alles andere ist aus dem Repository wiederherstellbar.

## 7.2 Der Schnitt, und warum er so ist

```
                       ┌───────────────────────────────┐
   :443 / :80 ────────▶│ nginx (reverse proxy)         │
                       └──┬──────────┬─────────────┬───┘
                          │          │             │
              /           │  /admin/ │       /api/ │  /api/socket.io/
                          ▼          ▼             ▼
                 ┌────────────┐ ┌──────────────┐ ┌──────────────────┐
                 │ user-client│ │ admin-client │ │ server (NestJS)  │
                 └────────────┘ └──────────────┘ └───────┬──────────┘
                                                         ▼
                                                 ┌──────────────────┐
                                                 │ postgres         │
                                                 └──────────────────┘
```

- **Nur der Proxy veröffentlicht einen Port.** Server und Datenbank liegen allein
  im internen Docker-Netz, also kann kein Endpunkt von außen erreicht werden, der
  nicht durch den Proxy geht. Ein unauthentifizierter Endpunkt ist damit nicht
  „offen im Internet", sondern „offen hinter dem Proxy" — ein Unterschied, auf
  den sich der Security-Review stützt.
- **`BASE_HREF` ist ein Bau-Argument, kein Laufzeitwert.** Angular braucht den
  Basispfad beim Übersetzen, deshalb sind die beiden Client-Container derselbe
  Dockerfile mit zwei Argumenten.
- **Der Server wartet auf die Datenbank**, per `condition: service_healthy` — er
  fährt seine Migrationen beim Start, und das darf nicht vor der ersten
  annehmbaren Verbindung passieren.
- **TLS ist eine Overlay-Datei**, keine zweite Compose-Datei mit kopiertem
  Inhalt. Die Routing-Regeln liegen in einer eingebundenen Teildatei, die beide
  Serverblöcke teilen — die Alternative wären zwei Kopien, die auseinanderlaufen.
- **Die Grund-Compose-Datei spricht HTTP** und reicht für einen Versuch auf
  `localhost` und für nichts sonst: das Sitzungscookie trägt in Produktion
  `Secure`.

## 7.3 Was der Proxy wissen muss

Drei Dinge, an denen ein davorgesetzter zweiter Proxy scheitert, wenn er sie
nicht kennt:

1. **`/api/socket.io/` braucht `Upgrade` und `Connection`.** Der WebSocket liegt
   absichtlich unter `/api` (siehe [Abschnitt 3](03-kontextabgrenzung.md)).
2. **`/admin/` ist ein eigener Container**, kein Pfad im Nutzer-Client.
3. **Die Sicherheitskopfzeilen setzt dieser Proxy**, nicht die Anwendung: alles
   `'self'`, `frame-src 'none'`, `script-src` ohne Ausnahme — was auch für ein
   Plug-in-Bündel gilt, weil es same-origin geladen wird.

`infra/nginx/trefaro-locations.conf` ist die maßgebliche Fassung;
`tools/spike-verification/verify-proxy.mjs` sagt gegen eine laufende Instanz, ob
sie angekommen ist.

## 7.4 Entwicklung und CI

- **Entwicklung:** `nx serve` für Server und Clients, Datenbank und Mailpit als
  Container. Die Bündel-URL ist dieselbe wie im Betrieb, weil der Dev-Server sie
  auf den Server proxiert.
- **CI:** Lint, Unit, die drei E2E-Projekte, Container-Builds — und ein Auftrag,
  der die fünf Container **aus leerem Volume** hochfährt und einen Browser
  darüber treibt. Der Fehlerklasse „läuft in der Entwicklung, kaputt wie
  ausgeliefert" ist mit keiner Testsuite dieses Repositories beizukommen; genau
  dafür gibt es `stack-e2e`.

Und die Regel, die daran hängt: **wer „grün" sagen will, hat den Stack
hochgefahren** — und wer „grün" über die CI sagt, hat den **Abschluss** des Laufs
gelesen.
→ [`docs/rules/deployment.md`](../rules/deployment.md),
[`docs/rules/infrastructure.md`](../rules/infrastructure.md)

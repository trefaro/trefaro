# 3 Kontextabgrenzung

Die Systemgrenze ist eng gezogen, und das ist Absicht: jeder Pfeil über die
Grenze ist ein Datenschutzrisiko, das begründet werden muss (NFR 7, NFR 9).

Das Original der Verteilungssicht aus der Thesis liegt unter
[`docs/thesis/diagramme/`](../thesis/diagramme/) — `Verteilungssicht.png` und
`Use Cases.png` zeigen denselben Ausschnitt, den dieser Abschnitt in Worte
fasst.

## 3.1 Fachlicher Kontext

```
   Veranstalter ──── HTTPS ────▶┐
   Nutzer ────────── HTTPS ────▶│
   Interessierte Person ─HTTPS ▶│         ┌───────────────┐
                                ├────────▶│               │
                                          │    Trefaro    │──── SMTP ──────▶ Mailserver der Organisation
   Betreiber ─── Shell/Compose ─────────▶ │  (eine Instanz)│
                                          │               │──── HTTPS ─────▶ Push-Dienst des Browserherstellers
                                          └───────┬───────┘
                                                  │
                                          Browser des Nutzers
                                                  │
                                                  └─── HTTPS ───▶ externe Mediathek / Stream (nur als Link)
```

| Nachbar                                    | Richtung    | Was über die Grenze geht                                                                                                                                                                                                                                            |
| ------------------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Veranstalter** (Browser)                 | rein / raus | Alles unter `/admin/` und `/api/admin/…`. Immer mit Sitzung; es gibt keine anonyme Admin-Route.                                                                                                                                                                     |
| **Nutzer** (Browser, oft installierte PWA) | rein / raus | `/` und `/api/user/…`. Öffentlich sind nur Startseite, Reihen, Event-Landingpage, Registrierung, Kontaktformular und Newsletter-Anmeldung.                                                                                                                          |
| **Interessierte Person**                   | rein / raus | Derselbe Client ohne Sitzung. Sie kann sich registrieren und den Veranstalter kontaktieren — die Antwort erreicht sie **per Mail**, nicht in der Anwendung.                                                                                                         |
| **Mailserver der Organisation**            | raus        | SMTP mit Anmeldung und STARTTLS. Bestätigungen, Einladungen, Benachrichtigungen, Rücksetz-Links, der Datenexport-Hinweis. Trefaro betreibt keinen eigenen MTA.                                                                                                      |
| **Push-Dienst des Browserherstellers**     | raus        | Web-Push nach VAPID, an den Endpunkt, den der Browser dem Client gegeben hat. **Verschlüsselte Nutzlast**, so wenig Personenbezug wie möglich — der Dienst sieht den Inhalt nicht.                                                                                  |
| **Externe Mediathek / Stream**             | keiner      | Trefaro speichert eine URL und **verlinkt** sie. Kein `<iframe>`, kein eingebetteter Player, kein fremdes Skript auf einer Seite dieser Anwendung (F51, und seit AP 9 der Phase 5 auch als CSP-Kopfzeile). Der Browser des Nutzers geht dorthin, die Instanz nicht. |
| **Betreiber**                              | rein        | `.env`, `docker compose`, Backups, TLS-Zertifikat. Kein Fernzugriff, keine Telemetrie, kein Aufruf nach Hause.                                                                                                                                                      |
| **Zertifizierungsstelle** (Let's Encrypt)  | raus        | Nur beim Ausstellen und Erneuern des TLS-Zertifikats, außerhalb der Anwendung. → [`INSTALL.md`](../INSTALL.md)                                                                                                                                                      |

## 3.2 Was ausdrücklich **nicht** über die Grenze geht

Diese Liste ist der eigentliche Inhalt dieses Abschnitts — sie ist kürzer zu
prüfen als das Gegenteil:

- **Keine Analyse, keine Telemetrie, kein Fehlerdienst.** Eine Instanz meldet
  nichts an niemanden. Was schiefging, steht im eigenen Log.
- **Kein CDN.** Schriften liegen lokal im Image (kein Google Fonts), Icons
  ebenso, und keine Seite lädt ein Skript von außerhalb. Die Kopfzeilen des
  Proxys setzen das durch: alles `'self'`, `frame-src 'none'`, und `script-src`
  ohne Ausnahme — was auch für ein Plug-in-Bündel gilt.
- **Kein Objektspeicher.** Logos, Profilbilder, Chat-Bilder und
  Registrierungsanhänge liegen in einem Docker-Volume.
- **Keine Karte.** OpenStreetMap ist die entschiedene Alternative, aber sie ist
  eine Ausbaustufe nach v1 (F14). Räume werden in v1 strukturiert verwaltet,
  nicht verortet.
- **Kein Newsletter-Versanddienst.** v1 verwaltet nur das Opt-in; der Versand
  läuft über das Werkzeug, das die Organisation ohnehin hat.
- **Keine zweite Instanz.** Es gibt keine Föderation, keinen Abgleich zwischen
  Organisationen und keinen gemeinsamen Profilbestand.

## 3.3 Technischer Kontext

Alles kommt durch **einen** veröffentlichten Port, den des Reverse Proxy; Server
und Datenbank liegen allein im internen Docker-Netz. Welche Adresse wohin geht,
steht in [Abschnitt 7](07-verteilungssicht.md); die Verträge der Endpunkte in
[`docs/rules/api-contracts.md`](../rules/api-contracts.md).

Drei Eigenheiten, die man kennen muss, bevor man einen Proxy davorstellt:

1. **Der WebSocket liegt unter `/api/socket.io/`**, nicht am socket.io-Standard.
   Grund: das Sitzungscookie des Nutzers trägt `Path=/api` und würde nirgendwo
   sonst mitreisen — und genau dieser Handshake authentifiziert den Socket.
2. **Plug-in-Bündel kommen vom Server**, unter `/api/plugins/<key>/main.js`,
   nicht aus einem Client-Container. So gilt dieselbe URL in der Entwicklung
   (durch den Dev-Server-Proxy) und im Betrieb (durch NGINX).
3. **Die OpenAPI-Beschreibung ist öffentlich** (`/api/docs`), die bedienbare
   Konsole daneben nicht. Der Quelltext ist ohnehin offen, und NFR 8 verlangt
   Dokumentation.

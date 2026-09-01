# Deployment und Prüfung

Die Fehlerklasse, die **keine** Testsuite dieses Repositories finden kann — und
was stattdessen dagegen prüft.

Die E2E-Suiten fahren `nx serve`, die Vertragssuite benutzt `fetch`, und
die CI **baut** die Images, ohne sie je zusammen zu starten. Alles, was nur im
Zielbetrieb oder nur im Produktionsbuild existiert, ist damit unbeobachtet. Zwei
Beispiele haben je eine frische Produktionsinstanz unbenutzbar gemacht.

- **Eine Umgebungsvariable lebt an drei Stellen, nicht an zwei:** `env.ts` liest
  sie, `.env.example` dokumentiert sie — und `infra/docker-compose.yml` muss sie
  an den Server-Container **durchreichen**. Genau das fehlte bei
  `ADMIN_BOOTSTRAP_*`: eine frische Produktionsinstanz hatte **keinen
  Administrator**. Bei `I18N_CATALOGUE_DIR` sind es vier Stellen (zusätzlich
  webpack-`assets` und der `COPY` im Dockerfile).
- **Wer Installierbarkeit prüfen will, fährt den Stack hoch:**
  `docker compose -f infra/docker-compose.yml up -d --build` gegen ein **leeres**
  Volume, mit eigenem `-p`-Projektnamen, danach `down -v`. Das ist die einzige
  Prüfung, die NFR 15 belegt, und sie gehört an das **Ende jeder Phase**.
- **Was nur im Produktionsbuild passiert, sieht keine Suite.**
  `tools/spike-verification/` gegen einen laufenden Stack ist dafür das einzige
  Netz — benutzen, bevor man „grün" sagt.
- **Der Service Worker des Nutzer-Clients hat Scope `/` — also auch `/admin/`.**
  `ngsw-worker.js` liegt im Wurzelverzeichnis und beantwortet **jede** Navigation
  in seinem Scope aus dem eigenen Cache, sofern `navigationUrls` sie nicht
  ausschließt. Bis 28.08.2026 fehlte `/admin` dort — der Veranstalter-Client war
  im Containerbetrieb **nicht erreichbar**. Wer eine Adresse ergänzt, die nicht
  diesem Client gehört, ergänzt sie dort. Geprüft in `verify-proxy.mjs` gegen das
  gebaute `ngsw.json`, mit ngsws eigener Auswahlregel — ein Unit-Test und jede
  `fetch`-Prüfung sind dafür blind.
- **Ohne TLS ist der Produktionsstack nur auf `localhost` bedienbar.** Das
  Sitzungscookie trägt `Secure`, sobald `NODE_ENV=production` (E2), und ein
  Browser speichert das nur über HTTPS. TLS gehört damit zur Installations-Story
  (`infra/docker-compose.tls.yml`), nicht zur Härtung; `Secure` fallen zu lassen
  ist keine Alternative.
- **Das Routing des Proxys steht einmal** in `infra/nginx/trefaro-locations.conf`,
  eingebunden von `trefaro.conf` und `trefaro-tls.conf`. Und **`ports:` im Overlay
  braucht `!override`** — Compose verkettet Sequenzen, Mounts führt es über ihr
  Ziel zusammen.
- **`AUTH_SECRET` braucht ≥ 32 Zeichen.** Ein handgeschriebenes `.env`
  unterschreitet das leicht, und der Server läuft dann in einer Absturzschleife
  mit genau dieser Meldung. `randomBytes(32).toString('base64url')`.
- **`startupWarnings()` ist eine reine Funktion mit zwei Lesern** — dem Startlog
  und dem Setup-Zustand. Sie meldet Werte, die _vorhanden_ und für ein echtes
  Deployment _falsch_ sind (Klartext-URL, Mailserver auf `localhost`, Absender
  ohne Domain, fehlendes VAPID-Paar, unverschlüsselte Verbindung zu einer
  entfernten DB) — nicht, was `loadEnv` schon verweigert. Eine neue solche
  Bedingung kommt dorthin, nicht in ein Dokument.
- **Ersteinrichtung:** Token nur im Speicher, 32 Zufallsbytes, bei jedem Start
  neu, Vergleich mit `timingSafeEqual`, **keine** engere Drosselung als die
  globale (ein 256-Bit-Token lässt sich nicht raten, E4). **Der Account wird
  zuletzt geschrieben** — er schließt die Route, also erst Name, Sprache, Farben;
  wird ein Wert abgelehnt, bekommt der Betreiber das Formular zurück und keine
  verschlossene Instanz. **Keine Sitzung** als Antwort: angemeldet wird sich auf
  dem Login, weil dort ein Deployment ohne TLS sofort auffällt (E2).
  `ADMIN_BOOTSTRAP_*` bleibt der unbeaufsichtigte Weg.
- **Der Erfolgspfad der Ersteinrichtung hat keinen automatisierten Test und kann
  keinen haben** (die Endpunkte existieren nur bei leerer `admin_user`-Tabelle, und
  der letzte Administrator ist nicht löschbar, F22). Also Unit-Tests plus
  `verify-setup.mjs` gegen einen **frischen** Stack; die Suiten prüfen, dass die
  Route **zu** ist.
- **Prüfskripte nehmen die Adresse aus `BASE`** (alte Namen gelten weiter und
  gewinnen), die zwei mit Datenbankzugriff zusätzlich `POSTGRES_CONTAINER`,
  `DATABASE_USER`, `DATABASE_NAME`. **Kein Containername als Literal** — mit dem
  alten Literal legte ein Lauf gegen den Container-Stack den Schalter der
  **Entwicklungs**instanz um und prüfte gegen die andere.
- **Ein Prüfskript nagelt keinen konfigurierbaren Wert fest, sondern seine Form.**
  `verify-api.mjs` prüft Hex-Form (E17) und dass eine Logo-URL fehlt oder die
  pfadfreie Route ist (E19) — nicht zwei gesäte Farben. Eine gebrandete Instanz
  ist der Normalfall.
- **`verify-proxy.mjs` läuft über HTTPS, wenn `PROXY_BASE` https ist** (dazu
  `PROXY_PLAIN_BASE` für Umleitung und `Secure`-Cookie-Login). Gegen ein selbst
  ausgestelltes Zertifikat braucht auch der socket.io-Client die Ausnahme, sonst
  liest sich der Fehlschlag wie „der Proxy leitet keine Upgrades weiter".
- **`tools/spike-verification/` prüft eine laufende Instanz, `*-e2e` prüft im
  CI** — bewusst getrennt.
- **`tools/demo-seed/` füllt ausschließlich über die API**, damit kein Zustand
  entsteht, den die Anwendung selbst ablehnen würde. `seed.mjs --reset` ersetzt
  einen früheren Lauf. Braucht **Mailpit**: Bestätigung, Selbstbedienungslink und
  Widerspruch sind Tokens, die nur in versandter Mail existieren. Er brandet die
  Instanz und übersetzt einen Teil des Inhalts; die Bilder werden **erzeugt**
  (`demoPng`), nicht eingecheckt, weil der Server die ersten Bytes liest (F38) und
  den Kopf für die Größe (F106). `--reset` nimmt die Marke **nicht** zurück.

Siehe auch: [Browsersuiten und E2E-Tests](e2e-tests.md), [Whitelabel und PWA](whitelabel-pwa.md), [Infrastruktur-Entscheidungen](infrastructure.md).

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
- **Sieben Zahlen sind Konfiguration, nicht Code** (sechs seit AP 2 der Phase 5, die siebte seit AP 10):
  `LOGIN_ATTEMPTS_PER_WINDOW`, `REGISTRATIONS_PER_WINDOW`,
  `NEWSLETTER_SIGNUPS_PER_WINDOW`, `CONFIRMATIONS_PER_WINDOW`,
  `MAILS_PER_RECIPIENT_PER_WINDOW` und — seit AP 4 —
  `PASSWORD_RESETS_PER_WINDOW`. Sie leben an den drei Stellen von oben —
  `core/config/rate-limits.ts` hält die Vorgaben, `.env.example` erklärt sie,
  `infra/docker-compose.yml` reicht sie durch — und in der Compose-Datei
  **leer**, nicht mit einer Kopie der Zahl: eine zweite Kopie einer Vorgabe ist
  eine Vorgabe, die auseinanderläuft. Wer eine Instanz übernimmt und wissen
  will, ob jemand eine Grenze gelockert hat, liest die ersten Zeilen des
  Serverlogs: jeder Wert über seiner Vorgabe steht dort als `WARN`, und
  Schweigen heißt die ausgelieferten Zahlen. Die siebte ist
  `GLOBAL_REQUESTS_PER_MINUTE` — die Grenze, gegen die **jede** Anfrage zählt,
  Vorgabe 300, und bis AP 10 eine Zeile Code. Gebraucht hat sie als Erstes der
  Lasttest, denn bei fünf Anfragen je Sekunde misst er die Drosselung und nicht
  den Server; sie im Code hochzusetzen wäre genau das, was E60 verbietet.
- **Zwei Werte kamen in AP 10 der Phase 5 dazu**: `GLOBAL_REQUESTS_PER_MINUTE`
  (siehe oben) und `LOG_LEVEL` — `warn`, `log` (Vorgabe), `debug` oder
  `verbose`, beide leer durchgereicht. **Leiser als `warn` gibt es nicht**, und
  das ist kein Geschmack: die Zeilen, die eine gelockerte Grenze (E60) oder
  unverschlüsselte Mail (E62) melden, sind Warnungen — eine Instanz, die sie
  nicht drucken kann, ist eine, deren Konfiguration aus ihrem eigenen Protokoll
  nicht mehr prüfbar ist. Was ins Protokoll darf, steht in
  [`observability.md`](observability.md).
- **Zwei weitere Werte und ein Verzeichnis kamen in AP 3 der Phase 5 dazu**:
  `SMTP_REQUIRE_TLS` und `SMTP_PAUSE_BETWEEN_MAILS_MS` — beide leer
  durchgereicht, beide mit ihrer Vorgabe im Server — sowie
  `NODE_EXTRA_CA_CERTS` zusammen mit dem Mount `infra/ca/` →
  `/etc/trefaro/ca`. Der Mount ist bewusst **immer** da und normalerweise leer:
  einem internen Mailserver zu vertrauen soll eine Datei und eine Variable
  sein, keine zweite Compose-Datei. Bei derselben Gelegenheit wurde eine
  Vorgabe **korrigiert**: `SMTP_PORT=587` stand neben `SMTP_SECURE=true`, und
  das ist kein „sicherer", sondern das falsche Protokoll auf diesem Port — so
  konfiguriert wurde nie etwas versendet. Das ist genau die Fehlerklasse dieses
  Dokuments: die Kombination existiert nur in der Compose-Datei, also sah sie
  keine Suite.
- **Der Mailserver der Entwicklung beweist zu wenig, und dafür gibt es ein
  eigenes Profil** (E62): `docker compose -f infra/docker-compose.dev.yml
--profile secure-mail up -d` startet einen Mailpit, der ohne Anmeldung und
  ohne STARTTLS **ablehnt**, auf eigenen Ports neben dem offenen. Geprüft wird
  er mit `tools/secure-mail/verify.sh` — erst, was er ablehnt, dann eine
  Bestätigungsmail, die trotzdem durchgeht. Zertifikat, Schlüssel und
  Passwortdatei erzeugt `materials.sh` nach `infra/mailpit/` und **nichts
  davon ist eingecheckt**: ein selbstsignierter Schlüssel ist ein Schlüssel.
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
- **Vier Werte fehlen nicht mit einer Warnung, sondern mit einer
  Absturzschleife:** `AUTH_SECRET`, `DATABASE_PASSWORD`, **`SMTP_HOST` und
  `SMTP_FROM`** — `read.required()` in `env.ts` sammelt sie unter „is required
  when `NODE_ENV=production`", und der Server startet nicht. Die zwei Mailwerte
  überraschen, weil eine Instanz ohne Mail sonst nirgends verboten ist; die
  Begründung ist der Double-Opt-In, ohne den sich niemand anmelden kann. Dazu
  verlangt Compose selbst `PUBLIC_USER_CLIENT_URL` und
  `PUBLIC_ADMIN_CLIENT_URL` (`:?`-Syntax, der Fehler kommt dann von Compose und
  nicht vom Server). Gefunden am 14.09.2026 vom `stack`-Job beim allerersten
  Lauf, an seinem eigenen erzeugten `.env` — was genau die Klasse ist, für die
  es ihn gibt.
- **Der `stack`-Job der CI ist die Antwort auf diese ganze Datei.**
  `tools/shipped-stack/verify.sh` fährt die fünf Container aus **leerem**
  Volume hoch, richtet die Instanz über den **geführten** Weg ein
  (`ADMIN_BOOTSTRAP_*` bleibt leer, der Token kommt aus dem Serverlog), fährt
  `verify-setup.mjs` und `verify-proxy.mjs` und lässt danach einen Browser mit
  **wirklich registriertem** Service Worker darauf los (`apps/stack-e2e`).
  Lokal dasselbe Kommando. Die statische Hälfte ist `verify-proxy.mjs` gegen
  `ngsw.json`, die verhaltensmäßige ist der Browser — beide braucht es, weil
  die eine die Regel liest und die andere ihre Wirkung.
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
- **Der Socket braucht eine eigene `location`, und sie liegt in `/api/`**
  (F160). `location /api/socket.io/` mit `proxy_http_version 1.1`, `Upgrade`
  und `Connection "upgrade"` — nginx nimmt das längste Präfix, also gewinnt sie
  über `/api/` und kollidiert nicht mit ihr. Unter `/api` **muss** sie liegen,
  weil das Sitzungscookie `Path=/api` trägt und der Handshake sich damit
  authentifiziert (E41); der Pfad steht als `REALTIME_PATH` in `shared-models`,
  und wer ihn ändert, ändert vier Stellen: Adapter, Proxy, beide Dev-Proxys.
  In den Dev-Proxys entscheidet die **Reihenfolge** — `/api/socket.io` mit
  `"ws": true` muss **vor** `/api` stehen, sonst nimmt die allgemeinere Regel
  den Handshake und lässt das Upgrade fallen.
- **`verify-chat.mjs` ist die einzige Prüfung, die das Abnahmekriterium von
  AP 7 wirklich stellt:** zwei Konten, zwei Sockets, eine Nachricht, die bei
  beiden ankommt — **durch den Proxy**. Es braucht Mailpit (der Double-Opt-In
  eines Kontos) und `docker exec` (für ein Teilnehmerkonto gibt es bewusst
  keinen Löschendpunkt) und räumt in der Reihenfolge aus F158 auf. Das
  Gegenstück in `verify-proxy.mjs` prüft nur noch, dass die **Ablehnung** ohne
  Cookie ankommt: der Satz des Servers, angekommen über den Socket, ist derselbe
  Beweis für Upgrade und Rückweg, den vorher das Echo geliefert hat — nur ohne
  einen Handler, der allein für den Test existiert.
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
- **`tools/upload-sweep/` greift als einziges Werkzeug an der API vorbei** — es
  listet das Volume mit `docker exec … find` im Server-Container und liest die
  Pfadspalten mit `psql` im Datenbank-Container, weil keine API die Frage
  beantwortet, welche Bytes im Volume liegen, auf die keine Zeile zeigt. Beide
  Containernamen kommen aus `SERVER_CONTAINER` und `POSTGRES_CONTAINER`; wer
  rät, listet das eine Volume gegen die Zeilen des anderen. Es **löscht nichts**,
  meldet in beide Richtungen und gibt **0 / 2 / 1** zurück (einig / etwas
  gefunden / Lauf nicht möglich), damit ein Cron-Eintrag die drei Lagen
  auseinanderhalten kann.
- **Was nur hinter dem echten Proxy gilt, wird hinter dem echten Proxy
  geprüft.** Die Sicherheitskopfzeilen und die in Produktion abgeschaltete
  API-Konsole (F229, F230) haben ihre Tests in `apps/stack-e2e`, nicht in einer
  Client-Suite: ein Entwicklungsserver schickt keine dieser Kopfzeilen und läuft
  nicht mit `NODE_ENV=production`, also würde eine Suite dort eine Regel
  behaupten, die niemand ausgeliefert bekommt.

Siehe auch: [Browsersuiten und E2E-Tests](e2e-tests.md), [Whitelabel und PWA](whitelabel-pwa.md), [Infrastruktur-Entscheidungen](infrastructure.md).

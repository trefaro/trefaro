# Hinweise für diesen Teilbaum

Sechs Werkzeuge, und sie unterscheiden sich darin, **wer die Instanz hochfährt**:

- `spike-verification/` und `demo-seed/` laufen gegen eine **laufende** Instanz,
  die jemand anders gestartet hat, nicht im CI — jenes prüft ein Deployment,
  dieses füllt es, ausschließlich über die API, damit kein Zustand entsteht, den
  die Anwendung selbst ablehnen würde.
- `shipped-stack/` **erzeugt seine eigene Wegwerf-Instanz**: fünf Container aus
  leerem Volume, geführte Ersteinrichtung, ein Browser darauf, danach `down -v`.
  Es läuft lokal und im CI-Job `stack` mit demselben Kommando, damit „bei mir
  lief es" und „die CI sagt grün" dieselbe Sache bedeuten.
- `upload-sweep/` läuft wie die ersten beiden gegen eine **laufende** Instanz,
  greift aber als einziges Werkzeug an der API vorbei: es listet das Volume im
  Server-Container und liest die Pfadspalten im Datenbank-Container, weil genau
  die Frage, die es stellt, keine API beantwortet — welche Bytes im Volume
  liegen, auf die keine Zeile zeigt. Es **löscht nichts** und urteilt nicht über
  ein Schema, dessen Pfadspalten es nicht alle kennt.
- `load-test/` **erzeugt seine eigene Wegwerf-Instanz** wie `shipped-stack/`, und
  es ist das einzige Werkzeug, das dabei eine Grenze **anhebt**: jede Anfrage
  zählt gegen `GLOBAL_REQUESTS_PER_MINUTE`, und bei den ausgelieferten 300 pro
  Minute misst ein Lasttest die Drosselung statt den Server. Angehoben wird in
  der `.env` des Wegwerf-Stacks, nie in einer Zeile Code (E60), und `load.mjs`
  bricht mit `3` ab, sobald auch nur eine 429 kommt. Alle sechs Szenarien sind
  Lesezugriffe; gefüllt wird per SQL, weil 20 000 Anmeldungen durch Drosselung
  und Double-Opt-In keine Messung wären — mit Präfix an jeder Adresse und einem
  `--remove`, das genau die wieder wegnimmt.
- `secure-mail/` **erzeugt seinen eigenen Gegenspieler**: einen Mailserver, der
  ohne Anmeldung und ohne STARTTLS ablehnt (Compose-Profil `secure-mail`), und
  einen Server daneben, der trotzdem durchkommt. Es beantwortet die eine Frage,
  die der offene Mailpit nicht beantworten kann — und ausdrücklich **nicht** die
  nach der Zustellbarkeit, die an DNS-Einträgen hängt (E63).

Vor Änderungen: [`docs/rules/deployment.md`](../docs/rules/deployment.md).
Die zwei Regeln, die hier am häufigsten gebrochen wurden:

- **Kein Containername als Literal.** Die Adresse kommt aus `BASE`, der
  Datenbankzugriff zusätzlich aus `POSTGRES_CONTAINER`, `DATABASE_USER`,
  `DATABASE_NAME` — sonst prüft ein Lauf die eine Instanz und verändert die andere.
- **Ein Prüfskript nagelt keinen konfigurierbaren Wert fest, sondern seine Form.**
  Eine gebrandete Instanz ist der Normalfall.

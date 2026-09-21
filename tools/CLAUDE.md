# Hinweise für diesen Teilbaum

Fünf Werkzeuge, und sie unterscheiden sich darin, **wer die Instanz hochfährt**:

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

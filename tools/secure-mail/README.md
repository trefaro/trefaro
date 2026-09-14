# Ein Mailserver, der ablehnt

Ein Skript, das zwei Dinge zeigt, die der offene Mailpit des Entwicklungsstacks
nicht zeigen kann: **was ein strenger Mailserver ablehnt** und **dass diese
Anwendung trotzdem durchkommt** — angemeldet, verschlüsselt und mit einem
Zertifikat, für das keine öffentliche Stelle bürgt (E62).

```bash
tools/secure-mail/verify.sh
```

Aus der Wurzel des Arbeitsbereichs. Gebraucht werden Docker, die
Entwicklungs-Datenbank und ein freier Port (Vorgabe 3100).

## Warum es das gibt

Jede automatisierte Suite dieses Repositories spricht mit dem Mailpit aus
`infra/docker-compose.dev.yml`, und der nimmt alles an. Für die Frage „ist eine
Nachricht mit funktionierendem Link rausgegangen" ist das genau richtig; für
„kann sich diese Instanz anmelden und verschlüsseln" ist es wertlos — und das
ist die Frage, die der Mailserver einer Organisation am ersten Tag stellt.

Deshalb ein zweites Compose-Profil: derselbe Mailpit, aber mit
`--smtp-auth-file`, einem STARTTLS-Zertifikat und `--smtp-require-starttls`, auf
eigenen Ports **neben** dem offenen. Zwei nebeneinander, weil der Vergleich der
Beweis ist.

## Was das Skript tut

1. `materials.sh` legt Zertifikat, Schlüssel und Passwortdatei unter
   `infra/mailpit/` an — **nichts davon ist eingecheckt**, ein selbstsignierter
   Schlüssel ist ein Schlüssel.
2. Startet das Profil `secure-mail` und die Datenbank.
3. `probe.mjs` fragt den Mailserver, was er ablehnt: unverschlüsselt
   (`530 Must issue a STARTTLS command first`) und unangemeldet
   (`530 Authentication required`). Schlägt fehl, wenn er etwas davon annimmt —
   dann wäre alles danach bedeutungslos.
4. Baut den Server und startet ihn mit `SMTP_REQUIRE_TLS=true`, Zugangsdaten und
   **`NODE_EXTRA_CA_CERTS`** auf das erzeugte Zertifikat.
5. `check.mjs` legt ein Teilnehmerkonto an und liest die Bestätigungsmail aus
   dem strengen Mailserver.

Zum Schluss zeigt es, was der Server beim Start über seine Mail-Einstellungen
gesagt hat. **Schweigen ist das Ergebnis:** eine Zeile dort hieße, dass die
Instanz im Klartext verschickt oder jedes Zertifikat akzeptiert.

## Die Gegenprobe

Ohne `NODE_EXTRA_CA_CERTS` scheitert schon die TLS-Verbindung
(`self-signed certificate`). Das ist der Beweis, dass die Prüfung wirklich
stattfindet — und der Grund, warum es in diesem Repository keine Zeile
`rejectUnauthorized: false` gibt und `smtp-mailer.spec.ts` rot wird, wenn
jemand eine schreibt.

## Was es ausdrücklich **nicht** prüft

Zustellbarkeit. SPF, DKIM, DMARC, Reverse-DNS und die Frage, ob eine Nachricht
im Posteingang statt im Spam-Ordner landet, hängen an den DNS-Einträgen der
Organisation (E63). Sie sind eine Prüfliste in
[`docs/INSTALL.md`](../../docs/INSTALL.md), Abschnitt 7.3, und kein Testserver
der Welt kann sie beantworten.

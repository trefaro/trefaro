# Release-Feststellung v1.0

**Stand: 01.10.2026, AP 14 der Phase 5 (E71).** Dieses Dokument stellt fest,
worauf eine Version 1.0 sich stützen könnte und was dabei offen bleibt. Es
**setzt keinen Tag** — den setzt ein Mensch, und zwar erst, nachdem er den
Abschnitt _Vor dem Tag_ gelesen hat.

Das ist keine Formalität. Ein Arbeitspaket kann messen, zählen und aufschreiben;
es kann nicht entscheiden, ob ein Produkt fertig genug ist, um einen Namen zu
tragen, den man nicht zurücknimmt. Was hier steht, ist deshalb eine
**Entscheidungsgrundlage** und keine Empfehlung mit einem Haken daran.

---

## 1. Worauf sich v1.0 stützt

### 1.1 Die Anforderungen der Thesis

Fünf Phasen, von denen jede ihr eigenes Protokoll hat: Kern-Eventmanagement
(alle P1), Whitelabel und Mehrsprachigkeit, Profile und Community, fünf
kuratierte Plug-ins, Härtung und Gestaltung. Was gegenüber der Thesis **anders**
entschieden wurde, steht nicht verstreut, sondern an einer Stelle: im Anhang des
[Referenzdokuments](Anforderungsanalyse_und_Umsetzungsplan.md), fünfunddreißig
Punkte, jeder mit Grund und Fundstelle. Der Umsetzungsstand je Anforderung steht
in den Phasenprotokollen [1](PHASE1.md), [2](PHASE2.md), [3](PHASE3.md),
[4](PHASE4.md) und [5](PHASE5.md).

Die eine Korrektur, die der Usability-Test der Thesis gefunden hat — die
E-Mail-Adresse in der Teilnehmerübersicht — ist umgesetzt und seit AP 8 der
Phase 5 auch bei 768 Pixeln lesbar.

### 1.2 Einundsiebzig Entscheidungen, jede an ihrem Platz

**E1–E71.** E46–E59 sind in AP 10 der Phase 4 gegen die Umsetzung geprüft
worden, E60–E71 in AP 14 der Phase 5 — zwölf von zwölf halten, zwei davon
mechanisch nachrechenbar (jede Seite des Nutzer-Clients hat eine Zeile in der
Mockup-Tabelle; kein Satz aus `docs/arc42/` steht ein zweites Mal in
`docs/rules/` oder im Referenzdokument). **F1–F245** sind vollständig vergeben,
ohne Dublette und mit genau vier dokumentierten Lücken.

### 1.3 Was am 01.10.2026 gemessen grün war

Alles mit `--skip-nx-cache`, damit kein Zwischenspeicher für ein Ergebnis
einsteht:

| Prüfung                                     | Ergebnis                                                 |
| ------------------------------------------- | -------------------------------------------------------- |
| `nx run-many -t lint test build`            | **19 Projekte** grün, 1 m 27 s                           |
| Server-Unit-Tests                           | **1461**                                                 |
| API-Vertragstests (`apps/server-e2e`)       | **44** Suiten, **730** Tests, EXIT=0                     |
| Browsersuite Veranstalter (3 Engines + 768) | **330** bestanden, 84 übersprungen, EXIT=0               |
| Browsersuite Teilnehmende (3 Engines + 390) | **267** bestanden, 65 übersprungen, EXIT=0               |
| Fünf-Container-Stack aus leerem Volume      | **13** Browsertests, 90 s, keine Container übrig, EXIT=0 |

Die übersprungenen Tests sind die beiden Gestaltungsprojekte und ihr Filter
(E68) — sie laufen bei 390 beziehungsweise 768 Pixeln und werden in den
Desktop-Projekten übersprungen, nicht ausgelassen.

### 1.4 Der ausgelieferte Stack, nicht der entwickelte

`tools/shipped-stack/verify.sh` fährt die **fünf Container aus leerem Volume**
hoch — Produktionsbuilds, echter Service Worker, echtes NGINX, echte Datenbank —
und treibt einen Browser darüber. Das ist die Lücke, die am 28.08.2026 einen
Fehler durchgelassen hat, bei dem jede Suite dieses Repositories grün war und
der Veranstalter-Client im ausgelieferten Stack unerreichbar. Seit AP 1 der
Phase 5 ist es zusätzlich ein CI-Auftrag.

Dazu `tools/spike-verification/` gegen eine laufende Instanz: Proxy, API,
Plug-in-Schalter, Admin-Zugang, Mail, Katalog, Push und Ersteinrichtung —
zehn Skripte, die eine Instanz fragen statt eine Annahme zu wiederholen.

### 1.5 Die Dokumentation

- [`INSTALL.md`](INSTALL.md) — und ihre Ausreichendheit ist belegt, indem ihr
  jemand gefolgt ist und **nichts anderes** gelesen hat (F239).
- [`arc42/`](arc42/) — zwölf Abschnitte, die nichts nacherzählen (E70), darin
  der Plug-in-SDK-Leitfaden, belegt durch ein sechstes Plug-in, das allein
  daraus gebaut und danach wieder gelöscht wurde.
- [`rules/`](rules/) — dreizehn Dateien mit dem, was beim Bauen schon einmal
  schiefgegangen ist.
- [`SECURITY-REVIEW.md`](SECURITY-REVIEW.md) — sechsundzwanzig angesehene
  Punkte, zehn Befunde, jeder mit einer Entscheidung und jeder behobene mit
  einem Test, der ihn wieder rot machen würde.
- [`../CONTRIBUTING.md`](../CONTRIBUTING.md) — wie jemand mitmacht und warum
  vor v1.0 kein Code hereinkommt.
- [`usability-test/`](usability-test/) — übergabefähig, aber **nicht
  durchgeführt** (siehe 2.1).

---

## 2. Was offen bleibt

Nichts davon ist verschwiegen oder neu: alles steht in [`todo.md`](../todo.md),
nach dem gruppiert, was es löst. Hier steht es gebündelt, damit eine
Tag-Entscheidung es nicht zusammensuchen muss.

### 2.1 Was einen Menschen oder Hardware braucht — sechs Punkte

Keines davon kann dieses Repository prüfen, und keine weitere Phase ändert das:

1. **Web Push auf echten Geräten.** Braucht einen Produktionsbuild, HTTPS und
   vier Geräte. Die Gerätematrix aus Spike 3 hängt daran, und F7 an ihr.
2. **Eine Kamera am Einlass.** Das Check-In ist gebaut und mit getippten Codes
   geprüft; eine Kamera in einer Hand ist eine Zeile der Matrix.
3. **Eine Neuinstallation nimmt ein neu hochgeladenes App-Symbol an.**
4. **Eine installierte PWA nimmt ein neues Deployment an.**
5. **Der Usability-Test mit Democracy International.** Vorbereitet, nicht
   gehalten — Vorabentscheidung 2 der Phase 5: ein Paket kann einen Test
   vorbereiten, aber nicht abhalten. Das Bündel ist übergabefähig.
6. **Der 44-Sekunden-Stillstand des Lasttests.** Alles, was sich durch Hinsehen
   ausschließen ließ, ist ausgeschlossen; was bleibt, misst man auf einem
   echten Linux-Server.

### 2.2 Was der Pilotpartner entscheidet — einundzwanzig Fragen

Bewusst später gestellt (Marius, 28.08.2026), keine davon blockiert eine Phase,
jede sagt, was heute gilt und was eine Änderung kostet. Die Spannweite: ein
mehrzeiliger Textfeldtyp im Feld-Baukasten, der Schriftart-Upload, wonach die
Teilnehmersuche sucht, was ein Raumplan verweigern soll, ob zwei parallele
Sitzungen gleichzeitig belegbar bleiben, ob die Kontrastschwelle von 3:1 auf
4,5:1 steigt, und ob die Drosselzahlen für ein Büro hinter einer Adresse
passen. **Keine davon ist eine Lücke** — jede ist eine getroffene Entscheidung,
die billig zu ändern ist.

### 2.3 Bekannte Lücken — vier

1. **Drei 401 auf der öffentlichsten Seite.** Ein anonymer Besucher der
   Event-Seite erzeugt drei abgewiesene Plug-in-Anfragen in seiner Konsole.
   Nichts ist kaputt — alle drei zeichnen danach „zum Mitmachen anmelden" —,
   aber es ist genau das Rauschen, das einen echten Fehler unsichtbar macht.
   Eine Vertragsfrage (weiß ein Einhängepunkt, ob jemand angemeldet ist?), kein
   Fehler.
2. **Die Lade des Nutzer-Clients fragt nicht nach `prefers-reduced-motion`.**
   160 ms, in einem Client, der die Medienabfragen dafür schon hat.
3. **Kein Kanal für Sicherheitsmeldungen** — siehe _Vor dem Tag_.
4. **`tools/secure-mail/verify.sh` läuft nirgends automatisch.** Das Skript
   beweist, dass diese Anwendung durch einen Mailserver kommt, der Anmeldung
   und Verschlüsselung erzwingt (E62). Es ist gelaufen und es besteht — aber
   ein Auftrag dafür fehlt, und ein Auftrag kann nicht grün heißen, bevor
   jemand einen Lauf gelesen hat.

### 2.4 Ein flackernder Test, mit Namen

`apps/admin-client-e2e/src/participants.spec.ts:224` in Firefox, einmal in drei
vollen Läufen. Die Ursache ist eingegrenzt und nicht bewiesen: eine Zahl auf
einem Filterknopf, die nach dem Stornieren vom Server nachgeladen wird und
unter drei Engines einmal nicht in zehn Sekunden ankam. Kein geteilter Zustand,
kein falscher Test — der nächste Lauf, der ihn erwischt, soll die Spur behalten.
Er war in den Läufen dieses Pakets grün.

### 2.5 Was v1.0 bewusst nicht hat — sechs Punkte

In [`todo.md`](../todo.md) unter _After v1.0_: die Sprache in einem geteilten
Link, die zwei Körpergrenzen von Proxy und Anwendung, der Katalog als langsamste
öffentliche Antwort, die Fehlerkennung ohne gemeinsames Banner, der Modulgraph
ohne Zusammenbau und der socket.io-Adapter für den zweiten Server-Container.
Jeder ist angesehen, verstanden und mit Begründung nicht gebaut worden.

---

## 3. Vor dem Tag

Drei Dinge, und zwei davon kann nur Marius tun. Die Reihenfolge ist nicht
beliebig.

1. **Den Meldekanal für Sicherheitslücken einschalten, bevor gepusht wird.**
   `CONTRIBUTING.md` sagt einem Finder, er solle GitHubs private vulnerability
   reporting benutzen. Am 01.10.2026 gegen das Repository geprüft: die
   Einstellung ist **aus**. Das Repository ist öffentlich, die Datei ist es noch
   nicht — es liest also noch niemand eine Zusage, die nicht gilt, und genau
   das ändert sich mit dem Push. Ein Aufruf schaltet es ein
   (`gh api --method PUT` auf den Pfad `private-vulnerability-reporting` des
   Repositories). Danach ist eine zwanzigzeilige `SECURITY.md` fällig — aber
   **danach**, nicht davor: eine Datei, die einen Kanal nennt, ist so viel wert
   wie der Kanal.
2. **Pushen und den Lauf lesen.** Siebzehn Commits der Phase 5 liegen lokal;
   `origin/main` steht auf `c6512b9`, dem Abschluss der Phase 4. Die ganze
   Phase 5 ist unveröffentlicht — Härtung, Gestaltung, arc42, der
   Security-Review, `CONTRIBUTING.md`, das Testbündel. Der erste Push ist
   zugleich der erste CI-Lauf über all das, und **wer „grün" über die CI sagt,
   hat den Abschluss des Laufs gelesen**. Bei der Gelegenheit gehört der
   fehlende Auftrag für `tools/secure-mail/verify.sh` dazu (2.3).
3. **Dann erst taggen.** E71: v1.0 wird von einem Menschen getaggt. Dieses
   Paket hat keinen gesetzt — `git tag` ist leer.

---

## 4. Was ein Tag nicht behaupten würde

Damit es niemand hineinliest:

- **Nicht**, dass Push-Benachrichtigungen auf echten Geräten funktionieren. Sie
  sind gebaut und nie auf einem Telefon gesehen worden.
- **Nicht**, dass eine Mail im Posteingang landet. Zustellbarkeit hängt an SPF,
  DKIM und DMARC der Organisation; `INSTALL.md` hat die Prüfliste, und E63 sagt
  ausdrücklich, dass die zweite Hälfte dem Betreiber gehört.
- **Nicht**, dass Menschen außerhalb dieses Projekts die Anwendung bedienen
  können. Der Usability-Test ist vorbereitet und nicht gehalten; die
  Anwendungsfälle, die seit 2024 dazugekommen sind, sind von niemandem geprüft
  worden, der sie nicht gebaut hat.
- **Nicht**, dass die Anwendung fehlerfrei ist. Sie ist geprüft, und das ist
  etwas anderes.

Was ein Tag behaupten würde, ist schmaler und trotzdem genug: **die Anwendung
tut, was die Thesis beschrieben hat, sie lässt sich aus leerem Volume
installieren, und wo sie etwas anderes tut, steht warum.**

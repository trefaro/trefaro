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

### 2.3 Bekannte Lücken — drei

1. **Drei 401 auf der öffentlichsten Seite.** Ein anonymer Besucher der
   Event-Seite erzeugt drei abgewiesene Plug-in-Anfragen in seiner Konsole.
   Nichts ist kaputt — alle drei zeichnen danach „zum Mitmachen anmelden" —,
   aber es ist genau das Rauschen, das einen echten Fehler unsichtbar macht.
   Eine Vertragsfrage (weiß ein Einhängepunkt, ob jemand angemeldet ist?), kein
   Fehler.
2. **Die Lade des Nutzer-Clients fragt nicht nach `prefers-reduced-motion`.**
   160 ms, in einem Client, der die Medienabfragen dafür schon hat.
3. **Es fehlt eine `SECURITY.md`.** Der Kanal ist seit dem 01.10.2026 offen
   (siehe _Vor dem Tag_), und `CONTRIBUTING.md` nennt ihn — aber die Datei, die
   GitHub auf der Sicherheitsseite eines Repositories anzeigt, gibt es nicht.
   Zwanzig Zeilen, deren Inhalt entschieden ist: eine unterstützte Version (das
   aktuelle `main`, bis v1.0 getaggt ist), was hier als Lücke zählt, und dass
   der Betreiber einer selbst gehosteten Instanz ebenfalls erfahren muss.

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

Drei Dinge standen hier. **Zwei sind am 01.10.2026 erledigt**, und sie stehen
weiter da, weil die Reihenfolge der Punkt war und eine erledigte Reihenfolge
belegt werden muss.

1. **✅ Der Meldekanal für Sicherheitslücken ist eingeschaltet — vor dem Push.**
   `CONTRIBUTING.md` sagt einem Finder, er solle GitHubs private vulnerability
   reporting benutzen; am Morgen des 01.10.2026 war die Einstellung **aus**.
   Eingeschaltet und nachgefragt (`{"enabled": true}`), danach erst gepusht.
   Damit war die Zusage in keiner Sekunde öffentlich und unerfüllt. **Offen
   bleibt die zwanzigzeilige `SECURITY.md`** — sie ist das, was GitHub auf der
   Sicherheitsseite anzeigt, und sie folgt dem Kanal, nie umgekehrt.
2. **✅ Gepusht und der Lauf gelesen.** `c6512b9..dcf2284`, **achtzehn
   Commits** — die ganze Phase 5 auf einmal: Härtung, Gestaltung, arc42, der
   Security-Review, `CONTRIBUTING.md`, das Testbündel und der neue
   CI-Auftrag. Lauf **36868215383**, sieben Aufträge, **alle sieben success**,
   rund sechzehn Minuten. Gelesen wurden die Abschlüsse der Aufträge, nicht der
   Rückgabewert des Wartens — und bei den beiden, die zum **ersten Mal** auf
   einem Runner liefen, zusätzlich ihre Ausgabe:
   - `stack`: fünf Container aus leerem Volume, Ersteinrichtung,
     Proxy- und Socket-Prüfungen, **13 Browsertests** bestanden, 269 s.
   - `secure-mail`: beide Ablehnungen beobachtet (`530 Must issue a STARTTLS
command first`, `530 Authentication required`), die Mail durch die dritte
     Verbindung zugestellt, und **keine `Smtp`-Warnung** beim Start — die
     Stille ist das Ergebnis (E62).
3. **Dann erst taggen.** E71: v1.0 wird von einem Menschen getaggt. Dieses
   Paket hat keinen gesetzt — `git tag` ist leer. **Das ist der einzige Schritt,
   der noch aussteht.**

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

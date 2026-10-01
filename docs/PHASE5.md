# Phase 5 — Härtung, Gestaltung und Release v1.0

**Status: abgeschlossen am 01.10.2026 — Meilenstein M16 erreicht** (Plan
14.09.2026; AP 1 bis AP 4 am 14.09.2026 — **M13** nach AP 3 —, AP 5 am
15.09.2026, AP 6 am 18.09.2026 — **M14** —, AP 7 bis AP 9 am 21.09.2026 —
**M15** nach AP 8 —, AP 10 bis AP 12 am 24.09.2026, AP 13 am 30.09.2026 mit
einem Nachtrag am 01.10.2026, AP 14 am 01.10.2026). Vierzehn
Pakete, **E60–E71** gegen die Umsetzung geprüft, und die Release-Feststellung
steht in [`RELEASE-v1.0.md`](RELEASE-v1.0.md). **Der Tag selbst ist Marius'
Schritt** (E71). Alles über dem Abschnitt _Fortschritt_ ist der **Plan** und
wird nicht rückwirkend korrigiert; was tatsächlich passierte — samt
Abweichungen — steht unten, wie in [`PHASE1.md`](PHASE1.md),
[`PHASE2.md`](PHASE2.md), [`PHASE3.md`](PHASE3.md) und
[`PHASE4.md`](PHASE4.md).

Grundlage: Kapitel 6, Phase 5 in
[`Anforderungsanalyse_und_Umsetzungsplan.md`](Anforderungsanalyse_und_Umsetzungsplan.md)
(Usability-Test, Lasttests NFR 12, Security-Review, DSGVO-Funktionen,
Fehlerprotokollierung und Monitoring NFR 10/11, vollständige Doku, Release
v1.0). Was die vier Phasen davor offen gelassen haben, steht in
[`todo.md`](../todo.md) unter _Checkable after phase 5_ — **zweiunddreißig
Einträge, jeder ist unten einem Arbeitspaket zugeordnet.** Dazu kommen die
beiden Abschnitte, die keiner Phase gehören: _On a device — waiting for Marius_
und _Questions for the pilot partner_.

Die Entscheidungen zählen bei **E60** weiter (Phase 1: E1–E16, Phase 2: E17–E30,
Phase 3: E31–E45, Phase 4: E46–E59); Ergänzungen am Referenzdokument bekommen
**F203** und folgende (F1–F202 sind vergeben, F62 und F129–F131 nie).

## Fünf Entscheidungen vorab (Marius, 14.09.2026)

Sie sind der Rahmen dieses Plans, nicht Vorschläge:

1. **Die Gestaltungsprüfung prüft und behebt im selben Paket** — kein
   Befundpapier, das auf ein zweites Paket wartet —, und sie gilt **beiden**
   Clients: der Nutzer-Client mobile-first gegen die Mockups der Thesis, der
   Veranstalter-Client desktop-first bis hinunter zur Tablet-Breite. Weil das
   für ein Paket zu viel ist, sind es **zwei** Pakete derselben Machart (AP 7
   und AP 8).
2. **Der Usability-Test wird vorbereitet, nicht abgewartet.** Die Phase schreibt
   das Skript und stellt die Instanz; wann Democracy International es fährt,
   entscheidet der Pilotpartner. Dieselbe Regel wie bei der Kamera und der
   Gerätematrix: was einen Menschen außerhalb dieses Repositories braucht,
   bekommt eine Zeile in `todo.md` und keinen blockierten Meilenstein.
3. **v1.0 taggt Marius, nicht ein Arbeitspaket.** Die Phase stellt die
   Release-Fähigkeit her und sagt, worauf sie sich stützt.
4. **Die SMTP-Arbeit wartet nicht auf den Server des Pilotpartners** (nach
   Rückfrage am 14.09.2026). Sie wird gegen einen Testserver gebaut, der
   Anmeldung und Verschlüsselung wirklich verlangt — siehe E62. Was ein
   Testserver grundsätzlich nicht zeigen kann, wird nicht vertagt, sondern
   **umgewidmet**: es ist eine Betreiberaufgabe und gehört in die
   Installationsdokumentation.
5. **arc42 bekommt ein eigenes Paket** (AP 12) — die Architekturdokumentation,
   die das Referenzdokument unter „vollständige Doku" nur nennt.

## Ziel

Am Ende der Phase ist Trefaro nicht mehr „fertig gebaut", sondern **abgebbar**:
eine Organisation kann eine Instanz betreiben, ohne dass jemand aus diesem
Projekt danebensteht.

- **Was von außen erreichbar ist, ist gehärtet**: die Drosselung ist
  konfigurierbar statt einkompiliert, sie zählt auch pro Empfängeradresse, und
  der WebSocket-Handshake wird endlich mitgezählt.
- **Mail funktioniert gegen einen echten Mailserver** — mit Anmeldung,
  mit Verschlüsselung, mit einer Pause zwischen zweihundert Einladungen und
  einem zweiten Versuch für die, die vorübergehend abgelehnt wurde.
- **Niemand läuft mehr in eine Sackgasse**: ein Teilnehmender, der sein Passwort
  vergisst, kommt zurück; ein Mensch, der gehen will, wird gelöscht; und der
  Server begründet seine Ablehnung in der Sprache, in der die Seite steht.
- **Beide Clients halten ihre Gestalt** vom Telefon bis zum Schreibtisch, und
  der Nutzer-Client hält sie **gegen die Mockups der Thesis** — die er bisher
  nie gesehen hat, weil nie jemand hingeschaut hat (siehe _Ist-Zustand_).
- **Der Stack wird so getestet, wie er ausgeliefert wird** — in einem
  CI-Auftrag, der die fünf Container aus leerem Volume hochfährt und einen
  Browser darauf loslässt.
- **Die Architektur ist beschrieben**, nach arc42, für jemanden, der dieses
  Repository zum ersten Mal öffnet.
- Und der **Usability-Test ist vorbereitet**, mit den sieben Aufgaben der Thesis
  und den Anwendungsfällen, die sie nie getestet hat.

**Nicht** Teil von Phase 5: Gamification (FR 4.9, bewusst nie); ein
Newsletter-Versandmodul (F8); ein socket.io-Adapter für mehrere
Server-Container (nur nötig, wenn je mehr als einer läuft — eine Instanz je
Organisation ist die Architekturentscheidung); die Übersetzbarkeit der
Formularbeschriftungen und Medien-Titel (erst eine Frage an den Pilotpartner,
dann vielleicht Arbeit); und die Vorstellung in Open-Source-Netzwerken, die im
Referenzdokument neben v1.0 steht — das ist Marius' Sache und kein Paket.

## Der Ist-Zustand, auf dem diese Phase aufbaut

Vier Dinge sind beim Schreiben dieses Plans gemessen worden und stehen hier,
weil sie die Reihenfolge der Pakete bestimmen.

**Der mobile-first-Client ist noch nie an einem Telefon gerendert worden — von
nichts.** Beide `playwright.config.mts` fahren ausschließlich
Desktop-Projekte (`Desktop Chrome`, `Desktop Firefox`, `Desktop Safari`); die
Einträge `Mobile Chrome` und `Mobile Safari` stehen auskommentiert darin, genau
so, wie Nx sie hingeschrieben hat. Das ist die Erklärung für den Befund
darunter: **es hat nie etwas hingesehen.**

**Die Gestaltung ist dünn, und zwar messbar.** Drei `@media`-Abfragen im ganzen
Nutzer-Client (`app.scss`, `my-registration-page.ts`,
`event-landing-page.ts`), eine im Veranstalter-Client, **null** in allen
geteilten Bibliotheken. Die Absicht ist da, wo sie steht — `min-width: 48rem` in
`rem`, `repeat(auto-fit, minmax(11rem, 1fr))`, ein Kommentar, der NFR 6 nennt —,
aber sie steht an drei Stellen von sechzehn Seiten.

**Die Mockups und der Bau sind nicht nur kosmetisch auseinander.** Die
Event-Detailansicht der Thesis zeigt **gestapelte Zeilen über die volle Breite**
mit Icon links und Chevron rechts; `event-detail-tiles.ts` zeichnet ein
Kachelraster (`auto-fit, minmax(11rem, 1fr)`). Die Navigationsleiste der Thesis
ist eine **eingeschobene Lade** mit Bild, Name und Adresse des Menschen oben und
„Einstellungen" unten angeheftet; im Bau gibt es eine Leiste und eine Regel, die
sie ab 48rem statisch stellt. Das ist Struktur, nicht Abstand — und genau
deshalb ist AP 7 ein Paket und keine Nacharbeit.

**Drei SMTP-Schlüssel sind Konfiguration, die nie ausgeführt wurde.**
`SMTP_USER`, `SMTP_PASSWORD` und `SMTP_SECURE` stehen in
`apps/server/src/app/core/config/env.ts` und in `.env.example`. Das Mailpit aus
`infra/docker-compose.dev.yml` läuft ohne Anmeldung und ohne Verschlüsselung auf
Port 1025 — also hat **keine Zeile dieses Repositories je bewiesen, dass die
drei Schlüssel etwas bewirken.** Dieselbe Klasse wie die
Bootstrap-Zugangsdaten, die AP 13 der Phase 1 gefunden hat: ein Schlüssel in
`env.ts` ist noch keine Konfiguration.

## Entscheidungen, die diese Phase festlegt

| Nr.     | Entscheidung                                                                                                                                                                                                                                                                                                                            |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **E60** | **Die Drosselung wird konfigurierbar, und die Vorgaben sind die heutigen Zahlen.** Eine Lockerung steht in einer `.env` und wird beim Start laut protokolliert. Nie wird ein Grenzwert für Tests gelockert — ein gelockerter Grenzwert wird nicht mehr getestet (E4).                                                                   |
| **E61** | **Ein Testprofil darf nie das sein, was eine Instanz ausliefert.** Wenn die E2E-Läufe eigene Grenzwerte bekommen, kommen sie aus einer Datei, die der Produktions-Stack nicht kennt, und der Server sagt beim Start, dass er sie benutzt.                                                                                               |
| **E62** | **Der Mailserver der Tests verlangt Anmeldung und Verschlüsselung.** Mailpit bekommt `--smtp-auth` und ein STARTTLS-Zertifikat in einem eigenen Compose-Profil. Das Zertifikat wird dem Absender über `NODE_EXTRA_CA_CERTS` bekannt gemacht — **nie** über eine Zeile Code, die die Prüfung abschaltet.                                 |
| **E63** | **Zustellbarkeit ist eine Betreiberaufgabe, keine Testaufgabe.** SPF, DKIM, DMARC und die Frage, ob eine Mail im Posteingang landet, hängen an den DNS-Einträgen der Organisation. Sie bekommen eine Prüfliste in `INSTALL.md` und verlassen `todo.md` als offene Arbeit.                                                               |
| **E64** | **Eine Ablehnung reist als Code mit Werten, nicht als Satz.** Der Grund wird im Katalog übersetzt, die Vertragssuite behauptet den Code. Der Satz des Servers verschwindet aus der Oberfläche, die Zusammensetzung aus F77 bleibt.                                                                                                      |
| **E65** | **Löschen heißt anonymisieren, wo jemand anderes die Zeile geschrieben hat, und wirklich löschen, wo nur der Mensch selbst sie geschrieben hat.** Ein Forum-Thread überlebt seinen Eröffner (`SET NULL`), ein Gespräch behält die Nachrichten der Gegenseite, ein Profil verschwindet. Was bleibt, trägt keinen Namen mehr.             |
| **E66** | **Die Mockups der Thesis sind die Referenz des Nutzer-Clients.** Wo der Bau abweicht, wird die Abweichung **entschieden** — entweder zurückgebaut oder mit Begründung als bewusst protokolliert. Eine dritte Möglichkeit („ist halt so geworden") gibt es nicht.                                                                        |
| **E67** | **Drei Breiten, und die schmalste ist die, für die entworfen wird**: 390, 768 und 1280 CSS-Pixel. Der Nutzer-Client wird bei 390 entworfen und muss bei 1280 benutzbar bleiben (NFR 6); der Veranstalter-Client wird bei 1280 entworfen und muss bei 768 benutzbar bleiben. 768 ist beim Veranstalter ein **Boden**, kein Entwurfsziel. |
| **E68** | **Ein Gestaltungstest ist ein eigenes Playwright-Projekt mit einer eigenen kleinen Auswahl.** Er fährt eine markierte Teilmenge bei Telefonbreite und **verdoppelt niemals das Anmeldebudget** (E4). Die volle Suite bleibt bei den drei Desktop-Projekten.                                                                             |
| **E69** | **Der letzte Schritt des Plug-in-Vertrags ist 1.3.0**, und er trägt die Zeitzone des Events **am Port**, nicht am Slot — so, wie `todo.md` es nach AP 10 der Phase 4 bereits entschieden hat. Danach ist der Vertrag für v1.0 geschlossen.                                                                                              |
| **E70** | **arc42 erzählt nichts nach.** Jeder Abschnitt sagt entweder etwas Neues oder **verweist**: Entscheidungen auf E1–E59, Qualitätsanforderungen auf die NFR-Tabelle, Querschnittskonzepte auf `docs/rules/`, Risiken auf `todo.md`. Eine zweite Kopie einer Regel ist eine Regel, die auseinanderläuft.                                   |
| **E71** | **v1.0 wird von einem Menschen getaggt.** Das Abschlusspaket stellt die Release-Fähigkeit fest und listet, worauf sie sich stützt und was offen bleibt; es setzt keinen Tag und baut nichts nach, was ein Pilotpartner erst noch sagen muss.                                                                                            |

## Arbeitspakete

Die Reihenfolge ist Abhängigkeits- **und** Risikoreihenfolge. AP 1 steht vorn,
weil `todo.md` es ausdrücklich verlangt („it is the first item there, not the
last") und weil jedes spätere Paket davon profitiert, dass der Stack als
Container geprüft wird. AP 7 und AP 8 sind die einzigen Pakete **ohne
Server-Abhängigkeit** — sie lassen sich jederzeit vorziehen, wenn der
Usability-Test früher stattfinden soll.

Jedes Paket endet mit lauffähiger, prüfbarer Software, eigenen Unit-Tests,
mindestens einem E2E- oder API-Vertragstest und einem Conventional Commit.

### AP 1 — Der Stack wird geprüft, wie er ausgeliefert wird

Ein CI-Auftrag fährt `infra/docker-compose.yml` **aus leerem Volume** hoch,
lässt `tools/spike-verification/verify-proxy.mjs` laufen und danach eine
Handvoll Playwright-Tests gegen Port 8080 — Produktionsbuilds, echter Service
Worker, echtes NGINX. Das ist die Lücke in der Testpyramide, die genau die Form
des Fehlers vom 28.08.2026 hat: alle Suiten grün, der Veranstalter-Client im
Produktions-Stack unerreichbar. Dazu die Ersteinrichtung aus leerem Volume, die
AP 13 der Phase 3 von Hand gefahren hat.

**Fertig, wenn** ein absichtlich kaputt konfigurierter Service Worker diesen
Auftrag rot macht und sonst nichts im Repository; der Auftrag aus leerem Volume
startet, sich einen Administrator bootstrappt und wieder abräumt; und seine
Laufzeit im Protokoll steht.

### AP 2 — Die Drosselung wird konfigurierbar, und sie zählt vollständig (E4, E60, E61)

`LOGIN_ATTEMPTS_PER_WINDOW`, `REGISTRATIONS_PER_WINDOW`,
`NEWSLETTER_SIGNUPS_PER_WINDOW` und `CONFIRMATIONS_PER_WINDOW` kommen aus der
Umgebung, Vorgaben exakt die heutigen Zahlen, und der Server protokolliert beim
Start laut, wenn ein Wert über seiner Vorgabe steht. Dazu **der zweite Zähler
pro Empfängeradresse** (heute zählt nur die Clientadresse, die Mail geht aber an
eine Adresse, die der Aufrufer wählt) und **der WebSocket-Handshake**, den
`@nestjs/throttler` nie gesehen hat, weil engine.io vor Nests Router antwortet.
Und damit die Antwort auf das Budgetproblem der drei E2E-Projekte, die sich seit
AP 8 der Phase 4 einen Server teilen: ein Testprofil, das der Produktions-Stack
nicht kennt (E61). `infra/docker-compose.yml` reicht jeden neuen Wert durch —
sonst ist er keine Konfiguration (die Lehre aus AP 13).

**Fertig, wenn** ein gesetzter Wert wirkt, ein gelockerter beim Start eine
Warnung erzeugt, eine zweite Anmeldung an dieselbe Adresse von einer anderen
Clientadresse aus gedrosselt wird, ein Handshake-Sturm gezählt wird — und
`nx run-many -t e2e --parallel=1` **lesbar** durchläuft, also ohne 429 in der
Vertragssuite.

### AP 3 — Mail: angemeldet, verschlüsselt und höflich (E62, E63)

Mailpit bekommt in einem eigenen Compose-Profil `--smtp-auth` und ein
STARTTLS-Zertifikat; der Server spricht `SMTP_SECURE=true` mit
`SMTP_USER`/`SMTP_PASSWORD` dagegen, und das Zertifikat kommt über
`NODE_EXTRA_CA_CERTS` — **keine Zeile, die die Zertifikatsprüfung abschaltet.**
Dazu die zwei Dinge, die der Einladungsversand aus AP 12 der Phase 3 schuldig
ist: eine **konfigurierbare Pause** zwischen zwei Mails und ein **zweiter
Versuch** bei einer vorübergehenden Ablehnung (4xx) — die Zeilen tragen mit
`status` und `failure` schon alles, was ein erneuter Versuch braucht, also ist
das die Schleife des Absenders und keine Schemaänderung. Und
`List-Unsubscribe` samt `List-Unsubscribe-Post: List-Unsubscribe=One-Click`,
mit einem Endpunkt, der einen nackten POST annimmt — der bekommt **eigene**
Begründung gegen E5b und keine Kopie der Abmeldeseite. Was ein Testserver nicht
zeigen kann — SPF, DKIM, DMARC, Posteingang statt Spam —, wird zur Prüfliste in
`INSTALL.md` (E63).

**Fertig, wenn** eine Bestätigungsmail über einen Mailserver geht, der ohne
Anmeldung und ohne TLS **ablehnt**; ein Server, der 451 antwortet, einen zweiten
Versuch bekommt und die Zeile nicht auf „failed" stehen bleibt; zweihundert
Einladungen mit messbarer Pause rausgehen; der Kopfzeilen-Abmeldelink einmal
funktioniert und beim zweiten Mal nichts kaputt macht; und `INSTALL.md` sagt,
welche DNS-Einträge eine Organisation braucht.

### AP 4 — Die eine Sackgasse: vergessenes Passwort

FR 4.3 hat den Wechsel _im_ Profil gebaut, der das alte Passwort braucht. Das
Zurücksetzen ist eine eigene Route: ein signiertes Token mit **eigenem Zweck**
und eigener Lebensdauer (der vierte, neben den drei aus F23), eine eigene
Drosselung, und eine Antwort, die **nicht verrät**, ob es zu der Adresse ein
Konto gibt (E10, E32). Die Mail bei wiederholter Registrierung darf danach
endlich auf die Wiederherstellung zeigen, weil es eine gibt.

**Fertig, wenn** ein Teilnehmender ohne Hilfe zurückkommt; eine unbekannte
Adresse dieselbe Antwort und dieselbe Laufzeit bekommt wie eine bekannte; ein
Token einmal wirkt; und ein Zurücksetzen die anderen Sitzungen beendet (F139).

### AP 5 — Der Server begründet in der Sprache des Lesers (E64)

Das letzte Stück von Kapitel 4, das Phase 2 nicht geliefert hat, und
ausdrücklich **keine** Textextraktion: jede `BadRequestException` der
Geschäftsschicht trägt einen **Code** und seine Platzhalterwerte statt eines
Satzes, der Katalog hält die Sätze, jeder Client löst sie auf. Die
Zusammensetzung aus F77 — eigener Satz plus Grund des Servers — bleibt, nur ist
der Grund jetzt die Hälfte, die ein Mensch auch lesen kann. Die Vertragssuite
behauptet ab hier den Code und nicht den Satz, was das zweite Argument für
Codes ist. Dazu die vier verbliebenen `load(…, i18n.locale())`-Stellen ohne
Wächter, die AP 5 der Phase 4 benannt hat — sie sind dieselbe Familie von
Fehlern und sie stehen in Seiten, die dieses Paket ohnehin anfasst.

**Fertig, wenn** ein deutscher Browser einen deutschen Grund für eine abgelehnte
Anmeldung bekommt; die API-Vertragssuite einen stabilen Code prüft; kein
englischer Satz mehr aus der Geschäftsschicht in eine Oberfläche gelangt; und
ein Sprachwechsel während eines laufenden Ladevorgangs die späte Antwort
verwirft (je eine Unit-Prüfung).

### AP 6 — Löschen: was geht, was bleibt, und was keinen Namen mehr trägt (E65) → **M14**

Die DSGVO-Funktionen, und sie sind **ein** Thema statt fünf: Datenexport
(eine Anfrage, ein Archiv, alles, was zu einem Menschen gehört) und Löschung —
mit den drei Fällen, die vier `todo.md`-Einträge über drei Phasen gesammelt
haben. Ein **Profil** verschwindet; seine **Gespräche** bleiben stehen, weil die
Gegenseite ihre Nachrichten geschrieben hat (`conversation_member.member_id`
trägt bewusst keinen Fremdschlüssel, E39); ein **Forum-Thread** überlebt seinen
Eröffner, weil er der Behälter für die Beiträge anderer ist — `created_by` wird
nullbar mit `SET NULL`, der Autor ist in der Nutzlast längst nullbar (F195);
ein **Beitrag** dagegen hängt an seinem Menschen (E58). Migration: eine.

**Fertig, wenn** ein Mensch seinen Export bekommt und darin nichts fehlt, was
über ihn gespeichert ist; sein Konto löschbar ist; ein Gespräch nach dem
Löschen der Gegenseite noch lesbar ist und niemanden mehr benennt; ein Thread
mit gelöschtem Eröffner samt fremder Antworten stehen bleibt; und nichts davon
eine Kerntabelle eines Plug-ins anfasst.

### AP 7 — Die Mockups gegen den Bau: der Nutzer-Client wird mobile-first (E66, E67, E68)

Das Paket, das Marius angefordert hat, und es prüft **und** behebt.

**Erst die Bestandsaufnahme:** sechzehn Seiten unter
`apps/user-client/src/app/pages/` gegen die vier Mockup-Bögen in
[`docs/thesis/mockups/`](thesis/mockups/) — Startseite, Event-Landingpage,
Event-Detailansicht, Navigationsleiste, Veranstalter kontaktieren,
Programmplan, Teilnehmersuche — bei **390, 768 und 1280** CSS-Pixeln. Das
Ergebnis ist eine Tabelle mit drei Spalten: _bewusst anders_ (mit dem Grund und
der Entscheidung, die es festgelegt hat), _abgedriftet_ (wird behoben), _im
Mockup nicht vorgesehen_ (die elf Seiten, die es 2024 noch nicht gab —
Nachrichten, Anmeldeverwaltung, Newsletter, die vier Bestätigungs- und
Anmeldeseiten des Kontos; sie bekommen die Regeln der Bögen, nicht deren
Bilder).

**Dann die Behebung.** Was heute schon absehbar dazugehört: die
Event-Detailkacheln werden gestapelte Zeilen mit Icon und Chevron statt eines
`auto-fit`-Rasters; die Navigationsleiste wird die eingeschobene Lade mit Bild,
Name und Adresse oben und „Einstellungen" unten; die Programm-Zeitleiste bekommt
ihre Zeitmarken so, wie beide Bögen sie zeigen. Was die Bestandsaufnahme sonst
findet, kommt dazu — **die Größe dieses Pakets ist beim Start nicht bekannt, und
das ist der Preis dafür, dass es prüft und behebt** (siehe _Risiken_).

**Und dann der Wächter**, damit es nicht wieder driftet: ein eigenes
Playwright-Projekt bei Telefonbreite, das eine **markierte kleine Auswahl**
fährt — kein horizontales Scrollen, keine überlappenden Bedienelemente, jede
Schaltfläche mindestens 44 Pixel hoch, die Lade öffnet und schließt. Es
verdoppelt das Anmeldebudget nicht (E68): die Auswahl registriert niemanden,
sondern liest.

**Fertig, wenn** die Tabelle für jede der sechzehn Seiten eine Zeile hat und
keine davon „ist halt so geworden" sagt; die drei benannten Struktur-Abweichungen
behoben sind; das Gestaltungsprojekt bei 390 Pixeln grün ist und bei absichtlich
zurückgedrehtem CSS rot; und `nx run-many -t e2e --parallel=1` weiterhin lesbar
durchläuft.

### AP 8 — Der Veranstalter-Client bis zur Tablet-Breite (E67)

Achtzehn Seiten, zehn davon mit einer Tabelle, und eine `@media`-Abfrage im
ganzen Client. Desktop-first bleibt richtig (NFR 6), aber 768 ist ein Boden:
die Seitenleiste wird einklappbar statt weggeschoben, die Tabellen bekommen
einen eigenen horizontalen Scrollbereich statt die Seite zu schieben, und die
Formularraster brechen um. **Keine Mockups** — die Thesis hat für den
Veranstalter-Client keine gezeichnet, also ist der Maßstab hier die
Benutzbarkeit und nicht ein Bild. Dazu der Satz, den `todo.md` der
Design-Seite schuldet: seit F106 kann der Server die Maße eines Bildes lesen,
also kann die Seite endlich sagen, dass ein 500×120-Logo als App-Icon **nicht**
verwendet wird, statt es still zu ignorieren.

**Fertig, wenn** jede Seite bei 768 Pixeln ohne horizontales Scrollen der Seite
bedienbar ist; die Teilnehmerübersicht dort ihre E-Mail-Spalte behält (sie ist
die einzige Korrektur aus dem Usability-Test der Thesis); und ein hochgeladenes
breites Logo eine Begründung bekommt.

### AP 9 — Security-Review und der Blick ins Volume

Auth, Upload-Validierung, Plug-in-Isolation, und die Frage, ob die
OpenAPI-Beschreibung weiter öffentlich ausgeliefert werden soll (heute ja, mit
dem Argument, dass die Quelle ohnehin AGPL ist — das ist ein Argument und keine
Entscheidung). Dazu der Kehrbesen über das Upload-Volume: `AttachmentsService`
gleicht aus, wo Datenbank und Volume auseinanderlaufen können, und er gleicht in
Richtung **Bytes behalten** aus — also kann ein Absturz zwischen zwei Schritten
eine Datei hinterlassen, auf die keine Zeile zeigt. Der Lauf listet das Volume,
verbindet es mit `attachment.file_path` und **meldet**; er löscht nichts.

**Fertig, wenn** der Review ein Protokoll mit Befund und Entscheidung je Punkt
hat; jeder Befund entweder behoben ist oder mit Begründung in `todo.md` steht;
und der Kehrbesen auf einer Instanz mit einer künstlich verwaisten Datei genau
diese eine nennt.

### AP 10 — Fehlerprotokollierung, Monitoring und Lasttests (NFR 10, 11, 12)

Die drei gehören zusammen, weil ein Lasttest ohne Instrumentierung eine Zahl
ohne Erklärung ist. Erst die Fehlerprotokollierung und die Betriebsmetriken, die
das Referenzdokument unter NFR 10/11 verlangt — was ein Betreiber sehen muss,
wenn eine Instanz sich seltsam verhält, ohne dass personenbezogene Daten im
Protokoll landen. Dann die Lasttests (NFR 12). Und dabei die Neumessung, die
`todo.md` seit AP 5 der Phase 1 aufgehoben hat: die Teilnehmerübersicht ist bei
2 000 Anmeldungen je Event gemessen (13 ms im schlechtesten Fall); eine
Organisation eine Größenordnung darüber ist nie gemessen worden, und die Antwort
wäre `pg_trgm` — eine Entscheidung, die vor einer echten Datenbank getroffen
wird und nicht in einem Plan (F32).

**Fertig, wenn** ein Betreiber aus den Protokollen erkennen kann, was schiefging,
ohne eine Adresse darin zu finden; die Lastzahlen mit Aufbau und Datum im
Protokoll stehen; und für `pg_trgm` eine Entscheidung mit Messung dahinter steht
— auch wenn sie „nicht nötig" lautet.

### AP 11 — Der Plug-in-Vertrag schließt (E69)

Ein letzter Schritt, **1.3.0**, und dann ist der Vertrag für v1.0 zu. Er trägt
die Zeitzone des Events **am Port** — ein Feld an `PluginProgramItem` oder ein
kleiner Lesevorgang je Event —, weil eine Eigenschaft, die nur eine Seite
liefern kann, eine ist, die ein Einhängepunkt vergisst, und ein vergessener
Wert hier die Zone des Browsers wäre, also genau der Fehler. Heute zeichnen
Raumplan und individueller Programmplan ihre Zeiten in der Uhr des Lesers,
während das Programm **darüber auf derselben Seite** in der Zone des Events
steht (E8). Jede Erweiterung bekommt ihren Fall im Kompatibilitätstest, und je
eine Zeile in den zwei Bündeln, die eine Uhrzeit zeichnen. Dazu die
Entscheidung, die `todo.md` für diese Phase aufgehoben hat: ob die zweite Hälfte
von E55 („der Plan zeigt an, wo ich einen Platz habe") zwei weitere
Port-Fähigkeiten wert ist — oder ob die Zeitleiste des Programms, wo der Platz
gebucht wird, der richtige und einzige Ort dafür ist.

**Fertig, wenn** ein aus Kanada gelesener Raumplan dieselbe Uhrzeit zeigt wie
das Programm darüber; ein Plug-in, das 1.2.0 deklariert, weiter montiert wird;
und die E55-Entscheidung mit Begründung protokolliert ist, gebaut oder nicht.

### AP 12 — arc42: die Architektur wird beschreibbar (E70)

`docs/arc42/` nach dem Muster, das sich bei `docs/rules/` bewährt hat: zwölf
Dateien und ein Index in `README.md`, auf Deutsch wie die übrige Dokumentation
dieses Repositories. Die Quellen liegen alle schon hier — das Paket ordnet sie,
statt sie neu zu erfinden (E70):

| arc42 | Abschnitt                       | Woher                                                                            |
| ----- | ------------------------------- | -------------------------------------------------------------------------------- |
| 1     | Einführung und Ziele            | Kapitel 1–3 des Referenzdokuments, der Prioritäten-Kompass der Umfrage           |
| 2     | Randbedingungen                 | Tech-Stack, AGPL, eine Instanz je Organisation, NFR 9 (kein fremdes CDN)         |
| 3     | Kontextabgrenzung               | `docs/thesis/diagramme`, die SMTP-/Push-/OSM-Außenschnittstellen                 |
| 4     | Lösungsstrategie                | Schichtung, Plug-in-Muster, Whitelabel über CSS Custom Properties                |
| 5     | Bausteinsicht                   | Nx-Projekte, Kernmodule, die sieben geteilten Bibliotheken                       |
| 6     | Laufzeitsicht                   | Client-Start-Sequenz, Double-Opt-In, Chat-Handshake, Plug-in-Montage             |
| 7     | Verteilungssicht                | die fünf Container, NGINX, `INSTALL.md`                                          |
| 8     | Querschnittliche Konzepte       | **verweist** auf `docs/rules/` — und beherbergt den Plug-in-SDK-Leitfaden        |
| 9     | Architekturentscheidungen       | **verweist** auf E1–E59 (und E60 ff.), F1–F202                                   |
| 10    | Qualitätsanforderungen          | die NFR-Tabelle als Qualitätsbaum mit Szenarien                                  |
| 11    | Risiken und technische Schulden | **verweist** auf `todo.md`, _Known gaps_ zuerst                                  |
| 12    | Glossar                         | Reihe, Event, Programmpunkt, Plug-in, Slot, Einhängepunkt, Bündel — zweisprachig |

Der **Plug-in-SDK-Leitfaden** ist eigener Text und kein Verweis, weil es ihn
noch nicht gibt: drei Dinge muss ein fremder Autor wissen, und alle drei hat
Phase 0 gelernt — Bündel werden same-origin geladen und laufen mit vollem
Seitenzugriff (die Prüfung bleibt deshalb ein menschlicher Schritt), Eingaben
kommen als **Eigenschaften** und nicht als Attribute, und eine
Plug-in-Migration muss nach jeder Kernmigration gestempelt sein, auf die sie
zeigt.

**Fertig, wenn** jemand, der dieses Repository zum ersten Mal öffnet, aus
`docs/arc42/` heraus arbeiten kann; kein Abschnitt eine Regel wiederholt, die in
`docs/rules/` steht (er verweist); und ein Plug-in nach dem Leitfaden gebaut
werden kann, ohne eine der fünf kuratierten Implementierungen zu lesen.

### AP 13 — Der Usability-Test wird vorbereitet, und die Doku wird vollständig

Das Skript für Democracy International: die **sieben Aufgaben der Thesis**
wiederholt, plus die Anwendungsfälle, die sie nie getestet hat — Chat, Profile,
Profilsuche, die fünf Plug-ins, die es 2024 noch nicht gab. Dazu eine Instanz
mit Demo-Daten (`tools/demo-seed/`), ein Beobachtungsbogen und die Frage, die
der Test beantworten soll. **Gefahren wird er von Menschen, nicht von einem
Paket** (Vorabentscheidung 2): das Ergebnis ist ein übergabefähiges Bündel und
eine Zeile unter _On a device — waiting for Marius_.

Dazu die Dokumentation, die das Referenzdokument seit Kapitel 6 der Phase 0
schuldet: **`CONTRIBUTING.md`** — das meiste ist entschieden und muss nur
eingesammelt werden (AGPL-3.0-or-later, Conventional Commits, ein Unit-Test je
Feature und Playwright für die Oberfläche, die Schichtgrenzen als Lint-Regeln,
Vertragsänderungen nur mit Versionsschritt); **was nicht entschieden ist, muss
Marius entscheiden**: ob vor v1.0 überhaupt Pull Requests angenommen werden,
DCO oder CLA, wer prüft, und wie ein Plug-in in den kuratierten Satz kommt. Und
die zwei Werkzeugfragen: bleibt `/spikes` im Nutzer-Client als
Betreiberwerkzeug oder verschwindet es, und bleibt
`tools/spike-verification/` — wenn ja, gehört es in die Betriebsdokumentation.

**Fertig, wenn** der Test ohne Rückfrage an dieses Repository durchführbar ist;
`CONTRIBUTING.md` existiert und keine Frage offenlässt, die es beantworten
müsste; und beide Werkzeugfragen eine Entscheidung mit Begründung haben.

### AP 14 — Abschluss der Phase (E71) → **Meilenstein M16**

Wie AP 10 der Phase 4 und AP 13 der Phase 3: **E60–E71 gegen die Umsetzung
geprüft**, mechanisch, wo es mechanisch geht — und eine Abweichung wird
protokolliert, nicht nachgebaut. `todo.md` unter _Checkable after phase 5_
durchgearbeitet, jeder Umzug mit Grund. F203 ff. im Referenzdokument
vollständig. Dieses Dokument von Plan auf Protokoll, mit einem phasenweiten _Was
anders lief_. Und die **Release-Feststellung**: worauf v1.0 sich stützt, was
offen bleibt (die Kamera, die Gerätematrix, der Usability-Test, die
Zustellbarkeit beim Betreiber) — und **kein Tag**, weil den ein Mensch setzt.

**Fertig, wenn** die Feststellung geschrieben ist und Marius sie gelesen hat.

## Meilensteine

| Meilenstein | Nach  | Inhalt                                                                                        |
| ----------- | ----- | --------------------------------------------------------------------------------------------- |
| M13         | AP 3  | Die Außenhaut hält: Container-CI, konfigurierbare Drosselung, Mail mit Anmeldung und TLS      |
| M14         | AP 6  | Ein Mensch kommt herein, zurück und wieder heraus — Zurücksetzen, Löschen, Export, Begründung |
| M15         | AP 8  | Beide Clients halten ihre Gestalt vom Telefon bis zum Schreibtisch                            |
| M16         | AP 14 | Phase 5 abgeschlossen, v1.0 ist feststellbar release-fähig                                    |

## Querschnittsregeln für jedes Arbeitspaket

- **Erst der Test, dann der Code.** Unit-Tests je Service und Guard, API-Vertrag
  in `apps/server-e2e`, Oberfläche in `apps/*-e2e` (Chromium, Firefox, WebKit).
- **Die E2E-Budgets werden addiert, bevor eine Suite dazukommt** (E4,
  `docs/rules/e2e-tests.md`) — bis AP 2 die Budgets konfigurierbar macht,
  und danach erst recht, weil ein Testprofil nie das ist, was ausgeliefert wird
  (E61).
- **Neben einer Browsersuite wird nicht gebaut**, und ein Lauf, dessen Ausgabe
  man wegwirft, hat nicht stattgefunden (die drei Lehren aus Phase 4).
- **Kein Schalter, der nichts liest** (E21), kein Feld ohne Bedeutung, und **kein
  neuer Wert, den `infra/docker-compose.yml` nicht durchreicht.**
- **Eine Lockerung steht in einer `.env`, nie in einer Zeile Code** — das gilt
  für Grenzwerte (E60) genauso wie für Zertifikatsprüfung (E62).
- **Jeder neue oder geänderte Bildschirm liefert seine Katalogschlüssel** in
  Englisch und Deutsch (E22, E23, F70, F80). Kein Text im Template.
- **Löschen ist die Ausnahme, Archivieren die Regel** — außer dort, wo ein
  Mensch seine Löschung verlangt (E65).
- **Eine Migration pro Arbeitspaket**, explizites SQL, `down` mitgeschrieben und
  einmal wirklich ausgeführt.
- **Englisch mit Marius, Englisch im Code, Deutsch in der Dokumentation**;
  Conventional Commits.
- **Nach jedem Paket** `nx run-many -t lint test build` und die E2E-Suiten grün,
  dann committen — und wer „grün" sagt, hat den **Abschluss** des CI-Laufs
  gelesen.

## Risiken

| Risiko                                                                                                       | Gegenmaßnahme                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AP 7 kennt seine Größe nicht, wenn es anfängt** — die Behebungsliste entsteht erst in der Bestandsaufnahme | Die Bestandsaufnahme ist der erste Schritt und ihr Ergebnis ist eine Tabelle. Wenn sie größer ausfällt als ein Paket, wird **an der Tabelle geteilt**, mit Begründung — nicht stillschweigend gekürzt |
| **Eine Gestaltungsänderung bricht Browsertests**, die auf Struktur zeigen                                    | Die Suiten zeigen auf Rollen und Beschriftungen, nicht auf CSS-Klassen. Wo doch, wird der Selektor mit dem Layout geändert und das im Protokoll benannt                                               |
| **Ein vierter Playwright-Lauf verdoppelt Laufzeit und Anmeldebudget**                                        | E68: eigenes Projekt, markierte kleine Auswahl, und die Auswahl **registriert niemanden**. AP 2 macht die Budgets vorher konfigurierbar                                                               |
| **Der Usability-Test kommt nie**, weil er an einem Dritten hängt — und die Phase wartet                      | Vorabentscheidung 2: AP 13 liefert das Bündel, nicht das Ergebnis. M16 hängt nicht daran                                                                                                              |
| **Ein Testmailserver beweist zu wenig**, und jemand hält „grün" für Zustellbarkeit                           | E63 trennt die zwei Hälften ausdrücklich und schreibt die zweite als Betreiber-Prüfliste in `INSTALL.md`. Die Phase behauptet nirgends, Posteingang statt Spam geprüft zu haben                       |
| **Der Fehlercode-Umbau (AP 5) fasst die ganze Geschäftsschicht an** und bricht die Vertragssuite             | Die Suite wechselt auf den Code — genau das ist das zweite Argument dafür. Der Umbau geht Modul für Modul, nicht Datei für Datei, und jedes Modul hat seinen Unit-Test vorher                         |
| **arc42 wird eine zweite Wahrheit** neben `docs/rules/` und dem Referenzdokument                             | E70: jeder Abschnitt sagt etwas Neues **oder** verweist. AP 14 prüft die zwölf Abschnitte darauf, so wie es die Entscheidungen prüft                                                                  |
| **Löschen trifft Plug-in-Daten**, die niemand im Blick hat                                                   | Ein Plug-in fasst keine Kerntabelle an (F21) — also muss das Löschen umgekehrt die Plug-in-Tabellen fragen. AP 6 zählt sie auf und begründet je Tabelle, was mit einer Zeile geschieht                |

## Nachträge am Referenzdokument — geplant

F203 ff., je Paket beim Bauen vergeben. Absehbar: welche Grenzwerte
konfigurierbar sind und was ein lauter Start bedeutet (AP 2); wie ein
Testmailserver aussieht und wo die Grenze zur Betreiberaufgabe liegt (AP 3);
der vierte Tokenzweck (AP 4); wie ein Fehlercode gebaut ist und was er an
Werten trägt (AP 5); was beim Löschen verschwindet, was anonymisiert wird und
was stehen bleibt (AP 6); welche Abweichungen von den Mockups bewusst sind
(AP 7); die drei Breiten und ihr Sinn (AP 7, AP 8); der Vertragsschritt auf
1.3.0 und die Zone am Port (AP 11); und der Platz von arc42 neben den
bestehenden Dokumenten (AP 12). Anhangspunkt 11 bekommt den Abschluss des
Vertrags.

## Definition of Done für Phase 5

1. **Jedes Arbeitspaket hat sein Abnahmekriterium nachweislich erfüllt**;
   `nx run-many -t lint test build`, die Server-Unit-Tests, die API-Vertragstests
   und beide Browsersuiten sind grün — und der kombinierte Lauf ist seit AP 2
   **lesbar**, also nicht mehr nur einzeln grün.
2. **Ein CI-Auftrag fährt die fünf Container aus leerem Volume hoch** und treibt
   einen Browser darüber; ein Fehler der Klasse „läuft in der Entwicklung,
   kaputt wie ausgeliefert" wird darin rot.
3. **Jeder Grenzwert kommt aus der Umgebung**, mit den heutigen Zahlen als
   Vorgabe, und eine Lockerung ist beim Start sichtbar.
4. **Eine Mail geht über einen Server, der Anmeldung und Verschlüsselung
   verlangt**, mit Pause und zweitem Versuch — und `INSTALL.md` sagt, was der
   Betreiber selbst an seinem DNS tun muss.
5. **Ein Mensch kann zurückkommen und gehen**: Passwort zurücksetzen, Daten
   exportieren, Konto löschen — und was von ihm bleibt, weil es jemand anderes
   geschrieben hat, trägt seinen Namen nicht mehr.
6. **Der Server begründet in der Sprache der Seite.**
7. **Für jede Seite des Nutzer-Clients steht eine Zeile in der Mockup-Tabelle**,
   und keine sagt „ist halt so geworden". Beide Clients sind bei ihren drei
   Breiten bedienbar, und ein Gestaltungsprojekt hält das fest.
8. **Der Security-Review ist protokolliert**, die Lastzahlen stehen mit Aufbau
   und Datum da, und die Betriebsprotokolle enthalten keine personenbezogenen
   Daten.
9. **`docs/arc42/` steht**, zwölf Abschnitte, ohne eine Regel zu wiederholen,
   die anderswo im Repository steht — samt Plug-in-SDK-Leitfaden.
10. **Der Usability-Test ist übergabefähig vorbereitet**, `CONTRIBUTING.md`
    existiert, und beide Werkzeugfragen sind entschieden.
11. **`todo.md` unter _Checkable after phase 5_ ist durchgearbeitet** und
    F203 ff. stehen im Referenzdokument. Verschobene Einträge tragen eine
    Begründung, gestrichene ebenfalls.
12. **Dieses Dokument ist von Plan auf Protokoll korrigiert** und hat je Paket
    einen Abschnitt „erledigt" sowie am Ende ein phasenweites _Was anders lief_.
13. **Die Release-Feststellung ist geschrieben** — worauf v1.0 sich stützt und
    was offen bleibt. **Der Tag selbst ist Marius' Schritt** (E71).

---

## Fortschritt

Je Paket ein Abschnitt „erledigt" mit dem, was tatsächlich passierte —
Abweichungen vom Plan stehen hier, damit AP 14 sie nicht rekonstruieren muss.

### AP 1 — Der Stack wird geprüft, wie er ausgeliefert wird (erledigt, 14.09.2026)

Umgesetzt:

- **Ein CI-Job `stack`, und dasselbe Kommando auf dem Laptop.** Die Arbeit liegt
  in `tools/shipped-stack/verify.sh`, nicht in der YAML — absichtlich, denn ein
  Job, den man lokal nicht fahren kann, wird beim ersten roten Lauf nicht
  verstanden, sondern abgeschaltet. Er fährt die fünf Container aus **leerem**
  Volume hoch, wartet auf `/api/health`, richtet ein, prüft, lässt einen Browser
  laufen und räumt in einer `trap` wieder ab — auch im Fehlschlag. Die letzte
  Zeile ist die Laufzeit: **97 s** lokal bei warmen Images.
- **Eingerichtet wird über den geführten Weg, nicht über `ADMIN_BOOTSTRAP_*`** —
  eine Abweichung vom Plan, und eine, die mehr beweist als geplant. Der Plan
  sagte „bootstrappt sich einen Administrator"; beim Bauen stellte sich heraus,
  dass `verify-setup.mjs` den Administrator ohnehin selbst anlegt. Also bleiben
  die beiden Bootstrap-Werte **leer**, das Skript liest den Setup-Token aus dem
  Serverlog und geht den Weg, den ein echter Betreiber geht — genau den, von dem
  `docs/rules/deployment.md` sagt, dass ihn **keine** Suite dieses Repositories
  erreichen kann (die Endpunkte existieren nur bei leerer `admin_user`-Tabelle,
  und der letzte Administrator ist nicht löschbar, F22).
- **`apps/stack-e2e`, sieben Tests, nur Chromium.** Die verhaltensmäßige Hälfte:
  ein Service Worker, der **wirklich registriert und in Kontrolle** der Seite
  ist. `verify-proxy.mjs` liest `ngsw.json` mit ngsws eigener Auswahlregel — das
  ist die statische Hälfte und bleibt —, aber eine Regel zu lesen ist nicht
  dasselbe wie ihre Wirkung zu sehen. Die entscheidende Behauptung ist
  formuliert wie das Symptom von damals: an `/admin/` darf **die Navigation des
  Nutzer-Clients nicht** antworten. Ein Engine-Fächer wäre hier Verschwendung —
  Firefox und WebKit decken die zwei Client-Suiten ab, wo die Unterschiede
  zwischen Engines tatsächlich wohnen.
- **Das Abnahmekriterium, so geprüft, wie es geschrieben steht.** Mit `!/admin`
  und `!/admin/**` aus `ngsw-config.json` entfernt wird der Job rot (`EXIT=1`,
  89 s); mit ihnen grün (`EXIT=0`, 97 s). Und die zweite Hälfte — „und sonst
  nichts im Repository" — ist nicht geglaubt, sondern nachgezählt:
  `navigationUrls` wird an genau **zwei** Stellen behauptet, in dieser neuen
  Suite und in `verify-proxy.mjs`, und das zweite läuft ausschließlich in diesem
  Job. Kein Unit-Test, keine Vertragssuite, keine der beiden Browsersuiten liest
  die Datei überhaupt.
- **Beide Hälften fangen den Fehler, jede für sich — und das musste eigens
  geprüft werden.** Im roten Lauf scheitert `verify-proxy.mjs` zuerst, und
  `set -e` beendet das Skript, bevor der Browser überhaupt startet. Damit war
  die verhaltensmäßige Hälfte **unbewiesen**, also ist der kaputte Stack ein
  zweites Mal hochgefahren und nur die Browsersuite darauf gefahren worden:
  `leaves the organizer client to the network` fällt, und zwar mit dem
  buchstäblichen Symptom von damals — `base href` ist **`/`** statt `/admin/`,
  der Worker hat `/admin/` also wirklich aus dem Cache des Nutzer-Clients
  beantwortet und der Browser hatte die falsche Anwendung vor sich. Die Lehre
  ist allgemeiner als dieser Fall: **in einer Kette, die beim ersten Fehlschlag
  abbricht, ist jede spätere Prüfung unbewiesen, bis sie einmal allein gegen den
  Fehler gehalten wurde.**

**Was anders lief:**

- **Der Job hat zuerst mich gefunden, und das war der Beweis.** Der allererste
  Lauf kam nicht bis zur ersten Prüfung: der Server startete nicht, weil mein
  erzeugtes `.env` `SMTP_HOST` und `SMTP_FROM` nicht setzte. Vier Werte fehlen
  in Produktion nicht mit einer Warnung, sondern mit einer **Absturzschleife**
  (dazu `AUTH_SECRET` und `DATABASE_PASSWORD`); die zwei Mailwerte überraschen,
  weil eine Instanz ohne Mail sonst nirgends verboten ist, und der Grund ist der
  Double-Opt-In. Steht jetzt in `docs/rules/deployment.md`. Dass ausgerechnet
  der Job, der „läuft in der Entwicklung, kaputt wie ausgeliefert" fangen soll,
  als erstes ein unvollständiges `.env` fängt, ist keine Ironie, sondern seine
  Arbeit.
- **Eine `playwright.config.*` erzeugt still ein `e2e`-Target.** Das
  `@nx/playwright`-Plugin leitet es aus jeder solchen Datei ab, also war
  `stack-e2e` in der Sekunde seiner Entstehung Teil von
  `nx run-many -t e2e` — dem Job, der gegen `nx serve` läuft — und wäre dort
  gegen einen Stack gelaufen, den niemand gestartet hat. Ein eigener Target-Name
  in `project.json` genügt **nicht**, weil die Ableitung danebensteht; das
  Projekt musste im Plugin-Eintrag ausgeschlossen werden. Geprüft mit
  `nx show projects --with-target e2e` nach einem `nx reset`. In
  `docs/rules/tooling-traps.md`.
- **Zwei Behauptungen waren falsch, bevor sie liefen.** Beide Clients
  bootstrappen `trefaro-root`, also unterscheidet dieses Element sie nicht —
  ein Test, der es geprüft hätte, wäre aus dem falschen Grund grün geworden.
  Und `/api/config` trägt `theme`, nicht `design`. Das zweite hat der erste
  Lauf gefunden, das erste ein Blick in die Vorlagen davor.
- **Das Skript räumt auch im Fehlschlag ab**, und die Reihenfolge in der `trap`
  ist Absicht: erst `compose down -v`, dann die Umgebungsdatei löschen. Compose
  interpoliert die Datei auch beim **Abräumen**, also entfernt die umgekehrte
  Reihenfolge nichts und lässt fünf Container stehen — mit
  „`DATABASE_PASSWORD must be set`" als Begründung, die wie ein Startfehler
  aussieht. Einmal von Hand hineingelaufen, danach auch der `STACK_KEEP`-Zweig
  repariert: dort überlebt die Umgebungsdatei den Lauf, und der Hinweis nennt
  sie, statt ein Kommando vorzuschlagen, das scheitern muss.

**Der Stand nach diesem Paket:** `nx run-many -t lint test build` grün über
**19** Projekte (18 plus `stack-e2e`), die drei E2E-Projekte unverändert — die
Plugin-Ableitung hätte `stack-e2e` zu einem vierten gemacht, und das ist
verhindert. Der `stack`-Job ist der vierte der CI und hängt bewusst **nicht** an
`images`: jener Job baut in den GitHub-Actions-Cache und lädt die Ergebnisse
nie, es gäbe also nichts wiederzuverwenden, und eine Abhängigkeit würde nur zwei
Jobs serialisieren, die nebeneinander laufen können.

### AP 2 — Die Drosselung wird konfigurierbar, und sie zählt vollständig (erledigt, 14.09.2026)

Umgesetzt:

- **Fünf Zahlen kommen aus der Umgebung, und die Vorgaben sind die bisherigen**
  (E60, F203). Der Plan nannte vier; die fünfte ist der Zähler, den dasselbe
  Paket dazubaut — ein neuer Grenzwert, der als einziger nicht verstellbar
  wäre, wäre der Sonderfall gewesen, den später niemand erklären kann. Die
  Vorgaben stehen in `core/config/rate-limits.ts`, jede mit der Begründung, die
  bis hierher neben ihrem Controller stand. Die globale Grenze (300/min) und
  die Fünfzehn-Minuten-Sperre des Logins bleiben ausdrücklich Konstanten: ein
  Betreiber mag einen großzügigeren **Zähler** wollen, aber „sofort weiter
  probieren" ist für keine Instanz richtig.
- **Eine Route nennt die Art ihrer Tür, nicht ihr Maß.** `@RateLimit('login')`
  statt `@Throttle({ default: { limit: KONSTANTE } })`. Das ist keine Kosmetik,
  sondern der Grund, warum das Paket überhaupt eine Form brauchte: ein Dekorator
  kann nicht injiziert werden, also hätte jede Zahl an einer Route sie im Bau
  festgeschrieben. Gelöst über **benannte Throttler** aus
  `ThrottlerModule.forRootAsync` — die Zahl kommt per DI aus der geprüften
  Umgebung, und jeder benannte Throttler trägt ein `skipIf`, das die Metadaten
  der Route liest. Die fünf Konstanten sind damit weg, `common/login-throttle.ts`
  ebenfalls.
- **Laut heißt laut, und Schweigen heißt die ausgelieferten Zahlen.** Jeder Wert
  **über** seiner Vorgabe erzeugt beim Start eine `WARN`-Zeile mit Variable,
  Wert und Vorgabe; ein Wert **darunter** erzeugt keine, weil das die sichere
  Richtung ist. `rateLimitWarnings()` ist eine reine Funktion mit sechs Tests —
  die Alternative, im Bootstrap zu formulieren, hätte eine Zeile geprüft, die
  nur beim Hochfahren entsteht.
- **Der zweite Zähler ist ein Interceptor, kein Guard** (F204), und das ist die
  einzige Stelle des Pakets, an der der Plan gegen die Wirklichkeit korrigiert
  werden musste. Ein Guard läuft, bevor irgendetwas den Rumpf geparst hat — und
  eine Anmeldung mit Dateifeld kommt als `multipart/form-data`. Ein Guard hätte
  dort einen leeren Rumpf gesehen und durchgewunken: eine Umgehung, die ein
  Angreifer genau einmal finden muss. `RecipientThrottleInterceptor` steht
  deshalb **hinter** dem Multipart-Interceptor derselben Route und zählt die
  Adresse im Rumpf mit **einem** Budget je Postfach, ohne Route im Schlüssel —
  Anmeldeformular, Newsletter-Anmeldung und Kontoformular teilen sich fünf je
  fünf Minuten. Der Schlüssel ist gehasht: er überlebt die Anfrage um fünf
  Minuten, und eine Liste von Adressen im Speicher ist etwas anderes als eine
  Adresse in einer Anfrage.
- **Der Handshake kostet, was eine Anfrage kostet** (F205). socket.ios
  `allowRequest` zählt ihn gegen **dasselbe** globale Budget, über denselben
  `ThrottlerStorage` — keine neue Zahl zum Konfigurieren und keine zum
  Falschsetzen. Die Client-Adresse wird gelesen, wie Express sie unter
  `trust proxy: 1` liest: der letzte Eintrag von `X-Forwarded-For`. Der erste
  wäre vom Aufrufer wählbar, und den Header zu ignorieren machte alle Clients
  hinter dem Proxy zu einem.
- **Das Testprofil ist eine Datei, die der Produktions-Stack nicht kennt**
  (E61). `apps/server/.env.serve-e2e`, geladen von Nx für die Task
  `serve-e2e` und für keine andere. Es brauchte ein eigenes Ziel statt einer
  Konfiguration, weil `dependsOn` kein `configuration`-Feld hat und
  `@nx/js:node` keine `env`-Option — beides nachgeschlagen, nicht vermutet, und
  als Falle in `docs/rules/tooling-traps.md` notiert. Die drei E2E-Projekte
  hängen jetzt an `serve-e2e`.

**Das Abnahmekriterium, Punkt für Punkt:**

- _Ein gesetzter Wert wirkt_ — nachgewiesen als Mutation: mit
  `MAILS_PER_RECIPIENT_PER_WINDOW=100` im Profil läuft
  `apps/server-e2e/src/api/rate-limits.spec.ts` **rot** (achtmal 202 statt
  fünfmal 202 und dreimal 429), mit `=5` grün. Ein Test, der nach dem Code
  geschrieben wurde, beweist nichts, bevor er einmal gefallen ist.
- _Ein gelockerter Wert warnt beim Start_ — `nx run server:serve-e2e` schreibt
  sechs Zeilen (Profilname plus vier gelockerte Werte, in der Mutation fünf),
  `nx run server:serve` schreibt **keine einzige**. Beide Richtungen gemessen;
  die zweite ist die wichtigere, weil sie zeigt, dass das Profil nicht leckt.
- _Eine zweite Anmeldung an dieselbe Adresse von einer anderen Clientadresse
  wird gedrosselt_ — jeder der acht Versuche in der Suite kommt von einer
  anderen `X-Forwarded-For`, und das Registrierungsbudget steht im Profil bei
  400: was ausgeht, kann also nichts anderes sein als das Postfach. Die
  Gegenprobe steht daneben: derselbe Client darf danach an ein **anderes**
  Postfach schreiben.
- _Ein Handshake-Sturm wird gezählt_ — fünf Unit-Tests auf `handshakeThrottle`,
  darunter der Sturm selbst, die getrennten Budgets zweier Adressen und der
  Beweis, dass der Proxy-Hop und nicht der Proxy zählt.
- _`nx run-many -t e2e --parallel=1` läuft lesbar_ — **EXIT=0**, 690 + 317 + 258
  grün, und im ganzen Lauf genau **drei** 429: alle drei von der Suite erbeten,
  deren Gegenstand sie sind. Vorher waren es die Registrierungen der
  Vertragssuite, und der Fehlschlag sah nach einem kaputten Endpunkt aus.

**Was anders lief:**

- **Der Plan sagte „Guard", die Multipart-Route sagte etwas anderes.** Siehe
  oben — die Korrektur kam aus der Frage, was `req.body` zum Zeitpunkt eines
  Guards eigentlich enthält, und nicht aus einem roten Test. Der Test kam danach
  und steht jetzt in `recipient-throttle.interceptor.spec.ts` als eigener Fall.
- **Die Kommentarschlüssel-Falle aus AP 1 hat ein zweites Mal zugeschlagen.**
  `"// serve-e2e"` **in** `targets` ist ein Ziel namens `// serve-e2e`, und der
  Projektgraph scheitert dann vollständig („Failed to process project graph"),
  nicht an der betroffenen Stelle. Die Regel stand bereits in
  `docs/rules/tooling-traps.md` — sie ist jetzt um das genaue Fehlerbild und um
  die zulässigen Stellen ergänzt, denn die alte Fassung sagte, was gilt, aber
  nicht, woran man merkt, dass man dagegen verstoßen hat.
- **Eine Entscheidung, die der Plan nicht vorsah: die Ablehnung bleibt
  sichtbar.** Ein erschöpftes Empfängerbudget antwortet 429 statt die Mail still
  fallen zu lassen. Still wäre das dichtere Verhalten — aber ein Haushalt hinter
  einer gemeinsamen Adresse stünde dann ohne jede Erklärung da, warum der
  Bestätigungslink nie ankam, und für ein Anmeldeformular heißt das: die
  Anmeldung kommt nie zustande. Das Restsignal ist benannt und schmal (F204).
- **Das Profil hebt vier Zahlen an und eine ausdrücklich nicht.**
  `MAILS_PER_RECIPIENT_PER_WINDOW` bleibt bei der ausgelieferten Fünf, damit
  jeder volle E2E-Lauf **eine echte Grenze** anfasst. Das ist die direkte
  Antwort auf die Sorge, die E4 formuliert und E60 wiederholt: ein Profil, das
  alles anhebt, ist ein Profil, unter dem nichts mehr geprüft wird.

**Der Stand nach diesem Paket:** `nx run-many -t lint test build` grün über
**19** Projekte, 1291 Server-Unit-Tests (14 neu), 690 Vertragstests (3 neu),
317 + 258 Browsertests unverändert. `todo.md` verliert sechs Einträge unter
_Checkable after phase 5_ — der unlesbare Kombinationslauf, die konfigurierbare
Drosselung, der Zähler je Empfänger, der ungezählte Handshake, die geteilten
E2E-Budgets und die Frage nach der Login-Grenze, die jetzt eine `.env`-Zeile ist
statt eines Releases.

### AP 3 — Mail: angemeldet, verschlüsselt und höflich (erledigt, 14.09.2026) → **Meilenstein M13**

Umgesetzt:

- **Ein Mailserver, der ablehnt** (E62, F206). `infra/docker-compose.dev.yml`
  bekommt ein zweites Profil (`--profile secure-mail`): derselbe Mailpit, aber
  mit `--smtp-auth-file`, einem STARTTLS-Zertifikat und
  `--smtp-require-starttls`, auf eigenen Ports **neben** dem offenen. Zwei
  nebeneinander, weil der Vergleich der Beweis ist. Der Plan schrieb
  `--smtp-auth`; das Abbild kennt den Schalter unter `--smtp-auth-file`, und die
  Passwortdatei nimmt Klartext — beides am laufenden Container nachgesehen statt
  aus der Dokumentation abgeschrieben.
- **Verschlüsselung ist etwas, das verlangt wird, nicht etwas, das sich ergibt.**
  Neu ist `SMTP_REQUIRE_TLS` — STARTTLS, das stattfinden **muss** —, mit `true`
  als Vorgabe in Produktion und `false` sonst. Das ist die einzige
  umgebungsabhängige Vorgabe in `env.ts`, und der Grund steht in
  `core/config/smtp.ts`: der Mailpit der Entwicklung hat kein Zertifikat, und
  eine Vorgabe, die `nx serve` das Mailen unmöglich macht, ist eine Vorgabe, die
  jemand einmal abschaltet und nie wieder anschaltet. Ohne sie war STARTTLS eine
  Gelegenheit: nodemailer rüstet auf, **wenn** der Server es anbietet, und wer
  das Angebot unterwegs entfernt, bekommt die Mail und das Passwort im Klartext.
- **Das Zertifikat wird benannt, die Prüfung nie abgeschaltet.**
  `NODE_EXTRA_CA_CERTS` reicht `infra/docker-compose.yml` jetzt durch, dazu ein
  immer vorhandener, normalerweise leerer Mount `infra/ca/` →
  `/etc/trefaro/ca`: einem internen Mailserver zu vertrauen soll eine Datei und
  eine Variable sein und keine zweite Compose-Datei. Eine Zeile
  `rejectUnauthorized: false` gibt es nirgends — und `smtp-mailer.spec.ts` wird
  rot, wenn jemand eine schreibt. Gemessen in beide Richtungen: mit benannter
  Datei geht die Mail durch, ohne sie lehnt schon die TLS-Verbindung ab.
- **Eine Pause zwischen zwei Mails, und sie ist Konfiguration** (F207).
  `SMTP_PAUSE_BETWEEN_MAILS_MS`, Vorgabe eine Sekunde, gewählt aus dem Fehler,
  den sie verhindert: `todo.md` nannte „zweihundert Einladungen in zwanzig
  Sekunden" als den Weg in die Drosselung, also muss die Vorgabe genau das
  unmöglich machen — dreieinhalb Minuten statt zwanzig Sekunden. Sie steht am
  SMTP-Block und nicht bei den Einladungen, weil der Grund dem Mailserver
  gehört. Eine **verkürzte** Pause ist eine `WARN`-Zeile beim Start: bei den
  Grenzwerten ist die gefährliche Richtung die größere Zahl (E60), hier die
  kleinere, und `smtpWarnings()` ist dieselbe reine Funktion mit acht Tests.
- **„Jetzt nicht" bekommt einen zweiten Versuch, „nie" nicht** (F207). Eine
  4xx-Antwort wird nach dem Zehnfachen der Pause noch einmal versucht; danach
  ist Schluss, weil die Zähler, die ein Veranstalter beobachtet, zur Ruhe kommen
  müssen. 5xx und Verbindungsfehler bekommen keinen: der erste ist endgültig,
  der zweite trifft alle zweihundert Empfänger nacheinander und machte aus einem
  Ausfall den doppelten. Die Unterscheidung fällt am **Port**
  (`TemporaryMailFailure`), weil „eine Zahl zwischen 400 und 499" SMTP-Wissen
  ist; die Geschäftsschicht liest ein `temporary`.
- **Der Abmeldeknopf des Mailprogramms** (F208, RFC 8058). Jede Einladung trägt
  `List-Unsubscribe` und `List-Unsubscribe-Post`, geschrieben von der
  **Vorlage** — derselben, die den Link im Fußtext setzt, damit beide nie für
  zwei verschiedene Menschen sprechen. Dahinter ein Endpunkt, der einen nackten
  `POST` annimmt, das Feld `List-Unsubscribe=One-Click` **verlangt** und `204`
  antwortet. Seine Begründung gegen E5b ist eigen und keine Kopie: die Anfrage
  steht in einer Kopfzeile statt im Rumpf, sie trägt einen Marker, den ein
  Linkvorschau-Dienst nicht mitschickt, und sie kann ausschließlich wegnehmen —
  während der Bestätigungslink, für den E5b geschrieben wurde, eine Anmeldung
  **erzeugt**.
- **Zustellbarkeit verlässt `todo.md` und wird eine Prüfliste** (E63).
  `docs/INSTALL.md` hat einen neuen Abschnitt 7 mit vier Teilen: die zwei
  Formen der Verschlüsselung, warum Einladungen langsam rausgehen, die sieben
  Punkte SPF/DKIM/DMARC/Reverse-DNS/Ausrichtung/zwei echte Postfächer/der
  Proxy vor dem One-Click-Endpunkt — und der Satz, dass
  `tools/secure-mail/verify.sh` die **erste** Hälfte beantwortet und über die
  zweite nichts sagt.

**Das Abnahmekriterium, Punkt für Punkt:**

- _Eine Bestätigungsmail geht über einen Mailserver, der ohne Anmeldung und
  ohne TLS ablehnt_ — `tools/secure-mail/verify.sh`, EXIT=0. Es fragt den
  Mailserver zuerst, was er ablehnt (`530 Must issue a STARTTLS command first`,
  `530 Authentication required`), und schickt danach eine echte
  Konto-Bestätigung durch ihn hindurch. Ohne `NODE_EXTRA_CA_CERTS` scheitert
  schon die Verbindung — das ist die Gegenprobe, die zeigt, dass die Prüfung
  wirklich stattfindet.
- _Ein Server, der 451 antwortet, bekommt einen zweiten Versuch und die Zeile
  bleibt nicht auf „failed" stehen_ — drei Unit-Tests am Versand: der zweite
  Versuch findet statt, er findet **nicht sofort** statt, und nach dem zweiten
  Fehlschlag steht die Zeile mit den Worten des Mailservers auf `failed`. Dazu
  zwei am Mailer, die 4xx von 5xx und von einem Verbindungsfehler trennen.
- _Zweihundert Einladungen gehen mit messbarer Pause raus_ — die Vertragssuite
  misst sie: der Versand der zweihundert dauert **länger als zwanzig Sekunden**,
  und diese Behauptung ist ohne Pause falsch. Gegengeprüft als Mutation am
  Unit-Test: ohne die Pause wird „waits between two mails" rot.
- _Der Kopfzeilen-Abmeldelink funktioniert einmal und macht beim zweiten Mal
  nichts kaputt_ — fünf Vertragstests, die die URL **aus der Kopfzeile der
  Mail** nehmen, die der Server tatsächlich verschickt hat: ein `GET` ist keine
  Route, ein `POST` ohne Marker ist 400, der erste Klick nimmt die Adresse aus
  jeder Kontaktliste, der zweite antwortet wieder 204.
- _`INSTALL.md` sagt, welche DNS-Einträge eine Organisation braucht_ —
  Abschnitt 7.3, sieben Punkte zum Abhaken.

**Was anders lief:**

- **Der ausgelieferte Stack konnte keine Mail verschicken** (Anhangspunkt 28).
  `infra/docker-compose.yml` setzte `SMTP_PORT=587` neben `SMTP_SECURE=true` —
  implizites TLS auf einem Port, der im Klartext begrüßt. Gemessen: gegen den
  strengen Mailserver kommt so in sechzig Sekunden keine Verbindung zustande.
  Gefunden hat es nicht ein Test, sondern die Frage, was `SMTP_SECURE=true`
  eigentlich gegen einen STARTTLS-Port tut — genau die Fehlerklasse aus
  `docs/rules/deployment.md`: die Kombination existierte nur in der
  Compose-Datei, also sah sie keine Suite. Die Vorgabe ist korrigiert, und der
  Ersatz ist keine zweite Kopie derselben Zahl, sondern eine Variable mit einer
  umgebungsabhängigen Vorgabe.
- **Die Unit-Tests des Versands laufen jetzt auf falschen Uhren.** Eine Pause
  lässt sich mit `setTimeout(0)` nicht mehr abwarten, und ein Test, der wirklich
  wartet, misst eine Stoppuhr statt eine Eigenschaft. Mit
  `jest.advanceTimersByTimeAsync` sagt die Suite stattdessen, **was zu welchem
  Zeitpunkt passiert sein muss** — nach null Millisekunden eine Mail, nach einer
  Pause zwei —, und das ist die schärfere Behauptung.
- **Die Pause wird für die E2E-Läufe verkürzt, nicht abgeschaltet.** 150 ms im
  Profil, damit die zweihundert Einladungen der Vertragssuite eine halbe Minute
  brauchen statt dreieinhalb. Abschalten ginge nicht einmal: `read.integer`
  verweigert die Null, und eine Pause von null wäre keine. Das Profil sagt es
  beim Start, wie es das Drosselprofil sagt — die siebte `WARN`-Zeile.
- **Ein Endpunkt, den nur Software aufruft, ist eine ungewohnte Sorte Vertrag.**
  Der One-Click-Endpunkt hat kein DTO und keine Seite, dafür eine
  Rumpf-Bedingung, die anderswo Validierung wäre. Sie steht im Controller mit
  ihrer Begründung, weil sie **die** Begründung ist: ohne den Marker ist der
  Endpunkt genau das, was E5b verbietet.
- **Ein Lauf ist in diesem Paket zweimal ungültig geworden, einmal fremd und
  einmal durch mich.** Der erste kombinierte Lauf war rot mit **einem** Test von
  258 (`plugin-forum.spec.ts:224`, Chromium), Nx hat die Task selbst als flaky
  markiert, und dieselbe Suite allein war unmittelbar danach grün. Das ist die
  Sorte Fehlschlag, die `todo.md` seit AP 7 der Phase 4 verfolgt; der Eintrag
  dort hat jetzt auch für die Teilnehmersuite einen Testnamen. Der zweite Lauf
  ist **meine** Schuld: ich habe während der laufenden Browsersuite eine
  Quelldatei umbenannt, `serve-e2e` hat neu gestartet, und acht Tests liefen
  gegen `ECONNREFUSED`. Die Regel dagegen stand schon da, nur eine Nummer zu
  eng — „nicht neben einer Browsersuite **bauen**" heißt auch „nicht neben ihr
  **schreiben**", denn der Watcher baut dann für einen. Steht jetzt so in
  `docs/rules/e2e-tests.md`.
- **Das Prüfskript läuft vorerst nur lokal.** `tools/secure-mail/verify.sh`
  gehört der Form nach neben `shipped-stack/` in die CI, und die Stelle ist
  offensichtlich. Es ist trotzdem nicht dazugekommen: einen CI-Auftrag kann man
  von hier aus nicht prüfen, ohne zu pushen, und „grün in der CI" heißt in
  diesem Repository, dass jemand den **Abschluss** eines Laufs gelesen hat. Als
  Eintrag in `todo.md` benannt, mit der Form, die er haben müsste.

**Der Stand nach diesem Paket:** `nx run-many -t lint test build` grün über
**19** Projekte, **1316** Server-Unit-Tests (25 neu), **695** Vertragstests
(5 neu), 317 + 258 Browsertests unverändert grün. `tools/shipped-stack/verify.sh`
noch einmal gefahren, weil `infra/docker-compose.yml` sich geändert hat:
**EXIT=0**, keine einzige `[Smtp]`- oder `[RateLimits]`-Zeile, keine
Container- und Volume-Reste. `todo.md` verliert drei Einträge — den Mailserver
mit Anmeldung und TLS, die fehlende Pause samt zweitem Versuch und die fehlende
`List-Unsubscribe`-Kopfzeile — und bekommt einen dazu, den CI-Auftrag für
`tools/secure-mail/verify.sh`.

**Eine Einschränkung, die zum Lauf gehört:** der kombinierte
`nx run-many -t e2e --parallel=1` ist an diesem Tag nur einmal vollständig
durchgelaufen (mit dem einen flaky gewordenen Test); bei den Wiederholungen
belegte ein **anderes Projekt auf demselben Rechner** Port 4200, worauf
`user-client:serve` scheitert und Nx die Teilnehmersuite gar nicht erst startet.
Gemessen wurde deshalb so: Veranstalter- und Vertragssuite im kombinierten Lauf
(317 und 695, drei 429 im ganzen Lauf, alle drei von der Drosselungssuite
erbeten), und die Teilnehmersuite gegen **denselben** `serve-e2e`-Server über
`BASE_URL` auf einem freien Port — 258 grün, EXIT=0. Das ist dieselbe Aussage,
nur ohne den Port, der einem anderen gehört.

### AP 4 — Die eine Sackgasse: vergessenes Passwort (erledigt, 14.09.2026)

Umgesetzt:

- **Der vierte Tokenzweck, und er wirkt genau einmal** (F209). `password-reset`
  lebt **eine Stunde** statt der vierzehn Tage einer Bestätigung, und der
  Unterschied ist nicht Vorsicht, sondern Fachlichkeit: ein Bestätigungslink
  sagt „ja, das ist meine Adresse" und gewährt nichts; ein Rücksetz-Link **ist**
  das Konto, solange er gilt. Das Einmalige war die eigentliche Frage, denn
  diese Anwendung speichert Token grundsätzlich nicht (E5, F23, F180) — es gibt
  also keine Zeile zum Abhaken. Antwort: das Subjekt trägt nicht nur die
  Konto-ID, sondern dazu eine geheime **Marke über dem Passwort-Hash**
  (`TokenSigner.mark`, HMAC mit `AUTH_SECRET`, vom Signaturverfahren
  domänengetrennt). Ein gesetztes Passwort ändert den Hash, die Marke stimmt
  nicht mehr, der Link löst kein Konto mehr auf. Zwei Folgen, beide geprüft und
  beide dokumentiert statt versteckt: ein **zweiter** angeforderter Link
  entwertet den ersten nicht (beide sind gegen denselben Hash geprägt — wer
  zuerst benutzt wird, entwertet den anderen), und ein im Profil geänderter
  Passwort entwertet einen offenen Rücksetz-Link, weil das dieselbe Aussage über
  dasselbe Konto ist und die jüngere gewinnt.
- **Drei Zustände, drei Briefe — und der dritte ist die Begründung der anderen
  beiden** (F210). Eine bestätigte Adresse bekommt den Link (die **zehnte**
  Mail), eine unbestätigte noch einmal die Kontobestätigung (der fehlende
  Schritt ist die Bestätigung, nicht das Passwort), eine **unbekannte** den
  Satz, dass es hier kein Konto gibt (die **elfte**, und sie grüßt niemanden —
  es gibt keine Zeile, also keinen Namen). Dass auch der dritte Fall schreibt,
  ist die Entscheidung des Pakets: E32 verlangt, dass der Unterschied im
  Postfach steht, und nur so kostet jede Anfrage dasselbe
  Mailserver-Gespräch — womit die **Laufzeit** der Antwort so wenig verrät wie
  ihr Statuscode. F181 („keine zehnte Mail für ‚du stehst schon auf der
  Liste'") widerspricht nicht: dort hätte der Brief nichts enthalten, was man
  tun kann, hier schon — die richtige Adresse suchen oder ein Konto anlegen.
- **Zwei Routen, und die zweite nimmt ihr Token im Rumpf.** `POST
/api/user/profiles/password-reset` (200, die Adresse zurück) und `POST
/api/user/profiles/password` (204). Das Token steht im Rumpf, weil diese
  Anfrage etwas **ändert** (F44, E5b) — ein Linkvorschau-Dienst darf kein
  Passwort setzen. Es kommt auch **keine** Sitzung zurück: der Link belegt eine
  Adresse, das Anmelden danach belegt, dass jemand das eben gewählte Passwort
  kennt. Jede Ablehnung — gefälscht, abgelaufen, verbraucht, überholt — ist
  **ein** Satz.
- **Ein Zurücksetzen beendet alle Sitzungen, nicht „alle außer der eigenen"**
  (F211, F139 zu Ende gedacht). Dafür ein **zweiter** Port-Aufruf
  (`deleteForUser`) statt `deleteForUserExcept(userId, '')`: wer einen Link
  anfordern musste, ist nirgends angemeldet, und die Sitzungen, die es gibt,
  sind genau die, die vielleicht nicht die eigenen sind. Eine leere Ausnahme
  wäre ein Sonderfall, den später niemand liest.
- **Eine eigene Drosselung, und eine, die es schon gab** (E60). `PASSWORD_RESETS_PER_WINDOW`
  ist der sechste konfigurierbare Wert, Vorgabe **20** — die Zahl der
  Newsletter-Anmeldung, nicht die sechzig der Formulare: mehrere Menschen hinter
  einer öffentlichen Adresse, die binnen fünf Minuten ihr Passwort vergessen,
  sind eine Handvoll. Das **Setzen** des Passworts zählt dagegen als
  Bestätigung, weil eine solche Grenze nur gegen das Raten eines HMAC schützt —
  kein siebter Wert für dieselbe Sache. Dazu `@ThrottleByRecipient()`, weil die
  Route an eine Adresse schreibt, die der Aufrufer nennt (F204).
- **Zwei Seiten im Nutzer-Client und ein Link, der die Sackgasse öffnet.**
  `/profile/forgot-password` und `/profile/new-password`; der Link darauf steht
  **direkt unter** dem Anmeldeformular, weil wer diese Seite zum zweiten Mal
  liest, sie meistens liest, weil das Passwort nicht ging. Die neue Seite hängt
  bewusst **nicht** am `participantAnonymousGuard`: jemand kann anderswo noch
  angemeldet sein und trotzdem einen Link in der Hand halten.

**Nebenbei mitgenommen, weil es danebenlag:** die beiden Kontoendpunkte trugen
noch `@Throttle({ default: { limit: PROFILE_REGISTRATIONS_PER_WINDOW } })` mit
einer Konstante im Controller — eine Lücke, die AP 2 übersehen hatte. Sie heißen
jetzt `@RateLimit('registration')` und `@RateLimit('confirmation')`, die
Konstante ist weg, und damit wirkt das Testprofil endlich auch auf das
Kontoformular.

**Das Abnahmekriterium, Punkt für Punkt:**

- _Ein Teilnehmender kommt ohne Hilfe zurück_ — als Browserlauf, nicht als
  Behauptung: `apps/user-client-e2e/src/profile.spec.ts` registriert ein Konto,
  bestätigt es über die Mail, findet den Link **auf dem Anmeldeformular**,
  fordert an, holt den Link aus dem Brief, setzt ein Passwort und meldet sich
  damit an. Eine Anmeldung je Engine, wie es in dieser Datei vorgeschrieben ist.
- _Eine unbekannte Adresse bekommt dieselbe Antwort und dieselbe Laufzeit_ —
  dieselbe Antwort und **ein Brief** für beide (das ist das Strukturargument,
  und es ist das belastbare), dazu ein Vergleich der Mediane aus je drei
  Anfragen. Die Toleranz ist absichtlich großzügig: gemessen wird, dass kein Weg
  einen ganzen Schritt auslässt, nicht dass ein Mailserver konstant antwortet.
  **Als Mutation belegt:** lässt man den Brief an die unbekannte Adresse weg,
  wird genau dieser eine Test rot (1 von 9) — und sonst keiner.
- _Ein Token wirkt einmal_ — zweite Benutzung 400, Passwort unverändert; dazu
  im Unit-Test der Fall, den niemand von Hand findet: ein im Profil geändertes
  Passwort entwertet den offenen Link.
- _Ein Zurücksetzen beendet die anderen Sitzungen_ — eine zweite Sitzung wird in
  die Tabelle gesetzt, antwortet vorher 200 auf `/api/participant/me` und
  nachher 401.

**Was anders lief:** der erste vollständige Lauf der Teilnehmersuite hat einen
Test rot gemacht, den dieses Paket nicht angefasst hat — die Zeile nach dem
Stornieren einer Anmeldung. `getByRole('status')` fand **zwei** Live-Regionen:
die Storno-Meldung der Seite und die des Check-In-Plug-ins („kein Check-In-Code
für diese Anmeldung"), das im selben Moment neu zeichnet. Allein wiederholt war
der Test grün, es ist also ein Selektor und kein Produktfehler — an **zwei**
Stellen, denn `my-registration.spec.ts` hatte dieselbe Zeile. Beide filtern
jetzt auf den Satz, den sie meinen. In `docs/rules/e2e-tests.md`.

**Der Stand nach diesem Paket:** `nx run-many -t lint test build` grün,
**1345** Server-Unit-Tests (29 neu), die Vertragssuite um eine Datei und
**9** Tests reicher (**40** Suiten, **704** Tests, genau **drei** 429 im ganzen
Lauf — alle drei von der Drosselungssuite erbeten), die Teilnehmersuite um einen
Browsertest je Engine (**261** grün, EXIT=0). Der
Katalog wächst um **28** Schlüssel auf **1108** (zehn davon Mailtext für die
zwei neuen Briefe, einer die Zeile in der Mail bei wiederholter Registrierung).
`todo.md` verliert den Eintrag, der seit Phase 3 die einzige benannte Sackgasse
war.

### AP 5 — Der Server begründet in der Sprache des Lesers (E64) (erledigt, 15.09.2026)

Umgesetzt:

- **Eine Ablehnung ist ein Katalogschlüssel und seine Werte** (F212). `code` ist
  keine Nummer und keine Abkürzung, sondern **derselbe** Schlüssel, unter dem
  der Katalog den Satz hält (`problem.field.required`), und `params` sind die
  Werte für seine `{{ }}`-Lücken. Damit gibt es nichts dazwischen: kein Präfix,
  das ein Client anhängen müsste, keine Abbildungstabelle, keine zweite Stelle,
  die falsch sein kann. Geworfen wird mit `refuse` (400), `conflict` (409) und
  `tooLarge` (413) aus `business/common/problem.ts` — dieselben Nest-Ausnahmen
  wie vorher, nur ohne Satz darin; durchgereicht wird es von
  `AllExceptionsFilter`, der den Rumpf ohnehin neu schreibt und deshalb die
  einzige Stelle war, die es überhaupt konnte.
- **Die Liste ist geschlossen, und der Build hält die zwei Hälften zusammen.**
  `PROBLEM_CODES` in `shared-models` hat **138** Einträge; ein Code, der nicht
  darin steht, kompiliert nicht, und ein Code darin ohne Satz in **jedem**
  mitgelieferten Katalog lässt `catalogues.spec.ts` scheitern — in beide
  Richtungen, denn ein verwaister `problem.*`-Schlüssel im Katalog ist derselbe
  Fehler von der anderen Seite. `shared-models` ist der Ort, weil der Code ein
  Vertrag zwischen Server und **beiden** Clients ist und der Katalogtest ihn
  lesen muss, ohne eine Anwendung zu importieren; Sätze besitzt die Bibliothek
  weiterhin keine, nur Schlüssel — dieselbe Linie wie `registrationStatusKey`.
- **144 Wurfstellen in 36 Dateien, Modul für Modul** — Feld-Baukasten, Bild,
  Passwortregel, Konfiguration, Modulschalter, Event, Reihe, Programm,
  Programmanmeldung, Anmeldung, Anmeldeformular, Upload, Profil, Profilfragen,
  Chat, Kontakt, Einladung, Newsletter, Selbstbedienung, Übersetzung, Sprache,
  Ersteinrichtung. Kein `describePasswordPolicy()` mehr in einer Ablehnung: die
  Regel steht als `PASSWORD_POLICY` (zwei Zahlen) an einer Stelle, und die
  englische Fassung der Funktion bleibt genau dort, wo sie richtig ist — in der
  Startprüfung von `ADMIN_BOOTSTRAP_PASSWORD`, wo niemand einen Browser liest.
- **Was im Satz steht, wird ein Code; was an seinem Rand steht, ein Wert**
  (F214). „**A logo** may be up to 2 MB" und „**Ein Logo** darf bis zu 2 MB
  groß sein" stellen dasselbe Substantiv an verschiedene Stellen — also drei
  Codes für die drei Bildbereiche statt eines mit dem Substantiv als Wert, zwei
  für den Besitzer eines reservierten Feldschlüssels, je einer für die
  Eventtypen, die einen Ort oder einen Link brauchen, und `.one`/`.many` statt
  eines angehängten Plural-`s` (F81). Ein **Wert** ist, was niemand übersetzen
  darf: eine Beschriftung, die ein Veranstalter geschrieben hat, ein Slug, ein
  Modulschlüssel, eine Zahl, eine Dateigröße. Was eine Einheit braucht, reist
  fertig gesetzt, weil ein Katalogsatz nicht formatieren kann.
- **404, 401 und 403 bekommen ausdrücklich keinen Code** (F213), und das ist
  keine Auslassung, sondern die strukturelle Fassung dessen, was F77 von Hand
  tat: wo kein Code ist, zeigt kein Client mehr einen Grund. Der Satz „No event
  with id …" bleibt in der Logzeile stehen, wo er hingehört, und verschwindet
  von der Oberfläche, auf der er nie etwas erklärt hat. Ebenso bleibt die
  DTO-Prüfung von `class-validator` bei ihren englischen Sätzen — sie reisen als
  Array und standen deshalb noch nie in einer Oberfläche.
- **Beide Clients lösen auf, und der Compiler hat jede Stelle gefunden.**
  `Problem.detail: string | null` heißt jetzt `Problem.reason: Refusal | null`,
  und die Umbenennung war Absicht: hätte das Feld seinen Namen behalten und nur
  seine Bedeutung gewechselt, hätte jede vergessene Stelle stillschweigend einen
  rohen Schlüssel angezeigt. So bricht sie den Build. **46** Stellen in zwei
  Clients zeichnen den Grund jetzt wie ihre eigene Hälfte:
  `reason.code | transloco: reason.params`. `ApiError.explained` ist weg —
  „hat der Server selbst etwas geschrieben" ist seit diesem Paket dieselbe Frage
  wie „gibt es einen Code".
- **Die fünf Seiten mit dem ungesicherten Ladevorgang** — der Anhang, den AP 5
  der Phase 4 angekündigt hatte: Reihe, Startseite, Anmeldung, „meine
  Anmeldung" und, von jener Liste nicht genannt, die Liste „meine Anmeldungen".
  Alle fünf zählen ihre Ladevorgänge (`loadSequence`) und schreiben nach einem
  `await` nur, wenn ihr Lauf noch der jüngste ist; je ein Unit-Test löst die zwei
  Antworten in der falschen Reihenfolge auf. Die Liste war der schlimmste Fall
  und stand in keiner der vier Zeilen: eine späte Antwort hätte ihre Zeilen
  nicht ersetzt, sondern **angehängt**, weil eine zweite Seite denselben Weg
  nimmt.
- **Die Vertragssuite behauptet den Code.** `refusalOf(body)` in
  `support/api-client.ts`, eine neue Datei `problem-codes.spec.ts` für die
  Gestalt selbst (400 mit Code, Werte, 409 mit Code, vier Ablehnungen aus vier
  Modulen gegen die geschlossene Liste geprüft, und ein 404 **ohne** Code), und
  acht bestehende Suiten, die von einem englischen Satzfragment auf den Code
  umgestellt sind. Das ist das zweite Argument für Codes, jetzt belegt: `/1 of
the selected addresses/` prüfte eine Formulierung, `{ code, params: { count:
1 } }` prüft die Aussage.

**Fertig, wenn** — Punkt für Punkt:

| Kriterium                                                     | Beleg                                                                                                                                                                                                |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ein deutscher Browser bekommt einen deutschen Grund           | `registration.spec.ts`: Sprache auf `de`, Bestätigung mit kaputtem Token, und im Alert steht **beides** deutsch — der Satz des Clients und der Grund des Servers; der englische kommt nicht mehr vor |
| die API-Vertragssuite prüft einen stabilen Code               | `problem-codes.spec.ts` plus acht umgestellte Suiten; `41` Suiten, `709` Tests, EXIT=0                                                                                                               |
| kein englischer Satz der Geschäftsschicht in einer Oberfläche | strukturell: die Geschäftsschicht hält keinen Satz mehr (144 Wurfstellen), und ohne Code zeichnet kein Client einen Grund; `expectNoRawKeys` auf der deutschen Seite dazu                            |
| ein Sprachwechsel verwirft die späte Antwort                  | fünf Unit-Tests, je einer je Seite, die die zwei Antworten in der falschen Reihenfolge auflösen                                                                                                      |

**Was anders lief:** die Veranstaltersuite war im ersten vollständigen Lauf mit
**elf** roten Tests rot, alle in Firefox, alle mit `ECONNREFUSED 127.0.0.1:3000`
— und keiner davon ein Produktfehler. `serve-e2e` ist ein Watcher, und während
der Lauf lief, sind drei Docstrings in Serverdateien korrigiert worden; jede
Korrektur hat einen Neubau und einen Neustart ausgelöst, und der Server war
genau in den Sekunden weg, in denen Firefox dran war. Die Regel dazu steht seit
Phase 3 in `docs/rules/tooling-traps.md` und ist hier zum zweiten Mal
bestätigt: **während eines Browserlaufs wird keine Serverdatei gespeichert.**
Der saubere Wiederholungslauf: **317** grün, EXIT=0.

**Der Stand nach diesem Paket:** `nx run-many -t lint test build` grün über 19
Projekte; **1355** Server-Unit-Tests (zehn neu — der Ablehnungsbauer und der
Ausnahmefilter, der bis heute keinen eigenen Test hatte), **263** im
Nutzer-Client (fünf neu: je ein Rennen je Seite), **222** im Veranstalter-Client,
**113** in `shared-models`, **49** in `shared-i18n`, **32** in `shared-http`.
Vertragssuite **41** Suiten und **709** Tests (eine Datei und fünf Tests neu,
acht Suiten von Satzfragmenten auf Codes umgestellt), genau **drei** 429 im
ganzen Lauf — alle drei von der Drosselungssuite erbeten. Browsersuiten
**264** (drei neu: die deutsche Begründung je Engine) und **317**, beide
EXIT=0. `tools/shipped-stack/verify.sh` auf `STACK_PORT=8099` erneut gefahren,
weil der Katalog im Image liegt: sieben Browsertests, alles grün, keine
Container übrig. Der Katalog wächst um **138** Schlüssel auf **1246** — der
größte Sprung der Projektgeschichte, und jeder einzelne ist ein Satz, den vorher
niemand außerhalb des Codes ändern konnte. `todo.md` verliert den ältesten
offenen Eintrag der Anwendung (seit AP 8 der Phase 2) und schließt die vier
Seiten, die AP 5 der Phase 4 angekündigt hatte.

### AP 6 — Löschen: was geht, was bleibt, und was keinen Namen mehr trägt (E65) (erledigt, 18.09.2026) → **Meilenstein M14**

Zwei Funktionen, die in jeder Beschreibung fünf sind — Auskunft, Export,
Löschung, Anonymisierung, Aufbewahrung —, und die hier **eine** Frage
beantworten: was hält diese Instanz über einen Menschen? Der Export beantwortet
sie von vorn, die Löschung von hinten, und beide müssen dieselbe Antwort geben.
Genau deshalb teilen sie sich **einen** Port mit **einer** Implementierung:
`ParticipantDataRepository` mit `collect` und `erase`, und in dieser einen Datei
ist jede Tabelle genannt, die einen Menschen kennt. Eine Tabelle, die der Export
vergisst, vergisst auch die Löschung — und beides sieht von außen gleich aus,
nämlich nach nichts.

**Drei Wege, wie eine Zeile auf einen Menschen zeigt, und jeder wird anders
gelesen.** (1) Ein **Fremdschlüssel auf `user_profile`**: `user_session`,
`push_subscription` und in den Plug-ins `plugin_forum_post`,
`plugin_forum_thread`, `plugin_program_proposals_proposal`,
`plugin_personal_program_entry`. Ein `DELETE` der Profilzeile erledigt alle
sechs, und jede dieser Tabellen entscheidet **selbst**, was das für sie heißt.
(2) Die **Adresse**, die die Identität ist (E31): `registration` und
`newsletter_subscription`, ohne Fremdschlüssel gefunden und mit `lower()`
verglichen wie jede andere Adresssuche; das Löschen einer Anmeldung kaskadiert
weiter in `attachment`, `program_item_signup`, `invitation_recipient` und
`plugin_qr_checkin_ticket`. (3) Eine **Spalte ganz ohne Fremdschlüssel** —
`conversation_member.member_id` und `message.sender_id`, die eine bewusste Lücke
des Schemas (E39). Für die gibt es kein Automatikverhalten, und sie werden in
**entgegengesetzte** Richtungen behandelt: die Mitgliedschaft geht, denn sie
sagt „dieser Mensch ist in diesem Gespräch"; die Nachricht bleibt, denn die
Gegenseite hat sie gelesen.

**Die drei Kategorien aus dem Titel, und die Grenze zwischen ihnen ist, wer
etwas geschrieben hat** (F215). **Weg** ist, was einem Menschen allein gehört —
Konto, Sitzungen, Push-Anmeldungen, Mitgliedschaften, Newsletter-Einwilligungen,
Anmeldungen samt hochgeladener Dateien, Beiträge, Vorschläge, der persönliche
Programmplan, das Profilbild. **Stehen** bleiben die Gespräche mit allem, was
darin steht, und die Forum-Themen: beides sind Behälter für die Worte anderer,
und ein Gespräch, dem die Hälfte fehlt, ist eine Fälschung dessen, was die
Gegenseite gelesen hat (E14, E40). **Keinen Namen** tragen danach genau diese:
`message.sender_id` zeigt ins Leere, `plugin_forum_thread.created_by` ist
`NULL`, und die Clients zeichnen dafür einen Satz statt eines erfundenen Namens.

**Die Anmeldungen werden gelöscht und nicht anonymisiert** — die eine
Entscheidung, bei der das Paket von seinem eigenen Titel abweicht, und sie ist
begründet: „eine einzelne Anmeldung ist immer löschbar (DSGVO-Vorarbeit)" steht
seit Phase 1 im Datenmodell, eine anonymisierte Zeile hätte eine neue Spalte,
einen eindeutigen Platzhalter in einer eindeutigen Adresse und eine
Sonderdarstellung in zwei Clients gebraucht, und E14 schützt einen Veranstalter
davor, eine Reihe mit Anmeldungen wegzuwerfen — nicht eine Kopfzahl davor, dass
ein Mensch geht. Wer eine bevorstehende Teilnahme absagen will, storniert sie
vorher; eine Löschung sagt nichts darüber, ob jemand kommt, und der Bildschirm
sagt das auch so.

**Die Löschung nennt keine einzige Plug-in-Tabelle** (F217), und das ist F21
rückwärts gelesen: ein Plug-in darf auf eine Kerntabelle zeigen, weil das das
Plug-in bindet und nicht den Kern — also sagt genau dieser Fremdschlüssel, was
ein gelöschtes Konto für seine Zeilen bedeutet. Aufgezählt und je Tabelle
begründet: Beiträge und Vorschläge kaskadieren, weil ein Beitrag von Natur aus
zugeschrieben ist (E58); der persönliche Plan kaskadiert, weil er niemandem
sonst gehört; die Eintrittskarte hängt an der Anmeldung; Räume und
Raumzuordnungen kennen keinen Menschen; `decided_by` und `checked_in_by` zeigen
auf `admin_user` und sind ohnehin `SET NULL`. Genau **eine** Zeile war falsch —
`plugin_forum_thread.created_by` kaskadierte, und ein Thread ist der Behälter
für die Beiträge anderer. Er wird nullbar mit `SET NULL`, in **einer Migration
des Plug-ins**: eine Kernmigration an dieser Tabelle wäre das Spiegelbild
dessen, was F21 verbietet. Die Nutzlast musste nicht angefasst werden — der
`author` eines Threads ist seit F195 nullbar, weil ein Thread aus seinen
Beiträgen gezeichnet wird.

**Der Export ist ein Archiv, und darin stehen Daten und Sätze getrennt** (F216).
`GET /api/participant/me/export` antwortet mit einem ZIP: `export.json` mit
englischen Feldnamen und ISO-Zeitstempeln, weil ein Export auch von einem
Programm gelesen werden können muss und ein JSON, dessen Schlüssel mit der
Sprache wechseln, das nicht kann; `README.txt` mit **jedem** Satz, in der
Sprache des Kontos und aus dem Katalog (E22, E64); daneben die hochgeladenen
Dateien unter ihren eigenen Namen, jede auch in der JSON benannt, und eine
Datei, deren Bytes das Volume nicht mehr hält, steht dort mit `null` statt zu
verschwinden. Das ZIP ist von Hand geschrieben, ohne Abhängigkeit und ohne
Kompression: was darin liegt, ist JPEG, PNG oder PDF und damit schon
komprimiert, und was von einer ZIP-Bibliothek ohne Kompression und ohne
Streaming übrig bleibt, ist genau das Byte-Layout in `zip-archive.ts`. Beide
Prüfungen lesen es mit einem **fremden** Leser zurück — ein Test, der
zurückliest, was dieses Modul geschrieben hat, bestätigt einen Fehler, statt ihn
zu finden.

**Was der Export ausdrücklich nicht enthält**, und die README sagt alle drei
Punkte, statt sie wegzulassen: Zugangsdaten (Sitzungs-Token, Push-Schlüssel —
damit wird ein Gerät angesprochen, nicht ein Mensch beschrieben);
Kontaktanfragen ohne Konto, weil nichts die Adresse belegt hat und sie
zusammenzufassen hieße zu behaupten, zwei Fremde seien einer (F133); und was die
Plug-ins speichern. Der letzte Punkt ist die einzige Lücke dieses Pakets und
steht als eigener Eintrag in `todo.md`: dafür bräuchte der Vertrag einen Port,
ein Port ist ein Vertragsschritt, und den macht AP 11 zum letzten Mal. Die
**Löschung** braucht ihn nicht — dort sagt jeder Fremdschlüssel schon, was
gemeint ist.

**Die Löschung wird mit dem Passwort autorisiert** (F218), im Kontenmodul
geprüft und nirgends sonst, weil ein gespeicherter Hash dieses Modul nicht
verlassen darf. Kein Bestätigungsbrief — er ginge an eine Adresse, die gleich
aufhört zu existieren —, keine Karenzzeit — das wäre eine Kopie nach der Bitte,
sie zu löschen — und kein abzutippendes Wort. Ein Gespräch, in dem **beide**
Seiten gelöscht haben, wird ganz entfernt: was übrig bliebe, wären die
Nachrichten zweier Menschen hinter einer Zeile, die niemand mehr öffnen kann.

**Fertig, wenn** — Punkt für Punkt:

| Kriterium                                                        | Beleg                                                                                                                                                                                                                   |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ein Mensch bekommt seinen Export, und nichts fehlt darin         | `privacy.spec.ts`: Archiv entpackt mit Pythons `zipfile`, darin Konto, Anmeldung über die Adressgleichheit, **beide** Hälften des Gesprächs, die Sitzungen — und das hochgeladene Bild als Datei; kein Token, kein Hash |
| sein Konto ist löschbar                                          | `DELETE /api/participant/me` mit Passwort → 204; Profil, Sitzungen, Anmeldungen, Mitgliedschaften weg, die nächste Anfrage 401; ein falsches Passwort ändert nichts (401)                                               |
| ein Gespräch ist danach lesbar und benennt niemanden             | die Gegenseite liest beide Nachrichten weiter, `counterparts` ist leer, `message`-Zeilen stehen; im Client `chat.deletedAccount` statt eines Namens (zwei Unit-Tests)                                                   |
| ein Thread mit gelöschtem Eröffner bleibt samt fremder Antworten | `threadOpener(threadId)` ist `NULL`, `thread.author` ist `null`, und die freigegebene Antwort des anderen ist weiter lesbar                                                                                             |
| nichts davon fasst eine Plug-in-Tabelle an                       | strukturell: die Löschung schreibt vier Anweisungen, keine nennt eine Plug-in-Tabelle. Beleg ist die Folge — der Thread steht mit leerem Eröffner, was nur sein eigener Fremdschlüssel bewirkt haben kann               |

**Was anders lief:** der Trick mit den zwei Elementen. TypeORMs
PostgreSQL-Treiber antwortet auf ein `DELETE` mit `[rows, rowCount]` statt mit
den Zeilen — **auch mit `RETURNING`** —, und der Eintrag dazu stand seit Phase 3
in `docs/rules/tooling-traps.md`, nur für `UPDATE`. Die Folge war still und
sichtbar zugleich: die Logzeile einer Löschung meldete dreimal „2" (zweimal
falsch), und die Aufräumbedingung für ein Gespräch, in dem niemand mehr ist,
bekam zwei `undefined` statt zweier Ids und lief nie. Gefunden wurde es nicht
von einem Test, sondern beim Lesen der Logzeile im Browserlauf — die Zahl
„2, 2, 2" passte zu keinem Konto. Der Test, der es gefunden **hätte**, gibt es
jetzt: beide Seiten eines Gesprächs löschen ihr Konto, und danach ist die Zeile
weg. Dafür bekam `seedProfile` in der Vertragssuite ein optionales Passwort mit
echtem Argon2-Hash — ein Konto, das sich selbst löschen kann, ohne eine der
zwanzig Anmeldungen je fünf Minuten auszugeben (E4). Die Regel in
`tooling-traps.md` ist um `DELETE` und um `RETURNING` ergänzt.

Dazu eine kleinere Fundsache: das `unzip` von Debian ist ohne
`UNICODE_SUPPORT` gebaut und schreibt einen UTF-8-Dateinamen unter einem
anderen Namen auf die Platte, obwohl das Archiv korrekt ist. Beide
Archiv-Prüfungen nehmen deshalb Pythons `zipfile`, das das Flag ehrt und
nebenbei jede CRC prüft.

**Der Stand nach diesem Paket:** `nx run-many -t lint test build
--skip-nx-cache` grün über 19 Projekte; **1375** Server-Unit-Tests (zwanzig
neu: der Archivschreiber gegen einen fremden Leser, das Layout des Archivs, der
Dienst und die zwei Wege durch das Löschen), **270** im Nutzer-Client (sieben
neu: die Komponente und zweimal der gelöschte Gegenüber im Chat), **222** im
Veranstalter-Client — dort war nichts zu ändern, weil seine Gesprächsansicht
schon vorher niemanden benannte, den sie nicht findet —, **113** in
`shared-models`, **49** in `shared-i18n`, **32** in `shared-http`. Vertragssuite
**42** Suiten und **718** Tests (eine Datei und neun Tests neu), genau **drei**
429 im ganzen Lauf, alle drei von der Drosselungssuite erbeten. Browsersuiten
**264** und **317**, beide EXIT=0 — die Teilnehmersuite fährt den Export und die
Löschung am Ende des Passwort-vergessen-Tests, weil dessen Konto ohnehin für
diesen Test existiert und eine eigene Datei drei weitere Anmeldungen gekostet
hätte. `tools/shipped-stack/verify.sh` auf `STACK_PORT=8099` (8080 hält ein
anderes Projekt): „the shipped stack is good", sieben Browsertests, 137 s, keine
Container übrig — und damit ist die Plug-in-Migration einmal aus **leerem
Volume** gelaufen. Zusätzlich sind `down` und `up` der Migration einzeln gegen
die Entwicklungsdatenbank ausgeführt worden, und die Spalte hat beide Male ihre
Gestalt gewechselt (`is_nullable` und `confdeltype` gelesen). Der Katalog wächst
um **24** Schlüssel auf **1270**.

### AP 7 — Die Mockups gegen den Bau: der Nutzer-Client wird mobile-first (E66, E67, E68) (erledigt, 21.09.2026)

Das Paket, das prüft **und** behebt — und dessen Größe beim Start nicht bekannt
war. Sie ist es jetzt: **zwanzig Seiten** in der Bestandsaufnahme (der Plan
zählte sechzehn; gezählt wurden damals Verzeichnisse, und seither sind die zwei
Passwortseiten aus AP 4 dazugekommen), **drei benannte Struktur-Abweichungen**
behoben, **eine vierte** gefunden und behoben, die niemand vermutet hatte, und
ein eigenes Playwright-Projekt bei 390 Pixeln, das beides bewacht.

#### Erst die Bestandsaufnahme

Gemessen wurde nicht mit dem Auge, sondern im Browser: eine Wegwerf-Suite fuhr
jede Seite bei **390, 768 und 1280** CSS-Pixeln an und protokollierte je Seite
drei Zahlen — die Breite des Dokuments gegen die des Fensters, jedes
Bedienelement unter 44 Pixeln Höhe und jedes Paar von Bedienelementen, das sich
überlappt. Dazu ein Bildschirmfoto je Seite bei 390, gegen die vier Bögen
gehalten. Die Suite ist wieder weg; ihr Ergebnis ist die Tabelle unten und die
Liste der Behebungen.

Zwei Befunde der Messung waren es wert, die ganze Mühe zu machen:

- **Nichts scrollt seitwärts, auf keiner Seite und in keiner Breite.** Das war
  die Frage, mit der die Messung angefangen hat, und die Antwort war die
  langweilige — gut zu wissen und nicht der Rede wert, wenn man sie hat.
- **Die Suchfelder der Teilnehmersuche hatten überhaupt keinen Rahmen.** Nicht
  einen zu blassen: gar keinen. `border: 1px solid var(--trefaro-color-border)`
  stand da, und `--trefaro-color-border` hat **nie jemand gesetzt** — ein
  `var()` ohne Fallback macht nicht die Farbe ungültig, sondern die ganze
  Deklaration, und `border-style` fällt auf `none` zurück. Dasselbe traf
  `--trefaro-radius-sm`/`-md` und damit die Kartenzeilen der eigenen
  Anmeldungen und der Nachrichten. Auf einem Bildschirmfoto ist ein Feld ohne
  Rahmen nicht zu übersehen; in keiner Testsuite dieses Repositories ist es
  vorgekommen (F222).

#### Die Tabelle

| Seite (Datei unter `apps/user-client/src/app/`)                                   | Im Mockup                                         | Befund                                                                                                                                                                      | Entscheidung                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------------------------------------------------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hülle: Kopfzeile und Navigation (`app.html`, `features/navigation/nav-drawer.ts`) | _Navigationsleiste_                               | Leiste am unteren Rand, ab 48rem statisch oben; kein Bild, kein Name, keine Adresse; nichts angeheftet                                                                      | **abgedriftet → behoben**: eingeschobene Lade mit Hamburger, Bild/Name/Adresse oben, Einträgen mit Icon und Chevron, angehefteter Fußzeile. **Bewusst anders**: kein Eintrag „Einstellungen" (dieser Bau hat keine zweite Seite dafür — unten steht die Sitzung); der Sprachumschalter bleibt in der Kopfzeile; kein Eintrag für das gerade gelesene Event                                                                                                                                                      |
| `pages/start/start-page.ts`                                                       | _Startseite Teilnehmersicht_                      | Liste der Reihen mit Bild, Name, Beschreibung — wie gezeichnet; Ziele unter 44 px                                                                                           | **abgedriftet → behoben**: Zielgrößen. **Bewusst anders**: kein Hero-Band mit dem Organisationsnamen (den trägt die Kopfzeile auf jeder Seite, ein Band daneben nennte ihn zweimal); kein „More…"-Link — die ganze Zeile ist der Link und damit ein größeres Ziel                                                                                                                                                                                                                                               |
| `pages/series-detail/series-detail-page.ts`                                       | —                                                 | Kopf, Beschreibung, kommende und vergangene Events als Zeilen                                                                                                               | **im Mockup nicht vorgesehen**: der Bogen springt von der Liste zur Event-Seite. Folgt den Regeln der Bögen (dieselben Zeilen wie die Startseite)                                                                                                                                                                                                                                                                                                                                                               |
| `pages/event-landing/event-landing-page.ts`                                       | _Event Landingpage_ **und** _Event Detailansicht_ | Kacheln in einem `auto-fit`-Raster; Anmeldeknopf **hinter** dem ganzen Programm; Programm ohne Zeitmarken (die Uhrzeit stand unter 30rem über dem Punkt); Ziele unter 44 px | **abgedriftet → behoben**: gestapelte Zeilen mit Icon und Chevron, Anmeldeknopf über dem Programm, Zeitmarken als Plakette an einer Schiene, Zielgrößen. **Bewusst anders**: **eine** Seite statt zweier Bildschirme — die Kacheln sind Sprungmarken in dieselbe Seite (F47), also gibt es nichts, wohin ein zweiter Bildschirm führen könnte; „Informationen" steht vor der Beschreibung, weil „wann und wo" die Frage des ersten Bildschirms ist und eine Beschreibung unbekannter Länge sie sonst wegschiebt |
| `pages/event-landing/event-contact-form.ts`                                       | _Veranstalter kontaktieren_                       | Aufklappbares Formular am Fuß der Event-Seite; Thema als Freitext-Betreff statt Auswahl; Auslöseknopf 30 px hoch                                                            | **abgedriftet → behoben**: Zielgröße. **Bewusst anders**: kein eigener Bildschirm (die Anfrage gehört zu dem Event, das man gerade liest, und ohne Konto gibt es keinen Weg zurück zu einer eigenen Seite); das „Thema" ist ein Betreff, weil eine Auswahlliste eine Konfiguration wäre, die keine Organisation gepflegt hat                                                                                                                                                                                    |
| `pages/event-registration/event-registration-page.ts`                             | _Registrierung für ein Event_                     | Beschriftung über dem Feld, Pflichtstern, Häkchen für den Newsletter, Absenden am Ende — wie gezeichnet; Kästchen 18 px, Dateifeld 21 px, Felder 43 px                      | **abgedriftet → behoben**: Zielgrößen. **Bewusst anders**: die Überschrift ist „Registrierung", der Eventname steht als eigene Zeile darunter (mit dem Datum) statt in der Überschrift                                                                                                                                                                                                                                                                                                                          |
| `pages/registration-confirm/registration-confirm-page.ts`                         | —                                                 | Eine Meldung und ein Weg weiter                                                                                                                                             | **im Mockup nicht vorgesehen** (die Seite eines Mail-Links)                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `pages/my-registration/my-registration-page.ts`                                   | _Programmplan_ (zur Hälfte)                       | Programmpunkte mit Anmeldeknopf — wie gezeichnet; Uhrzeit ohne Marke; Knöpfe 34 px                                                                                          | **abgedriftet → behoben**: dieselbe Zeitleiste wie auf der Event-Seite, Zielgrößen. Die eigene Anmeldung ist an der gefüllten Marke zu erkennen statt an einem Rand                                                                                                                                                                                                                                                                                                                                             |
| `pages/my-registrations/my-registrations-page.ts`                                 | —                                                 | Liste der eigenen Anmeldungen                                                                                                                                               | **im Mockup nicht vorgesehen** (2024 gab es keinen Teilnehmer-Login)                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `pages/newsletter-confirm/newsletter-confirm-page.ts`                             | —                                                 | Eine Meldung                                                                                                                                                                | **im Mockup nicht vorgesehen**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `pages/invitation-opt-out/invitation-opt-out-page.ts`                             | —                                                 | Eine Meldung und ein Knopf                                                                                                                                                  | **im Mockup nicht vorgesehen**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `pages/profile/profile-page.ts`                                                   | _Profil bearbeiten_                               | Bild oben, Felder, Sprache, Weg zu den eigenen Anmeldungen — wie gezeichnet; Datenknöpfe 30 px, Dateifeld 13 px                                                             | **abgedriftet → behoben**: Zielgrößen. **Bewusst anders**: gespeichert wird mit einem Knopf unter dem Formular statt mit einem Disketten-Icon in der Kopfzeile (ein Formular wird von seinem Absenden gespeichert, und ein seitenspezifisches Bedienelement in der Hülle wäre eine zweite Wahrheit darüber, was die Hülle ist); „Meine Event Registrierungen" ist ein Eintrag der Lade statt eines Knopfes auf dieser Seite                                                                                     |
| `pages/profile-register/profile-register-page.ts`                                 | —                                                 | Formular                                                                                                                                                                    | **im Mockup nicht vorgesehen**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `pages/profile-confirm/profile-confirm-page.ts`                                   | —                                                 | Eine Meldung                                                                                                                                                                | **im Mockup nicht vorgesehen**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `pages/profile-login/profile-login-page.ts`                                       | —                                                 | Formular                                                                                                                                                                    | **im Mockup nicht vorgesehen**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `pages/profile-forgot-password/profile-forgot-password-page.ts`                   | —                                                 | Formular                                                                                                                                                                    | **im Mockup nicht vorgesehen** (AP 4 dieser Phase)                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `pages/profile-new-password/profile-new-password-page.ts`                         | —                                                 | Formular                                                                                                                                                                    | **im Mockup nicht vorgesehen** (AP 4 dieser Phase)                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `pages/people/people-page.ts`                                                     | _Teilnehmersuche_                                 | Zwei Suchfelder mit Knopf und Kartenzeilen mit Bild; **die Suchfelder hatten überhaupt keinen Rahmen**                                                                      | **abgedriftet → behoben**: die fehlenden Design-Token (siehe unten) und die Zielgrößen. **Bewusst anders**: zwei Felder und ein Knopf statt eines Feldes mit Lupe (FR 4.4 filtert auch über Tätigkeitsbereiche, und eine Suche bei jedem Tastenanschlag ist eine Anfrage bei jedem Tastenanschlag gegen einen gedrosselten Endpunkt, E4); Bild und Tätigkeitsbereich in der Zeile (das Profil von 2026 hat beides, der Bogen von 2024 kannte es nicht); „Vorname Nachname" statt „Nachname, Vorname"            |
| `pages/people/person-page.ts`                                                     | —                                                 | Fremdes Profil                                                                                                                                                              | **im Mockup nicht vorgesehen**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `pages/messages/messages-page.ts`                                                 | —                                                 | Gesprächsliste                                                                                                                                                              | **im Mockup nicht vorgesehen** (die Lade zeigt „Meine Nachrichten", der Bildschirm dahinter ist nicht gezeichnet)                                                                                                                                                                                                                                                                                                                                                                                               |
| `pages/messages/conversation-page.ts`                                             | —                                                 | Gespräch mit Verfassen-Feld                                                                                                                                                 | **im Mockup nicht vorgesehen**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `pages/spike-console/spike-console-page.ts`                                       | —                                                 | Werkzeugseite aus Phase 0                                                                                                                                                   | **im Mockup nicht vorgesehen** und keine Teilnehmerseite; unangetastet                                                                                                                                                                                                                                                                                                                                                                                                                                          |

#### Dann die Behebung

**Die Navigationsleiste ist die eingeschobene Lade geworden**
(`features/navigation/nav-drawer.ts`, acht Unit-Tests). Ein Hamburger links in
der Kopfzeile, darüber die Lade mit Bild, Name und Adresse oben, den Orten als
Zeilen mit Icon und Chevron, dem Einhängepunkt der Plug-ins und einer
angehefteten Fußzeile. Escape schließt, der Fokus geht in die Lade und kommt
zurück, Tab bleibt drin. **Bei jeder Breite dieselbe Lade** — die alte Regel
stellte die Leiste ab 48rem statisch, und zwei Darstellungen einer Navigation
sind zwei Dinge, die auseinanderlaufen; NFR 6 verlangt „auf dem Desktop
benutzbar", nicht einen zweiten Entwurf. Was die Leiste sonst wusste, weiß
jetzt die Lade: welche Einträge eine Instanz überhaupt hat (E42, F53) und dass
Abmelden ein Knopf ist und kein Link.

**Was unten angeheftet ist, ist die Sitzung und nicht „Einstellungen".** Der
Bogen heftet dort einen Eintrag mit Zahnrad an. Dieser Bau hat keine zweite
Seite dafür: die Sprache steht in der Kopfzeile, und alles andere, was ein
Konto einstellen kann — Benachrichtigungen, Auffindbarkeit, Passwort, Export —
steht auf der Profilseite, die schon eine eigene Zeile hat. Ein zweiter Weg zur
selben Seite wäre genau die Drift, die dieses Paket wegräumt. Also trägt der
angeheftete Platz das, was kein Ort ist: abmelden, oder anmelden.

**Die Event-Detailkacheln sind gestapelte Zeilen geworden.** `auto-fit,
minmax(11rem, 1fr)` setzte bei 390 Pixeln zwei schmale Spalten nebeneinander
und schnitt die Beschriftungen ab; der Bogen zeichnet Zeilen über die volle
Breite mit dem Glyph links. Jetzt auch mit Chevron rechts — dieselbe Zusage wie
in der Lade: diese Zeile führt woandershin.

**Die Programm-Zeitleiste hat ihre Zeitmarken.** Die Uhrzeit stand unter 30rem
**über** dem Programmpunkt, also auf jedem Telefon — die Zeitleiste hatte dort
gar keine Spalte. Jetzt steht die Zeit in beiden Bögen wie gezeichnet: als
Plakette in einer eigenen Spalte, mit einer Schiene, die von einer Marke zur
nächsten läuft. Auf der Event-Seite und auf „meine Anmeldung", denn das ist der
Bildschirm, den der Bogen _Programmplan_ zeigt — der mit den Anmeldeknöpfen.
Wer dort einen Platz hat, erkennt es an der gefüllten Marke.

**Der Anmeldeknopf steht über dem Programm.** Im Bogen sitzt er im Kopf der
Landingpage; im Bau stand er hinter der ganzen Zeitleiste, also auf einem
Telefon mehrere Bildschirme weiter unten — das Letzte, was jemand findet, der
sich längst entschieden hat.

**Jedes Ziel ist 44 Pixel hoch** (F221). Gemessen worden waren: Textfelder 43,
der Anmeldeknopf 43, die Knöpfe des Datenexports 30, der Auslöser des
Kontaktformulars 30, ein Dateifeld 21, ein Kästchen 18, der Sprachumschalter 28. Behoben mit **einer** Regel in `apps/user-client/src/styles.scss` statt mit
einer Zeile in neunzehn Bauteilen; ausgenommen sind Kästchen (die ihr Ziel vom
Label um sie herum bekommen) und Links mitten im Text (die Text sind). Der
Sprachumschalter hat seine Mindesthöhe selbst bekommen, weil er in beiden
Clients steht.

**Der Sprachumschalter wird kompakt** (`compact`, ein `input()` wie bei F182).
Die Kopfzeile trägt bei 390 Pixeln jetzt Hamburger, Logo, Organisationsnamen
und ihn; das geschriebene Wort „Sprache" ist das, was dabei weichen muss — und
nur das Wort: der zugängliche Name zieht auf `aria-label` um. In der
Seitenleiste des Veranstalters bleibt er, wie er war.

**Die fehlenden Design-Token sind da** — `--trefaro-color-border`,
`--trefaro-color-surface`, `--trefaro-radius-sm` und `--trefaro-radius-md`
werden jetzt von `deriveThemeVariables()` mit ausgeliefert, also auch an die
Plug-ins. Die Randfarbe ist **nicht** aus der Marke abgeleitet, sondern das
hellste Grau, das gegen die Seite noch 3:1 erreicht (WCAG 2.2 SC 1.4.11): eine
blasse Markenfarbe ließe das Feld genau dort verschwinden, wo die Regel zählt.
Ein Unit-Test verlangt beides — dass die Eigenschaften existieren und dass der
Kontrast reicht.

**Zehn Glyphen sind dazugekommen** (`menu`, `close`, `home`,
`event_available`, `group`, `mail`, `person`, `chevron_right`, `login`,
`logout`), aus derselben Quelle und nach derselben Regel wie die sieben davor
(E49): Name in `shared-models`, Pfad in `shared-theming`, keiner ohne den
anderen.

**5. Und der Punkt, den `todo.md` diesem Paket zugewiesen hatte.** Zwei
Eigenschaften nannte nur der Veranstalter-Client, jede mit einem festen
Rückfall dahinter — was die Seite richtig hält und die Frage verdeckt (F222).
Die Antwort war einmal so und einmal so: `--trefaro-color-surface-muted` wird
jetzt ausgeliefert, und mit ihr eine dritte, die der Eintrag nicht nannte
(`--trefaro-color-text-muted`, fünfmal in den Übersetzungseditoren); beide sind
neutral, und ein Test hält fest, dass die leisere Schrift auf der Seite **und**
auf der leiseren Fläche 4,5:1 erreicht. `--trefaro-color-surface-accent` ist
dagegen **weg**: eine gewählte Zeile in der Einladungsliste ist akzentgetönt,
und `--trefaro-color-accent-soft` ist genau das und wird seit jeher
ausgeliefert. Eine erfundene Eigenschaft weniger, und die gewählte Zeile trägt
jetzt die Farbe der Organisation.

#### Und dann der Wächter

`apps/user-client-e2e/src/design.spec.ts`, zwei Tests, ein eigenes
Playwright-Projekt `phone` bei **390 × 844** auf WebKit. Die drei
Desktop-Projekte laufen mit `grepInvert: /@design/`, das Telefonprojekt mit
`grep: /@design/` — die markierte kleine Auswahl aus E68, und sie **registriert
niemanden**: sechs Seiten werden gelesen, die eine Sitzung ist geseedet (F164),
und das Anmeldebudget bleibt unangetastet.

Was er prüft, ist die Gestalt und nicht das Wort: nichts steht seitlich heraus,
kein Bedienelement liegt auf einem anderen, jedes Ziel ist 44 Pixel hoch, und
die Lade öffnet, nennt den Menschen, lässt eine Handbreit Seite daneben stehen,
schließt auf Escape und gibt den Fokus zurück. Elemente eines Plug-ins sind
ausgenommen — ein Bündel bringt sein eigenes CSS mit, und dieser Test darf
nicht rot werden, weil eine fremde Suite gerade ein Plug-in eingeschaltet hat.

**Zweimal Gegenprobe gefahren**, und beide Male rot an genau der Stelle, die
sie prüfen sollte:

- Mit **zurückgedrehter 44-Pixel-Regel** in `styles.scss` fällt der Seitengang
  mit `33px button[submit] "Send message" is under 44px` — der Auslöser des
  Kontaktformulars, der seine Höhe von nichts anderem bekommt.
- Mit **weggenommenem `color`** an der Lade fällt der Ladentest mit sieben
  Befunden, alle bei `(1:1)`: „Pia Phone", „Event series", „My registrations",
  „Find participants", „Messages", „Your profile", „Sign out" — also genau der
  Fehler, den dieses Paket selbst gebaut hatte und den ein Bildschirmfoto
  gefunden hat, bevor es die Prüfung gab.

Beide Male blieb der jeweils andere Test grün, und die drei Desktop-Projekte
sehen diese Tests gar nicht.

#### Was anders lief

- **Ein Backtick in einem Kommentar beendet auch einen `styles`-Block.** Die
  Regel kannte das Repository für Template-Kommentare; hier stand
  `` `styles.scss` `` in einem CSS-Kommentar, und der Compiler meldete „Failed
  to resolve @Component.styles to a string or an array of strings" — eine
  Meldung, die nach einem kaputten Dekorator klingt und nicht nach einem
  Satzzeichen.
- **Ein Glyph fängt nicht immer mit `M` an.** `close` beginnt mit einem
  relativen `m`, und der Test, der jeden Pfad auf „fängt mit M an" prüfte,
  wurde davon rot. Geändert wurde der Test, nicht die Daten: die Icons werden
  unverändert übernommen, und das ist die Zusage, die in ihrer README steht.
- **Die Messung fand die Profilseite dreimal.** Die Wegwerf-Suite fuhr mit
  einer geseedeten Sitzung, und `/profile/login`, `/profile/register` und
  `/profile/forgot-password` liegen hinter dem Anonym-Guard — sie leiten dann
  auf `/profile` um, und der Bericht zeigte dreimal dieselbe Seite. Ein zweiter
  Durchgang ohne Sitzung hat die drei nachgeholt. Dieselbe Klasse wie „nicht
  sichtbar ist auf einer leeren Seite auch wahr": eine Messung, die nicht
  prüft, **wo** sie steht, misst etwas anderes.
- **Der erste Überlappungsbefund war keiner.** Die Messung meldete auf jeder
  Seite Überschneidungen zwischen Seiteninhalt und der festen unteren Leiste —
  richtig gerechnet und falsch gedeutet: Inhalt, der unter einer festen Leiste
  durchscrollt, überschneidet sie immer. Mit der Lade ist die Leiste weg und
  die Frage damit auch; für den Wächter bleibt die Regel stehen, weil sie ohne
  feste Leiste wieder etwas aussagt.

**Die Richtlinie zerbrach die zwei Seiten, und der Test sagte es.** Der erste
Stack-Lauf mit der neuen CSP meldete in beiden Clients „Executing inline event
handler violates … `script-src 'self'`" — und der Handler war keiner aus
diesem Repository: Angulars Produktionsbuild schiebt das Stylesheet auf und
schreibt dafür `<link rel="stylesheet" media="print" onload="this.media='all'">`
in `index.html`. Ohne den Handler bleibt das Blatt `media="print"`, und die
Seite rendert mit dem eingebetteten Bruchstück allein. Abgeschaltet wird
deshalb das Aufschieben (`optimization.styles.inlineCritical: false` in beiden
`project.json`, mit der Begründung daneben) und **nicht** die Richtlinie
gelockert. Das ist der Grund, warum zwei der sechs Kopfzeilentests eine Seite
**öffnen** statt eine Kopfzeile zu lesen: eine zu strenge Richtlinie zerbricht
leise, und `nx serve` schickt keine.

#### Der Stand nach diesem Paket

`nx run-many -t lint test build --skip-nx-cache` grün über **19 Projekte**.
Unit-Tests: **1375** im Server (unverändert — dieses Paket fasst keinen
Servercode an), **282** im Nutzer-Client (zwölf neu: acht für die Lade, einer
für die gestapelten Zeilen, zwei für die Zeitleiste und den Anmeldeknopf der
Event-Seite, einer für die Zeitleiste auf „meine Anmeldung"), **222** im
Veranstalter-Client, **113** in `shared-models`, **50** in `shared-i18n` (einer
neu: der kompakte Umschalter behält seinen zugänglichen Namen), **32** in
`shared-theming` (zwei neu: dass jede Eigenschaft ausgeliefert wird und dass
der Rand gegen die Seite 3:1 erreicht), **32** in `shared-http`, dazu die
Plug-in-Bündel unverändert.

Browsersuiten: **266** in der Teilnehmersuite (264 wie bisher, plus die zwei
des Telefonprojekts), **317** in der Veranstaltersuite, beide EXIT=0.
Vertragssuite **42** Suiten und **718** Tests, EXIT=0, genau **drei** 429 im
ganzen Lauf — alle drei von der Drosselungssuite erbeten.
`tools/shipped-stack/verify.sh` auf `STACK_PORT=8099`: „the shipped stack is
good", sieben Browsertests, 141 s, keine Container übrig — womit auch der
Produktionsbuild des Clients mit der neuen Grundlage einmal wirklich gelaufen
ist. Der Katalog wächst um **zwei** Schlüssel auf **1272**.

**Vier fremde Zusicherungen mussten mitgeändert werden**, alle aus demselben
Grund — sie zeigten auf Struktur, die dieses Paket bewegt hat:

- Fünf Plug-in-Suiten lasen den Glyph einer Kachel als `a.tile svg path`; eine
  Zeile hat jetzt **zwei** SVGs, also heißt es `.tile__icon svg path`.
- Zwei Sprachtests warteten auf das sichtbare Wort „Language" beziehungsweise
  „Sprache"; der Umschalter ist im Nutzer-Client kompakt, also ist es sein
  **zugänglicher** Name (`toHaveAccessibleName`).
- Der Widerspruchstest bestand auf „kein Knopf auf dieser Seite" — jede Seite
  hat jetzt einen: den Hamburger. Er zählt die Knöpfe in `main`.
- `profile.spec.ts` navigierte über die Leiste; dafür gibt es jetzt
  `openNavigation(page)` in `support/navigation.ts`, das die Lade öffnet und
  ihren Landmark zurückgibt.

**Und eine, die keine Strukturänderung war, sondern ein Wettlauf, den das
vierte Projekt sichtbar gemacht hat.** `plugin-forum.spec.ts` vergleicht die
montierten Plug-in-Kacheln gegen `/api/config` — und las die Konfiguration
**frisch**, Sekunden nachdem die Seite geladen war. Sobald eine andere Suite in
diesem Moment ein Plug-in einschaltet, sind beide Antworten richtig und sie
widersprechen sich: die Seite hat montiert, was sie wusste, der neue Aufruf
nennt eines mehr. Mit dem `phone`-Projekt verschob sich die Verteilung der
Tests auf die acht lokalen Arbeiter gerade so weit, dass daraus der Normalfall
wurde — drei Läufe hintereinander rot, allein gefahren grün. Behoben wie in
`start-up.spec.ts` seit AP 6 der Phase 4: der Test fängt die Antwort ab, die
**diese** Seite bekommen hat (`page.waitForResponse` vor `goto`), und vergleicht
nur noch das DOM dagegen. Danach: vier Läufe, der letzte grün mit 266.

### AP 8 — Der Veranstalter-Client bis zur Tablet-Breite (E67) (erledigt, 21.09.2026) → **Meilenstein M15**

Dasselbe Vorgehen wie in AP 7 und ein anderer Maßstab: für diesen Client hat
die Thesis **keine Bögen gezeichnet**, also ist der Maßstab die Benutzbarkeit
bei 768 Pixeln und nicht ein Bild. Gezählt sind es **zweiundzwanzig Seiten**
(der Plan sagte achtzehn; unter `pages/` liegen neunzehn Verzeichnisse, und
vier davon enthalten mehr als eine Seite — `series` drei, `messages` zwei,
`translations` zwei). Behoben sind die drei Dinge, die das Paket benannt hat,
ein Boden für Bedienelemente, den die Messung gefunden hat, und der Satz, den
`todo.md` der Design-Seite seit AP 12 der Phase 2 schuldet. Bewacht wird das
Ergebnis von einem vierten Playwright-Projekt bei 768 × 1024.

#### Erst die Bestandsaufnahme

Wieder im Browser statt mit dem Auge: eine Wegwerf-Suite fuhr **jede** Seite bei
**768 und 1280** Pixeln an und protokollierte je Seite vier Dinge — die Breite
des Dokuments gegen die des Fensters, die innersten Elemente, die über den
rechten Rand ragen, jede Tabelle mit ihrer Spaltenzahl und der Breite ihres
Rahmens, und jedes Bedienelement unter 24 Pixeln. Dazu ein Bildschirmfoto je
Seite bei 768. Die Suite ist wieder weg; ihr Ergebnis ist die Tabelle unten.

Drei Befunde, und der erste ist der, der die Richtung des ganzen Pakets
geändert hat:

- **Keine Seite scrollt seitwärts — und das ist nicht die gute Nachricht, die
  es in AP 7 war.** Eine Tabelle läuft nicht über, sie wird **gequetscht**: die
  Teilnehmerübersicht presste sieben Spalten in 736 Pixel, jede Adresse stand
  dreizeilig, „Newsletter" und „Profile" berührten sich ohne Lücke, und eine
  Zeile mit einer Zeile Inhalt war 57 Pixel hoch. Gemessen ist das eine Null;
  gelesen ist es unbrauchbar. Ein Rahmen zum Scrollen allein hätte daran nichts
  geändert — eine Tabelle ohne Mindestbreite schrumpft, statt zu scrollen. Es
  gehören beide Hälften dazu (F225).
- **Die Seitenleiste wurde nicht weggeschoben, sondern gestapelt.** Bei 768
  standen neun Einträge, der Sprachumschalter, der Name des Kontos und
  „Abmelden" als grünes Band **über** dem Inhalt: 190 Pixel, an denen man auf
  jeder Seite vorbeiscrollt, bevor die Überschrift kommt.
- **Was das Paket vorhergesagt hat und die Messung nicht gefunden hat: die
  Formularraster.** Im ganzen Client gibt es zwei `grid-template-columns` —
  eines ist schon `auto-fit`, das andere ist die zweispaltige Detailliste der
  Teilnehmerübersicht (`max-content 1fr`), und die passt. Es gab nichts
  umzubrechen, und es wurde nichts umgebrochen.

Dazu, was die Messung an Bedienelementen fand: Knöpfe mit 21 Pixeln Höhe auf
sechs Seiten (ihr Innenabstand sagt `0.3rem`), Kästchen mit den 13 Pixeln des
Browsers auf fünf, ein Dateifeld mit 21. Mit der Maus auf einem großen
Bildschirm fällt das nicht auf; bei 768 auf einem Tablet ist jedes davon ein
Verstoß gegen WCAG 2.2 SC 2.5.8, die 24 Pixel verlangt (F226).

#### Die Tabelle

Eine Zeile je Seite, alle zweiundzwanzig, dazu eine für die Hülle, die auf
jeder von ihnen steht. Gemessen bei 768.

| Seite (Datei unter `apps/admin-client/src/app/`)        | Bei 768 gemessen                                                                         | Entscheidung                                                                                             |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Hülle (`app.html`, `app.scss`)                          | Menü als 190 Pixel hohes Band über dem Inhalt; kein Weg, es wegzuklappen                 | **behoben**: Lade über dem Inhalt, Leiste mit einem Knopf, der sie öffnet und schließt (F223)            |
| `pages/login/login-page.ts`                             | Nichts über dem Rand, kein zu kleines Element; Karte `min(24rem, 100%)`                  | **unverändert** — eine Karte, die nie breiter wird als ihr Platz                                         |
| `pages/setup/setup-page.ts`                             | Nur erreichbar, solange die Instanz keinen Administrator hat; `min(34rem, 100%)`         | **unverändert**; gelesen statt gemessen, und die Breite kann nicht überlaufen                            |
| `pages/series/series-list-page.ts`                      | Tabelle mit vier Spalten, auf 736 gequetscht                                             | **behoben**: Rahmen und Mindestbreite 40rem                                                              |
| `pages/series/series-form-page.ts` (neu und bearbeiten) | Formular einspaltig, passt; ein Feld 21 Pixel hoch                                       | **behoben**: Boden für Bedienelemente                                                                    |
| `pages/series/series-detail-page.ts`                    | Zwei Tabellen mit fünf Spalten; ein Link 22 Pixel                                        | **behoben**: Rahmen und 40rem. Der Link bleibt — er ist Text (F226)                                      |
| `pages/translations/series-translations-page.ts`        | „Übersetzung speichern" 21 Pixel hoch                                                    | **behoben**: Boden                                                                                       |
| `pages/invitations/invitations-page.ts`                 | Zwei Tabellen mit fünf Spalten; Suchknopf 21, zwei Kästchen 13, vier weitere Knöpfe 21   | **behoben**: Rahmen und 44rem, Boden                                                                     |
| `pages/events/event-form-page.ts` (neu und bearbeiten)  | Formular einspaltig, passt; zwei Kästchen 13 Pixel, ein Feld 21                          | **behoben**: Boden — und die eigene Regel der Seite, die den Boden überschrieben hat, ist weg            |
| `pages/event-dashboard/event-dashboard-page.ts`         | Kachelraster `auto-fit` bricht schon um; Tabelle mit vier Spalten                        | **behoben**: Rahmen und 36rem. Das Raster bleibt, wie es ist                                             |
| `pages/participants/participants-page.ts`               | Sieben Spalten in 736 Pixeln, Adressen dreizeilig, zwei Kopfzellen ohne Lücke            | **behoben**: Rahmen und **56rem** — die Adressspalte bleibt, und die Tabelle bewegt sich statt der Seite |
| `pages/translations/event-translations-page.ts`         | Zwei „Übersetzung speichern" mit 21 Pixeln                                               | **behoben**: Boden                                                                                       |
| `pages/program/program-page.ts`                         | Zwei Kästchen 13 Pixel; die Anmeldeliste je Punkt ist eine Tabelle in einer Karte        | **behoben**: Boden; Rahmen und 22rem für die kleine Tabelle                                              |
| `pages/media-links/media-links-page.ts`                 | Nichts über dem Rand, nur Textlinks unter 24 Pixeln                                      | **unverändert**                                                                                          |
| `pages/registration-fields/registration-fields-page.ts` | Ein Kästchen 18 Pixel (die Seite setzt es selbst auf 1,1rem)                             | **behoben**: die eigene Regel ist weg, der Boden gilt                                                    |
| `pages/messages/messages-page.ts`                       | Liste, nichts über dem Rand; „Neue Gruppe" 21 Pixel                                      | **behoben**: Boden                                                                                       |
| `pages/messages/conversation-page.ts`                   | Nichts über dem Rand, kein zu kleines Element, bei 768 wie bei 1280                      | **unverändert**                                                                                          |
| `pages/newsletter/newsletter-page.ts`                   | Tabelle mit drei Spalten                                                                 | **behoben**: Rahmen und 36rem                                                                            |
| `pages/admins/admins-page.ts`                           | Tabelle mit vier Spalten                                                                 | **behoben**: Rahmen und 40rem                                                                            |
| `pages/design/design-page.ts`                           | Zwei Farbfelder 21 Pixel hoch; zum App-Symbol sagt die Seite nichts                      | **behoben**: Boden — und der Satz, den die Seite schuldete (F224)                                        |
| `pages/modules/modules-page.ts`                         | Tabelle mit fünf Spalten, eine davon ein Satz                                            | **behoben**: Rahmen und 44rem                                                                            |
| `pages/profile-fields/profile-fields-page.ts`           | Ein Kästchen 18 Pixel (dieselbe eigene Regel wie im Registrierungsformular)              | **behoben**: die eigene Regel ist weg                                                                    |
| `pages/languages/languages-page.ts`                     | Zwei Tabellen mit fünf Spalten, eine davon ein Textfeld je Zeile; vier Kästchen 13 Pixel | **behoben**: Rahmen und 44rem, Boden                                                                     |

#### Dann die Behebung

**1. Die Seitenleiste wird eine Lade** (`app.html`, `app.scss`, `app.ts`).
Oberhalb der Schwelle ändert sich nichts: die Leiste ist die Spalte, die sie
war. Unterhalb liegt sie **über** dem Inhalt statt über ihm zu stehen — der
Inhalt behält die ganze Breite, ob sie offen ist oder nicht —, und eine
schmale Leiste am oberen Rand trägt den einen Knopf, der sie öffnet und wieder
schließt. Drei Entscheidungen dazu, alle in F223:

- **Kein `role="dialog"`.** Oberhalb der Schwelle ist dasselbe Element eine
  dauerhafte Spalte, und eine Rolle, die nur unterhalb wahr wäre, müsste aus
  TypeScript gesetzt werden — womit die Schwelle an zwei Stellen stünde. Es ist
  also eine Offenlegung: `aria-expanded` am Knopf, Escape schließt, der Schirm
  schließt, und die Seite dahinter bleibt eine Seite.
- **Geschlossen heißt `visibility: hidden`**, nicht „links außerhalb": ein
  Menü, das man mit der Tabulatortaste erreicht, ohne es zu sehen, ist nicht
  geschlossen.
- **Keine Animation.** Eine Bewegung bräuchte eine Ausnahme für
  `prefers-reduced-motion`, und die wäre die zweite `@media`-Abfrage in einem
  Client, der eine haben soll. Es ist weiterhin **genau eine** im ganzen
  Client; die zweite Fundstelle des Wortes `@media` in `app.scss` steht in
  einem Kommentar.

Geschlossen wird sie außerdem, wenn man **angekommen** ist, und das hängt am
Router und nicht an einem Klick: ein Plug-in trägt Einträge bei, die diese
Komponente nie sieht (`NavigationEnd` **und** `NavigationSkipped` — wer den
Eintrag der Seite wählt, auf der er steht, bekommt kein `NavigationEnd`).

**2. Jede Tabelle bekommt einen Rahmen** (`features/tables/table-scroll.ts`,
dreizehn Tabellen in zehn Seiten). Zwei Hälften, und die erste ist die, die man
vergisst: die Seite gibt ihrer Tabelle eine **Mindestbreite**, bei der die
Spalten lesbar bleiben (36rem bis 56rem, je nachdem, was in ihnen steht), und
der Rahmen gibt dem Überhang einen Ort. Der Rahmen nennt sich **nur dann**
Region und ist nur dann ein Tabulatorhalt, wenn er wirklich scrollt: das hängt
am Inhalt so sehr wie am Fenster, wird also gemessen (ein `ResizeObserver` auf
dem Rahmen **und** auf der Tabelle) statt an der Breite abgelesen. Bei 1280
wären es sonst zehn Halte, die nirgendwohin führen.

**3. Ein Boden für Bedienelemente** (`styles.scss`): 24 Pixel, die Zahl aus
WCAG 2.2 SC 2.5.8 — und nicht die 44 des Nutzer-Clients, denn der ist für einen
Daumen entworfen und dieser für einen Zeiger, und zehn seiner Seiten sind eine
Tabelle, in der jeder Pixel je Zeile eine Zeile weniger auf dem Schirm ist
(F226). Eine Grundregel statt zwanzig Komponentenregeln — und drei Seiten
mussten ihre eigene aufgeben, weil eine Komponentenregel den Boden schlägt
(F226, zweiter Absatz).

**4. Der Satz, den die Design-Seite schuldete** (F224). Seit AP 12 der Phase 2
liest der Server die Maße eines Bildes aus dessen eigenem Kopf (F106), und das
Manifest entscheidet danach, ob ein hochgeladenes Symbol die mitgelieferten
ersetzt (F105) — nur gesagt hat das niemand. Jetzt:

- `isInstallableAppIcon` steht in `shared-models`, und **beide** Seiten lesen
  dieselbe Funktion: der Manifest-Bau und die Design-Seite. Zwei Kopien der
  Arithmetik wären zwei Antworten auf eine Frage, sobald eine sich bewegt.
- Die Antwort der beiden Schreibwege trägt die Maße mit (`BrandingState`), und
  daneben steht ein Lesepfad (`GET /api/admin/config/images`), damit der Satz
  auch beim Öffnen der Seite dasteht und nicht erst nach dem nächsten Upload.
  **Nicht** in `/api/config`: dafür müsste jeder Start jedes Clients die Datei
  öffnen.
- Auf der Seite sind es drei Sätze — „500 × 120 Pixel, ein Startbildschirm
  zeigt das nicht, die Symbole von Trefaro bleiben daneben stehen", „256 × 256
  Pixel, dieses Symbol zeigt ein Startbildschirm", und „diese Datei nennt ihre
  Größe nicht". Der dritte ist kein Tadel: ein Kopf, der nichts sagt, ist eine
  offene Frage, und das Manifest behandelt sie auch so.

#### Und dann der Wächter

Ein viertes Playwright-Projekt, `tablet`, bei **768 × 1024**, mit
`grep: /@layout/`; die drei Maschinenprojekte tragen `grepInvert: /@layout/`.
Es kostet **kein Budget**: die Sitzung ist die, die der globale Aufbau ohnehin
einmal anlegt, es registriert niemanden und verschickt keine Mail. Drei Tests —
sechs Seiten ohne seitwärts scrollende Seite und ohne zu kleines Bedienelement;
die Teilnehmerübersicht mit ihrer Adressspalte, deren Rahmen scrollt und die
Seite nicht; und die Lade, die sich öffnet, den Inhalt **nicht verschiebt**, auf
Escape schließt und den Fokus zurückgibt.

Beide Beweise geführt, in beide Richtungen und wieder zurückgedreht:

| Zurückgedreht                             | Was rot wird                                                                              |
| ----------------------------------------- | ----------------------------------------------------------------------------------------- |
| Die `@media`-Abfrage auf `max-width: 1px` | „opens the menu over the page": den Knopf gibt es nicht mehr — 1 von 3 rot                |
| Der Rahmen auf `overflow-x: visible`      | „participants: 912 wide in 768 — th „Newsletter" → 817; th „Profile" → 912" — 2 von 3 rot |

#### Was anders lief

- **„Kein horizontales Scrollen" war die falsche Frage.** Sie stand so im
  Paket, und die Messung hat sie mit Null beantwortet, bevor irgendetwas
  geändert war. Was tatsächlich unbenutzbar war, war die Quetschung — und die
  sieht man erst auf dem Bildschirmfoto. Die Abhilfe ist deshalb auch nicht
  „ein Rahmen, der scrollt", sondern „eine Mindestbreite **und** ein Rahmen".
- **Zwei Handler mussten von Elementen herunter, die keine Bedienelemente
  sind.** `(keydown.escape)` stand am Layout-`<div>` und `(click)` am `<nav>`
  (als Delegation für alle Einträge); `@angular-eslint` verbietet beides mit
  Recht. Das Ergebnis ist besser als das, was da stand: Escape hängt jetzt am
  **Host** der Komponente (wirkt also, wo der Fokus auch ist), und geschlossen
  wird bei der **Navigation** statt beim Klick — womit auch die Einträge
  mitgehen, die ein Plug-in beiträgt.
- **Ein Kästchen blieb 13 Pixel breit, obwohl die Grundregel 24 sagt.** Drei
  Seiten setzten `.check input` selbst — zweimal auf `1.1rem`, einmal auf
  `auto` —, und eine Komponentenregel wird **nach** dem globalen Stylesheet
  eingehängt, gewinnt also bei gleicher Spezifität. Gefunden hat es der
  Wächter, im ersten Lauf, mit `13×24 input[checkbox]`. Notiert in
  `docs/rules/angular-clients.md`.
- **Und wieder ein Backtick in einem CSS-Kommentar**, diesmal in drei Dateien
  auf einmal: `` `styles.scss` `` in einem Kommentar innerhalb von `styles:`
  beendet das Template-Literal. Dieselbe Falle wie in AP 7, dieselbe Abhilfe —
  keine Backticks in einem Kommentar, der in einem Template-Literal steht.
- **Was bewusst nicht behoben wurde:** Textlinks unter 24 Pixeln. Ein Name in
  einer Tabellenzelle und ein „Zurück zur Reihe" sind Text, und Text ist kein
  Ziel — SC 2.5.8 nimmt sie ausdrücklich aus. Der Wächter misst deshalb Knöpfe,
  Felder, Auswahllisten und Textbereiche, und keine Links (F226).

#### Der Stand nach diesem Paket

`nx run-many -t lint test build --skip-nx-cache` grün über **19 Projekte**.
Unit-Tests: **1380** im Server (fünf neu: was `state()` über das App-Symbol
sagt und dass es die Datei nicht öffnet, solange es keine gibt), **239** im
Veranstalter-Client (siebzehn neu: sechs für die Hülle, sechs für den Rahmen um
eine Tabelle, fünf für die drei Sätze zum App-Symbol), **117** in
`shared-models` (vier neu: die eine Regel, die Server und Seite teilen), **33**
in `shared-theming` (einer neu: dass die leisere Schrift auf beiden Flächen
lesbar bleibt), **282** im Nutzer-Client und **50** in `shared-i18n`
unverändert, dazu die Plug-in-Bündel unverändert.

Browsersuiten: **321** in der Veranstaltersuite (317 wie bisher, plus drei des
Tablet-Projekts und der Satz zum App-Symbol), **266** in der Teilnehmersuite,
beide EXIT=0. Vertragssuite **42** Suiten und **720** Tests (zwei neu: die
Antwort mit den Maßen und die ohne), EXIT=0, genau **drei** 429 im ganzen
Lauf — alle drei von der Drosselungssuite erbeten.
`tools/shipped-stack/verify.sh` auf `STACK_PORT=8099`: „the shipped stack is
good", sieben Browsertests, zweimal gefahren (158 s und, nach den letzten zwei
Stiländerungen, 102 s), keine Container übrig. Der Katalog wächst um
**fünf** Schlüssel auf **1277** (zwei für den Knopf der Lade, drei für die
Sätze zum App-Symbol; der Hinweis über dem Symbol-Feld wurde umgeschrieben, er
sagte „das kann hier nichts prüfen").

**Keine fremde Zusicherung musste mitgeändert werden.** Die Suiten dieses
Clients zeigen auf Rollen und Beschriftungen, und die Lade ist bei den Breiten,
in denen sie laufen, gar nicht da — die Seitenleiste steht dort, wo sie stand.

In `todo.md` sind zwei Haken dazugekommen (die zwei Eigenschaften mit Rückfall,
der Satz zum App-Symbol) und ein Eintrag: die Lade des **Nutzer**-Clients
animiert ohne Ausnahme für `prefers-reduced-motion` — aufgefallen beim
Entscheiden gegen eine Animation hier, und dort kostet die Ausnahme nichts,
weil jener Client ohnehin mehrere `@media`-Abfragen hat.

### AP 9 — Security-Review und der Blick ins Volume (erledigt, 21.09.2026)

Zwei Hälften, die nichts miteinander zu tun haben außer dem Paket: ein Review
über vier Bereiche, das ein Protokoll hinterlässt, und ein Werkzeug, das eine
Frage beantwortet, die keine API beantwortet. Das Protokoll steht in
[`docs/SECURITY-REVIEW.md`](SECURITY-REVIEW.md) — **sechsundzwanzig Punkte,
zehn Befunde, sechs behoben, einer entschieden, drei mit Begründung in
`todo.md`** —, und hier steht, was beim Suchen passiert ist.

#### Erst die Adressen

Der Einstieg war nicht der Code, sondern eine Liste, die es nicht gab. Die zwei
Sitzungswächter sind global und entscheiden am **deklarierten** Pfad (E16,
E33) — genau die Eigenschaft, die ein vergessenes `@UseGuards` harmlos macht,
und genau die, die niemanden sagen lässt, welche Endpunkte diese Instanz offen
anbietet. Also wurde die Liste erzeugt, und sie ist geblieben:

| Zugang                  | Adressen |
| ----------------------- | -------- |
| Veranstaltersitzung     | **98**   |
| Teilnehmersitzung       | **32**   |
| ohne Sitzung erreichbar | **41**   |
| **zusammen**            | **171**  |

Die einundvierzig sind einzeln durchgegangen worden, und sie zerfallen in vier
Gruppen mit je einem Grund: die vier Türen in eine Sitzung, das, was das Produkt
ohne Login verspricht (Startseite, Landingpage, Programm, Konfiguration,
Katalog, die vier Medienrouten), neun öffentliche Schreibzugriffe — jeder
namentlich gedrosselt, drei davon zusätzlich je Empfängeradresse — und die
token-autorisierte Selbstbedienung von E11. Kein Fund, aber auch keine
Überraschung mehr.

#### Dann die Bereiche

**Authentifizierung** hatte den schwersten Befund, und er stand nicht auf der
Liste möglicher Befunde: **ein Veranstalter konnte sein Passwort nicht
ändern.** `admins.controller.ts` hatte drei Routen — auflisten, anlegen,
löschen. Das Passwort eines Kontos war das, was bei seiner Entstehung gesetzt
wurde: in eine `.env` getippt oder von einer Kollegin gewählt. Der einzige
Wechsel war „zweites Konto anlegen, erstes löschen", und das nimmt die
Moderationsentscheidungen des Kontos mit (`decided_by` ist `SET NULL`). Alles
andere in diesem Bereich hielt: 256 Bit Sitzungsgeheimnis mit nur dem Hash in
der Datenbank, argon2id mit Zeitangleichung gegen Kontoaufzählung, die Flags
der zwei Cookies, `trust proxy 1`, der Startbericht.

**Upload-Validierung** hatte keinen echten Befund, und das war die
Überraschung — sieben Punkte, sieben Mal „stimmt": geschlossener Typkatalog mit
Signaturprüfung, Grenzen je Datei, je Einreichung, je Anzahl, `safeFileName`
auf dem Hin- und auf dem Rückweg, `Content-Disposition` immer `attachment`,
fünf getrennte Teilbäume mit generierten Namen ohne Endung, `nosniff` und
`sandbox` auf jeder Route, die Bytes ausliefert, ein selbst gebautes ZIP ohne
Verzeichniseinträge, und Bildmaße, die aus dem Kopf gelesen und nie dekodiert
werden. Der einzige Punkt mit einem Vermerk ist ein Paar Zahlen: der Proxy
lässt 25 MB durch, die Anwendung 20, und zusammengehalten werden sie von einem
Kommentar.

**Plug-in-Isolation** hatte einen: „ein Plug-in fasst keine Kerntabelle an"
(F21) stand in drei Docstrings und wurde von nichts geprüft. Importe prüft eine
ESLint-Regel, Adressen und Schalter prüft `plugin-controllers.spec.ts` — das
Schema prüfte niemand.

**Die OpenAPI-Frage** stellte sich beim Nachsehen als zwei Fragen heraus, und
das ist die ganze Antwort. Unter derselben Adresse liegen eine Beschreibung und
eine bedienbare Konsole.

#### Die Behebung

**1. Das Adressinventar wird ein Test** (`app/route-access.spec.ts`, F227). Er
liest die Deklarationen aller Controller des Images — Kern und Plug-ins —,
rechnet aus, was die Wächter daraus machen, und vergleicht die offenen mit
einer eingecheckten Liste, die nach dem **Grund** gruppiert ist. Gelesen wird
der Quellbaum und nicht der Modulgraph: so braucht der Test die
Datenzugriff-Schicht nicht, und er überschätzt in die sichere Richtung.

**2. Ein Veranstalter wechselt sein Passwort** (`admin-me.controller.ts`,
`pages/account/`, F228). `PUT /api/admin/me/password`, mit dem aktuellen
Passwort, danach enden alle anderen Sitzungen dieses Kontos. Ein eigener
Controller `admin/me`, weil dort das Subjekt die Sitzung ist und es keine Id
gibt, die man verwechseln kann. Eine eigene Seite unter `/account`, erreichbar
über den Namen im Menü. **Kein Zurücksetzen-Link** — er ginge an die Adresse,
von der diese Instanz ihre eigene Post verschickt —, und die Seite sagt das.

**3. Das Plug-in-Schema bekommt seinen Wächter**
(`plugins/plugin-schema.spec.ts`, F231). Die Migrationen aller Plug-ins werden
als Text gelesen; jede Tabelle, auf die sich ein `CREATE`/`ALTER`/`DROP TABLE`,
ein `CREATE INDEX` oder ein `TRUNCATE` richtet, muss mit `plugin_` anfangen.
Ein Fremdschlüssel **in** eine Kerntabelle bleibt erlaubt.

**4. Die Beschreibung bleibt, die Konsole geht** (`core/config/api-docs.ts`,
F230). `/api/docs-json` überall, weil jede Adresse darin aus der AGPL-Quelle
herzuleiten ist und Verstecken NFR 8 kostet und sonst nichts bringt.
`/api/docs` nicht in Produktion, weil Swagger UI fremdes JavaScript im Ursprung
des Veranstalter-Clients ist und sein „Try it out" eine authentifizierte
Anfragekonsole, die jeder erreicht, der einem Veranstalter einen Link schickt.

**5. Die Seiten bekommen eine Inhaltsrichtlinie**
(`infra/nginx/trefaro-locations.conf`, F229). Der Befund, der beim Lesen von
Punkt 4 auffiel: jede Route, die Bytes ausliefert, setzte eine CSP für diese
Bytes — die Dokumente, die sie anzeigen, setzten keine. Jetzt ist alles
`'self'`, mit zwei engen Ausnahmen (`style-src 'unsafe-inline'` für Angulars
Komponentenstile, `img-src blob: data:` für die Vorschau einer gewählten
Datei), und `script-src` bekommt keine — womit auch ein Plug-in-Bündel nichts
von außen nachlädt. Zwei Zeilen sind Produktregeln geworden: `frame-src 'none'`
ist „externe Medien werden verlinkt, nie eingebettet", und
`Permissions-Policy: camera=(self), …` sagt, dass von allen Gerätefähigkeiten
genau eine gebraucht wird. Sie steht auf **Server-Ebene**, weil ein
`add_header` in einem `location`-Block die geerbten abschaltet — die Falle
steht jetzt in `docs/rules/infrastructure.md`.

**6. Ein tiefer Typ-Import verschwindet.** Fiel auf, als das Inventar zuerst
über `AppModule` laufen sollte: `typeorm-content-translation.repository.ts`
importierte `QueryDeepPartialEntity` über einen Pfad in das Paket hinein, den
der Anwendungsbuild auflöst und die Spec-Übersetzung nicht — also scheiterte
**jede** Spec, die bis zur Zusammensetzung reichte, an einem `TS2307` in einer
fremden Datei. Der Typ wird jetzt aus dem Query Builder abgeleitet.

#### Der Kehrbesen

`tools/upload-sweep/sweep.mjs`, das fünfte Werkzeug unter `tools/` und das
einzige, das an der API vorbeigreift — weil die Frage, die es stellt, keine API
beantwortet: welche Bytes liegen im Volume, auf die keine Zeile zeigt.
`AttachmentsService` gleicht Datenbank und Volume zugunsten der **Bytes** aus,
und die Folge stand seit Phase 1 in seinem Klassenkommentar: ein Absturz
zwischen zwei Schritten kann eine Datei hinterlassen, die niemand mehr
erreicht.

Drei Dinge daran sind Entscheidungen und keine Umsetzungsdetails:

- **Sechs Spalten, nicht eine.** `todo.md` nannte `attachment.file_path`; mit
  nur der wäre jedes Logo und jeder Avatar „vergessen". Gelesen werden
  `attachment.file_path`, beide Spalten von `app_config`,
  `event_series.logo_path`, `event.logo_path` und `user_profile.avatar_path`.
- **Er urteilt nicht über ein Schema, das er nicht ganz kennt.** Vor dem ersten
  Vergleich fragt er `information_schema`, welche Spalten nach einem Pfad
  aussehen; findet er eine, die er nicht kennt, meldet er **gar nichts**. Sonst
  wäre die erste Tabelle eines neuen Moduls, die eine Datei speichert, eine
  Liste von „verwaisten" Dateien — und jemand löscht sie.
- **Er löscht nichts, und er meldet in beide Richtungen.** Die Gegenrichtung
  (eine Zeile, deren Datei fehlt) ist die ernstere Hälfte: sie ist ein
  Download, der einem Veranstalter 404 antwortet, und der Server sagt das erst,
  wenn zufällig jemand fragt.

Dazu eine Karenzzeit von fünfzehn Minuten, weil `store()` erst die Datei und
dann die Zeile schreibt — ohne sie meldete der Lauf auf einer beschäftigten
Instanz ihre eigenen laufenden Uploads.

#### Und dann die Probe

Jeder behobene Befund hat einen Wächter, und jeder Wächter wurde einmal
absichtlich gebrochen:

| Mutation                                                         | Was rot wird                                            |
| ---------------------------------------------------------------- | ------------------------------------------------------- |
| `@Controller('admin/attachments')` → `@Controller('downloads')`  | Inventar, mit `+ "GET /api/downloads/:id"`              |
| `ALTER TABLE "plugin_forum_thread"` → `ALTER TABLE "admin_user"` | Schema-Wächter, mit Datei- und Tabellennamen            |
| `this.form.reset()` aus der Kontoseite entfernt                  | „sendet beide Passwörter und leert danach das Formular" |

#### Was anders lief

**Die Frage des Pakets hatte eine Antwort, die nicht auf der Liste stand.** Vier
Bereiche waren benannt, und der schwerste Befund lag in keinem davon dort, wo
man ihn gesucht hätte: nicht in einem Wächter, einem Token oder einer
Signaturprüfung — sondern in einer Route, die es nicht gab. „Ein Veranstalter
kann sein Passwort nicht ändern" findet man nicht, indem man Code liest, in dem
etwas falsch ist; man findet es, indem man den Controller aufmacht und
nachzählt, was er kann.

**Und ein Fund kam aus einer anderen Frage.** Die Content-Security-Policy stand
in keinem der vier Bereiche. Sie fiel beim Nachlesen der OpenAPI-Frage an:
„Swagger UI läuft im Ursprung des Veranstalter-Clients" führt sofort zu „und
was schützt diesen Ursprung eigentlich" — und die Antwort war: drei Kopfzeilen,
von denen keine sagt, woher ein Skript kommen darf. Ein Review, das seine vier
Bereiche abarbeitet und nur die vier, hätte das nicht gesehen.

**Das Inventar wollte über den Modulgraphen laufen und ging daran kaputt.** Der
erste Versuch importierte `AppModule` — und scheiterte an `TS2307` in
`typeorm-content-translation.repository.ts`, einer Datei, die mit Adressen
nichts zu tun hat: ein tiefer Typ-Import in `typeorm` hinein, den der
Anwendungsbuild auflöst und die Spec-Übersetzung nicht. Behoben ist beides —
der Import und die Falle in `docs/rules/tooling-traps.md` —, aber der Test
liest jetzt trotzdem den Quellbaum, und aus besseren Gründen als dem Unfall:
er braucht die Datenzugriff-Schicht nicht, und er überschätzt in die sichere
Richtung.

**Ein Lauf ohne `--parallel=1` beweist nichts, und er sagt es nicht.** Der
erste Volldurchlauf dieses Pakets lief mit Nx' Vorgabe, also fuhren die drei
E2E-Projekte gleichzeitig gegen einen Server. Was dabei herauskam, sah nach
einem kaputten Katalog aus: `keyCount` war **4** statt 1288, `enabledModules`
war `undefined`, eine Suite brach mit `ECONNREFUSED` ab. Die Ursache ist der
**globale** Zähler — 300 Anfragen je Minute, und bewusst der einzige, den das
Testprofil **nicht** anhebt (E4). Die CI ruft seit jeher `--parallel=1` auf; die
Regel stand nur nicht dabei, warum. Jetzt steht sie in
`docs/rules/e2e-tests.md`.

**Ein Test von AP 8 war flackerig, und der Volldurchlauf hat es gezeigt.** „Die
Lade schiebt die Seite nicht" verglich den ganzen Kasten von `main` vor und
nach dem Öffnen — und die Reihenliste lädt weiter, während gemessen wird, also
wuchs die Höhe zwischen den zwei Messungen von 976 auf 16536 Pixel. Auf einer
Datenbank mit wenigen Zeilen fällt das nie auf. Verglichen werden jetzt `x`,
`y` und `width`: ein Schieben zeigte sich in denen, die Höhe sagt dazu nichts.

#### Der Stand nach diesem Paket

`nx run-many -t lint test build` grün über **19 Projekte**. Unit-Tests:
**1395** im Server (fünfzehn neu: drei für das Adressinventar, drei für das
Plug-in-Schema, zwei für die Entscheidung über die API-Konsole, fünf für den
Passwortwechsel und zwei dafür, dass „alle anderen Sitzungen" die richtige
Sitzung stehen lässt), **244** im Veranstalter-Client (fünf neu: die
Kontoseite), **282** im Nutzer-Client, **117** in `shared-models`, **50** in
`shared-i18n` und **33** in `shared-theming` unverändert.

Browsersuiten: **330** in der Veranstaltersuite (321 wie bisher, plus drei
Tests der Kontoseite über drei Engines), **266** in der Teilnehmersuite, beide
EXIT=0. Vertragssuite **43** Suiten und **725** Tests (eine Suite und fünf
Tests neu: der Passwortwechsel auf einem Wegwerfkonto), EXIT=0, genau **drei**
429 im ganzen Lauf — alle drei von der Drosselungssuite erbeten.
`tools/shipped-stack/verify.sh` auf `STACK_PORT=8099`: „the shipped stack is
good", **13** Browsertests (sieben wie bisher, sechs neu: zwei für die
Kopfzeilen, zwei, die die Seiten öffnen und die Konsole lesen, zwei für die
Beschreibung und die fehlende Konsole), zweimal gefahren — der erste Lauf
(121 s) mit zwei roten, die das Aufschieben des Stylesheets fanden, der zweite
(85 s) grün —, keine Container übrig.

Der Kehrbesen ist gegen dieselbe Instanz gefahren, mit drei Proben: eine
künstlich verwaiste Datei neben einem hochgeladenen Logo — **genau die eine**
wird genannt, das Logo nicht (`EXIT=2`); dann das Logo aus dem Volume gelöscht
— beide Richtungen werden gemeldet, die Zeile mit ihrem Besitzer
(`branding/… (app_config 1)`); und eine Spalte `event.brochure_path`
hinzugefügt — der Lauf meldet **gar nichts** und bricht mit `EXIT=1` ab, weil
er ein Schema nicht beurteilt, das er nicht ganz kennt. Die Spalte wurde
danach wieder entfernt.

Der Katalog wächst um **elf** Schlüssel auf **1288** (alle für die Kontoseite,
einer davon der Satz, dass es kein Zurücksetzen gibt). In `todo.md` sind zwei
Haken dazugekommen — das Sicherheitsreview und der Kehrbesen — und **drei**
Einträge: kein Weg, eine Lücke zu melden (der Kanal ist eine Entscheidung, die
hier niemand treffen kann); das Zahlenpaar von Proxy und Anwendung, das ein
Kommentar zusammenhält; und der Health-Endpunkt, der selbst mit der Datenbank
spricht — der letzte **vor AP 12**, das die Architektur beschreibt und nichts
beschreiben darf, was nicht stimmt.

### AP 10 — Fehlerprotokollierung, Monitoring und Lasttests (erledigt, 24.09.2026)

Drei Dinge, die zusammengehören, weil ein Lasttest ohne Instrumentierung eine
Zahl ohne Erklärung ist. Die Abnahmebedingung hat aber einen Satz, der wie zwei
klingt und wie ein Widerspruch aussieht: **ein Betreiber soll aus den
Protokollen erkennen können, was schiefging, ohne eine Adresse darin zu
finden.** Das Paket besteht im Wesentlichen darin, diesen Satz aufzulösen, und
die Auflösung ist eine Kennung statt eines Namens.

#### Was im Protokoll stand — und was daran nicht aufgeschrieben worden war

Der Anfang war eine Bestandsaufnahme derselben Art wie das Adressinventar aus
AP 9: **zweiundsechzig Aufrufstellen** von `logger.*` im Servercode, einzeln
gelesen. Der Befund war zunächst beruhigend — die Zeilen nennen Ids, zählen
Dinge und beschreiben Fehler — mit **drei** Ausnahmen, die eine Adresse
interpolierten: die angelegte Administratorin, die erste aus der Umgebung, und
die abgeschlossene Ersteinrichtung. Drei Zeilen, drei Einzeiler.

Die zwei ernsteren Befunde standen nicht an einer Aufrufstelle, sondern in den
Vorgaben zweier Bibliotheken — beides Dinge, die **niemand entschieden hat**:

1. **Nests Vorgabelogger hat jeden Pegel an**, `debug` eingeschlossen.
   `AllExceptionsFilter` schreibt einen erwarteten 401 oder 404 ausdrücklich auf
   `debug`, mit einem Kommentar, der begründet, warum das keine Warnung sein
   darf — und mit der Vorgabe stand die Zeile trotzdem in jedem
   Produktionsprotokoll. Ein Protokoll, das mit den Besuchern wächst statt mit
   den Problemen, ist eines, das niemand mehr liest.
2. **TypeORM hängt an eine gescheiterte Abfrage ihre Parameter** —
   `query failed: … -- PARAMETERS: ["jemand@example.org"]` —, und zwar auf dem
   Pegel `error`, den jede Umgebung dieses Servers anhat. Ein Schluckauf der
   Datenbank während einer Anmeldung schrieb damit eine Adresse ins Protokoll,
   ein Passwort-Reset das Token, mit dem man das Konto übernimmt.

Und ein dritter, der aus der eigenen Feder kam: der Filter protokollierte die
**ganze** Anfrageadresse. Die Teilnehmerübersicht sucht nach Nachname und
Adresse (F32), ein Bestätigungslink trägt ein signiertes Token — ein 500 auf
einer dieser Seiten schrieb beides mit.

Behoben ist das als vier Dinge: `LOG_LEVEL` mit Vorgabe `log` (und **leiser als
`warn` gibt es nicht** — die Zeilen zu E60 und E62 sind Warnungen, und eine
Instanz, die sie nicht drucken kann, ist aus ihrem eigenen Protokoll nicht mehr
prüfbar); ein eigener TypeORM-Logger, der dieselbe Anweisung und dieselbe
Fehlermeldung schreibt und statt der Werte ihre **Anzahl**; `redactPath`, das
die Schlüssel der Query-Zeichenkette behält und die Werte wegnimmt, im
Protokoll **und** im Rumpf der Fehlerantwort; und die drei Einzeiler.

Dazu die Wache, damit es so bleibt: `log-hygiene.spec.ts` liest jede
Aufrufstelle im Quelltext und lässt keine Interpolation durch, die eine
Adresse, einen Namen, ein Passwort, ein Token, eine Geräteadresse oder einen
Suchbegriff benennt. Rot gegen genau die drei Zeilen, bevor sie geändert
wurden. Die Ausnahmeliste hat **einen** Eintrag: das Ersteinrichtungs-Token,
das genau deshalb gedruckt wird — und ein dritter Test sorgt dafür, dass ein
Eintrag, der nichts mehr trifft, auffällt statt zu verstauben.

#### Die Fehlerkennung — der Satz, der wie ein Widerspruch klang

Acht Hexadezimalstellen, erzeugt für jedes 5xx und für nichts sonst, stehen im
Rumpf der Antwort (`incident`) und in der Logzeile neben dem Stack. Wer vor dem
Bildschirm sitzt, liest sie vor; `grep` findet genau einen Eintrag. Damit ist
ein Fehler untersuchbar, **ohne** dass irgendwo steht, wer ihn ausgelöst hat —
und das ist die ganze Auflösung des Widerspruchs. Ein 404 bekommt keine, denn
eine Kennung darauf erzöge Menschen dazu, eine Nummer zu nennen, die
nirgendwohin führt.

Einen Bildschirm hat sie nicht. Der Veranstalter-Client zeichnet einen
gescheiterten Aufruf an rund dreißig Stellen mit je eigenem Markup, also
bräuchte eine Kennung vor einem Menschen zuerst ein gemeinsames Bauteil — das
ist eine Änderung eigener Form und steht mit ihrem Preis in `todo.md`. Bis
dahin sagt `docs/INSTALL.md` §12.2, wo man sie findet.

#### Was ein Betreiber lesen kann

`/api/health` bleibt, was es war: zwei Wörter für einen Proxy und eine
Container-Prüfung, die sich beide nicht anmelden können. Alles darüber steht
unter `GET /api/admin/operations` — Laufzeit, Speicher, Umlaufzeit der
Datenbank, Antworten nach Klasse, die Kennung und Zeit des letzten Fehlers, und
was aus der ausgehenden Mail wurde. Zahlen und keine Zeilen; das einzige Feld
mit einer Zeichenkette ist die Kennung, und der Pfad daneben hat seine Werte
schon verloren.

Drei Schreiber, weil keiner allein reicht: ein Interceptor zählt, was geklappt
hat, der Ausnahmefilter zählt, was nicht — ein Wächter wirft **vor** jedem
Interceptor, ein 401 oder 429 käme dort also nie an —, und der Mailversand
zählt sich selbst, weil Mail der Teil ist, der aufhört zu funktionieren, ohne
dass jemand es merkt. Die Zähler stehen im Speicher und werden bei einem
Neustart null: ehrlich statt vollständig, denn der Neustart ist meistens genau
das Ereignis, nach dem gefragt wird.

Und dabei ist der Befund E2 des Sicherheitsreviews aus AP 9 abgearbeitet — der
Health-Endpunkt sprach selbst mit PostgreSQL. Er tut es jetzt über einen Port
(`DATABASE_HEALTH`, zwanzig Zeilen, wie der Eintrag es vorhergesagt hatte), der
eine **Dauer** zurückgibt statt eines Ja/Nein, weil `/api/admin/operations` der
zweite Leser ist; `null`, wenn die Runde nicht zustande kam. Behoben **vor**
AP 12, das die Architektur beschreibt und nichts beschreiben darf, was nicht
stimmt.

#### Die sechste Grenze

AP 2 hat fünf Grenzen aus dem Code in die Umgebung geholt und die sechste
stehen lassen: `GLOBAL_LIMIT = 300` pro Minute, die Grenze, gegen die **jede**
Anfrage zählt — fünf pro Sekunde. Das Erste, was sie je gebraucht hat, war
dieser Lasttest, und die Versuchung war, sie für die Messung im Code
hochzusetzen. Genau das verbietet E60. Also ist sie jetzt
`GLOBAL_REQUESTS_PER_MINUTE`: dieselbe Vorgabe, dieselbe laute Zeile beim Start,
durchgereicht von `infra/docker-compose.yml`, und der socket.io-Handshake zählt
weiter gegen dasselbe Budget. Der Messlauf hebt sie in der `.env` seines
Wegwerf-Stacks an — und die Instanz hat es beim Start gesagt:

```
WARN [RateLimits] GLOBAL_REQUESTS_PER_MINUTE is 1000000, above the default of
300 — a raised limit is a limit nobody is testing (E4).
```

`load.mjs` bricht mit Rückgabewert **3** ab, sobald auch nur eine 429 kommt,
statt eine Zahl der Drosselung als Messwert auszugeben.

#### Die Lastzahlen, mit Aufbau und Datum

Gemessen am **24.09.2026**, mit `tools/load-test/measure.sh`: fünf Container aus
leerem Volume, eine Reihe, ein Event, **20 000** Anmeldungen darauf, zwanzig
gleichzeitige Leser, zehn Sekunden je Szenario nach zwei Sekunden Aufwärmen.
Aufbau: PostgreSQL 17.11, Docker 29.7.2 (linux/amd64), Node 24.17 im Treiber,
Host 16 Kerne / 47 GB unter WSL2 (Linux 6.18) — also eine
Entwicklungsmaschine und kein Server, was für die Einordnung der Zahlen unten
zählt.

| Szenario       | Antworten/s | p50     | p90     | p95      | p99      |
| -------------- | ----------- | ------- | ------- | -------- | -------- |
| `config`       | **1 542**   | 12,0 ms | 17,1 ms | 19,2 ms  | 25,8 ms  |
| `series`       | **1 525**   | 12,3 ms | 17,1 ms | 18,6 ms  | 23,0 ms  |
| `event`        | **894**     | 20,6 ms | 29,6 ms | 33,2 ms  | 42,1 ms  |
| `catalogue`    | **293**     | 64,5 ms | 81,7 ms | 94,0 ms  | 121,0 ms |
| `search`       | **258**     | 75,3 ms | 88,1 ms | 95,6 ms  | 131,1 ms |
| `participants` | s. u.       | 73,5 ms | 96,0 ms | 105,6 ms | s. u.    |

Keine einzige Antwort außer 200, keine 429, und der Bericht der Instanz selbst
zählte am Ende **58 476** beantwortete Anfragen, 0 Client-Fehler, 0 gedrosselt,
0 Serverfehler — was zugleich die Probe darauf ist, dass die Zählung aus
`/api/admin/operations` und der Treiber dasselbe gesehen haben.

Drei Dinge sind daran bemerkenswert:

- **Die öffentlichen Seiten tragen die Last, um die es geht.** Der Fall, den
  eine kleine NGO wirklich hat, ist ein Newsletter, nach dem ein paar hundert
  Menschen innerhalb einer Minute auf dieselbe Landingpage klicken. Bei
  neunhundert bis fünfzehnhundert Antworten je Sekunde ist das kein Fall.
- **Der Katalog ist die langsamste öffentliche Antwort**, um den Faktor fünf:
  1 288 Schlüssel werden je Anfrage aus der englischen Datei, der Sprachdatei
  und den Überschreibungen zusammengesetzt und dann gehasht. Das ist die
  zweite Anfrage, die **jeder** Client beim Start macht. Ein ETag ist da
  (`no-cache, must-revalidate`, E22), aber er spart die **Leitung** und nicht
  die **Arbeit**: die Kennung entsteht erst, nachdem der Katalog gebaut ist, ein
  304 kostet den Server also so viel wie ein 200. Bei 293 Antworten je Sekunde
  ist das für eine Instanz einer Organisation weit jenseits dessen, was
  gebraucht wird — aufgeschrieben in `todo.md`, mit der Zahl daneben, statt
  hier optimiert zu werden.
- **`ILIKE` über 20 000 Zeilen kostet, was es kostet, und das ist wenig.** Die
  gesuchte Seite kommt bei 75 ms Median zurück, mit einem Suchbegriff, der
  jede Zeile trifft.

##### Und die eine Zahl, die dieses Protokoll nicht erklärt

Das Szenario `participants` hat in drei von vier vollständigen Läufen einen
Ausreißer, den die anderen fünf nicht haben: die Hälfte der Antworten liegt bei
73 ms, p95 bei 106 ms — und dann standen **23 von 1 146** Anfragen etwa
**vierundvierzig Sekunden** still, alle zur selben Zeit, danach lief es weiter,
und das Szenario **danach** war wieder tadellos.

Ausgeschlossen ist, was sich ausschließen ließ: keine langlaufende Abfrage in
`pg_stat_activity`, keine erschöpfte oder verlorene Verbindung (der Pool war
vorher wie nachher gesund), kein Fehler und kein 5xx im Bericht der Instanz,
kein Speicherwachstum, kein Schuld des Seeds (ein `VACUUM (ANALYZE)` nach dem
Einfügen ändert nichts), und kein geplanter Auftrag zu dieser Zeit — die
einzigen zwei laufen alle zwölf Stunden. Und: **dasselbe Szenario allein
gefahren ist sauber** — 4 046 Anfragen, schlechtester Fall 115 ms.

Damit steht es hier als das, was es ist: ein reproduzierbares Einfrieren des
ganzen Anfragewegs für eine Dreiviertelminute, auf einer WSL2-Maschine, das
sich von selbst löst und das ich dieser Anwendung mit den vorliegenden
Belegen **nicht** zuschreiben kann — und der Umgebung ohne Beleg auch nicht.
Die Zahl, die es entscheidet, ist ein Lauf auf einem echten Linux-Server; das
steht in `todo.md`. `load.mjs` zählt seit diesem Befund, **wie viele** Anfragen
über einer Sekunde lagen, denn genau diese Zahl unterscheidet einen Server, der
unter Last langsam wird, von einer Maschine, die einmal stehen bleibt — und ein
Maximum allein kann das nicht.

#### pg_trgm: gemessen statt behauptet (F32)

Die Frage, die `todo.md` seit AP 5 der Phase 1 offen hält: die
Teilnehmerübersicht ist bei **2 000** Anmeldungen je Event gemessen (13 ms im
schlechtesten Fall), und eine Organisation eine Größenordnung darüber ist nie
gemessen worden. Also **20 000** Anmeldungen auf ein Event, und dieselbe
Abfrage, die die Repository baut — ein `ILIKE '%wort%'` je Wort, oder-verknüpft
über drei Spalten, und-verknüpft über die Wörter, auf ein Event begrenzt,
sortiert und paginiert —, dreimal gemessen: wie ausgeliefert, mit `pg_trgm` und
einem GIN-Index auf jeder der drei Spalten, und wieder wie ausgeliefert. Der
dritte Durchgang ist keine Zeremonie: er beweist, dass die Datenbank so
zurückbleibt, wie sie war, und fängt den Fall ab, dass der zweite nur schneller
war, weil inzwischen alles im Cache lag. Median aus fünf Läufen je Anweisung,
`EXPLAIN ANALYZE`, PostgreSQL 17.11.

| Suchbegriff       | Anweisung        | ohne `pg_trgm` | mit `pg_trgm` | wieder ohne |
| ----------------- | ---------------- | -------------- | ------------- | ----------- |
| `a` (trifft alle) | Seite (25 Zeil.) | 0,24 ms        | 0,31 ms       | 0,17 ms     |
| `a` (trifft alle) | Zählung          | 7,18 ms        | 6,88 ms       | 7,12 ms     |
| `okonkwo`         | Seite            | 0,76 ms        | 0,50 ms       | 0,50 ms     |
| `okonkwo`         | Zählung          | 16,33 ms       | **2,46 ms**   | 17,40 ms    |
| `okonkwo amina`   | Seite            | 1,54 ms        | 1,50 ms       | 1,56 ms     |
| `okonkwo amina`   | Zählung          | 16,80 ms       | **2,18 ms**   | 17,11 ms    |

**Die Entscheidung: nein, und F32 bleibt, wie es ist** — jetzt mit einer Zahl
dahinter statt eines Arguments. Drei Dinge stehen in dieser Tabelle:

- Die **Seite** — das, was ein Veranstalter ansieht — kostet unter zwei
  Millisekunden, mit Index wie ohne. Sie hört nach 25 Zeilen auf, und der
  Sortierindex bedient sie; ein Trigramm-Index hat dort nichts zu tun.
- Die **Zählung** ist die Hälfte, die ein Index beschleunigt, und zwar um das
  **Siebenfache** — von 17 auf 2 ms. Siebzehn Millisekunden sind das, was der
  Index einspart, und siebzehn Millisekunden sieht niemand.
- Beim Suchbegriff, der **jede** Zeile trifft, ändert er **nichts** (7,2 gegen
  6,9 ms). Das ist der schlechteste Fall, und es ist genau der, in dem ein
  Trigramm-Index nichts wegnehmen kann.

Dagegen steht, was die Erweiterung kostet: `CREATE EXTENSION` braucht Rechte,
die eine kleine Organisation auf einer gemanagten PostgreSQL nicht unbedingt
hat — das Argument, auf dem F32 von Anfang an steht (NFR 15, Installierbarkeit).
Vierzehn Millisekunden sind dafür zu wenig. Die Entscheidung steht damit **eine
Größenordnung** über dem, was AP 5 gemessen hat, und das Werkzeug, das sie
wieder aufmacht, liegt daneben: wenn je eine Instanz zehnmal so groß wird, ist
es ein Aufruf und keine Diskussion.

#### Was anders lief

**Zwei Fehler fand der Container, kein Test — und beide in der Verdrahtung.**
Der erste: `RuntimeMetricsService` nimmt seine Uhr als Konstruktorparameter mit
Vorgabewert, damit ein Test sie stellen kann. Nest interessiert der Vorgabewert
nicht — es liest den ausgegebenen Parametertyp, findet `Function` und baut den
Container nicht. Der zweite: der neue Port `DATABASE_HEALTH` war in `providers`
gebunden und in `exports` vergessen. Beide Male startete der Server nicht, beide
Male nannte die Meldung den **Verbraucher** (`HealthController`) statt die
Datei, an der es lag, und beide Male war jeder Unit-Test grün — weil jeder
Dienst in seinem eigenen Test mit `new` gebaut wird und **nichts in diesem
Repository den Modulgraphen zusammensetzt**. Das ist die Lücke, und sie hat jetzt
zwei Wachen statt einer Erkenntnis: `operations.module.spec.ts` setzt das eine
Modul zusammen (ohne Datenbank, in einer Sekunde), und
`data-access.module.spec.ts` vergleicht `providers` mit `exports` und wird rot
für **jeden** Port, der gebunden und nicht herausgegeben wird. Die Klasse des
Fehlers bleibt offen und steht in `todo.md`.

**Und eine Messung, die zweimal etwas anderes maß als die Anwendung.** Erst
schien der Ausreißer des Teilnehmer-Szenarios die Schuld des Seeds zu sein —
ein Masseneinfügen lässt Sichtbarkeitsbits und Statistiken liegen, und zwanzig
Leser zahlen das gleichzeitig; das ist plausibel, `seed-registrations.mjs`
räumt es seitdem mit einem `VACUUM (ANALYZE)` weg, und es war **nicht** die
Ursache. Dann schien es der Treiber zu sein — `fetch` benutzt einen
prozessweiten Verbindungspool, dessen Regeln hier niemand gewählt hat, und
trägt Verbindungen von einem Szenario ins nächste; `load.mjs` spricht seitdem
`node:http` mit einem eigenen Pool je Szenario, was die Verbindungsregel zu
einem Teil der Messung macht statt zu einer Eigenschaft dessen, was vorher
lief. Auch das war nicht die Ursache. Was übrig blieb, steht oben als das, was
es ist. Die Lehre daraus ist keine über Datenbanken oder über `fetch`, sondern
die: **eine Messung, deren Aufbau man nicht kennt, misst den Aufbau** — und
deshalb druckt `measure.sh` ihn, bevor es misst, und fährt den Stack selbst
hoch, statt sich auf einen zu verlassen, den jemand anders gestartet hat.

**Und eine grüne Zeile, die kein Lauf war.** `nx run-many -t e2e` hat beide
Browsersuiten aus dem `[local cache]` beantwortet — „330 passed", „266 passed"
—, obwohl in diesem Paket zwanzig Serverdateien geändert worden waren. Der
Grund ist keine Fehlkonfiguration: die Eingaben einer inferierten
Playwright-Task sind ihr eigenes Projektverzeichnis, und `server:serve-e2e`
hängt als **fortlaufende** Task daran, die keine Ausgabe hat und deshalb nicht
in den Schlüssel eingeht. Wie weit das trägt, zeigte derselbe Lauf eine Minute
später: mit `--skip-nx-cache` brach er sofort ab, weil die
Entwicklungsdatenbank seit einem Neustart der Maschine gar nicht lief. Der
Cache hatte also nicht nur eine Serveränderung übersehen — er hätte „grün"
gemeldet, wo ein Lauf überhaupt nicht möglich war. Die Zahlen unten sind
deshalb aus einem Lauf mit `--skip-nx-cache`, und die Regel steht in
`docs/rules/e2e-tests.md`. Die CI ist davon nicht betroffen: sie hält keinen
Nx-Cache zwischen zwei Läufen.

**Was der Bestandsaufnahme gut tat:** die zweiundsechzig Logzeilen waren zu
neunundvierzig Fünfzigsteln in Ordnung. Der Ertrag des Nachlesens waren drei
Einzeiler — und zwei Vorgaben von Bibliotheken, die keiner der zweiundsechzig
Kommentare erwähnt, weil sie in keiner der zweiundsechzig Zeilen stehen. Das
ist dieselbe Form von Befund wie die Kopfzeilen in AP 9: nicht das, was jemand
falsch geschrieben hat, sondern das, was niemand geschrieben hat.

#### Der Stand nach diesem Paket

`nx run-many -t lint test build` grün über **19 Projekte**. Unit-Tests:
**1447** im Server (**zweiundfünfzig** neu: neun für den Protokollpegel, sieben
für den stillen Datenbanklogger, sieben für den Ausnahmefilter — Kennung,
Schwärzung und Zählung —, sechs für die Pfadschwärzung, fünf für die Zählung
selbst, vier für den Betriebsbericht, drei für die Loghygiene, drei für den
Interceptor, je zwei für den Modulzusammenbau, die Ports dieser Schicht und
den Gesundheitsendpunkt, und je einer für die sechste Grenze und die gezählte
Mail), Veranstalter-Client, Nutzer-Client und die geteilten Bibliotheken
unverändert — dieses Paket fasst keinen Client an und
legt **keinen** Katalogschlüssel an, weil es keinen Bildschirm hat.

Browsersuiten, mit `--skip-nx-cache` und damit wirklich gefahren: **330** in
der Veranstaltersuite und **266** in der Teilnehmersuite, beide unverändert,
weil dieses Paket keinen Bildschirm anfasst. Vertragssuite **44** Suiten und
**730** Tests — eine Suite und fünf Tests neu, der Betriebsbericht —, `EXIT=0`,
genau **drei** 429 im ganzen Lauf, alle drei von der Drosselungssuite erbeten.
`tools/shipped-stack/verify.sh`: „the shipped stack is good", **13**
Browsertests, keine Container übrig.

Der Lasttest ist viermal vollständig gefahren, jedes Mal aus leerem Volume und
jedes Mal mit `down -v` am Ende; die Zahlen oben sind aus dem letzten Lauf, und
die drei davor stimmen in Median und Durchsatz mit ihm überein.

Und es bringt **keine Migration**: die einzigen Indizes, die es je angelegt
hat, sind die drei Trigramm-Indizes des Vergleichs, und die hat derselbe Lauf
wieder entfernt. Eine Migration pro Paket ist die Regel für Pakete, die das
Datenmodell anfassen; dieses tut es nicht, und eine leere Migration wäre eine
Zeile Geschichte über nichts.

### AP 11 — Der Plug-in-Vertrag schließt (erledigt, 24.09.2026)

Ein Paket mit **einem Feld** und **zwei Entscheidungen, die nichts gebaut
haben**. Das ist keine Untertreibung, sondern die Form, die E69 diesem Schritt
gegeben hat: 1.3.0 ist der letzte, und was danach fehlt, fehlt bis v1.0. Also
war die Arbeit zur Hälfte, zu entscheiden, was **nicht** hineingehört.

#### Der Fehler, den niemand sehen konnte, der am Veranstaltungsort stand

`PluginSlotContext` trägt Sprache, Worte und Einhängepunkt und nichts über das
Event; `PluginProgramReads` lieferte zwei Zeitpunkte ohne ihre Zone. Also
zeichneten Raumplan und individueller Programmplan ihre Uhrzeiten mit
`Intl.DateTimeFormat` ohne `timeZone` — in der Uhr des **Browsers**. Auf
derselben Seite, ein paar Zentimeter darüber, steht das Programm des Events in
der Zone des Events (E8), gezeichnet vom Host.

Für jemanden im Bürgerhaus stimmen beide Zahlen überein, und genau deshalb hat
es keine Suite gefunden: der Testrechner steht in derselben Zone wie das
Fixture-Event. Aus Toronto gelesen sagte der Raumplan **03:00**, wo das
Programm darüber **09:00** sagte. Beide Zahlen waren „richtig" — sie
beantworteten nur zwei verschiedene Fragen, und eine Seite darf sich das nicht
aussuchen.

Der Test, der das zeigt, musste deshalb die Zone der Maschine erst wegnehmen:
in den Bündeln `vi.stubEnv('TZ', 'America/Toronto')`, in der Browsersuite ein
Playwright-Kontext mit `timezoneId`. Auf diesem Entwicklungsrechner (CEST) wäre
die Zusicherung „der Raumplan zeigt 09:00" sonst **grün gewesen, bevor irgendetwas
gebaut war** — eine Zusicherung, die die Maschine bestätigt statt den Code.

#### Warum die Zone am Port hängt und nicht am Slot

`todo.md` hatte die Antwort nach AP 10 der Phase 4 schon vorbereitet, und das
Paket hat sie geprüft statt sie zu wiederholen. Der Slot sieht billiger aus —
eine vierte zugesagte Eigenschaft neben `locale`, `strings` und `mountPoint`.
Er scheitert an derselben Prüfung wie der `signedIn`-Hinweis, den AP 9 der
Phase 4 abgelehnt hat: **nur eine Seite kennt ein Event.** `navigation` und
`my-registration` hätten nichts zu übergeben, also wäre die Eigenschaft
manchmal berechtigt leer, also müsste jedes Plug-in den leeren Fall behandeln —
und der einzige Rückfall, den ein Bündel dann hat, ist die Zone des Browsers.
Das ist der Fehler, nur mit einer zugesagten Eigenschaft davor.

Am Port reist sie **neben den Zeiten, zu denen sie gehört**:
`PluginProgramItem.timezone`. Ein Plug-in, das eine Uhrzeit hat, hat damit auch
die Zone dazu, und es kann sie nicht vergessen — es müsste sie ausdrücklich
weglassen.

Dieselbe Regel gilt eine Schicht weiter nach außen, und deshalb steht das Feld
auch an `PlannedSession` und `PersonalProgramItem` und nicht einmal am Rand der
Antwort: eine Zone am Rand ist eine, die der nächste Aufrufer nicht mitnimmt.

#### Woher der Host die Zone nimmt — ein Feld, kein Repository

`ProgramPluginReads` brauchte dafür etwas, das es nicht hatte: das Event. Der
naheliegende Weg wäre `EVENT_REPOSITORY` gewesen — vorhanden, global, eine
Zeile Konstruktor. Der Port kann aber Events anlegen, umbenennen und löschen,
und die Naht zu den Plug-ins ist die letzte Stelle, an der man so etwas
herumliegen lässt. Also derselbe Schnitt, den `ProfileDirectory` gegen das
Profil-Repository macht und `ProgramTally` gegen das des Programms: ein neuer
schmaler Port **`EventZones`** mit einer Methode, `zoneOf(eventId)`, gebunden
an dieselbe TypeORM-Klasse wie `EVENT_REPOSITORY` (zweiter Token, `useExisting`)
und mit einem `select` auf genau eine Spalte.

Gelesen wird er **einmal je Liste**, nicht je Sitzung — parallel zu den
Programmpunkten, also ohne zusätzliche Wartezeit —, und das Ergebnis wird auf
jede Zeile gestempelt.

Und eine Kleinigkeit, die eine Entscheidung ist: **es gibt keinen
Programmpunkt ohne Zone.** Wo das Event nicht gelesen werden kann — was nur im
Moment zwischen zwei Lesevorgängen passieren kann, weil eine Löschung das
Programm mitnimmt —, antwortet der Port `null` beziehungsweise eine leere
Liste. Ein erfundenes UTC wäre eine Uhr, die niemand gewählt hat, gezeichnet
neben einem Titel, der gleich verschwindet.

#### Was der Vertrag ausdrücklich **nicht** dazubekommen hat

Ein zweiter Lesevorgang „die Zone dieses Events" lag nahe und ist nicht
gebaut: wer eine Uhrzeit zeichnet, hat einen Programmpunkt gelesen, und wer
keinen gelesen hat, hat keine Uhrzeit. Eine Fähigkeit ohne Füller ist die
Attrappe aus F47. Drei Bündel zeichnen weiterhin in der Uhr des Lesers —
Forum, Programmvorschläge und QR-Check-In —, und das ist kein Versehen: sie
zeichnen, **wann etwas passiert ist**, und das hat keinen Ort. Der Kommentar in
`shared-plugin-kit/when.ts` sagt seit AP 6 der Phase 4 genau das; er ist jetzt
die Begründung für einen optionalen dritten Parameter statt für dessen Fehlen.

#### Die zweite Hälfte von E55: nein, und der Grund ist nicht der Preis (F236)

„Der Plan zeigt an, wo ich einen Platz habe" bräuchte zwei Fähigkeiten: die
Anmeldungen eines Kontos zu einem Event auflösen, und fragen, für welche
Programmpunkte eine Anmeldung einen Platz hält. Die zweite ist eine
Teilnehmerliste, Zeile für Zeile — genau das, wofür `countSignups` bewusst nur
eine Zahl herausgibt. Auf den aktuellen Anspruch verengt wäre sie sicher, und
trotzdem falsch: **die Marke gibt es schon**, dort wo der Platz gebucht wird.
Die Seite „meine Anmeldung" markiert jede Sitzung mit `signedUp`, schreibt
„gebucht" statt der freien Plätze und hebt die Zeile hervor. Eine zweite
Stelle, die dasselbe behauptet, ist eine, die irgendwann etwas anderes
behauptet — und die Wahrscheinlichkeit dafür ist hier hoch, weil die eine Seite
eine Anmeldung kennt und die andere ein Konto.

#### Der Datenexport: kein Port, aber ein Satz, der aufhört, allgemein zu sein (F237)

Das Archiv aus AP 6 trägt die Kerntabellen vollständig und sagt selbst, dass
Forumsbeiträge und Programmvorschläge fehlen. Ein Lese-Port dafür wäre die
**erste Fähigkeit in umgekehrter Richtung** (E59) — bisher erfährt der Kern von
einem Plug-in nur, was im Deskriptor steht. Drei Gründe dagegen, und der dritte
ist der schwerste:

1. Der Kern kann die Tabellen auch nicht selbst lesen; das wäre das Spiegelbild
   von F21.
2. Ein Lese-Port legt den Ausfall eines Plug-ins in einen Bildschirm, auf dem
   jemand ein **Recht** ausübt (NFR 10) — der Export ist die eine Stelle, an der
   „ein Modul hat gerade einen Fehler" nicht als Antwort taugt.
3. Er wäre in der Ecke des Pakets entstanden, das den Vertrag schließt. Eine
   Umkehrung der Richtung, die Phase 4 ausdrücklich entschieden hat, gehört in
   ein Paket mit eigener Risikobegründung, nicht in den letzten Absatz eines
   anderen.

Was stattdessen passiert ist, kostet zwei Katalogschlüssel: das `README.txt`
nennt jetzt die Module, die **diese** Instanz eingeschaltet hat — mit ihren
Titeln aus dem Katalog, gelesen aus dem Deskriptor —, und lässt den Absatz ganz
weg, wenn keines eingeschaltet ist. Aus „drei Dinge fehlen absichtlich, unter
anderem was die optionalen Module speichern" wird „zwei Dinge fehlen
absichtlich" plus ein Absatz, der die Module beim Namen nennt und sagt, wen man
fragt. Die **Löschung** braucht davon nichts: dort sagt jeder Fremdschlüssel
eines Plug-ins schon, was mit seinen Zeilen geschieht.

#### Was anders lief

**Der Compiler hat zwei Dateien gefunden, bevor ein Test es tat.** Ein
Pflichtfeld an `PluginProgramItem` machte die Fixtures der beiden Plug-in-Tests
rot — nicht mit einer fehlgeschlagenen Zusicherung, sondern mit `TS2322`. Das
ist die Eigenschaft, die `PersonalProgramItemDto implements PersonalProgramItem`
und `PlannedSessionDto implements PlannedSession` seit Phase 4 haben sollen:
eine Nutzlast, die von ihrem Modell abweicht, ist ein Build-Fehler und keine
fehlgeschlagene Anfrage. Sie hat hier zum ersten Mal wirklich gegriffen.

**Ein Test, der auf dieser Maschine grün gewesen wäre.** Siehe oben: ohne
`vi.stubEnv` hätte die Zusicherung „der Raumplan zeigt 09:00" die Zeitzone des
Entwicklungsrechners bestätigt. Dieselbe Falle wie ein `[local cache]` in
AP 10 — eine grüne Zeile, die nichts gefahren hat.

**Und ein Prüfskript, das rot meldete, ohne dass etwas kaputt war.**
`tools/spike-verification/verify-plugin-toggle.mjs` — gegen eine laufende
Instanz gefahren, weil dieses Paket seinen neuen Wert bis auf die Leitung
belegen wollte — meldete **vier** rote Prüfungen. Keine davon betraf diesen
Schritt: alle vier suchten den Namen eines Modulschlüssels im **Satz** des
Servers (`body.message`), und seit AP 5 dieser Phase reist eine Ablehnung als
**Code mit Werten** (E64). Das Skript prüfte also eine Antwortgestalt, die es
seit sechs Paketen nicht mehr gibt, an einem Server, der sich völlig richtig
verhielt. Es ist dieselbe Klasse von Befund, die AP 6 der Phase 4 in derselben
Datei gefunden hat, und sie hat denselben Grund: **keine Suite fährt dieses
Skript.** Die vier Prüfungen lesen jetzt `body.code` und `body.params.others`;
drei vollständige Läufe hintereinander sind grün. Die Regel steht in
`docs/rules/tooling-traps.md`.

#### Der Stand nach diesem Paket

`nx run-many -t lint test build` grün über **19 Projekte**. Unit-Tests:
**1461** im Server (**vierzehn** neu: drei für den gestempelten Zonen-Wert am
Host-Port, vier für das `README.txt` mit seinem bedingten Absatz, zwei für die
zwei Richtungen des Vertragsschritts, zwei für die Module im Archivbrief und je
einer für den weiter montierten 1.2.0-Deskriptor, den Plan und den Raumplan);
**17** in `shared-plugin-kit` (fünf neu: die Zone am Formatierer, der Tag, der
mit ihr umzieht, und der Rückfall, der lieber den nackten Zeitpunkt zeichnet als
eine falsche Uhr); **25** im Raumplan-Bündel und **20** im Plan-Bündel (je
eine Lesung aus Toronto). Veranstalter-Client **244** und Nutzer-Client **282**
unverändert — dieses Paket fasst keinen ihrer Bildschirme an. Katalog **1289**
Schlüssel: einer neu (`privacy.export.readme.modules`), einer umgeschrieben
(`…notIncluded` zählt jetzt zwei statt drei Dinge auf).

Browsersuiten, mit `--skip-nx-cache`: Veranstaltersuite **330** unverändert,
Teilnehmersuite **267** bei 65 übersprungenen — ein Test mehr als bisher, und
er läuft nur in Chromium, weil er `module_config` umlegt. Vertragssuite **44**
Suiten und **730** Tests, unverändert in der Zahl: dieses Paket hat dort keine
Tests hinzugefügt, sondern zwei bestehende um die Zone erweitert.
`tools/shipped-stack/verify.sh`: „the shipped stack is good", **13**
Browsertests, 138 s, keine Container übrig.
`verify-plugin-toggle.mjs` gegen die laufende Instanz: alle Prüfungen grün,
darunter die neue — `timezone` steht auf der Leitung, nicht nur im Typ.

**Eine Sache lief dabei schief, und sie gehört nicht zu diesem Paket:** der
erste vollständige E2E-Lauf hat die Teilnehmersuite gar nicht gefahren, weil
**Port 4200 belegt war** — von einem Entwicklungsserver eines anderen
Repositories auf derselben Maschine. Nx meldet das als
`Task "user-client:serve:development" is continuous but exited with code 1`,
und die davon abhängige Suite wird übersprungen; der Lauf endet mit einem
Fehler, der nach diesem Repository aussieht und keiner ist. Die Suite ist
deshalb einzeln gegen **4201** gefahren worden (`BASE_URL` reicht dafür, die
Konfiguration liest sie). Nichts davon ist eine Änderung wert: die Portnummer
in `project.json` ist richtig, und ein fremder Prozess ist kein Grund, sie zu
verstellen.

Und es bringt **keine Migration**: der Vertragsschritt liest eine Spalte, die
`event.timezone` seit AP 3 der Phase 1 hat.

### AP 12 — arc42: die Architektur wird beschreibbar (erledigt, 24.09.2026)

**`docs/arc42/`, zwölf Abschnitte und ein Index, 1527 Zeilen.** Kein Code, keine
Migration, kein neuer Katalogschlüssel — das einzige Paket dieser Phase, das
nichts baut. Was es liefert, ist der Einstieg, den es bis heute nicht gab: wer
dieses Repository zum ersten Mal öffnet, findet die Anforderungen im
Referenzdokument, die Regeln in `docs/rules/`, den Betrieb in `INSTALL.md` und
fünf Phasenprotokolle — und nirgends einen Text, der sagt, **wie das Ganze
geschnitten ist und warum**.

**Die Auflage, unter der das steht, ist E70: arc42 erzählt nichts nach.** Jeder
Abschnitt sagt entweder etwas Neues oder er verweist. Das ist keine Stilfrage,
sondern eine Haltbarkeitsfrage — eine zweite Kopie einer Regel ist eine Regel,
die auseinanderläuft, und dieses Repository hat schon drei Orte, an denen etwas
Wahres stehen kann. Abschnitt 8 besteht deshalb fast nur aus einer Tabelle nach
`docs/rules/`, Abschnitt 9 nennt nicht die Entscheidungen, sondern **wo sie
stehen und wie man darin sucht**, und Abschnitt 11 verweist auf `todo.md`,
statt dessen Haken zu kopieren.

**Nachgemessen statt behauptet.** Zwei Dinge lassen sich an dieser Auflage
mechanisch prüfen, und beide sind geprüft worden:

- **101 relative Verweise** in den zwölf Dateien und dem Index, alle
  auflösend.
- **Null gemeinsame Wortfolgen von neun Wörtern** zwischen `docs/arc42/` und
  `docs/rules/`. Beim ersten Durchgang waren es **25**, verteilt auf drei
  Stellen: Abschnitt 5 hatte die Voraussetzungsregel eines Modulschalters
  ausgeschrieben, Abschnitt 8 zwei Regelsätze aus `i18n.md` und `data-model.md`
  wörtlich zitiert, und Abschnitt 9 trug die E-Nummern-zu-Phase-Tabelle, die
  `docs/rules/README.md` schon führt. Alle drei sind durch Verweise ersetzt — die
  dritte war die wichtigste, denn sie wäre die erste Tabelle gewesen, die
  veraltet.

Was ein Abschnitt **neu** sagt, ist jeweils benannt: Abschnitt 4 nennt zu jeder
der fünf Grundentscheidungen ihren **Preis** (die Schichtung kostet einen Port
je Lesart — zuletzt einen mit einer Methode für ein Feld), Abschnitt 3 listet,
was ausdrücklich **nicht** über die Systemgrenze geht, Abschnitt 10 macht aus
den fünfzehn NFR einen Qualitätsbaum mit **21 Szenarien** samt Nachweis und
benennt am Ende die drei Qualitäten, über die keine Suite dieses Repositories
etwas sagt, und Abschnitt 12 ist vor allem eine **Übersetzungstabelle**:
deutsche Dokumentation, englischer Code, und ohne diese Tabelle findet man den
Bezeichner zum Begriff nicht.

#### Der Plug-in-SDK-Leitfaden — und wie belegt wurde, dass er reicht

Der eine Text, der nirgends stand. Er sitzt in Abschnitt 8 und nicht in einer
dreizehnten Datei, weil der Plan zwölf Abschnitte vorsah und Abschnitt 8 sonst
nur aus Verweisen bestünde.

Das Abnahmekriterium war ungewöhnlich, weil man es einem Text nicht ansieht:
_ein Plug-in kann nach dem Leitfaden gebaut werden, **ohne eine der fünf
kuratierten Umsetzungen zu lesen**._ Behaupten lässt sich das immer. Also ist
es **gemacht** worden: ein **sechstes** Plug-in, `session-notes`, gebaut allein
aus Abschnitt 8 — Deskriptor, Modul, Controller mit Pfad-Guard, eigener Port,
Service, Entity, Migration, TypeORM-Repository, Bündelprojekt, Webkomponente,
Katalogschlüssel in beiden Sprachen, Eintrag in `CURATED_PLUGINS`.

Es hat funktioniert: `nx lint server` grün (also halten die Schichtregeln auch
für ein fremdes Plug-in), die Migration lief beim Start gegen die
Entwicklungsdatenbank, die drei Routen wurden gemappt, der Deskriptor stand in
`/api/config`, das gebaute Bündel kam unter seiner URL, und im Browser hat sich
`<trefaro-plugin-session-notes>` am Einhängepunkt `event-detail` montiert — mit
`eventId`, `locale`, `strings` und `mountPoint` als **Eigenschaften**, den
Worten aus dem Katalog und der Primärfarbe der Instanz (`rgb(31, 111, 92)`), die
es nirgends geschrieben hat. Neun von neun Prüfungen eines kleinen Skripts
grün, darunter die 409, mit der `profiles` sich nicht unter einem laufenden
Abhängigen wegschalten lässt.

**Sechs Dinge fehlten dem Leitfaden**, und jedes davon hätte einen fremden Autor
Zeit gekostet. Sie stehen jetzt darin:

1. **Der Tabellenname.** `plugin_<key>_<name>` — mit **Unterstrichen statt
   Bindestrichen**: aus `session-notes` wird `plugin_session_notes_note`.
2. **Das Bündel ist ein eigenes Bauziel.** Die URL im Deskriptor zeigt auf
   `dist/apps/plugins/<key>/main.js`. Wer `nx build plugin-<key>` vergisst,
   bekommt 404, der Lader vermerkt `failed` — und nichts am Serverbau sagt es
   ihm.
3. **Die Custom Properties sind eine geschlossene, benannte Liste.** Der eigene
   erste Versuch hat `--trefaro-color-text` benutzt; das gibt es nicht, es heißt
   `--trefaro-color-on-surface`. Genau der Fehler, den F222 beschreibt: die
   Deklaration fällt **still** aus, der Browser lässt die geerbte Farbe stehen,
   und auf dem Rechner des Autors sieht es richtig aus. Der Leitfaden führt die
   Liste jetzt.
4. **`ICON_NAMES` ist geschlossen.** Der erste Entwurf nannte `edit_note` — ein
   Name, den es nicht gibt. Ein unbekannter Name bekommt **kein** Icon und wird
   in der Modulverwaltung gemeldet; für ein kuratiertes Plug-in schlägt
   zusätzlich `curated-plugins.spec.ts` fehl, was hier auch passiert ist.
5. **401 kommt vor 404.** Der Leitfaden sagte „ein ausgeschaltetes Plug-in
   antwortet 404, nicht 403" und verschwieg, dass der **Pfad-Guard zuerst** läuft:
   ohne Sitzung ist die Antwort 401, ob an oder aus. Die eigene Prüfung ist genau
   daran rot geworden — der Server hatte recht, die Prüfung hatte unrecht.
6. **Die Moduldatei darf beide Schichten sehen.** Sie liegt über `business/` und
   `data-access/`, also gehören `TypeOrmModule.forFeature` und die Bindung des
   eigenen Ports dorthin. Der Leitfaden hatte nur die Verbote genannt und kein
   Modul gezeigt.

**Das sechste Plug-in ist danach gelöscht worden** (F239) — Quelltext, Bündel,
Registrierung, Katalogschlüssel, Tabelle, Migrationszeile und
`module_config`-Zeile. Ein kuratiertes Plug-in, das niemand angefordert hat,
wäre eine Attrappe (F47); der Beweis gehört in dieses Protokoll, nicht ins
Image. Der Arbeitsbaum ist nachgeprüft sauber, und der Katalog steht unverändert
bei **1289** Schlüsseln.

#### Was nicht gebaut wurde, und warum

**Kein Test für `docs/arc42/`** (F240). Mechanisch prüfbar wären die beiden
Zahlen oben, und beide sind in diesem Paket gemessen worden; die inhaltliche
Prüfung der zwölf Abschnitte weist der Plan der Phase ohnehin **AP 14** zu, so
wie er die Entscheidungen prüft. Ein eigenes Testprojekt wäre eine dritte
Stelle, die etwas über diese Sammlung behauptet — und die Lehre aus AP 11 ist
frisch genug: was unter `tools/` liegt und in keiner Suite läuft, veraltet
still.

#### Was sonst noch auffiel

`CLAUDE.md` behauptete unter _Der Stand in Zahlen_ weiterhin **E1–E59**, obwohl
der Plan dieser Phase E60–E71 vergeben hat. Beim Schreiben von Abschnitt 9, der
genau diese Zuordnung erklärt, ist es aufgefallen und korrigiert worden — mit
dem Zusatz, dass die Prüfung von E60–E71 gegen die Umsetzung in AP 14 noch
aussteht. `docs/rules/README.md` fehlte aus demselben Grund die Zeile für
Phase 5; sie steht jetzt dort, wo die vier anderen stehen.

#### Nachträge

**F238–F240**, dazu **Anhangspunkt 33** im Referenzdokument (Version **1.59**).
In `todo.md` ist _Plug-in SDK documentation_ abgehakt — der letzte offene
Dokumentationspunkt vor `CONTRIBUTING.md`, das AP 13 gehört.

### AP 13 — Der Usability-Test wird vorbereitet, und die Doku wird vollständig (erledigt, 30.09.2026)

Drei Dinge, die nur zusammen ein Paket sind: ein **übergabefähiges Bündel für
den Usability-Test**, die **Beitragsregeln**, die seit Kapitel 6 der Phase 0
offen standen, und die **zwei Werkzeugfragen** aus `todo.md`. Gemeinsam haben
sie, dass keines davon Software ist, die jemand benutzt — und dass alle drei
dieselbe Sorte Schuld abtragen: etwas ist entschieden worden und steht nirgends.

#### Der Test ist vorbereitet, nicht gehalten

`docs/usability-test/` — fünf Dateien, 839 Zeilen, auf Deutsch: ein Index mit
der Frage, die der Test beantworten soll, das Skript, der Beobachtungsbogen, die
Instanz und die Auswertung. **Gefahren wird er von Menschen** (Vorabentscheidung
2), und der Eintrag in `todo.md` ist deshalb nicht erledigt, sondern nach _On a
device — waiting for Marius_ gezogen, wo das andere steht, was auf eine Person
statt auf ein Paket wartet.

**Die Frage ist dreiteilig**, und der Teil, der am meisten wert ist, steht
zuletzt: hält, was die Bögen versprochen haben, als laufende Anwendung (die
sieben Aufgaben, dieselbe Skala von 1 bis 4, damit es mit 2024 vergleichbar
bleibt) — trägt dieselbe Bedienlogik das, was seitdem dazugekommen ist (Konten,
Profile, Suche, Chat, fünf Plug-ins, nie von jemandem getestet, der sie nicht
gebaut hat) — und **würde diese Organisation ihre nächste Reihe darauf fahren,
und was fehlt bis dahin?** Die letzte ist die einzige, deren Antwort „nein, weil
…" lauten darf, ohne dass etwas schiefgelaufen ist.

**Die sieben Aufgaben sind rekonstruiert, und das steht im Skript** (F245). Die
Thesis liegt seit dem 26.08.2026 bewusst nicht in diesem Repository; wörtlich
festgehalten ist von den sieben nur die vierte („Interessent ohne
Teilnehmerstatus kontaktiert Veranstalter"), die übrigen sechs sind aus dem
Use-Case-Diagramm, den vier Mockup-Bögen und der einen dokumentierten Korrektur
abgeleitet. Sie treffen die Anwendungsfälle. Ob sie den **Wortlaut** treffen,
kann nur Kapitel 6 sagen — und genau daran hängt, ob die Zahlen vergleichbar
sind, was der ganze Grund für die Wiederholung ist. Das Skript sagt das an der
Stelle, an der es zählt, nennt die zwei erwogenen und nicht genommenen Kandidaten
(„Anwendung konfigurieren" und „Profil erstellen", beide stehen jetzt in Teil B)
und bittet um fünf Minuten mit der Thesis vor der ersten Sitzung. Eine Lücke, die
man sieht, ist billiger als eine Zahl, die man für vergleichbar hält.

Dazu zehn Aufgaben in Teil B für das, was die Thesis nie getestet hat, mit einer
Rotation, damit über vier Sitzungen jede zweimal drankommt; ein
Beobachtungsbogen, der die Skala der Thesis behält und daneben festhält, was eine
Tabelle nicht fasst (erster Klick, Irrwege, wörtliche Zitate, der Hinweis — falls
einer nötig war — und die Stelle, an der er fiel); und eine Auswertung, die sagt,
wohin ein Befund geht und dass **eine Beobachtung keine Aufgabe ist**: was zwei
von vier Personen passiert, ist ein Befund, was einer passiert, wird notiert und
nicht behoben. Genau so kam 2024 aus sieben Aufgaben **eine** Korrektur.

#### Die Demo-Instanz hat eine zweite Hälfte bekommen

Der Plan nennt `tools/demo-seed/` als die Instanz für den Test. Der Seed konnte
alles, was ein Veranstalter baut — und **nichts** von dem, was der Test prüfen
soll: keine Konten, keine Profile, keine Gespräche, keine Zeile in einem der fünf
Plug-ins. Eine moderierende Person, die erst fünf Profile von Hand erfindet,
bevor die Teilnehmersuche ausprobiert werden kann, stellt eine Rückfrage an
dieses Repository, und das Abnahmekriterium verbietet genau die. Also
`tools/demo-seed/community.mjs`, 320 Zeilen (F243).

Es füllt, was **gefunden** werden muss, und nicht, was die Aufgabe selbst ist:
zehn Konten mit Profilen, **sieben auffindbar und drei bewusst nicht** — der
Schalter aus E37 entscheidet zugleich über Gefundenwerden und Angeschriebenwerden,
und eine Instanz, auf der alle auffindbar sind, führt ihn nicht vor; drei
Gespräche, eines ungelesen; zwei Anfragen von Menschen ohne Konto, damit der
Posteingang des Veranstalters nicht leer ist; drei Forumsthemen mit zehn
Beiträgen, von denen **zwei in der Warteschlange bleiben**; vier Vorschläge in
allen vier Zuständen; drei Räume, von denen einer zu klein ist für die
Arbeitsgruppe darin (fünf Stühle, sieben Anmeldungen) — die Überbuchung ist der
Grund, warum es das Plug-in gibt, und auf einem Plan, auf dem alles passt, ist
sie nicht zu sehen; acht Programmpunkte in drei persönlichen Plänen; und sechs
Menschen, die schon durch die Tür sind. Den ersten eigenen Forumsbeitrag, die
eigene Anmeldung und das eigene Konto macht die getestete Person — das ist die
Aufgabe.

Alles geht wie bisher **durch die API und nie in die Datenbank.** Ein Konto ist
bestätigt, weil jemand den Link in seiner Mail geöffnet hat; ein Beitrag ist
freigegeben, weil der Veranstalter ihn freigegeben hat; ein Ticket ist gescannt,
weil der Code eingelesen wurde, den das Plug-in ausgegeben hat (E53) und nicht
das Selbstbedienungs-Token. Die Überbuchung wird **zurückgelesen** statt
behauptet: sie wird beim Lesen des Plans gerechnet und nirgends gespeichert
(E50), und die einzige Art, sicher zu sein, dass die Demo-Instanz wirklich eine
zeigt, ist, sie zu fragen.

Drei Dinge hängen **nicht** unter einer Reihe und überleben deshalb ein
`--reset`: die eingeschalteten Module, die Profilfragen und die zehn Konten mit
ihren Gesprächen. Ein Konto gehört einem Menschen und nicht einer Veranstaltung,
und **kein Administrator kann ein fremdes Konto löschen** — das ist Absicht
(E65). Ein zweiter Lauf meldet sich deshalb an, statt neu zu registrieren, und
fragt das **einmal** ab statt zehnmal: die Anmelderoute erlaubt zwanzig Versuche
je fünf Minuten je Absenderadresse, und zehn einzeln geprüfte Konten wären im
schlechtesten Fall einundzwanzig Versuche — einer zu viel, um etwas
herauszufinden. Dieselbe Rechnung ist der Grund für **zehn** Konten und nicht
zwanzig: eine Kontoregistrierung zählt gegen dasselbe Kontingent wie die vierzig
Anmeldungen, die schon da sind.

#### `CONTRIBUTING.md` — und vier Dinge, die vorher niemand entschieden hatte

Englisch, wie `README.md` und `docs/INSTALL.md`, und aus demselben Grund: die
Dokumentation dieses Repositories ist Deutsch, weil sie zur Thesis gehört, aber
ein Dokument, das **nach außen** adressiert ist, steht in der Sprache seiner
Leser (F241). Das meiste war Einsammeln, wie `todo.md` es seit Phase 1
vorhergesagt hatte. Vier Punkte waren es nicht, und Marius hat sie entschieden:

- **Vor v1.0 werden keine Pull Requests gemerged.** Mit den Gründen — der
  Vertrag schließt gerade, der kuratierte Satz ist zu, und ein Projekt, das Pull
  Requests sammelt, die es nicht prüfen kann, hat sich nicht geöffnet, sondern
  eine Warteschlange gebaut — und vor allem mit dem, was **stattdessen** hilft:
  Fehlerberichte von einer laufenden Instanz, Installationsprobleme (ein
  Steckenbleiben in `INSTALL.md` ist ein Mangel des Dokuments), Übersetzungen
  (die keine Freigabe brauchen, weil eine Sprachdatei Daten sind, die eine
  Instanz ausliefert), und die Nachricht, dass jemand es betreibt.
- **DCO statt CLA.** Eine Zeile `Signed-off-by`, kein Konto, kein Papier, keine
  Rechteabtretung — und ausdrücklich nichts, womit dieses Projekt später aus den
  Beitragenden heraus umlizenziert werden könnte.
- **Ein Maintainer, namentlich**, mit der Feststellung, dass ein zweiter gesucht
  wird. Das ist eine Tatsache und keine Vorliebe.
- **Kein Plug-in kommt vor v1.0 in den kuratierten Satz** (F242). Die fünf sind
  der Satz, der Vertrag ist bei 1.3.0 geschlossen (E69), und ein Aufnahmeverfahren
  für eine leere Warteschlange wäre ein erfundenes Verfahren statt einer Antwort
  — dieselbe Regel wie F47. Was stattdessen dasteht, ist die nützlichere Hälfte:
  **ein fremdes Plug-in braucht weder Erlaubnis noch dieses Repository.** Es lebt
  im eigenen, baut gegen den Leitfaden aus AP 12, und ein Betreiber nimmt es in
  sein Image.

Dazu, was vorher nirgends stand und für diese Anwendung mehr zählt als für die
meisten: **eine Sicherheitsmeldung geht nicht in ein Issue**, sondern über die
private Meldung von GitHub — was ohne eine Adresse in einer öffentlichen Datei
auskommt.

#### Die zwei Werkzeugfragen: beide bleiben, keines wird umbenannt

`/spikes` und `tools/spike-verification/` beantworten dieselbe Art Frage aus zwei
Richtungen, und es ist die Art Frage, die **keine Testsuite dieses Repositories
sehen kann**: ob der Proxy dieser Installation das Upgrade durchlässt, ob dieser
Mailserver annimmt, was dieser Server sendet, ob der Plug-in-Schalter in
**diesem** Browser ankommt. Die zehn Skripte sind für jemanden am Terminal, die
Seite für den, der vor dem störrischen Browser sitzt — sie ist die schnellste
Antwort auf „bei mir geht es" und liest nichts, was `/api/config` nicht ohnehin
öffentlich ausliefert. Beide stehen jetzt in **§12.4 von `docs/INSTALL.md`**, mit
einer Zeile je Skript und der Anweisung, sie nach einer Installation und nach
einem Update zu fahren (F244).

**Umbenannt wird keines.** „Spike" ist Phase-0-Vokabular für etwas, das heute ein
Deployment prüft — aber fünf Phasenprotokolle nennen die Werkzeuge so, und ein
Protokoll ist ein Nachweis und kein Dokument, das man nachführt. Gefehlt hat nie
ein Name, sondern ein Platz. Die Entscheidung steht deshalb auch dort, wo der
Code ist: im Kommentar der Route und im Kopf der Werkzeug-README.

#### Wie geprüft wurde

Wie bei jedem Paket, das eine Instanz betrifft: **hochgefahren.** Der
Fünf-Container-Stack aus leerem Volume, der Seed dagegen, dann ein Browser.

- Ein vollständiger Lauf **aus leerem Volume**, ohne Fehler und in einem Zug:
  40 Anmeldungen, 35 bestätigt, 4 storniert, eine Einladung an 12 wirklich
  verschickt, ein Widerspruch aus der Mail — und dann die zweite Hälfte: 6
  Module an, 3 Profilfragen, 10 Konten (7 auffindbar), 3 Gespräche mit 8
  Nachrichten, 2 Anfragen, 3 Forumsthemen mit 8 freigegebenen und 2 offenen
  Beiträgen, 4 Vorschläge mit 2 Entscheidungen, 3 Räume mit 10 Sessions und
  **1 Überbuchung**, 8 Punkte in 3 Plänen, 6 Menschen eingecheckt.
- **Ein zweiter Lauf mit `--reset`** gegen dieselbe Instanz: die Konten werden
  wiedererkannt statt verdoppelt, die Profilfragen auch, und die Nachrichten
  eines Gesprächs werden nicht ein zweites Mal geschrieben.
- **Im Browser**, bei 390 Pixeln: die Event-Seite trägt vier Einhängepunkte
  (Vorschläge, Forum, Raumplan, persönlicher Plan), die Programmzeile sagt „4 von
  4 Plätzen belegt", und die Teilnehmersuche zeigt **sechs** Menschen — die
  sieben auffindbaren minus die lesende Person, wie es sein soll; die drei ohne
  Häkchen sind nirgends.
- **Im Browser**, bei 1280 Pixeln: das Event-Dashboard zeigt die vier
  Plug-in-Kacheln, die **E-Mail-Spalte** in den letzten Anmeldungen (die eine
  Korrektur von 2024), zwei Warteschlangen mit je zwei offenen Entscheidungen,
  den Raumplan mit **Seminarraum 1 als überbucht markiert** und die
  Einlassliste, in der vier Namen „Checked in" tragen.
- `nx run-many -t lint test build --skip-nx-cache` über alle 19 Projekte.

#### Was anders lief

**Der Stack konnte keine Mail verschicken, und das war richtig so.** Der erste
Lauf brach mit 503 ab; im Log stand `Error upgrading connection with STARTTLS:
502 5.5.1 Command not implemented`. Mailpit spricht kein STARTTLS, und ein
Produktionsbau verlangt es, solange nichts anderes dasteht — `SMTP_REQUIRE_TLS`
ist in `NODE_ENV=production` standardmäßig an. Genau so soll E62 wirken: die
Lockerung steht in einer `.env` und in keiner Zeile Code, und sie muss jemandem
auffallen. Eine Zeile in der Wegwerf-`.env`, und der Lauf ging durch. Die Zeile
steht jetzt mitsamt Begründung in `03-instanz.md`, weil sie sonst jeden trifft,
der das Bündel benutzt.

**Die Anmelderoute ist für einen Testraum zu streng.** Zwanzig Versuche je fünf
Minuten je Absenderadresse sind für eine Organisation richtig; in einem Raum, in
dem vier Menschen hinter derselben Adresse sitzen und zehn Demokonten dazukommen,
ist das Kontingent nach zwei Runden verbraucht. Die Instanz-Anleitung setzt
`LOGIN_ATTEMPTS_PER_WINDOW` deshalb hoch — dass das überhaupt geht, ohne eine
Zeile Code anzufassen, ist E60 aus AP 2 dieser Phase, und es hat hier zum ersten
Mal jemand außerhalb eines Lasttests gebraucht.

**Drei Anläufe, drei Formfehler, und alle drei waren meine.** Die
Gesprächseröffnung bekam `me.id`, aber `GET /api/participant/me` antwortet
`{ participant, expiresAt }` — der Endpunkt beantwortet „wer ist angemeldet, und
bis wann", und die Hälfte, die der Seed braucht, ist die erste. Ein Raum hat
`description` und nicht `note`. Und der Nachrichtenverlauf paginiert über einen
Cursor und hat deshalb kein `total`, sondern `rows` und `hasMore` — was der
Wiederholungslauf sofort zeigte, weil er die Nachrichten ein zweites Mal
schrieb. Alle drei sind Fälle derselben Sorte: das DTO gelesen, statt die Antwort
zu raten, hätte jedes verhindert.

**Nebenbei aufgefallen und nicht behoben:** die öffentliche Event-Seite schreibt
für jeden nicht angemeldeten Besucher **drei 401 in die Konsole.** Die drei
Plug-ins am Einhängepunkt `event-detail` holen ihre Liste, sobald sie montiert
sind; wer keine Sitzung hat, bekommt dreimal 401 und danach dreimal die richtige
Meldung „anmelden, um mitzumachen". Kaputt ist nichts — aber es ist die
meistbesuchte öffentliche Seite der Anwendung, und drei Fehlermeldungen, hinter
denen kein Fehler steht, sind genau das Rauschen, das einen echten Fehler
unsichtbar macht. Der Slot sagt einem montierten Element alles, was es zum
Entscheiden braucht (E48) — nur nicht, ob jemand angemeldet ist. Eine
Vertragsfrage an einem geschlossenen Vertrag (E69), und deshalb ein Eintrag unter
_Known gaps_ statt einer eiligen Zeile.

Und zwei Kleinigkeiten, die beim Aufräumen auffielen und mitgenommen sind: der
Playwright-MCP-Server legt beim Fahren eines Browsers `.playwright-mcp/` im
Wurzelverzeichnis an, was niemand einchecken will — jetzt in `.gitignore`. Und
`tools/secure-mail/probe.mjs` lag seit AP 3 in einer Form ein, die Prettier
ablehnt (eine Zeile über achtzig Zeichen); `nx format:check` sieht nur
Geändertes und hat es deshalb nie gemeldet, ein `prettier --check` über das
ganze Repository schon.

#### Nachträge

**F241–F245**, dazu **Anhangspunkt 34** im Referenzdokument (Version **1.60**);
der alte Punkt 34 ist 35 geworden. In `todo.md` sind drei Einträge abgehakt — die
Beitragsrichtlinien und die zwei Werkzeugfragen —, der Usability-Test ist nach
_On a device — waiting for Marius_ gezogen, und ein neuer steht unter _Known
gaps_. `CONTRIBUTING.md` hat eine Zeile in der Wissenstabelle von `CLAUDE.md`
bekommen und eine in den Konventionen, weil „vor v1.0 keine Pull Requests" eine
Regel ist, die in jeder Sitzung gilt.

#### Nachtrag, 01.10.2026 — die Thesis lag plötzlich daneben

Das Paket war abgeschlossen, als Marius fragte, ob er die Thesis nicht einfach
hinlegen könne. Konnte er: `.gitignore` führt `docs/thesis/*.pdf`, seit es den
Ordner gibt — die Entscheidung vom 26.08.2026 hält die PDF aus dem
**Repository** heraus, nicht von der Platte. Eine Datei später war die Lücke
geschlossen, um die das Skript noch am Vortag gebeten hatte.

**Die Rekonstruktion war falsch, und nicht nur im Wortlaut.** Die Thesis testete
**vier** Aufgaben aus Veranstaltersicht und drei aus Teilnehmendensicht; abgeleitet
hatte ich drei und vier. „Kontaktieren Sie den Veranstalter" ist **Aufgabe 7** und
nicht Aufgabe 4 — die Zeile im Referenzdokument, auf die ich mich gestützt hatte,
beschreibt die _Situation_ der vierten Aufgabe und nicht ihren Text. Von den
sieben hätte die Ableitung ungefähr drei getroffen.

Jetzt stehen alle sieben **wörtlich aus Anhang H** im Skript, jede zweimal: die
Formulierung von 2024 für das Protokoll und dieselbe Aufgabe an dieser Instanz,
weil die Mockups ein „Global Forum 2024" zeigten und die Demo-Instanz andere
Hauptwörter hat. Die Handlung ist identisch, und nur darauf kommt es an. Die
Bewertungen je Fachperson aus **Anhang I** stehen in der Auswertungstabelle, mit
den Mittelwerten daneben. Zwei Aufgaben, die in Teil A keinen Platz mehr hatten,
sind nach Teil B gezogen (das Einladen Ehemaliger und die Anmeldung zu einem
einzelnen Programmpunkt) — die Rotation ist entsprechend neu.

**Drei Dinge hat Kapitel 6 geliefert, die keine Ableitung je gefunden hätte:**

- **Aufgabe 4 ist mit 2,33 die einzige durchgefallene** (3 · 2 · 2), und das
  Feedback aller drei sagt dasselbe: sie haben in der Teilnehmerübersicht
  gesucht, obwohl die gesuchte Person als Interessentin unter den Nachrichten
  stand. Daraus kam die Korrektur, die dieses Repository seit Phase 1 kennt.
  **Damit hat der Test eine Zeile, an der er sich entscheidet:** bleibt A4 unter
  4, hat die eine Änderung aus 2024 nicht gereicht. Das steht jetzt so in der
  Aufgabe und in der Auswertung.
- **Die 3 bei Aufgabe 3 war ein Werkzeugartefakt**, kein Entwurfsproblem: _„Das
  Event habe ich angelegt, es ist aber nirgendwo sichtbar"_ — Mockups speichern
  nicht. Eine 4 ist dort also der Wegfall eines Artefakts und **kein**
  Fortschritt. Ohne die Thesis hätte die Auswertung genau diesen falschen Erfolg
  gefeiert.
- **Kapitel 6 endet mit dem Auftrag für diesen Test**: vor einer tatsächlichen
  Umsetzung sollten „in einem weiteren Usability-Test die noch nicht evaluierten
  bzw. in den Mockups noch nicht berücksichtigten Use Cases bewertet werden".
  Teil B war die richtige Idee aus dem falschen Grund — jetzt steht der Satz
  darüber, der ihn begründet.

Übernommen wurde ausschließlich das: Aufgabentexte, Bewertungen, die Auswertung
dazu. **Das Interviewmaterial über eine reale Organisation bleibt draußen**, auch
nebenbei.

Geändert: `docs/usability-test/` (Teil A ganz neu, Teil B um zwei Aufgaben und
eine Rotation, Bogen und Auswertung um die Zahlen von 2024), **F245** neu
geschrieben, die Belegstelle in Kapitel 2 des Referenzdokuments geschärft
(Version **1.61**), eine Zeile in `docs/thesis/README.md`, und der Hinweis in
`todo.md`, dass vor der ersten Sitzung noch etwas zu prüfen sei, ist weg — es
ist geprüft.

**Was hängen bleibt:** eine Quelle, die ein Mensch in zwei Minuten danebenlegen
kann, ist billiger als die sauberste Ableitung. Die Ableitung war sorgfältig, sie
war als Ableitung gekennzeichnet, und sie war trotzdem zu über der Hälfte falsch.
**Fragen kostet weniger als ableiten** — und die Frage wäre schon im Paket die
richtige gewesen, nicht erst danach.

### AP 14 — Abschluss der Phase (E71) (erledigt, 01.10.2026) → **Meilenstein M16**

Das Paket baut nichts. Es prüft, räumt auf und stellt fest — und wo es eine
Abweichung findet, wird sie protokolliert und nicht nachgebaut, so wie es der
Plan verlangt. Keine Zeile Code hat sich in diesem Paket geändert, keine
Migration ist dazugekommen, kein Katalogschlüssel.

Vier Arbeiten: **E60–E71 gegen die Umsetzung**, mechanisch, wo es mechanisch
geht; **`todo.md` unter _Checkable after phase 5_** durchgearbeitet, jeder Umzug
mit Grund; **F203 ff.** auf Vollständigkeit; und die **Release-Feststellung**,
die in [`RELEASE-v1.0.md`](RELEASE-v1.0.md) steht, weil sie nicht einem Paket
gehört, sondern dem, was Marius davor liest.

#### Die zwölf Entscheidungen gegen die Umsetzung

Jede Zeile nennt, **woran** geprüft wurde — damit die nächste Prüfung dieselbe
ist und nicht eine ähnliche.

| Nr.     | Geprüft woran                                                                                                                                                                                                                          | Befund                                                                                                                                                                                                                                                                                                                                                         |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **E60** | `core/config/rate-limits.ts`: sieben Werte in `RateLimitEnv`, `RATE_LIMIT_DEFAULTS` gegen die Zahlen, die vorher im Code standen; `rateLimitWarnings()`; `infra/docker-compose.yml` reicht alle sieben durch; `.env.example` nennt sie | **Hält.** 300 / 20 / 60 / 20 / 60 / 5 / 20 — jede Vorgabe ist die Zahl, gegen die die Suiten geschrieben wurden. Eine Anhebung ergibt eine `WARN`-Zeile je Wert, eine Senkung nicht: das ist die Richtung, die sicher bleibt                                                                                                                                   |
| **E61** | `apps/server/.env.serve-e2e` (nur vom Ziel `server:serve-e2e` gelesen); `RATE_LIMIT_PROFILE` in `infra/docker-compose.yml`                                                                                                             | **Hält, und schärfer als gefordert.** E61 verlangt eine Datei, die der Produktions-Stack nicht kennt — die Compose-Datei reicht die Variable zusätzlich **gar nicht** durch, mit Kommentar. Und `MAILS_PER_RECIPIENT_PER_WINDOW` steht im Profil ausdrücklich auf der ausgelieferten Fünf                                                                      |
| **E62** | Suche über das ganze Repository nach `rejectUnauthorized`, `NODE_TLS_REJECT_UNAUTHORIZED`, `ignoreHTTPSErrors`; `smtp-mailer.spec.ts`; `data-source.ts`; `main.ts`; `docker-compose.dev.yml` (`mailpit-secure`)                        | **Hält.** Keine Zeile schaltet die Prüfung ab. Der Mailer hat einen Unit-Test, der genau das behauptet; die Datenbankverbindung setzt `rejectUnauthorized: true`; `main.ts` meldet laut, wenn die Umgebung die Prüfung lockert. Die zwei Werkzeugskripte lesen die Variable aus der Umgebung — eine Lockerung in einer `.env`, genau die Form, die E62 erlaubt |
| **E63** | `docs/INSTALL.md` (SPF, DKIM, DMARC, Absenderdomäne); der Eintrag in `todo.md`                                                                                                                                                         | **Hält.** Vier Punkte als Betreiber-Prüfliste, und die Zustellbarkeit steht nirgends als etwas, das dieses Repository geprüft hätte                                                                                                                                                                                                                            |
| **E64** | `libs/shared-http/src/lib/api-error.ts`; `libs/shared-models/src/lib/problems/problem.ts`; Suche nach `explained` und `problem.detail` in beiden Clients                                                                               | **Hält.** `Problem = { key, params?, reason }`, `reason = { code, params }`. `detail` und `explained` sind weg — kein Treffer in einem Client                                                                                                                                                                                                                  |
| **E65** | `business/privacy/privacy.service.ts` und ihr Port; die beiden Einträge in `todo.md`                                                                                                                                                   | **Hält.** `erase()` zählt in einer Zeile, was ging und was stehen blieb — Anmeldungen weg, Gespräche stehend, Newsletter-Einwilligungen weg, Dateien weg — und die Zeile nennt keine Adresse, weil die Adresse das Gelöschte ist                                                                                                                               |
| **E66** | Jede Datei `*-page.ts` unter `apps/user-client/src/app/` gegen die Mockup-Tabelle aus AP 7 (`comm -23` über beide sortierte Listen)                                                                                                    | **Hält, mechanisch.** Zwanzig Seiten, einundzwanzig Zeilen (die eine mehr ist das Kontaktformular der Event-Seite), **Differenz leer**. Seit AP 7 ist keine Seite dazugekommen, die keine Zeile hätte                                                                                                                                                          |
| **E67** | `apps/user-client-e2e/playwright.config.mts` (`phone`, 390 × 844) und `apps/admin-client-e2e/playwright.config.mts` (`tablet`, 768 × 1024); die drei Desktop-Projekte bei der Vorgabe 1280                                             | **Hält.** Drei Breiten, und die, für die entworfen wird, ist je Client die, bei der ein eigenes Projekt misst                                                                                                                                                                                                                                                  |
| **E68** | Dateien mit `@design` bzw. `@layout`; die Kopfkommentare beider Dateien; die Zahl der übersprungenen Tests im Lauf                                                                                                                     | **Hält.** Genau **zwei** markierte Dateien, je eine je Client. Beide sagen im Kopf, dass sie niemanden registrieren, und der Lauf zeigt es von außen: 65 bzw. 84 übersprungene Tests sind die Projekte, die den Filter nicht treffen                                                                                                                           |
| **E69** | `business/plugin-api/plugin-api-version.ts`; `PluginProgramItem.timezone`                                                                                                                                                              | **Hält.** `PLUGIN_API_VERSION = '1.3.0'`, die Zone am Port, und die Datei sagt selbst, dass danach geschlossen ist                                                                                                                                                                                                                                             |
| **E70** | Alle Sätze ab 60 Zeichen aus `docs/arc42/*.md` gegen alle Sätze aus `docs/rules/*.md`, dem Referenzdokument, `INSTALL.md` und `CLAUDE.md` (Code-Spannen und Links vorher entfernt)                                                     | **Hält, mechanisch: null identische Sätze.** Und jeder Abschnitt verweist oder ist neu — die zwei ohne Verweis auf ein Regeldokument sind die Laufzeitsicht (fünf Abläufe, die es nirgends gab) und das Glossar (eine Übersetzungstabelle Deutsch → Code)                                                                                                      |
| **E71** | `git tag`                                                                                                                                                                                                                              | **Hält.** Leer. Dieses Paket stellt fest und taggt nicht                                                                                                                                                                                                                                                                                                       |

Zwölf von zwölf. Das ist kein besonders gutes Zeichen und auch kein schlechtes:
E60–E71 sind in den Paketen entstanden, die sie umsetzen, und eine Entscheidung,
die beim Bauen geschrieben wird, hält beim Prüfen meistens. Wertvoll an der
Prüfung sind die zwei Zeilen, die **mechanisch** sind — E66 und E70 —, denn sie
sind die einzigen, die auch in einem Jahr noch dasselbe prüfen.

#### `todo.md` unter _Checkable after phase 5_ — durchgearbeitet

Der Abschnitt hatte am Ende **vierundvierzig** Einträge; der Plan nennt oben
zweiunddreißig, und die Differenz ist nicht gewachsene Arbeit, sondern gefundene:
zwölf Einträge sind **in** der Phase dazugekommen, die meisten aus AP 9 und
AP 10, und das sind die Pakete, die ausdrücklich gesucht haben.

- **Achtundzwanzig** waren in der Phase erledigt und abgehakt.
- **Einer** war erledigt und nicht abgehakt — die zwei rennenden Spezifikationen
  der Teilnehmersuite, deren eine Hälfte AP 5 und deren andere AP 6 geschlossen
  hat. Beide Schließungen stehen im Eintrag, das Kästchen stand offen. Genau
  dafür gibt es ein Abschlusspaket.
- **Fünfzehn** sind umgezogen, jeder mit seinem Grund im Eintrag selbst: fünf zu
  _Questions for the pilot partner_, drei zu _Known gaps_, einer zu _On a
  device_ und sechs in einen neuen Abschnitt, **_After v1.0 — looked at,
  understood, and deliberately not built_**.
- **Gestrichen wurde keiner.** Ein gestrichener Eintrag nimmt seine Begründung
  mit, und der nächste Mensch fängt das Nachdenken von vorn an.

Der neue Abschnitt ist die eigentliche Änderung an der Datei. Bis hierher war
jeder Eintrag entweder einer Phase zugeordnet, einem Menschen (`On a device`)
oder dem Pilotpartner — und mit der letzten Phase ging die erste Möglichkeit
aus. Was dort jetzt steht, ist weder Lücke noch vertagte Prüfung, sondern
**angesehen, verstanden und bewusst nicht gebaut**: die Sprache in einem
geteilten Link, die zwei Körpergrenzen von Proxy und Anwendung, der Katalog als
langsamste öffentliche Antwort, die Fehlerkennung ohne gemeinsames Banner, der
Modulgraph ohne Zusammenbau und der socket.io-Adapter, der erst ab dem zweiten
Server-Container existiert.

Zwei Umzüge sind mehr als Buchhaltung:

- **Der Kanal für Sicherheitsmeldungen ist entschieden und nicht eingeschaltet.**
  AP 13 hat in `CONTRIBUTING.md` GitHubs private vulnerability reporting
  benannt — die Option, die keine Adresse in einer öffentlichen Datei braucht.
  Am 01.10.2026 gegen das Repository selbst geprüft: die Einstellung ist
  **aus**. Das Repository ist öffentlich, die Datei ist es nicht, weil die ganze
  Phase 5 ungepusht ist — es liest also noch niemand eine Zusage, die nicht
  gilt. Aber die Reihenfolge ist der Punkt: **die Einstellung geht an, bevor der
  Push die Datei veröffentlicht.** Steht in der Release-Feststellung, weil es
  Marius' Schritt ist und keines Pakets.
- **Der 44-Sekunden-Stillstand des Lasttests zieht zu _On a device_.** Es ist
  der einzige Eintrag der Phase, dessen Antwort Hardware braucht, die dieses
  Repository nicht hat: alles, was sich durch Hinsehen ausschließen ließ, ist
  ausgeschlossen, und übrig bleibt der Unterschied zwischen einem Server und
  einem Entwicklungslaptop, der nebenher Images gebaut hat.

#### F203 ff. und die Zählung

Mechanisch gezählt: **F1–F245 vollständig**, keine Dublette, und genau die vier
dokumentierten Lücken (F62, F129–F131). F203–F245 sind dreiundvierzig Nachträge
in dreizehn Paketen. Anhangspunkt 11 trägt den Abschluss des Vertrags bei 1.3.0,
wie der Plan es vorgesehen hat.

AP 14 legt **zwei** dazu, beide über Fragen, die vorher niemand gestellt hatte,
weil sie erst am Ende entstehen: **F246** — wer eine Version feststellt, was in
die Feststellung gehört und was ein Tag ausdrücklich nicht behauptet — und
**F247** — wohin ein offener Punkt kommt, wenn es keine nächste Phase mehr gibt.
Dazu **Anhangspunkt 35**: Kapitel 6 nennt „Release v1.0" als Ergebnis dieser
Phase und sagt nichts darüber, wer sie ausruft. Das Referenzdokument steht damit
bei **1.62**, und F1–F247 sind vergeben.

#### Was anders lief

- **Eine Zusage stand in einer Datei, deren Kanal nicht existiert.** Siehe oben.
  Gefunden, weil die Prüfung nicht beim Text aufgehört hat: `CONTRIBUTING.md`
  sagt „Security → Report a vulnerability", und die Frage, ob dieser Menüpunkt
  da ist, beantwortet das Repository und nicht die Datei. **Das ist die Klasse
  von Fehler, die ein Abschlusspaket finden muss** — eine Dokumentation, die
  stimmt, solange niemand sie benutzt.
- **Meilenstein M15 war seit dem 21.09.2026 erreicht und stand nirgends.** Die
  Meilensteintabelle setzt ihn hinter AP 8, AP 8 ist an jenem Tag fertig
  geworden — und weder seine Überschrift im Fortschritt noch `CLAUDE.md` sagten
  es. M13, M14 und M16 tragen ihren Vermerk, M15 hat ihn jetzt auch. Derselbe
  Fehlertyp wie das Kästchen darunter, und derselbe Grund: wer ein Paket
  abschließt, schaut auf das Paket und nicht auf die Tabelle daneben.
- **Ein Kästchen war seit zwei Wochen fällig.** Der Eintrag der zwei rennenden
  Spezifikationen erzählt seine eigene Schließung in zwei Absätzen und blieb
  offen. Ein offenes Kästchen an etwas Fertigem ist dieselbe Unwahrheit wie ein
  Haken an etwas Unfertigem — nur die bequemere.
- **`docs/rules/decisions.md` trug drei veraltete Stände, und das ist die
  gefährlichste Datei dafür.** Sie heißt „bestätigte Entscheidungen" und
  existiert, damit niemand etwas erneut aufrollt — also wird sie gelesen und
  geglaubt. Darin stand: „die **fünf** Fragen an den Pilotpartner" (es sind
  einundzwanzig, und sie waren seit Phase 3 mehr), „`CONTRIBUTING.md` wird
  geschrieben, wenn alle Phasen durch sind" (seit AP 13 geschrieben), und
  „jede der **fünf** Zahlen kommt aus der Umgebung" — es sind **sieben**, denn
  AP 4 hat die Grenze für Rücksetz-Links dazugelegt und niemand hat
  weitergezählt; `docs/rules/observability.md` trug denselben Zählfehler als
  „sechste Grenze". Beide Dateien nennen jetzt die maßgebliche Liste statt
  einer Zahl: `RATE_LIMIT_DEFAULTS`. **Eine bestätigte Entscheidung mit
  veraltetem Stand wird erneut diskutiert** — das ist genau der Schaden, den
  die Datei verhindern soll.
- **Die Sprachregel dieses Repositories war an zwei Stellen falsch.**
  `CLAUDE.md` sagt, die Dokumentation sei deutsch, und nennt dabei `todo.md`
  ausdrücklich mit — `todo.md` ist durchgehend **englisch**, und zwar seit der
  ersten Zeile. Ebenso die vier Protokolle unter `docs/spikes/`, die aus Phase 0
  stammen und älter sind als die Regel. Gemessen statt geglaubt: ein Zähler über
  Funktionswörter beider Sprachen, über jede Markdown-Datei des Repositories.
  Die Regel ist jetzt die, die gilt — und die zwei Ausnahmen haben denselben
  Grund wie ein Phasenprotokoll: **ein Protokoll wird nicht nachträglich
  übersetzt**, es ist eine Aufzeichnung.
- **Die Prüfung der zwölf Entscheidungen war zweimal mechanisch und zehnmal
  gelesen**, und das ist die ehrliche Zahl. E66 (jede Seite hat eine Zeile) und
  E70 (kein Satz steht zweimal) ließen sich ausrechnen; die anderen zehn sind
  belegt durch die Stelle, an der sie stehen, und ein Mensch, der sie gelesen
  hat. Wer sie in einem Jahr erneut prüft, prüft bei zehn von zwölf dasselbe nur
  ungefähr. Das ist kein Mangel dieses Pakets, sondern die Eigenschaft von
  Entscheidungen, die über Haltung und nicht über Werte reden — und der Grund,
  warum die zwei mechanischen die wertvollsten sind.

#### Der Stand nach diesem Paket

`nx run-many -t lint test build --skip-nx-cache` grün über **19 Projekte**
(1 m 27 s). Unit-Tests unverändert, weil keine Zeile Code sich geändert hat:
**1461** im Server, **117** in `shared-models`, **17** in `shared-plugin-kit`,
**244** im Veranstalter-Client und **282** im Nutzer-Client. Katalog **1289**
Schlüssel.

Browsersuiten mit `--skip-nx-cache` und `--parallel=1`, gegen eine frisch
hochgefahrene Entwicklungsdatenbank: Veranstaltersuite **330** bei 84
übersprungenen, Teilnehmersuite **267** bei 65 übersprungenen, EXIT=0 nach
4 m 17 s. Die übersprungenen Tests sind die beiden Gestaltungsprojekte und ihr
Filter, also E68 von außen gesehen.

Vertragssuite **44** Suiten und **730** Tests, EXIT=0.
`tools/shipped-stack/verify.sh` noch einmal gefahren, weil eine
Release-Feststellung sich nicht auf eine Messung von vor einer Woche stützen
soll: „the shipped stack is good", **13** Browsertests, **90 s**, keine
Container übrig, EXIT=0.

`todo.md`: _Checkable after phase 5_ geschlossen, **neunundzwanzig** Einträge
und keiner mehr offen. Die Datei hat einen Abschnitt mehr und zwei korrigierte
Einleitungen.

#### Nachtrag, 01.10.2026 — die Phase wird veröffentlicht

Zwei der drei Schritte aus der Release-Feststellung sind noch am selben Tag
getan worden, und die Reihenfolge war der ganze Inhalt.

**Zuerst der Meldekanal, dann der Push.** GitHubs private vulnerability
reporting war aus; eingeschaltet und nachgefragt (`{"enabled": true}`), und erst
danach ging `CONTRIBUTING.md` an die Öffentlichkeit. Die Zusage war damit in
keiner Sekunde öffentlich und unerfüllt — was sie geworden wäre, hätte jemand
die zwei Schritte in der bequemen Reihenfolge gemacht.

**Und davor noch ein Auftrag.** `tools/secure-mail/verify.sh` war seit AP 3 der
Wächter über die Bereitstellungshälfte von E62 und lief nirgends; der Eintrag
dazu stand seit heute Morgen unter _Known gaps_. Er ist jetzt der fünfte
CI-Auftrag, zwischen `e2e` und `images`, bewusst **nicht** in `e2e`: dessen
Mailserver nimmt alles an, und zwei Antworten auf dieselbe Frage an einer Stelle
sind der Weg, auf dem beide aufhören, gelesen zu werden. Vorher kalt auf diesem
Rechner gefahren, weil man einen Auftrag nicht pusht, den man nie hat laufen
sehen.

**Der Lauf.** `c6512b9..dcf2284`, **achtzehn Commits** — die ganze Phase 5 auf
einmal. Lauf `36868215383`, **sieben Aufträge, alle sieben `success`**, rund
sechzehn Minuten. Gelesen wurden die Abschlüsse der Aufträge, nicht der
Rückgabewert des Wartens (`docs/rules/tooling-traps.md`) — und bei den beiden,
die **zum ersten Mal überhaupt** auf einem Runner liefen, zusätzlich ihre
Ausgabe, weil ein grüner Auftrag, der seine Arbeit überspringt, auch grün ist:

- **`stack`** (seit AP 1, nie gelaufen, weil der letzte Push vier Tage älter
  war): fünf Container aus leerem Volume, Ersteinrichtung über den Assistenten,
  Proxy- und Socket-Prüfungen, **13 Browsertests** bestanden, **269 s**.
- **`secure-mail`**: `530` auf den unverschlüsselten Versuch, ein zweites `530`
  auf den unangemeldeten, die Mail durch die dritte Verbindung — und **keine
  `Smtp`-Warnung** beim Start. Die Stille ist das Ergebnis.

**Und dann die Datei, in dieser Reihenfolge und nicht in der bequemen.**
`SECURITY.md` steht seit demselben Tag: wohin ein Bericht geht und was
hineingehört, dass `main` die einzige unterstützte Version ist, solange v1.0
nicht getaggt ist, was hier als Lücke zählt — und, in die andere Richtung, was
stattdessen **dem Betreiber** gehört (ein fehlendes Zertifikat, ein offenes
Relay, ein veröffentlichter Datenbankport), mit dem Zusatz, dass ein Bericht
darüber meist heißt, die Installationsanleitung sei nicht deutlich genug, und
_das_ ist wieder dieses Projekt. Dazu der Satz, den eine selbst gehostete
Anwendung schuldet: eine Behebung hier erreicht niemanden, bis ein Betreiber ein
Image zieht — also sagt eine Veröffentlichung, was ein Betreiber darüber hinaus
tun muss. `CONTRIBUTING.md` verweist seitdem darauf, statt eine zweite Kopie zu
tragen, die auseinanderläuft (E70 gilt nicht nur für arc42).

Damit sind beide Einträge unter _Known gaps_ abgehakt, die zu diesem Punkt
gehörten. **Der Tag ist der einzige Schritt, der noch aussteht** (E71).

---

## Was anders lief — über die ganze Phase

Je Paket steht es oben; das hier sind die fünf Dinge, die man erst sieht, wenn
man vierzehn Pakete nebeneinanderlegt.

**Was nur in der Konfiguration lebt, sieht keine Suite — viermal, in vier
Paketen.** AP 1 ist genau deshalb das erste Paket gewesen, und es hat sich auf
dem ersten Lauf bezahlt gemacht: der Server startete nicht, weil ein erzeugtes
`.env` zwei Mailwerte nicht setzte, und vier fehlende Werte sind in Produktion
keine Warnung, sondern eine Absturzschleife. AP 3 fand, dass der **ausgelieferte**
Stack gar keine Mail verschicken konnte — `SMTP_PORT=587` neben
`SMTP_SECURE=true`, eine Kombination, die nur in einer Compose-Datei existierte
und die deshalb keine Suite je gesehen hat. AP 10 fand zwei
Verdrahtungsfehler, die beide als Container auftraten, der nicht startet, und
deren Fehlermeldungen den _Verbraucher_ nannten statt die schuldige Datei. Und
AP 13 bekam vom strengen Mailserver ein `502 5.5.1 Command not implemented`,
weil Mailpit kein STARTTLS spricht. Vier Funde, keiner davon durch einen Test
findbar, drei davon durch den Container-Auftrag aus AP 1 **wiederholbar**. Die
Lehre der Phase 4 — „wer ‚grün' sagt, hat den Stack hochgefahren" — ist in
dieser Phase nicht bestätigt worden, sondern bezahlt.

**Eine Messung misst, was sie misst, und nicht, was man wissen wollte.** Dreimal
in drei Paketen, und jedes Mal war die Zahl richtig und die Frage falsch. AP 7
fragte „scrollt eine Seite seitwärts?" und bekam schon vor jeder Änderung
überall Nein — unbenutzbar war die **Quetschung**, die man erst auf dem
Bildschirmfoto sieht. Dieselbe Messung fand die Profilseite dreimal, weil drei
Routen hinter dem Anonym-Guard auf sie umleiten, und meldete Überschneidungen
mit einer festen unteren Leiste, unter der Inhalt definitionsgemäß
durchscrollt. AP 10 lief ohne `--parallel=1` und bewies damit nichts, ohne es zu
sagen. Der gemeinsame Nenner ist nicht Schlamperei, sondern Reihenfolge: **die
Frage wird vor der Messung geprüft, nicht nach ihr** — sonst hat man eine Zahl
und hält sie für einen Befund.

**Die Lockerung stand jedes Mal in einer `.env`, und kein einziges Mal in einer
Zeile Code.** E60, E61 und E62 sind drei Formulierungen derselben Regel, und die
Phase hat sie fünfmal angewendet: die sechs Drosselgrenzen (AP 2), die sechste
davon für den Lasttest (AP 10), die Pause zwischen zwei Einladungen (AP 3), das
Zertifikat des strengen Mailservers über `NODE_EXTRA_CA_CERTS` statt über
`rejectUnauthorized: false` (AP 3) — und zuletzt, in einem Paket, das gar keine
Software baute, die Demo-Instanz mit `SMTP_REQUIRE_TLS=false` und
`LOGIN_ATTEMPTS_PER_WINDOW=200` in einer `.env.stack`, die `.gitignore` fernhält
(AP 13). Das Testprofil hebt vier Zahlen an und **eine ausdrücklich nicht**,
damit jeder volle Lauf eine echte Grenze anfasst. Die Suche über das ganze
Repository findet am Ende der Phase keine Zeile, die eine Zertifikatsprüfung
abschaltet.

**Sieben Mal hat die Phase Nein gesagt und den Grund danebengeschrieben.** Die
zweite Hälfte von E55 (F236), der Lese-Port für den Datenexport (F237), ein
Testprojekt für `docs/arc42/` (F240), Textlinks unter 24 Pixeln (F226), ein
Plug-in im kuratierten Satz vor v1.0 (F242), Pull Requests vor dem Tag (F241) —
und, in die andere Richtung, die zwei Werkzeuge aus Phase 0, die **nicht**
weggeworfen, sondern zu Betreiberwerkzeugen erklärt wurden (F244). Sieben Neins
in vierzehn Paketen, jedes an der Stelle, an der jemand später danach sucht. Das
ist derselbe Befund wie am Ende der Phase 4, und er ist der Grund, warum
`todo.md` auch nach dieser Phase nichts verloren hat: **ein begründetes Nein ist
eine Entscheidung, ein unbegründetes eine Auslassung**, und nur das erste
überlebt die Person, die es getroffen hat.

**Und das Teuerste, was die Phase gelernt hat, ist keine Regel über Software.**
AP 13 hat die sieben Aufgaben des Usability-Tests aus dem Use-Case-Diagramm, den
Mockups und einem überlieferten Zitat **rekonstruiert**, sauber als
Rekonstruktion gekennzeichnet — und Marius hat die Thesis mit einem Dateikopieren
danebengelegt, weil `.gitignore` seit jeher einen Platz dafür hatte. Die
Rekonstruktion war zu über der Hälfte falsch, und schlimmer: die echte Quelle
trug zwei Dinge, die keine Ableitung je erreicht hätte — welche Aufgabe
durchgefallen war und dass eine niedrige Bewertung ein Werkzeugartefakt war,
dessen Verschwinden eine Auswertung als Fortschritt gefeiert hätte. **Außerhalb
des Repositories ist nicht außerhalb der Reichweite.** Steht als F245 im
Referenzdokument und als Nachtrag an AP 13; hier steht es, weil es die einzige
Lehre dieser Phase ist, die nichts mit dem Produkt zu tun hat.

### Die Phase in Zahlen

| Maß                              | Ende Phase 4 | Ende Phase 5 |
| -------------------------------- | ------------ | ------------ |
| Projekte                         | 18           | **19**       |
| Server-Unit-Tests                | 1267         | **1461**     |
| API-Vertragstests                | 687          | **730**      |
| Browsertests Veranstalter        | 317          | **330**      |
| Browsertests Teilnehmende        | 258          | **267**      |
| Regeldateien unter `docs/rules/` | 12           | **13**       |
| Katalogschlüssel                 | 1080         | **1289**     |
| `PLUGIN_API_VERSION`             | 1.2.0        | **1.3.0**    |

Dazu, gegen den letzten Commit der Phase 4 gerechnet: **433 Dateien** geändert,
**135** davon neu, +30 265 / −2 448 Zeilen. Entscheidungen **E60–E71**,
Nachträge **F203–F245**, Meilensteine **M13 bis M16**. Neu entstanden sind
`docs/arc42/` (zwölf Abschnitte), `docs/SECURITY-REVIEW.md`,
`docs/usability-test/` (fünf Dateien), `CONTRIBUTING.md`,
`docs/rules/observability.md`, `apps/stack-e2e`, `tools/load-test/`,
`tools/secure-mail/`, `tools/shipped-stack/` und
`tools/demo-seed/community.mjs`.

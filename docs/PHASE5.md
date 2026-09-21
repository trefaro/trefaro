# Phase 5 — Härtung, Gestaltung und Release v1.0

**Status: Plan vom 14.09.2026 — von Marius noch nicht freigegeben.** Alles über
dem Abschnitt _Fortschritt_ ist der **Plan** und wird nicht rückwirkend
korrigiert; was tatsächlich passiert — samt Abweichungen — kommt unten dazu, wie
in [`PHASE1.md`](PHASE1.md), [`PHASE2.md`](PHASE2.md), [`PHASE3.md`](PHASE3.md)
und [`PHASE4.md`](PHASE4.md).

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

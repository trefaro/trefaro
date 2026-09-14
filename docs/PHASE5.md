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

_Noch nichts — die Phase ist nicht freigegeben._ Je Paket kommt hier ein
Abschnitt „erledigt" mit dem, was tatsächlich passierte; Abweichungen vom Plan
stehen hier, damit AP 14 sie nicht rekonstruieren muss.

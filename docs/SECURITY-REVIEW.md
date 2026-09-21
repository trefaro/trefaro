# Sicherheitsreview

**Stand: 21.09.2026, AP 9 der Phase 5.** Gegenstand sind die vier Bereiche, die
`todo.md` seit Phase 1 unter diesem Namen führt: **Authentifizierung**,
**Upload-Validierung**, **Plug-in-Isolation** und die Frage, ob die
**OpenAPI-Beschreibung** weiter öffentlich ausgeliefert werden soll. Dazu ein
fünfter Abschnitt für das, was dabei nebenbei auffiel.

Zum selben Arbeitspaket gehört der **Kehrbesen über das Upload-Volume**
(`tools/upload-sweep/`). Er ist kein Befund dieses Reviews, sondern die Antwort
auf eine Eigenschaft, die `AttachmentsService` schon immer offen benannt hat —
er steht deshalb im Phasenprotokoll und nicht hier.

Jeder Punkt hat einen **Befund** und eine **Entscheidung**. „Kein Befund" heißt:
nachgelesen, und die Sache stimmt — nicht „nicht angesehen". Wo ein Befund
behoben wurde, steht daneben, **was ihn künftig rot macht**; ein behobener
Befund ohne Wächter ist ein Befund, der wiederkommt.

## Wie gelesen wurde

Drei Wege, und keiner davon ist ein Scanner:

1. **Am Code entlang**, Bereich für Bereich, mit den Fragen, die zum Bereich
   gehören — bei einer Sitzung: woher kommt das Geheimnis, wie liegt es, wann
   endet es; bei einem Upload: wer sagt, was die Datei ist, und wie kommt sie
   zurück.
2. **Über die Adressen.** Die zwei Sitzungswächter entscheiden am **deklarierten
   Pfad** (E16, E33), also sagt keine einzelne Datei, welche Endpunkte offen
   sind. Für dieses Review wurde die Liste erzeugt — und ist dabei geblieben,
   als Test (A2).
3. **Gegen die laufende Instanz.** Was nur im Produktionsbuild oder nur hinter
   dem echten Proxy passiert, sieht keine Testsuite dieses Repositories: die
   Kopfzeilen und die abgeschaltete API-Konsole wurden am Fünf-Container-Stack
   geprüft und haben dort ihre Tests bekommen (`apps/stack-e2e`).

Was dieses Review **nicht** ist, steht am Ende.

## A — Authentifizierung und Sitzungen

### A1 — Das Sitzungsgeheimnis

**Befund:** Keiner. 256 Bit aus `randomBytes`, base64url kodiert; gespeichert
wird ausschließlich der SHA-256 (`business/common/session-token.ts`), sodass ein
gestohlener Datenbankabzug keine lebenden Sitzungen aushändigt. Beide
Sitzungsarten benutzen dieselben sechs Zeilen — eine zweite Implementierung wäre
die, bei der eine Seite ein kürzeres Token bekommt.

**Entscheidung:** Unverändert.

### A2 — Die Cookies, und die Regel, die an ihnen hängt

**Befund:** Die Flags stimmen — `HttpOnly`, `SameSite=Lax`, `Secure` in
Produktion, `Path=/api`, und zwei getrennte Namen für die zwei Identitäten
(E34). Daran hängt die Entscheidung, **kein CSRF-Token** zu führen: beide
Clients erreichen die API gleichursprünglich, also trägt kein Cross-Site-Request
das Cookie. Der Preis ist eine Regel, die der Rest der API einhalten muss —
**nichts, was Zustand ändert, ist ein GET** — und die stand in zwei Kommentaren.
Niemand konnte sagen, welche Adressen diese Instanz überhaupt offen anbietet.

**Entscheidung: behoben.** `apps/server/src/app/route-access.spec.ts` liest die
Deklarationen aller Controller des Images — Kern **und** Plug-ins — und rechnet
aus, was die zwei globalen Wächter daraus machen. **171 Adressen: 98 hinter der
Veranstaltersitzung, 32 hinter der Teilnehmersitzung, 41 offen.** Die 41 stehen
als Liste im Test, gruppiert nach dem **Grund**, aus dem sie offen sind — die
vier Türen in eine Sitzung, was das Produkt ohne Login verspricht, die neun
öffentlichen Schreibzugriffe (alle namentlich gedrosselt) und die
token-autorisierte Selbstbedienung von E11. Wer eine Adresse öffnet, ändert
diese Liste und schreibt daneben, warum.

Der Wächter beißt: ein `@Controller('downloads')` statt
`@Controller('admin/attachments')` macht den Test rot mit
`+ "GET /api/downloads/:id"`.

### A3 — Die zwei Wächter

**Befund:** Keiner. Global registriert und am deklarierten Pfad entschieden,
nicht an einem Dekorator — ein vergessenes `@UseGuards` wäre sonst ein offener
Endpunkt, und Plug-in-Controller schreiben andere Leute. `@AllowAnonymous` kommt
vier Mal vor: die zwei Anmeldungen, die zwei Abmeldungen. Die Ersteinrichtung
trägt es am Controller und liegt zusätzlich hinter `SetupGuard`, der beide
Routen schließt, sobald es einen Administrator gibt.

**Entscheidung:** Unverändert — und die 41 offenen Adressen sind mit A2 einzeln
durchgegangen worden, statt dem Prinzip zu vertrauen.

### A4 — Passwörter

**Befund:** Keiner. argon2id mit den Vorgaben der Bibliothek, absichtlich nicht
konfigurierbar; eine Organisation, die ihre eigene Instanz betreibt, soll über
Speicherparameter nicht nachdenken müssen. Eine unbekannte Adresse kostet
dieselbe Zeit wie eine bekannte (`equalizeTiming`), also lässt sich das
Anmeldeformular nicht als Kontoverzeichnis benutzen. Die Richtlinie ist eine
Länge und keine Zeichenklassen (NFR 4).

**Entscheidung:** Unverändert.

### A5 — Ein Veranstalter konnte sein Passwort nicht ändern

**Befund:** Der schwerste des Reviews. Das Passwort eines Veranstalterkontos war
das, was bei seiner Entstehung gesetzt wurde — von wem auch immer die Instanz
installiert hat, in eine `.env` getippt, oder von einer Kollegin beim Anlegen
gewählt. `admins.controller.ts` hatte drei Routen: auflisten, anlegen, löschen.
Keine vierte.

Der einzige Weg, ein Passwort zu wechseln, war deshalb: ein zweites Konto
anlegen und das erste löschen. Das ist nicht nur umständlich — es **kostet die
Zuordnung**: `plugin_program_proposal.decided_by` und
`plugin_forum_post.decided_by` sind `SET NULL`, also verlieren die
Moderationsentscheidungen dieses Kontos ihren Namen. Eine Zugangsdatei, die man
weitergegeben hat, ließ sich nicht zurücknehmen, ohne die Geschichte
mitzunehmen.

**Entscheidung: behoben.** `PUT /api/admin/me/password`, mit dem aktuellen
Passwort — denn diese Sitzung kann ein unverschlossener Laptop sein — und danach
enden **alle anderen** Sitzungen dieses Kontos. Ein eigener Controller
(`admin/me`) statt einer vierten Route auf `admin/admins`: dort ist das Subjekt
jemand anderes und kommt als Id aus einer Tabelle, hier ist es die Sitzung und
es gibt gar keine Id, die man verwechseln könnte. Im Client eine eigene Seite
unter `/account`, erreichbar über den Namen im Menü.

**Bewusst ohne Zurücksetzen-Link.** Ein Link geht an eine Adresse, und die
Adresse eines Veranstalters ist die, von der diese Instanz ihre eigene Post
verschickt; eine Instanz mit falsch konfiguriertem Mailserver würde eine Tür
aushändigen, die niemand erreichen kann. Wer ausgesperrt ist, bekommt von einem
anderen Veranstalter ein neues Konto — und die Seite sagt das, statt es jemanden
herausfinden zu lassen.

Wächter: fünf Unit-Tests am Dienst, fünf Vertragstests auf der Leitung
(`apps/server-e2e/src/api/admin-password.spec.ts`, auf einem Wegwerfkonto, das
die Suite selbst anlegt und wieder löscht), fünf am Formular, drei im Browser.

### A6 — Wann eine Sitzung endet

**Befund:** Keiner. Abmelden löscht die Zeile, der Ablauf gleitet mit der
Benutzung, ein Intervall räumt abgelaufene Zeilen weg, und das Löschen eines
Kontos nimmt seine Sitzungen mit — `admin_session` hängt an `admin_user` mit
`ON DELETE CASCADE`, es braucht dafür keinen Code. Seit A5 kommt „alle anderen"
beim Passwortwechsel dazu.

**Entscheidung:** Unverändert.

### A7 — Drosselung

**Befund:** Keiner, und der Bereich ist jung: AP 2 dieser Phase hat die
Grenzwerte konfigurierbar gemacht (E60), mit den heutigen Zahlen als Vorgabe und
einem lauten Startprotokoll für jede Lockerung. Über allem liegt ein globaler
Zähler, darunter fünf benannte; der WebSocket-Handschlag zählt in denselben
Speicher (`handshake-throttle.ts`), weil engine.io antwortet, bevor der Router
von Nest zum Zug kommt.

**Entscheidung:** Unverändert. Ob die Zahlen selbst richtig sind, ist keine
Frage an den Code — sie stehen als zwei Einträge in `todo.md` unter _Questions
for the pilot partner_.

### A8 — Wessen Adresse gezählt wird

**Befund:** Keiner. `trust proxy` steht auf **1**: genau ein Hop, weil genau ein
Reverse Proxy den Port veröffentlicht. Eine größere Zahl — oder `true` — ließe
einen Anrufer sein eigenes `X-Forwarded-For` vorschieben und damit an jedem
Zähler vorbeigehen. CORS führt eine Liste aus zwei Ursprüngen, die aus der
Konfiguration kommen, und `credentials: true` steht nicht neben einem
Platzhalter.

**Entscheidung:** Unverändert.

### A9 — Was die Instanz beim Start über sich sagt

**Befund:** Keiner. `startupWarnings` nennt die Fälle, in denen eine
Konfiguration _vorhanden_ und _falsch_ ist — ein `Secure`-Cookie über
klartextliches HTTP (niemand kann sich anmelden), ein Mailserver auf
`localhost`, ein Absender ohne Domain, eine entfernte Datenbank ohne TLS. Die
Lockerungen der Drosselung und der Mailverschlüsselung protokollieren sich
getrennt, weil sie Entscheidungen sind und keine Mängel.

**Entscheidung:** Unverändert.

## B — Upload-Validierung

### B1 — Was angenommen wird

**Befund:** Keiner. Der Katalog der Typen ist geschlossen (F38), und jeder Typ
darin wird gegen seine **eigenen ersten Bytes** geprüft — der `Content-Type`
einer Multipart-Grenze schreibt der Absender. Ein Unit-Test behauptet für beide
Kataloge, dass kein Typ ohne Signatur darin steht. SVG ist in keinem von beiden,
und das ist der Grund, aus dem die Medienrouten überhaupt ruhig sein können.

**Entscheidung:** Unverändert.

### B2 — Wie viel

**Befund:** Ein kleiner. Die Grenzen selbst sind vollständig: je Datei
(`MAX_UPLOAD_BYTES`, 10 MB), je Einreichung (`MAX_SUBMISSION_BYTES`, 20 MB, im
Dienst geprüft), Anzahl der Dateien, Anzahl der Textteile, und
`defParamCharset: 'utf8'`, ohne das „Grüße.pdf" als Mojibake ankäme. Der Befund
ist das Paar: der Proxy lässt **25 MB** durch und die Anwendung **20**, damit
die Anwendung diejenige ist, die nein sagt — und diese Beziehung hält ein
Kommentar in `infra/nginx/trefaro-locations.conf`, sonst nichts.

**Entscheidung: notiert** (`todo.md`). Ein mechanischer Wächter bräuchte
entweder einen Test, der aus dem Server-Projekt heraus eine Infrastrukturdatei
liest — und dann von Nx' Cache falsch als frisch geführt würde —, oder einen
25-MB-Upload gegen den echten Proxy. Für zwei Zahlen, die sich nur zusammen
ändern, ist beides zu teuer; die Notiz nennt die Bedingung.

### B3 — Der Dateiname

**Befund:** Keiner. `safeFileName` läuft **zweimal**: beim Speichern, bevor der
Name in eine Spalte geht, und beim Ausliefern, bevor er in eine Kopfzeile geht.
Keine Verzeichnisse, keine Steuerzeichen, keine Anführungszeichen, begrenzte
Länge. `Content-Disposition` ist **immer** `attachment` und nie `inline` — eine
Datei, die der Browser an dieser Stelle rendern würde, liefe im Ursprung des
Veranstalter-Clients.

**Entscheidung:** Unverändert.

### B4 — Wo die Bytes liegen

**Befund:** Keiner. Fünf Teilbäume, deren erster Pfadteil die Art der Datei
nennt (E19); generierte Namen ohne Endung, also lädt nichts zum Raten ein und
nichts kann versehentlich als sein Dateiname ausgeliefert werden; `writeFile`
mit `flag: 'wx'`, also überschreibt eine Kollision niemandes Dokument; und
`absolute()` lehnt jeden Pfad ab, der die Wurzel verlässt — nicht als erste
Verteidigung, sondern als die, die noch hält, wenn eine Zeile einmal nicht von
`save()` geschrieben wurde.

**Entscheidung:** Unverändert.

### B5 — Wie die Bytes zurückkommen

**Befund:** Keiner. Ein Registrierungsanhang hat **einen** Weg nach draußen, und
der liegt hinter der Veranstaltersitzung; das Volume wird nirgends statisch
ausgeliefert. Jede Route, die gespeicherte Bytes ausliefert — der Anhang, die
vier öffentlichen Medienrouten, das ZIP des Datenexports — trägt
`X-Content-Type-Options: nosniff` und eine eigene
`Content-Security-Policy: default-src 'none'; sandbox`. Der Typ eines
gespeicherten Bildes wird beim Ausliefern aus seinen ersten Bytes entschieden,
nicht aus einer Spalte.

**Entscheidung:** Unverändert. Die öffentliche Avatar-Route hat ihr eigenes
Argument, und es steht ausgeschrieben in
`profile-avatar-media.controller.ts` — es hängt daran, dass die Teilnehmersuche
niemals die Id eines Profils aushändigt, das sie nicht zeigen würde.

### B6 — Das ZIP des Datenexports

**Befund:** Keiner. Selbst gebaut, ohne Kompression und ohne
Verzeichniseinträge — ein Pfad mit `/` darin ist für jeden Entpacker ein
Verzeichnis, und es gibt hier keinen. Die Namen der Anhänge laufen erneut durch
`safeFileName` und danach durch eine Kollisionsauflösung. Also kein Zip-Slip
über einen hochgeladenen Dateinamen.

**Entscheidung:** Unverändert.

### B7 — Die Bildmaße

**Befund:** Keiner. `image-dimensions.ts` liest **Kopfdaten** und dekodiert
nichts. Ein hochgeladenes Bild wird nie umkodiert und nie skaliert, also gibt es
in dieser Anwendung keine Stelle, an der eine Dekompressionsbombe Speicher
kostet.

**Entscheidung:** Unverändert.

## C — Plug-in-Isolation

### C1 — Was ein Plug-in importieren darf

**Befund:** Keiner. Eine ESLint-Regel über den Importpfad erlaubt aus
`src/plugins/**` genau `app/business/plugin-api` und sonst nichts vom Wirt; die
Antwort auf einen Verstoß war schon in Phase 4 ein Port und keine Ausnahme.
Dieselbe Regel hält die Schichten innerhalb eines Plug-ins auseinander.

**Entscheidung:** Unverändert.

### C2 — Welche Adressen ein Plug-in bekommt

**Befund:** Keiner. `plugin-controllers.spec.ts` behauptet über jeden Controller
jedes eingehängten Plug-ins: der Pfad beginnt mit `admin/`, `participant/` oder
`user/` **und** dem eigenen Schlüssel, der Schlüssel ist deklariert, der
Schalter-Guard hängt dran, und **kein weiterer Guard** — ein Plug-in erfindet
keine Authentifizierung und kann auch keine zurücknehmen.

**Entscheidung:** Unverändert.

### C3 — Was ein Plug-in am Schema tun darf

**Befund:** „Ein Plug-in fasst keine Kerntabelle an" (F21) stand in drei
Docstrings und wurde von nichts geprüft. Das ist die Regel, die hält, bis jemand
in Eile eine Spalte anbaut.

**Entscheidung: behoben.** `apps/server/src/plugins/plugin-schema.spec.ts` liest
die Migrationsdateien aller Plug-ins als Text und nennt jede Tabelle, auf die
sich ein `CREATE`/`ALTER`/`DROP TABLE`, ein `CREATE INDEX` oder ein `TRUNCATE`
richtet; keine davon darf ohne `plugin_` anfangen. Ein Fremdschlüssel **in** eine
Kerntabelle bleibt ausdrücklich erlaubt — so hängt sich ein Plug-in überhaupt an
ein Event. Der Wächter beißt: `ALTER TABLE "admin_user"` in der Forum-Migration
macht ihn rot mit dem Dateinamen und dem Tabellennamen.

### C4 — Was ein Plug-in lesen darf

**Befund:** Keiner. Über Ports in `plugin-api`, versioniert
(`PLUGIN_API_VERSION`), und die Erweiterung des Vertrags ist ein eigenes Paket
(AP 11, E69).

**Entscheidung:** Unverändert.

### C5 — Ein Plug-in im Browser

**Befund:** Ein Plug-in-Bündel wird gleichursprünglich geladen und läuft mit
vollen Seitenrechten. Das ist bekannt, beabsichtigt und der Grund, weshalb die
kuratierte Liste im Image liegt und es keine Fremdinstallation zur Laufzeit gibt
(`todo.md`, Plug-in-SDK). Der Befund ist ein anderer: bis zu diesem Review war
„gleichursprünglich" das **einzige**, was überhaupt eine Grenze zog — ein Bündel
hätte ein Skript von irgendwo nachladen können, und nichts hätte es abgelehnt.

**Entscheidung: behoben** als Teil von E1: `script-src 'self'` heißt, dass auch
ein Plug-in nichts von außerhalb dieser Instanz nachlädt.

## D — Die OpenAPI-Beschreibung

### D1 — Bleibt sie öffentlich?

**Befund:** Die Frage war offen — bis hierher war es „ja, weil die Quelle
ohnehin AGPL ist", und das ist ein Argument und keine Entscheidung. Beim
Nachsehen stellte sich heraus, dass die Adresse **zwei** Dinge ausliefert: die
Beschreibung (`/api/docs-json`) und eine bedienbare Konsole (`/api/docs`).

**Entscheidung: zwei Antworten, und das ist die Entscheidung.**

- **Die Beschreibung bleibt öffentlich, überall.** Das alte Argument trägt: jede
  Adresse, jeder Parameter und jede Antwortform darin ist aus der
  veröffentlichten Quelle in einem Nachmittag herzuleiten. Sie zu verstecken
  kostet NFR 8 eine dokumentierte API und bringt einem Angreifer nichts, was er
  nicht lesen könnte. Ein Integrator zeigt einen beliebigen Betrachter auf
  `/api/docs-json`.
- **Die Konsole läuft in Produktion nicht.** Das ist nicht dieselbe Frage:
  Swagger UI ist ein paar hundert Kilobyte fremdes JavaScript **im Ursprung des
  Veranstalter-Clients**, und dass das Sitzungscookie `HttpOnly` ist, hilft
  dagegen nicht — Skript in diesem Ursprung stellt die Anfrage einfach selbst.
  Dazu ist ihr „Try it out" eine authentifizierte Anfragekonsole, die jeder
  erreicht, der einem Veranstalter einen Link schicken kann. Dafür bekommt eine
  selbstgehostete Instanz nichts zurück, was die Beschreibung nicht auch gibt.

Umgesetzt als `servesApiConsole(nodeEnv)` in
`apps/server/src/app/core/config/api-docs.ts` — eine Funktion und nicht ein
Vergleich im Hochfahren, weil das Hochfahren die eine Datei dieser Anwendung
ist, die kein Unit-Test erreicht. Wächter: zwei Unit-Tests, und zwei Tests gegen
den ausgelieferten Stack (`/api/docs-json` → 200, `/api/docs` → 404).

## E — Was nebenbei auffiel

### E1 — Die Seiten selbst hatten keine Inhaltsrichtlinie

**Befund:** Jede Route, die gespeicherte Bytes ausliefert, setzte eine
`Content-Security-Policy` für diese Bytes — und die Dokumente, die diese Bytes
_anzeigen_, setzten keine. Der Proxy lieferte `X-Content-Type-Options`,
`X-Frame-Options` und `Referrer-Policy` und sonst nichts. Ein eingeschleustes
`<script src="https://…">` wäre gelaufen; dass keines existiert, war eine
Eigenschaft des Codes und nicht etwas, das jemand ablehnt.

**Entscheidung: behoben.** Eine Richtlinie in
`infra/nginx/trefaro-locations.conf`, auf Server-Ebene neben den drei
bestehenden Kopfzeilen — in einem `location`-Block hätte sie die Vererbung der
drei anderen abgeschaltet, was die klassische nginx-Falle ist. Alles ist
`'self'`, weil diese Anwendung keinen Dritten enthält: Schriften liegen in den
Client-Images (nie ein Font-CDN, NFR 2), die Plug-in-Bündel unter
`/api/plugins/`, das Manifest unter `/api/config/`. Zwei enge Ausnahmen —
`style-src 'unsafe-inline'`, weil Angular Komponentenstile als `<style>`
einhängt und `index.html` die Zeilen für den Ladebildschirm trägt, und
`img-src blob: data:` für die Vorschau einer gerade gewählten Datei.
`script-src` bekommt keine.

Zwei Sätze, die dabei zu Kopfzeilen werden: **`frame-src 'none'`** ist das
Produktversprechen „externe Medien werden verlinkt, nie eingebettet", und
**`Permissions-Policy: camera=(self), …`** sagt, dass von allen
Gerätefähigkeiten genau eine gebraucht wird — die Kamera des Check-In-Scanners,
der als Web Component im Veranstalter-Client läuft.

Wächter: sechs Tests in `apps/stack-e2e/src/security-headers.spec.ts`, und zwei
davon sind die wichtigeren: sie öffnen beide Clients und lesen die Konsole mit,
denn eine zu strenge Richtlinie zerbricht eine Seite leise.

**Und genau das taten sie beim ersten Lauf.** Beide Clients meldeten
„Executing inline event handler violates … 'script-src 'self''", und der
Handler war keiner, den jemand geschrieben hatte: der Produktionsbuild von
Angular schiebt mit `optimization.styles.inlineCritical` das Stylesheet auf und
erzeugt dafür
`<link rel="stylesheet" media="print" onload="this.media='all'">`. Ohne den
Handler bleibt das Blatt `media="print"` — die Seite rendert mit dem
eingebetteten Bruchstück allein. Behoben ist es, indem das Aufschieben
abgeschaltet wird und **nicht**, indem die Richtlinie `'unsafe-hashes'`
bekommt: das wären ein paar Millisekunden Erstdarstellung gegen eine Ausnahme
in der Zeile, um die es hier geht. Die Falle steht in
`docs/rules/angular-clients.md`; dass sie überhaupt auffiel, ist der ganze
Grund, warum die zwei Tests eine Seite öffnen statt eine Kopfzeile zu lesen.

### E2 — Der Health-Endpunkt spricht selbst mit der Datenbank

**Befund:** `core/health/health.controller.ts` injiziert die `DataSource` und
führt `SELECT 1` aus. Die ESLint-Regel für strenge Schichtung greift für
`src/app/business/**` und `src/plugins/**`, nicht für `src/app/core/**` — also
ist das kein Verstoß gegen eine Regel, aber es ist eine Stelle außerhalb der
Datenzugriff-Schicht, die mit PostgreSQL spricht. Ein Datenbankwechsel müsste
diese Datei mit anfassen, und genau das soll die Schichtung ausschließen.

**Entscheidung: notiert** (`todo.md`). Kein Sicherheitsbefund, und die Behebung
ist ein Port von zwanzig Zeilen — aber sie gehört nicht in ein Paket, dessen
vier Bereiche anders heißen. AP 12 beschreibt die Architektur und darf dabei
nichts beschreiben, was nicht stimmt.

### E3 — Es gibt keinen Weg, eine Lücke zu melden

**Befund:** Das Repository hat `README.md` und die Lizenz, aber keine
`SECURITY.md` — also keinen Kanal, über den jemand eine gefundene Schwachstelle
melden könnte, ohne sie öffentlich in ein Issue zu schreiben. Für ein
öffentliches AGPL-Projekt ist das die eine Datei, die ein Sicherheitsreview
nicht auslassen sollte.

**Entscheidung: notiert** (`todo.md`), weil das Einzige, was fehlt, nichts ist,
was in diesem Repository entschieden werden kann: der Kanal. Zwei Möglichkeiten,
beide in der Notiz — GitHubs privates Melden einschalten, oder eine Adresse
nennen, die jemand liest.

### E4 — Die Datenzugriff-Schicht ließ sich nicht in einen Unit-Test ziehen

**Befund:** Fiel auf, als das Inventar von A2 zuerst über `AppModule` laufen
sollte: `typeorm-content-translation.repository.ts` importierte einen Typ über
einen tiefen Pfad in das Paket hinein
(`typeorm/query-builder/QueryPartialEntity`). Der Pfad löst sich für den
Anwendungsbuild auf und für die Spec-Übersetzung nicht — also scheiterte jede
Spec, die irgendwie bis zur Zusammensetzung reichte, an einem `TS2307` in einer
Datei, die mit ihr nichts zu tun hat.

**Entscheidung: behoben.** Der Typ wird jetzt aus dem Query Builder selbst
abgeleitet (`Parameters<typeof insert.values>[0]`), und die Falle steht in
`docs/rules/tooling-traps.md`. Das Inventar liest trotzdem den Quellbaum statt
den Modulgraphen, und zwar aus einem eigenen Grund, der im Test steht.

## Die Befunde auf einen Blick

| Nr.    | Befund                                                                | Entscheidung                                                   |
| ------ | --------------------------------------------------------------------- | -------------------------------------------------------------- |
| **A2** | Welche Adressen offen sind, sagte keine Datei                         | **behoben** — Inventar als Test, 41 offene mit Begründung      |
| **A5** | Ein Veranstalter konnte sein Passwort nicht ändern                    | **behoben** — `PUT /api/admin/me/password` und eine Seite      |
| **B2** | Proxy-Grenze und Anwendungsgrenze hängen an einem Kommentar           | notiert (`todo.md`)                                            |
| **C3** | Nichts prüfte, dass eine Plug-in-Migration Kerntabellen ausspart      | **behoben** — `plugin-schema.spec.ts`                          |
| **C5** | Nichts hinderte ein Plug-in-Bündel am Nachladen von außen             | **behoben** mit E1                                             |
| **D1** | Öffentliche OpenAPI-Auslieferung war ein Argument, keine Entscheidung | **entschieden** — Beschreibung ja, Konsole nicht in Produktion |
| **E1** | Die Clients hatten keine Content-Security-Policy                      | **behoben** — CSP und Permissions-Policy am Proxy              |
| **E2** | Der Health-Endpunkt spricht selbst mit der Datenbank                  | notiert (`todo.md`)                                            |
| **E3** | Kein Weg, eine Schwachstelle zu melden                                | notiert (`todo.md`) — der Kanal ist eine Entscheidung          |
| **E4** | Ein tiefer Typ-Import sperrte die Datenzugriff-Schicht aus Tests aus  | **behoben** — Typ aus dem Builder abgeleitet                   |

Sechsundzwanzig Punkte angesehen, zehn Befunde, sechs behoben, einer
entschieden, drei notiert. Keiner der drei notierten ist eine offene Lücke: es sind zwei
Wartungsrisiken und eine Entscheidung, die ein Mensch treffen muss.

## Was dieses Review nicht ist

- **Kein Penetrationstest.** Es hat nichts angegriffen; es hat gelesen,
  aufgelistet und an einer laufenden Instanz nachgesehen.
- **Keine Abhängigkeitsprüfung.** Welche Bibliothek eine bekannte Lücke hat,
  beantwortet ein Werkzeug, das täglich läuft, und nicht ein Paket, das einmal
  lief. Das gehört zu NFR 3 und in den Betrieb.
- **Keine Aussage über den Betrieb.** TLS, Backups, wer `docker exec` darf und
  wie das Volume gesichert wird, hängen an der Organisation und stehen in
  `docs/INSTALL.md`.
- **Keine Aussage über Zustellbarkeit.** SPF, DKIM und DMARC sind eine
  Betreiberaufgabe (E63) und haben ihre eigene Prüfliste.
- **Kein Ersatz für ein zweites Paar Augen.** Wer dieses Dokument liest und
  einen der „kein Befund"-Punkte anders beantwortet, hat recht, bis das Gegenteil
  hier steht.

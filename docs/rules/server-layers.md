# Schichten und Ports im Server

Die Schichtentrennung des Servers ist keine Konvention, sondern durchgesetzt —
und die Antwort auf jeden Verstoß ist ein Port, nie eine gelockerte Regel.

Die Thesis verlangt, dass ein Datenbankwechsel allein durch Austausch
der Datenzugriffsschicht möglich bleibt (NFR). Jede Abkürzung, die die
Geschäftslogik direkt an TypeORM, `fs` oder ein Fremdmodul hängt, kostet genau
diese Eigenschaft.

- **Layer-Grenzen sind ESLint-Regeln** in `apps/server/eslint.config.mjs`. Bei
  Verstoß **einen Port einziehen**, nicht die Regel lockern.
- Die Datenzugriffsschicht darf nur auf `ports/` zugreifen. Ein von mehreren
  Modulen geteilter Port gehört deshalb nach `business/common/ports/` (F100).
  Ebenso wandert alles, was zwei Module **wirklich** brauchen, nach
  `business/common/` statt kopiert zu werden: Passwortregel und Hasher,
  Sitzungstoken, `AllowAnonymous`, die Login-Drosselung — jedes Duplikat wäre
  eines, das beim nächsten Verschärfen übersehen wird. `CommonModule` liefert
  dabei nur die Injectables; Funktionen und Typen werden direkt importiert.
- **Der dritte Aufrufer ist der, bei dem man auszieht** (F138). Zwei ähnliche
  Dienste sind zwei Dienste; beim dritten wortgleichen Exemplar wird geteilt.
  So entstand `ImageFileService` in `business/common/` (Branding, Zeilen-Logo,
  Avatar: dieselben vier Uploadprüfungen, dasselbe Lesen je Teilbaum) und
  `field-kit.ts` (Anmeldeformular und Profilfragen: dieselbe Antwortprüfung).
  Geteilt wird dabei **die Regel, nie die Tabelle**: ein gemeinsamer Port für
  zwei Feldtabellen hätte zwei Implementierungen und einen bedeutungslosen Typ
  ergeben. Beim Ausziehen bleibt beim alten Dienst, was Zeilen kennt —
  `LogoImageService` behält `purgeUnderSeries` und heißt weiter so. Dieselbe
  Rechnung kann über die Modulgrenze hinaus zeigen: die **Zahlen** der
  Passwortregel liegen seit dem fünften Exemplar in `shared-models` (F141), die
  Regel selbst bleibt in `business/common/password-policy.ts` und der Server
  entscheidet weiter. In AP 5 traf es `searchTerms`: zwei Kopien (Übersicht,
  Kontaktliste) waren **nicht** wortgleich — eine kappte bei fünf Wörtern, die
  andere nicht —, und das ist der Drift, den die Regel meint. Jetzt
  `business/common/search-terms.ts`, mit der Kappung für alle drei. In AP 6 traf es das **Fenster** einer
  paginierten Liste: fünf Services hatten dieselben zwei privaten Helfer, der
  Chat wäre der sechste gewesen — und wieder war der Fund der Drift (vier
  Kopien wiesen `2.7` als Seitenzahl ab, die der Teilnehmerübersicht las sie als
  Seite 2). Jetzt `business/common/page-window.ts`, mit der strengeren Lesart
  (F159). Und sie kann auch **gegen** das Teilen ausfallen: für ein
  Oberflächenbauteil, das zwei Anwendungen bräuchten, wäre eine neue geteilte
  Bibliothek nötig — und die Liste der geteilten Libs kommt aus der Architektur
  der Thesis, nicht aus einem Arbeitspaket (F145).
- **Ein neuer Port muss in `exports` von `DataAccessModule`, nicht nur in
  `providers`.** `@Global()` macht das Modul überall sichtbar, aber ein
  Providertoken, das nicht exportiert ist, bleibt unauflösbar — mit einem
  Startfehler, der nach einem falsch geschriebenen Modul klingt („Is XModule a
  valid NestJS module?") und in Wahrheit eine fehlende Zeile in der
  Exportliste ist.
- **Dateien sind Datenzugriff.** `FileStore` ist ein Port wie ein Repository; die
  Geschäftslogik weiß, _dass_ eine Datei bleibt, nicht _wo_. Kein `fs`-Import in
  der Geschäftslogik.
- **Zählen statt Lesen:** wer nur Zahlen braucht, bekommt einen eigenen schmalen
  Port (`RegistrationTally`, `ProgramTally`) statt Zugriff auf die Zeilen. Einen
  zählenden Port bekommt, was groß oder unbegrenzt ist; dreißig winzige
  Felddefinitionen werden in der Geschäftslogik gezählt (F49). Dasselbe Muster
  für eine **Frage über eine Adresse**: `ProfileDirectory` in
  `business/common/ports/` beantwortet genau zwei — hat diese Adresse ein
  bestätigtes Konto (Teilnehmerübersicht, F149) und in welcher Sprache wird ihr
  geschrieben (Mail, F125). Nicht `UserProfileRepository` an zwei weitere
  Module: der kann ein ganzes Konto lesen **und** schreiben, und das darf das
  Modul, dem die Konten gehören (E33). Der Weg über einen Port ist hier nicht
  Geschmack — `MailModule` kann `ProfilesModule` nicht importieren, weil dieses
  Mail verschickt.
- **Ein Modul, das eine Authentifizierung braucht, importiert sie** — es baut
  keine zweite. `ChatModule` importiert seit AP 7 `ProfilesModule`, und **nur**
  für `UserSessionService`: der Handshake des Sockets prüft dasselbe Cookie wie
  der globale Teilnehmer-Guard (E34, E41), und zwei Implementierungen von „löse
  dieses Cookie auf“ sind der Weg, auf dem eine von beiden eine widerrufene
  Sitzung überlebt. Was es weiterhin **nicht** nimmt, ist
  `UserProfileRepository`: der kann ein ganzes Konto lesen und schreiben, und
  das darf das Modul, dem die Konten gehören (E33).
- **Ein Port, den zwei Module lesen, zieht nach `business/common/ports/`**
  (F100) — und `SearchableProfileRepository` ist der Fall, an dem das mehr als
  Ordnung ist: die Suche zeigt diese Profile, der Chat darf genau mit ihnen ein
  Gespräch beginnen. Das ist nicht zweimal dieselbe bequeme Schnittstelle,
  sondern **eine** Regel mit zwei Lesern (`searchable` ist das Opt-in für
  gefunden **und** angeschrieben werden, E37), und ein zweiter Port wäre eine
  zweite Gelegenheit, sie falsch zu treffen. Gefragt wird er nur beim
  **Beginnen**: danach entscheidet Mitgliedschaft, sonst würde ein
  zurückgenommener Schalter ein laufendes Gespräch stummschalten (E14).
- **Rohes SQL ist in dieser Schicht erlaubt, wenn der Query-Builder das falsche
  Werkzeug ist.** Die Ungelesen-Zahl des Chats ist eine **korrelierte**
  Unterabfrage auf `cm.last_read_at` der äußeren Abfrage; ein Builder, der
  aliasqualifizierte Namen umschreibt, ist für eine Abfrage, bei der genau die
  Zuordnung der Aliase die Aussage ist, ungeeignet. Ausnahme mit Begründung an
  der Konstante — und die Regel darüber bleibt: eine Liste ist eine Abfrage je
  **Seite**, nie je Zeile (F49).
- **Eine Regel, die nichts vergessen darf, gehört in die Anweisung** (F152).
  `SearchableProfileRepository` hat keine Methode, die ein Profil ohne Opt-in
  zurückgeben könnte: `searchable = true` und `confirmed_at IS NOT NULL` stehen
  in **beiden** Statements, nicht in den Aufrufern. Der Aufrufer, der es
  vergessen hätte, ist der, der **ein** Profil über seine Id holt — und dessen
  Fehler wäre nicht ein falsches Ergebnis, sondern ein veröffentlichtes Profil.
  Dasselbe Muster wie bei der Platzgrenze (F43): was nicht schiefgehen darf,
  wird nicht oben geprüft, sondern unten unmöglich gemacht. Seit AP 6 zweimal
  angewandt: `AttachmentRepository` trägt `registration_id IS NOT NULL` in
  **jeder** Anweisung, also kann die Download-Route des Veranstalters ein
  Chatbild nicht ausliefern (F155), und `ConversationRepository` hat keine
  Methode ohne den Mitgliedschafts-Join — „nicht deins" und „gibt es nicht"
  werden dadurch dieselbe Antwort, ohne dass ein Aufrufer daran denken muss.
  **In AP 10 hat diese Regel zum ersten Mal einen zweiten Port erzwungen**
  (F173): die Organisation hat keine Mitgliedschaft (F133), also hätte sie den
  Port nur mit genau der Methode lesen können, ohne die er entworfen wurde. Der
  neue trägt die Regel wieder in der Anweisung — `type IN ('group',
'organizer_contact')` in **jedem** Lesezugriff, damit ein `direct`-Gespräch
  dort nicht herauskommen kann. Zwei Ports über zwei Tabellen sind kein
  Duplikat, wenn der **Unterschied die Zugangsregel** ist; und wenn eine Zusage
  „nichts geschrieben" lautet, gehört sie in die Transaktion — bei TypeORM
  **geworfen**, denn ein `return` committet (siehe
  [Werkzeug-Fallen](tooling-traps.md)).
- **Eine Liste darf nicht eine Abfrage je Zeile werden** (F49) — und das gilt
  auch, wenn die Zeilen aus einem anderen Modul kommen: `EventsService.locate`
  ist drei Abfragen, also hat „meine Anmeldungen" `locateMany(ids, locale)`
  daneben (dazu `findByIds` an zwei Repositories und
  `EventSeriesService.slugsOf`). Wer eine solche Batch-Lesung anlegt, hält die
  Regeln der Einzelfassung: dieselbe 404-Regel, derselbe Statusverzicht — und
  eine Id, die nichts trifft, fehlt in der Antwort, statt sie scheitern zu
  lassen.
- **Wer zustellt, hängt an nichts** (F162). Das Chat-Gateway braucht
  `ConversationsService` (darf dieser Socket den Raum betreten?), und
  „gelesen“ muss zugestellt werden — der Kreis wäre da, `forwardRef` die
  naheliegende Antwort und schon die zweite dieser Art. Die Auflösung ist die
  Frage aus F103: was ist das **Geteilte**? „Emit in einen Raum“, und das kennt
  keine Mitgliedschaft. `ChatRealtimeService` hängt deshalb an nichts und
  bekommt vom Gateway einen absichtlich schmalen Ausschnitt des Namensraums
  (`to(room).emit(…)`) — nicht das ganze Objekt, das auch Verbindungen annehmen
  und Handshakes lesen könnte. Dazu zwei Regeln: **Speichern ist verbindlich,
  Zustellen ist bestes Bemühen** (ein Sendefehler ist eine Logzeile, keine
  Antwort), und **zugestellt wird außerhalb der Kompensation** — die Datei wird
  verworfen, wenn die **Zeile** scheiterte, und eine Zustellung nimmt keine
  geschriebene Zeile zurück.
- **Wer etwas zustellen muss, fragt beim Schreiben, wen** (F163).
  `MessageRepository.append` antwortet mit der Zeile **und** den Mitgliedern,
  in derselben Transaktion. Ein `membersOf(conversationId)` wäre bequemer und
  genau die Methode, die dieser Port nicht haben darf (F152): „wer schreibt mit
  wem“, für jede Id, für jeden Aufrufer. Als Teil des Schreibens ist die Frage
  ohne bewiesene Mitgliedschaft unerreichbar — dasselbe Muster wie bei der
  Platzgrenze (F43): was nicht schiefgehen darf, wird unten unmöglich gemacht.
- **Eine Zusammensetzung gehört über ihre Teile.** `business/dashboard`,
  `business/content-translations` und `business/manifest` importieren ihre
  Quellen; im Elternmodul hätte derselbe Service den Kreis geschlossen und einen
  `forwardRef` gebraucht (F49, F100, F103). Jeder gefragte Service löst das Event
  **selbst** auf — drei Primärschlüssel-Lesezugriffe sind der Preis dafür, dass
  jedes Modul seine 404-Regel behält.
- **Unteilbarkeit gehört in die Datenzugriffsschicht, die Regel in die
  Geschäftslogik** (F43): die Platzgrenze entscheidet die Datenbank, in einer
  Anweisung, unter `FOR UPDATE` auf der Programmpunkt-Zeile; der Port nimmt die
  Kapazität mit und antwortet `created` / `already-signed-up` / `full`. Wer eine
  zweite Grenze braucht, zieht denselben Schnitt — **nicht** „erst zählen, dann
  schreiben".
- **Ein Plug-in liest Kerndaten nur über den Vertrag** (E12, F45).
  `PluginProgramReads` liefert fünf Felder je Programmpunkt und Anmeldezahlen,
  nichts sonst; bereitgestellt vom globalen `PluginHostModule`. Ein Plug-in
  importiert ausschließlich aus `plugin-api`. Neue Fähigkeit = Minor am
  `PLUGIN_API_VERSION` **plus** ein Fall im Kompatibilitätstest.
- Ein Plug-in bringt **eigene** Entities und Migrationen mit; Kerntabellen werden
  nie angefasst. Raumzuordnung von Programmpunkten = plug-in-eigene Join-Tabelle
  (F21) — `program_item` hat **kein** `room_id`.
- **`type` statt `interface` für generische Nutzlasten** (F101): nur ein
  Objekt-`type` bekommt eine implizite Indexsignatur, und daran hängen der eine
  generische Port, das eine generische Repository und das eine Formularbauteil.

- **Ein Port liest eine Zielgruppe, nie eine Tabelle** (F134, wie F152 und
  F173). `PushSubscriptionRepository` hatte `findAll()`, solange es eine
  Benachrichtigung gab („alle"). Ab AP 11 gibt es zwei Zielgruppen und **keine
  Methode für eine dritte**: die Geräte einer Event-Änderung (bestätigte
  Angemeldete **plus** jedes Gerät ohne Konto, in _einer_ `UNION`, damit die
  zweite Hälfte nicht einzeln erreichbar ist) und die Geräte eines Kontos. Wer
  eine neue Benachrichtigung baut, bringt ihre Zielgruppe als **Anweisung** mit,
  nicht als Filter darüber.
- **Ein Dienst, der ohne Anfrage arbeitet, fragt seinen Modulschalter selbst**
  (E21, F63). Der Guard hängt an Routen; eine Benachrichtigung entsteht aus
  einer Event-Änderung, also fragt niemand die Flagge für sie. `PushService`
  liest dieselbe Registry wie der Guard (F53) — und stellt fest: Abonnements
  bleiben beim Ausschalten liegen, es geht nur nichts mehr raus.
- **Eine Benachrichtigung darf nie scheitern lassen, worüber sie berichtet.**
  Beide `notify…`-Methoden antworten mit einem Bericht statt zu werfen, und ihre
  Aufrufer `void`en sie: wer ein Event speichert oder eine Nachricht schreibt,
  wartet nicht auf den Push-Dienst eines Browserherstellers und sieht auch
  keinen Fehler von ihm. Dieselbe Regel wie bei der Live-Zustellung (E41) —
  **Speichern ist verbindlich, Zustellen ist beste Absicht.**
- **Wer Worte in einer Sprache braucht, gruppiert nach Sprache** (F177, F125).
  Ein Katalog ist eine Auflösung aus drei Quellen (E23); eine Organisation mit
  fünfzig Abonnenten hat zwei Sprachen, nicht fünfzig Kataloge. E24 (Rückfall
  als Ganzes) gilt **nur** für Mail und ist bewusst nicht übernommen.

Siehe auch: [Verträge der Endpunkte](api-contracts.md), [Regeln des Datenmodells](data-model.md).

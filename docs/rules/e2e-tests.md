# Browsersuiten und E2E-Tests

Wie die Browsersuiten dieses Repositories geschrieben werden, und welche
Fehlschläge nach einem kaputten Fixture aussehen, aber keines sind.

Drei Browser × zwei Suiten laufen parallel gegen **eine** Instanz mit
**einer** `app_config`-Zeile und einer globalen Drosselung. Fast jeder
Flake dieses Repositories kam daher, nicht aus dem Anwendungscode.

- **Playwrights `name` vergleicht Teilstrings**, nicht ganze Namen:
  `getByRole('link', { name: 'Participants' })` traf auch „All participants".
  Wo eine Seite zwei Wege zur selben Ansicht anbietet, braucht der Test
  `exact: true`. Ebenso: `getByText('0%')` trifft die Null in „20 %", und zwei
  Tabellen auf einer Seite brauchen `aria-label`, sonst trifft ein
  Zeilen-Locator die Kopfzeile der anderen.
- **Fixture-Namen tragen keine Uhrzeit.** `fixtureLabel()` bildet
  `<scope>-<pid>-<n>`; ein Playwright-Arbeiter ist ein Prozess, seine pid trennt
  ihn von allen anderen. `Date.now()` kollidierte am eindeutigen Slug-Index.
- **Zwei Suiten dürfen nicht denselben Slug ableiten** — derselbe Fehlschlag.
- **Eine Browsersuite meldet sich einmal pro Lauf an**, nicht pro Fixture: der
  Login erlaubt 20 Versuche in fünf Minuten (E4), und ein 429 im Seed sagt nichts
  über den Test. Beide Suiten legen die Sitzung in eine Datei im Temp-Verzeichnis.
- **Aufräumcode muss mit einem 404 rechnen** — wer über eine Liste iteriert,
  findet Einträge, die es beim zweiten Zugriff nicht mehr gibt.
- **`test.skip(browserName !== 'chromium')` verhindert kein Rennen _innerhalb_
  einer Datei.** Playwright verteilt auch die Tests einer Datei auf mehrere
  Arbeiter (`fullyParallel` im Nx-Preset); die CI läuft mit einem Arbeiter und
  sieht es nie. Zwei Tests, die denselben instanzweiten Zustand schreiben, gehören
  in `test.describe.configure({ mode: 'serial' })` — oder nach `apps/server-e2e`.
- **Instanzweiter Zustand gehört nach `apps/server-e2e`** (dort läuft eine Suite
  allein, `maxWorkers: 1`): Modulschalter mit Fernwirkung, ein dritter Eintrag im
  Sprachumschalter, alles mit `module_config`. Im Browser gilt: nur Chromium, und
  **wiederherstellen, was gefunden wurde**. Die Suiten schreiben **keine Farbe**
  (`start-up.spec.ts` prüft `#1f6f5c` in beiden Clients) und schalten **nicht**
  `media-links` (zwei andere Suiten benutzen es parallel).
- **Die Suiten nennen Schlüssel, keine Wörter.** `t(key, params, locale)` aus
  `support/catalogue.ts` liest die mitgelieferten Kataloge von der Platte und
  **wirft** bei einem unbekannten Schlüssel, statt Schlüssel gegen Schlüssel zu
  vergleichen; `tPattern()` für Sätze, deren Parameter ein Test nicht nachbauen
  kann; `expectNoRawKeys(page)` findet jede Lücke der Extraktion auf einer
  besuchten Seite — **nicht** auf der Sprachverwaltung, die zeigt Schlüssel als
  Funktion. Verglichen werden **ganze** Textknoten. Literal bleibt nur
  Fixture-Text, ein Bezeichner, eine Uhrzeit — oder eine **Server**meldung (F77).
- **Ein Aufräumcode, der über alle Katalogschlüssel läuft, wächst mit dem
  Katalog.** `resetLocale()` schickte ein `DELETE` je Schlüssel und lief bei 149
  in den Timeout; es **fragt** jetzt, welche Schlüssel eine Zeile haben.
- **Eine Prozentzahl über hunderte Schlüssel bewegt sich nicht** — ein Test zählt
  („1 von 598 Schlüsseln") statt zu runden.
- **Nie `nx run-many -t e2e` über beide Browsersuiten.** Sechs Browser gegen einen
  Server, alle von `::1`, reißen die globale Drosselung (300 Anfragen/min):
  `/api/i18n/:locale` antwortet 429, beide Clients zeichnen rohe Schlüssel, und
  der Fehlschlag sieht nach kaputtem Katalog aus. Erst `user-client-e2e`, dann
  `admin-client-e2e`, wie in der CI.
- **Playwright emuliert Offline in WebKit nicht** — `context.setOffline()` wirkt in
  Chromium und Firefox; dort mit Begründung überspringen.

- **Ein Fehlerkörper trägt einen Zeitstempel.** Wer zwei Fehlerantworten auf
  Gleichheit prüft — weil ein Endpunkt für zwei Zustände dasselbe sagen soll
  (E10, E32) —, vergleicht `message` und `statusCode`, nie den ganzen Rumpf: die
  Millisekunde dazwischen macht den Test rot und sagt nichts.
- **Der Teilnehmer-Login hat sein eigenes Drosselbudget** — 20 Versuche in fünf
  Minuten, getrennt vom Admin-Login (der Zähler hängt an Route **und** Adresse).
  Die sechs Kontosuiten in `apps/server-e2e` verbrauchen davon **sechzehn**
  (`my-registrations.spec.ts` kam in AP 4 mit einer dazu, `profile-search.spec.ts`
  in AP 5 mit einer — dort braucht nur der **Suchende** eine Sitzung, die
  Gefundenen sind geseedet; `chat.spec.ts` in AP 6 mit **zwei**: ein Gespräch hat
  zwei Seiten, und die dritte Person der Suite ist wieder geseedet, weil zu ihr
  nur **geschrieben** wird; `chat-realtime.spec.ts` in AP 7 mit **keiner** — dort
  sind auch die Sitzungen geseedet, F164), die Browsersuite des
  Nutzer-Clients drei (einer je Engine, `profile.spec.ts` meldet sich genau
  einmal an und beweist das neue Passwort in `server-e2e`; `chat.spec.ts` aus
  AP 8 kommt mit **keiner** dazu — auch dort ist die Sitzung geseedet, siehe
  unten); wer eine weitere
  schreibt, zählt vorher nach. Ein 429 sieht dort aus wie ein Anmeldefehler und
  ist keiner. **Deshalb wächst `profile.spec.ts` statt Nachbarn zu bekommen:**
  „meine Anmeldungen" (AP 4) und die Profilsuche (AP 5) laufen in dessen einem
  Test mit, weil jede eigene Datei drei weitere Anmeldungen gekostet hätte.
- **Was instanzweit ist, muss eine Suite selbst wieder abräumen.** Der
  Profil-Baukasten (`profile_field`) hat kein Event, an dem er hängt: eine
  liegengebliebene **Pflichtfrage** lässt jedes `PATCH /api/participant/me`
  anderer Suiten scheitern, und ein liegengebliebener Schlüssel schickt den
  nächsten Lauf der eigenen Suite in den „nummeriere um die Kollision"-Zweig.
  `deleteProfileFields(prefix)` in `support/database.ts`, und jede Frage
  bekommt einen Schlüssel mit Lauf-Präfix. Dasselbe gilt für Konten: die Adresse
  ist instanzweit eindeutig (E31), also `deleteProfiles(domain)` im `afterAll`.
- **Ein `afterAll`, das nach Muster löscht, löscht die Fixtures der anderen
  Engines mit** (F147). Für ein Teilnehmerkonto gibt es bewusst keinen
  Löschendpunkt, also räumt die Suite per SQL nach Adressmuster ab — mit einer
  gemeinsamen Maildomain löschte die erste fertige Engine die **laufenden**
  Konten der beiden anderen, deren Sitzungszeilen gingen per Fremdschlüssel mit,
  und der Interceptor schob sie mitten im Test auf die Loginseite. Der Fehlschlag
  sah wie ein kaputter Login aus. Also: je Engine eine eigene Domain
  (`@<engine>.profiles.example.org`), und generell muss ein Muster, nach dem
  gelöscht wird, den eigenen Lauf tragen.
- **Was instanzweit sichtbar ist, sehen alle drei Engines.** Die Profilfragen
  hängen an keinem Event, also stehen auf der Profilseite auch die Fragen der
  beiden anderen Engines — eine Erläuterung mit demselben Wortlaut trifft dann
  dreimal. Der Lauf gehört in den **Wortlaut**, nicht nur in den Schlüssel.
  Aus demselben Grund seedet keine Browsersuite eine **Pflicht**frage: sie ließe
  jedes `PATCH /api/participant/me` der anderen Engines scheitern.
- **Eine Zusicherung über eine Tabellenzelle muss eine Zelle sein.** „Die Zeile
  enthält _Ja_" war grün, **bevor** es die Profilspalte gab: die
  Newsletter-Spalte daneben sagt für dieselbe Person dasselbe. Wer eine neue
  Spalte prüft, liest `getByRole('cell')` an der Position, die der
  Kopfzeilentest festhält — und ergänzt diesen zuerst, sonst prüfen beide Tests
  nichts.
- **`allInnerTexts()` wartet nicht.** Nach einem `reload()` steht die Liste noch
  nicht, und die Zusicherung vergleicht ein leeres Array — was als „die
  Reihenfolge stimmt nicht" gemeldet wird. Vorher auf eine Zeile warten, dann
  die Texte lesen.
- **Ein Server, der zwischen den Läufen stehen bleibt, sammelt die
  Drosselzähler.** `nx e2e` startet den Server als Abhängigkeit — wer aber
  daneben ein eigenes `nx serve server` laufen lässt (etwa zum Debuggen), lässt
  **einen** Prozess über alle Durchläufe hinweg zählen. Nach wenigen
  Volldurchläufen reißen dann zwei Budgets, und beide sehen nach einem
  Codefehler aus: das **Registrierungsbudget** (60 je 5 min, E4) lässt die
  mailbasierten Tests auf eine Nachricht warten, die nie verschickt wurde — es
  sieht nach kaputter Mail aus; das **Login-Budget** (20 je 5 min, danach 15
  Minuten Sperre) lässt das Loginformular stehen, wo es steht, und der Test
  meldet „URL ist noch `/profile/login`". Die Zähler liegen im Speicher, also
  ist die Abhilfe die aus `decisions.md`: **den Server neu starten**, nicht die
  Drosselung anfassen und nicht abwarten. Beim Arbeiten an einer einzelnen
  Stelle hilft `--grep`.
- **Ein Schalterpaar wird in der umgekehrten Reihenfolge zurückgesetzt.** Wer
  eine Voraussetzung testet (E42, F128), schaltet den Abhängigen aus, dann die
  Voraussetzung — und muss im `finally` die **Voraussetzung zuerst** wieder
  einschalten. Andernfalls verweigert sich das Zurücksetzen selbst, mit genau dem
  409, den der Test beweisen wollte.
- **Was in der Datenbank hängen bleibt, wenn kein Fremdschlüssel es mitnimmt,
  räumt die Suite ausdrücklich ab.** `conversation_member.member_id` trägt
  bewusst keinen Fremdschlüssel (E39), also lässt `deleteProfiles(domain)` die
  Gespräche stehen — und `direct_key` ist instanzweit eindeutig. Dazu die
  **Reihenfolge**, die F158 erklärt: erst die Anhangs-Ids merken, dann das
  Gespräch löschen (das kaskadiert die Nachrichten), dann die Anhänge. Umgekehrt
  scheitert es an `CHK_message_content`, und der Fehlschlag steht im `afterAll`,
  wo er nach einem kaputten Test aussieht und keiner ist.
  `deleteConversations(ids)` in `support/database.ts`.
- **Eine Zusicherung über eine Sortierung stellt den Zustand selbst her.** „Die
  Gesprächsliste beginnt mit dem zuletzt bewegten" hing zuerst davon ab, in
  welches Gespräch ein **früherer** Test zuletzt geschrieben hatte — grün, aber
  aus dem falschen Grund, und beim nächsten neuen Test rot. Wer eine Reihenfolge
  behauptet, schreibt vorher die Zeile, die sie beweist.
- **Eine Sitzung darf geseedet werden, wenn die Suite die Sitzung braucht und
  nicht das Anmelden** (F164). Eine Sitzung _ist_ eine Zeile mit dem SHA-256 des
  Cookie-Werts; Guard und Socket-Handshake lösen sie gleich auf und können nicht
  erkennen, wie sie entstand. `seedSession(profileId)` in `support/database.ts`,
  und der Grund ist derselbe wie bei `seedProfile`: die Echtzeit-Suite braucht
  **drei** Sitzungen (beide Seiten eines Gesprächs und eine Person, die außen
  steht) und hätte das Budget auf neunzehn von zwanzig gebracht. Was das
  aufgibt — der Beweis, dass eine Anmeldung ein brauchbares Cookie ausstellt —
  führt `chat.spec.ts` mit echten Anmeldungen.
- **Auch ein Browser darf eine geseedete Sitzung bekommen** (F164, AP 8). Zwei
  Dinge gehören dazu, und das zweite ist das, was man vergisst: das Cookie im
  Kontext (`addCookies`, **`path: '/api'`** — dort stellt der Server es aus) und
  der Hinweis in `localStorage` (`trefaro.participant-session`), denn der
  Nutzer-Client fragt ohne ihn gar nicht nach einer Sitzung (F143) und merkt das
  Cookie folglich nie. Beides tut `signInWithSeededSession` in
  `apps/user-client-e2e/src/support/participant-session.ts`. Damit kostet
  `chat.spec.ts` **null** Anmeldungen — bei zwanzig je fünf Minuten für die ganze
  Instanz war das die Bedingung dafür, dass es eine eigene Datei sein durfte
  statt in `profile.spec.ts` mitzuwachsen.
- **Ein toter Socket wird mit `page.routeWebSocket` nachgestellt**, nicht mit
  `setOffline` (F169). `context.setOffline(true)` **kappt keine bestehende
  WebSocket-Verbindung**: das Offline-Banner erscheint sofort (F110), der
  Socketstatus bleibt aber „verbunden", bis der Heartbeat zuschlägt — bis zu
  45 s, also weit jenseits jeder Zusicherung. Ein Handler ohne
  `connectToServer` stellt dagegen genau den Fehlschlag her, den Spike 4 meint:
  ein Proxy, der das Upgrade weiterleitet und dann alles schluckt. Der Client
  gibt ihn nach acht Sekunden zu (F169), also ist er in einer normalen
  Zusicherung prüfbar. **Netz und Socket sind zwei Banner** — wer eines prüft,
  hat das andere nicht geprüft.
- **Was „auf einem Telefon benutzbar" heißt, prüft man auf einem Telefon.** Die
  drei Engines laufen in Desktop-Größen; `chat.spec.ts` setzt zu Beginn
  390 × 844 und fährt den ganzen Gang dort, samt einer Zusicherung, dass
  `scrollWidth` die Breite nicht übersteigt. Ein Bauteil, das seitlich
  heraussteht, ist auf dem Desktop unsichtbar kaputt.
- **Eine Mail, die drei Engines an dasselbe Postfach schicken, wird am Rumpf
  erkannt** (AP 9). Sonst gilt: Adresse plus Betreffmuster genügen, weil jede
  Mail an _die Person_ geht, die der Test spielt. Die Benachrichtigung über eine
  Kontaktanfrage geht an die **Organisation** — also liegen nach einem Lauf drei
  Nachrichten mit identischem Empfänger und identischem Betreff im Postfach, und
  die Kopfzeilen unterscheiden sie nicht. `waitForMailTo` nimmt deshalb ein
  drittes Muster (`text`) und holt die Rümpfe nur für die Nachrichten, die
  Adresse und Betreff schon gefiltert haben; das Unterscheidungsmerkmal ist die
  Adresse, die der Test getippt hat. Und: was den Empfänger entscheidet, gehört
  ins Fixture — die geseedete Reihe trägt seit AP 9 eine `contactEmail`, weil
  die Suite die Absenderadresse der Instanz nur aus deren Konfiguration erraten
  könnte.
- **Ein Node-Client muss das Cookie selbst setzen.** Ein Browser hängt es an,
  ein `socket.io-client` in Node nicht: `extraHeaders: { cookie }`. Gilt für die
  Vertragssuite und für `tools/spike-verification/verify-chat.mjs` — und es ist
  der Grund, warum der Socket unter `/api` wohnt (F160): im Browser entscheidet
  der **Pfad** des Cookies, ob der Handshake überhaupt eine Sitzung mitbringt.
- **Ein Socket-Test muss auf das Ankommen warten.** Nichts an einem Ereignis
  ist eine Zusicherung, die Playwright oder Jest von sich aus wiederholt: erst
  auf den Zustand warten (`settle(() => …)`), dann prüfen. Und wer zwei Zähler
  leert, um das nächste Ereignis zu messen, wartet vorher auf **beide** — ein
  Nachzügler aus der Zeile davor sieht sonst wie die Antwort auf die nächste
  aus. Jeder geöffnete Socket wird im `afterAll` getrennt, sonst hält Jest den
  Prozess offen.
- **Eine Landmarke ohne Namen trifft die falsche.** `getByRole('complementary')`
  auf einer Seite des Veranstalter-Clients trifft **zwei** Dinge: die
  Seitenleiste der Arbeitsfläche und ein offenes Detailfeld. Eine Zusicherung
  darüber war deshalb mal grün aus dem falschen Grund — solange das Feld zu war,
  traf sie die Seitenleiste, und deren Navigationseintrag „Profilformular"
  enthält das Wort „Profil", nach dem gesucht wurde — und mal rot mit einer
  Strict-Mode-Verletzung, sobald das Feld offen war. Also **immer** mit `name`,
  wie der Nachbartest in derselben Datei es längst tat. Dieselbe Klasse wie
  F149: eine Zusicherung muss das prüfen, worüber sie redet.
- **Ein Fixture, das die API nicht herstellen kann, wird geseedet — mit
  Begründung.** „Auffindbar, aber unbestätigt" hat keinen Weg durch die
  Endpunkte: `searchable` ist nur hinter einer Sitzung schreibbar, und eine
  Sitzung gibt es erst nach dem Double-Opt-In (E32). Genau diese Zeile darf im
  Verzeichnis nicht auftauchen, also gehört sie in die Suite — `seedProfile` in
  `apps/server-e2e/src/support/database.ts`,
  `seedSearchableProfile` in der Browsersuite. Der Passwort-Hash ist dort
  Unsinn: nach so einer Zeile wird **gesucht**, mit ihr wird nie angemeldet, und
  ein Login würde ein Budget verbrauchen (E4).
- **Ein Modulschalter wird über die API umgelegt, nicht in der Tabelle.** Der
  Server hält die Flags in einem Cache; eine Zeile hinter seinem Rücken ändert
  erst mal nichts. `PATCH /api/admin/modules/:key` — und die Suite stellt ihn
  im eigenen Teardown wieder her, weil alle Vertragssuiten mit **einem** Worker
  gegen **eine** Instanz laufen.
- **Wer eine Zusicherung über „nichts geschrieben" schreibt, zählt danach
  nach.** Ein Test, der nur den 400 prüft, hätte in AP 10 nicht gefunden, dass
  eine abgelehnte Gruppe trotzdem als Zeile in der Tabelle lag (ein `return`
  im TypeORM-Transaktions-Callback committet). Die zweite Zählung ist der Test.
- **Was in einer Suite geprüft wird, entscheidet, was nur sie kann.** Die
  Browsersuite des Veranstalters liest **kein** Postfach: dass die Antwort an
  einen Gast wirklich in Mailpit landet, entscheidet `apps/server-e2e` gegen den
  Mailserver; was nur ein Browser entscheiden kann, ist, ob der Bildschirm es
  sagt — und der Satz dort kommt aus dem `delivery` des Servers, ist also nicht
  zu haben, wenn nichts rausging (F174).
- **Ein Fixture, das drei Engines teilen, braucht auch unterscheidbare
  **Namen**, nicht nur Adressen.** Drei Browser gegen eine Instanz heißt drei
  Zeilen in derselben Übersicht: ein Locator „die Zeile der Person, die gefragt
  hat" fand alle drei. Der Name des Gasts trägt deshalb das Engine-Label — er
  ist, wie die Zeile **heißt**.
- **Die Entwicklungsdatenbank ist nicht die Werksvorgabe.** Wer einmal
  `tools/demo-seed/` laufen ließ, hat Organisationsname und Primärfarbe der
  Demo in `app_config` — und die Browsersuiten erwarten `#1f6f5c` aus der ersten
  Migration. Zwei Fehlschläge in `start-up.spec.ts`, die nach einem
  Theming-Fehler aussehen, sind in Wahrheit der Seed. Zurücksetzen, nicht den
  Test anpassen.

- **Eine Suite legt nur zurück, was sie gelesen hat.** Wer Instanzzustand
  umschaltet, merkt ihn sich — und der Anfangswert dieser Variable darf **keine
  Vermutung** sein. Ein Absturz im `beforeAll` lässt das `afterAll` sonst die
  Vermutung _schreiben_: in AP 11 blieb so `push` in der Entwicklungsinstanz an,
  und kaputt ging davon der eine schreibende Test der Modulverwaltung im
  **Veranstalter-Client**, der „einschalten" klickt und nichts zum Klicken fand.
  `boolean | null = null`, und wiederhergestellt wird nur, was gelesen wurde.
- **Ein Aufräum-Request, dessen Rumpf abgelehnt wird, räumt nichts auf.**
  `DELETE /api/user/push/subscriptions` nimmt nur den Endpunkt; mit dem Rumpf des
  Abonnierens ist es ein 400 (F44). Jeder Lauf ließ eine Zeile zurück — 58, bis
  AP 11 die Abonnements zu einer Zielgruppe machte und jede davon zu einem
  Endpunkt, den die Instanz anzusprechen versucht. **Den Status eines Aufräumens
  prüfen**, sonst ist es eine Absicht.
- **`web-push` spricht immer TLS**, egal was im Endpunkt steht. Ein Push-Dienst
  als HTTP-Attrappe bekommt einen TLS-Handshake, ein TLS-Dienst bräuchte ein
  Zertifikat, dem der Serverprozess traut — und dafür entweder eine CA in seiner
  Umgebung oder einen Agenten ohne Prüfung. **Kein Test ist ein Grund, warum
  Produktionscode ein ungeprüftes Zertifikat annehmen kann.** Also ist die
  Attrappe **ein lauschender Socket je Gerät** und die „Zustellung" ist die
  Verbindung: das entscheidet, **wer** benachrichtigt wird. Was eine
  Benachrichtigung sagt, prüft ein Unit-Test gegen die mitgelieferten Kataloge;
  dass `410 Gone` aufräumt, einer gegen die gemockte Bibliothek.
- **„Es ging nichts raus" braucht eine Wartezeit.** Eine Benachrichtigung wird
  von der Anfrage, die sie auslöst, absichtlich nicht abgewartet — also ist die
  Behauptung nur nach einer kurzen Stille prüfbar. Die Alternative ist eine
  Zusicherung, die auch grün ist, wenn die Regel umgekehrt gilt.
- **Die Vertragssuite braucht ein VAPID-Paar.** Ohne eins hat die Instanz Push an
  der Quelle aus und `push-notifications.spec.ts` hätte nichts zu prüfen; der
  erste Test sagt das in einem Satz, statt achtmal zu scheitern. In der CI steht
  ein Wegwerf-Paar in der Job-Umgebung, lokal in `.env` — dasselbe, was
  `verify-push.mjs` seit Phase 0 verlangt.

Siehe auch: [Fallen in den Angular-Clients](angular-clients.md), [Deployment und Prüfung](deployment.md).

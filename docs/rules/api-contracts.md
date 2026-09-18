# Verträge der Endpunkte

Wie ein Endpunkt in dieser Anwendung geschnitten ist, wie er geschützt wird und
was er antwortet.

Diese Formen sind mehrfach gegen Alternativen entschieden worden; die
Alternativen waren jeweils ein offener Endpunkt, eine Sackgasse oder ein toter
Link.

- **Eine Ablehnung reist als Code, nicht als Satz** (E64, F212). Der Rumpf einer
  abgelehnten Anfrage trägt `code` — einen Katalogschlüssel aus der
  geschlossenen Liste in `shared-models` — und `params`, die Werte, für die der
  Satz Lücken hat. `message` trägt **denselben Code**, weil eine Logzeile und
  ein Stacktrace etwas zu nennen brauchen und es keinen Satz mehr gibt. Gebaut
  wird das mit `refuse` (400), `conflict` (409) und `tooLarge` (413) aus
  `business/common/problem.ts`; durchgereicht wird es vom
  `AllExceptionsFilter`, der den Rumpf ohnehin neu schreibt. **404, 401 und 403
  bekommen keinen Code** (F213): sie haben keinen Grund, den ein Mensch liest —
  der Client weiß ihn selbst —, und ein `message` ohne Code zeigt kein Client
  mehr an. Die Vertragssuite prüft ab AP 5 der Phase 5 **den Code**, nie den
  Satz: `refusalOf(body)` in `support/api-client.ts`.
- **Drei Präfixe, drei Zugangsstufen** (E33): `/api/user` ist der anonyme
  Besucher, `/api/participant` der angemeldete Mensch, `/api/admin` der
  Veranstalter. Jede Stufe hat ihren Guard am **deklarierten** Pfad und ihr
  eigenes Cookie (E34) — `trefaro_admin_session` und `trefaro_user_session`
  können gleichzeitig offen sein, und **kein** Guard akzeptiert das Cookie des
  anderen. `/api/user` kann den Schutz nicht bekommen (Startseite, Landingpage,
  Programm, Anmeldeformular, tokenbasierte Selbstbedienung), deshalb ein neuer
  Präfix statt einer Ausnahmeliste. Konto **anlegen** und **bestätigen** bleiben
  bei `/api/user` — dabei ist niemand angemeldet. `AllowAnonymous` liegt in
  `business/common/`, weil zwei Guards es lesen (F100).
- **Der Admin-Schutz hängt am URL-Präfix `/api/admin`** (E16), nicht an einem
  Dekorator — ein vergessenes `@UseGuards` in einem Plug-in wäre ein offener
  Endpunkt. `isAdminPath` liest jeden _deklarierten_ Pfad einzeln und
  **überschätzt** (F69): `@Post('admin')` unter `@Controller('setup')` sieht für
  ihn aus wie `/api/admin/…`. Absicht, weil der Fehler in die andere Richtung ein
  offener Endpunkt wäre. Wer so eine Route braucht, setzt `@AllowAnonymous()`
  **und** einen eigenen Guard davor.
- **Ein Plug-in bekommt seine Zugangsstufe aus dem Pfad** (E57, F189) —
  `admin/plugins/<key>/…`, `participant/plugins/<key>/…`,
  `user/plugins/<key>/…`. Es erfindet keine Authentifizierung, deklariert keinen
  Sitzungs-Guard und kann keinen zurücknehmen; dazu trägt jeder Controller
  `@PluginController(<key>)` **und** `PluginEnabledGuard`, damit ein
  abgeschaltetes Plug-in 404 gibt. Wer fragt, kommt aus
  `CurrentPluginParticipant` bzw. `CurrentPluginOrganizer` — **zwei**
  Dekoratoren, weil zwei Cookies zwei Berechtigungen sind (E34) und „wer auch
  immer angemeldet ist" die Gestalt wäre, in der jemand seinen eigenen Vorschlag
  freigibt. `plugins/plugin-controllers.spec.ts` läuft über **alle** montierten
  Plug-in-Controller und hält Präfix, Schlüssel und Guard fest — und dass der
  Switch-Guard der einzige ist.
- **Ein Plug-in darf eine öffentliche Route haben, wenn ihre Antwort keine
  Person enthält** (E58, F192, AP 6 der Phase 4):
  `GET /api/user/plugins/room-planning/events/:id/rooms?locale=` — Räume nach
  Namen, je Raum die Sessions mit Titel und Zeit, **keine** Anmeldezahl,
  **keine** Warnung. Ein Raumname ist keine Person; wie voll ein Workshop ist,
  wäre eine Information über Menschen, bevor jemand sich entschieden hat zu
  kommen. `?locale=` mit den drei Antworten von F94, über den durch `plugin-api`
  re-exportierten Pipe; ob das Event veröffentlicht ist, prüft die Route nicht
  — der Vertrag hat keinen Port dafür, wie beim Forum.
- **Ein Plug-in darf drei Zugangsstufen haben, wenn es drei Zielgruppen hat**
  (E57, AP 7 der Phase 4). Das Check-In ist der Fall und deshalb das Beispiel:
  `GET /api/user/plugins/qr-checkin/ticket?token=` ist anonym und über die
  **Signatur** autorisiert (E11, E54) — Token in der **Query**, weil das der
  Link in der Mail trägt (F44) —, `GET /api/participant/plugins/qr-checkin/tickets`
  über die Sitzung (F148, Plural: ein Mensch ist keine Anmeldung), und die Tür
  liegt unter `admin/`. Der anonyme Controller trägt als einziger eine eigene
  Drosselung (60 je 5 min, E4); hinter einer Sitzung greift die globale.
- **Ein Code am Einlass reist im Rumpf, und ein zweiter Scan ist kein Fehler**
  (E53, F197). `POST …/checkins` mit `{ code }` — nichts, das den Zustand
  ändert, ist ein GET, und ein Code in einer URL landet im Log und in der
  Chronik eines geteilten Bildschirms. Zweimal derselbe Code ergibt **zweimal
  200** mit **demselben** Zeitpunkt und `alreadyCheckedIn`; die Bedingung steht
  im `UPDATE … WHERE checked_in_at IS NULL`, und das Statement sagt zurück, ob
  es geschrieben hat. Ein unbekannter Code ist eine **404, die nichts über
  Anmeldungen sagt**, und jede Art, an einem Ticket zu scheitern — gefälscht,
  abgelaufen, gelöscht, nie bestätigt —, ist wortgleich dieselbe 404.
- **Die Einlassliste trägt den Code je Zeile** (F199). Ein Knopf neben einer
  Zeile schickt genau das, was die Kamera gelesen hätte, also hat die Tür
  **eine** Route — die Alternative wäre ein zweiter Einlassweg über die
  Anmelde-Id gewesen, und dann liefen „mit Kamera" und „ohne Kamera"
  auseinander. Der Code entsteht **beim ersten Lesen**, und das gilt für die
  Liste des Veranstalters wie für die Ticketseite; dass ein `GET` dabei eine
  Zeile anlegt, ist idempotent (`INSERT … ON CONFLICT DO NOTHING`) und für
  niemanden sichtbar.
- **Warnungen sind gerechnet, nicht gespeichert, und lehnen nichts ab** (E50,
  F196). `GET …/events/:id/schedule` trägt je Session `warnings`
  (`overbooked`, `double-booked`) und je Raum die Vereinigung, dazu **jede**
  Session des Events für den Editor (F49, eine Anfrage je Bildschirm);
  `PUT …/program-items/:id/rooms/:id` hat zwei Regeln — die Session gibt es und
  gehört zum Event des Raums — und keine dritte. `GET …/rooms/:id/schedule`
  aus Phase 1 ist eine Scheibe dieses Plans, damit eine Session in zwei Räumen
  gegen beide gerechnet wird.
- **`PATCH` an einem Raum schreibt nur, was kommt, und `null` leert** (Etage,
  Beschreibung) — dieselbe Lesart wie bei jedem `PATCH` dieser Anwendung, mit
  denselben zwei Regeln wie beim Anlegen (getrimmter Name ohne Doppelgänger im
  Event, mindestens ein Platz). `DELETE` nimmt die Zuordnungen über die Kaskade
  der eigenen Join-Tabelle (F21) und lässt die Sessions stehen; ein zweites
  `DELETE` ist ein 404, wie bei einer Session.
- **Eine Zählroute entsteht, wenn ein Abschnitt sie liest** (E21, E59, F193).
  `GET …/events/:id/summary` gibt die drei Zustände in **einer** Anweisung
  (`GROUP BY status`), mit einer Null für einen Zustand ohne Zeilen — sie kam
  deshalb in AP 3 und nicht in AP 2, wo es den Bildschirm noch nicht gab. Die
  Zahl gehört dem **Abschnitt des Plug-ins**, nie der Kachel des Hosts: eine
  Kachel mit Zahl hieße, dass der Host ein Plug-in fragt, und diese Richtung hat
  der Vertrag nicht. Und `total` einer gefilterten Liste ist keine
  Zusammenfassung: es zählt genau die eine Teilmenge.
- **Eine Freigabe ist eine Route, kein Feld** (E51, F191). `POST …/approval` und
  `POST …/rejection`, nie ein `PATCH` mit `status` — das wäre die Gestalt, in
  der jemand `pending` zurücksetzt. Zustand und Zeitpunkt werden in **einer**
  Anweisung geschrieben, weil die Prüfbedingung der Tabelle keine andere
  Kombination zulässt; eine Korrektur ist erlaubt und verschiebt den Zeitpunkt.
  Die abgelehnte Zeile bleibt stehen (E14) und ist genau zwei Parteien
  sichtbar — die Sichtbarkeitsregel steht in der **Anweisung** des Repositories
  (F152), nicht in einem Aufrufer und erst recht nicht in einem
  Query-Parameter.
- **Slugs sind je Elternteil eindeutig** (E7), nicht je Instanz → öffentliche
  Adressen sind geschachtelt (`/series/:reihe/events/:event`), die API-Pfade
  folgen (F28). Die öffentliche Adresse wird an **einer** Stelle gebaut:
  `publicEventPath`, `publicSeriesPath`, `publicUrl(origin, pfad)` in
  `shared-models` (F112) — den Origin kennt nur das Deployment
  (`publicUserClientUrl` aus `/api/config`). Verlinkt wird nur Veröffentlichtes.
- **Export und Löschung hängen an `participant/me`** (E65, F216, F218).
  `GET /api/participant/me/export` antwortet mit **einem** ZIP: `export.json`
  mit den Daten (englische Feldnamen, ISO-Zeitstempel), `README.txt` mit jedem
  Satz in der Sprache des Kontos und aus dem Katalog, und daneben die
  hochgeladenen Dateien. `DELETE /api/participant/me` trägt das **aktuelle
  Passwort** im Rumpf, antwortet 204 und löscht das Sitzungs-Cookie. Beide
  liegen am Profilbildschirm (F49) und nicht in einem eigenen Controller, weil
  das Passwort dort geprüft werden muss, wo der gespeicherte Hash gelesen
  werden darf. Keine eigene Drosselungsart (E60): beide stehen hinter einer
  Sitzung, und die konfigurierbaren Grenzen zählen die Türen **ohne** Sitzung.
- **Ein Endpunkt für einen Bildschirm** (F49). Das Dashboard ist eine Anfrage,
  nicht vier. `GET …/events/:id/translations` bringt Event **und** Programm;
  geschrieben wird aber je Ding und je Sprache (F97), damit ein Fehler in der
  neunzehnten Session die achtzehn davor nicht wegwirft.
- **Listen sind serverseitig gefiltert, sortiert und paginiert**, mit der ID als
  letztem Sortierkriterium. Kein Endpunkt liefert „alles". **Keine
  Datenbankerweiterung für Suche** (F32): `ILIKE '%wort%'` je Wort, kein
  `pg_trgm` — Installierbarkeit vor Mikrooptimierung (13 ms bei 2 000
  Anmeldungen).
- **Ein Event hat eine Startseite, und die ist nicht sein Formular** (F48).
  `/series/:reihe/events/:event` ist das Dashboard, `…/edit` das Formular —
  dieselbe Ordnung wie bei der Reihe. Speichern führt zurück aufs Dashboard, ein
  _neues_ Event weiterhin auf die Reihe.
- **Das öffentliche Registrierungsformular antwortet immer gleich** (E10), sonst
  wird es zur Abfrage über die Teilnehmerliste.
- **Ein abgeschaltetes Kernmodul antwortet 404**, wie ein Plug-in (F53):
  `@CoreModuleController(key)` + `CoreModuleEnabledGuard`. `/api/config` und der
  Guard lesen **denselben** Zwischenspeicher (`ModuleFlagCache`, 15 s), damit
  nicht ein Client von einem Modul erfährt, dessen API 404 gibt. Ein neues
  optionales Modul braucht Deskriptor **und** Guard, sonst ist der Schalter eine
  Attrappe. Wer den Schalter zur Laufzeit umlegt, ruft `refresh()` — und die
  Modulverwaltung liest den Zustand aus den **Registries**, nie aus der Tabelle;
  ein unbekannter Schlüssel ist ein 404, keine neue Zeile.
- **Ein Modulschalter darf eine Voraussetzung haben, und löst sie nie still
  auf** (F128, E42). Der Deskriptor nennt sie (`CoreModuleDescriptor.requires`),
  `ModuleSummary.requires` trägt sie zum Client, die Modulverwaltung zeigt sie
  **als Namen** in der Zeile. Einschalten ohne die Voraussetzung ist ein **409
  mit dem fehlenden Schlüssel**, Ausschalten der Voraussetzung unter einem
  laufenden Abhängigen ein **409 mit den Abhängigen** — beides **vor** dem
  Schreiben, damit ein verweigerter Klick nichts ändert. „Dann schalte ich die
  anderen eben mit ab" wäre ein Schalter, der mehr tut als er sagt.
  `profile-search` und `chat` brauchen `profiles`; **`chat` braucht
  ausdrücklich nicht `profile-search`** — ohne Verzeichnis lässt sich kein neues
  Gespräch beginnen, die bestehenden bleiben lesbar (E14, E37), und eine
  Voraussetzung hätte behauptet, Nachrichten seien ohne Verzeichnis sinnlos.
  **Seit AP 2 der Phase 4 gilt das auch für Plug-ins** (E47, F190):
  `ServerPlugin.requires`, dieselbe Mechanik, und der Prüfweg liest **beide**
  Registries — die Voraussetzung eines Plug-ins ist ein Kernmodul, und der
  Abhängige eines Kernmoduls kann ein Plug-in sein. Wer nur eine Familie fragt,
  setzt die Hälfte der Regel durch, und zwar die falsche. F128 hatte Plug-ins
  ausgenommen, weil ein Plug-in Kerndaten über den Vertrag erreicht (E12) — das
  gilt für Programmpunkte und Anmeldungen und **nicht für Menschen**: ein
  Vorschlag gehört einem Konto, und Konten gibt es nur mit `profiles`.
- **Ein Modulschalter deckt keine P1-Anforderung** (F171). Das Kontaktformular
  `POST /api/user/series/:reihe/events/:event/contact` liegt in
  `business/chat/`, weil dieses Modul die Gespräche besitzt — und trägt als
  einziger Controller dort **kein** `@CoreModuleController(CHAT_MODULE_KEY)`.
  FR 3.4 ist P1, der Chat aus FR 4.5 ein abschaltbares P2-Modul, und `chat`
  setzt `profiles` voraus (E42): mit dem Schalter davor wäre eine Instanz **ohne
  Teilnehmerkonten nicht erreichbar**, und genau für die ist UC 14 da. Der
  Schalter entscheidet, ob die Menschen **in** einer Instanz einander schreiben
  dürfen, nicht ob die Organisation angeschrieben werden kann. Wer hier einen
  Dekorator „nachträgt", nimmt einer Instanz ihr Postfach — deshalb steht die
  Begründung im Kopf des Controllers und nicht nur hier. Antwort ist immer
  **202** mit der geschickten Adresse (E10), eigene Drosselung (30 je 5 min,
  enger als die 60 des Anmeldeformulars, weil jede Anfrage eine Mail auslöst —
  die Mail geht hier aber an die **Organisation**, nicht an eine Adresse des
  Aufrufers, deshalb ohne den Empfängerzähler),
  404 nur für „kein veröffentlichtes Event an dieser Adresse" (F26) — und
  **kein** `hasEnded`-Riegel wie bei der Anmeldung: eine Frage zu einem Event,
  das vorbei ist, ist eine Frage. **Kein Bild**, also JSON statt `multipart`:
  ein öffentlicher Endpunkt, der Bytes von Unbekannten annimmt, wäre eine
  zweite Uploadfläche für nichts.
- **Ein zurückkehrender Modulschlüssel bringt eine Altlast mit.** Phase 2 zog
  fünf Attrappen-Deskriptoren zurück und ließ ihre `module_config`-Zeilen liegen
  („Abschalten löscht nie Daten"). Für eine `true`-Zeile ist das richtig — jemand
  hat sie gewollt. Für eine **`false`**-Zeile nicht: sie ist der Vorgabewert einer
  Zeit, in der der Schalter nichts tat, und sie überstimmt den Deskriptor
  stillschweigend am Tag, an dem das Modul wirklich kommt — der Veranstalter
  findet es aus, ohne es je ausgeschaltet zu haben. Deshalb löscht die Migration
  des Arbeitspakets die `false`-Zeile des zurückkehrenden Schlüssels;
  `ensureDefaults` schreibt sie beim nächsten Start aus dem Deskriptor neu. Gilt
  **für keinen mehr** — `profiles` (AP 1), `profile-search` (AP 5) und `chat`
  (AP 6) sind zurück, und keiner kostete eine eigene Migration: die aus AP 1 hat
  die `false`-Zeilen **aller drei** Schlüssel auf einmal gelöscht. Der eine
  Schlüssel, der nie zurückkommt, ist `newsletter` (F8) — und er ist deshalb das
  Beispiel, an dem `core-module-registry.service.spec.ts` „ein Flag ohne
  Deskriptor" prüft.
- **Das Selbstbedienungs-Token steht beim Lesen in der Query, beim Ändern im
  Rumpf** (F44): Lesen ist, was der Link in der Mail tut; ändern darf kein
  Linkvorschau-Dienst können. Nur eine **bestätigte** Anmeldung hat eine
  Selbstbedienungsseite, und gelesen wird über die **Event-Id**, nicht die
  öffentliche Adresse — sonst wäre jeder Link tot, sobald das Event auf Entwurf
  zurückgeht. `ProgramService.listForEvent` und `EventsService.locate` sind genau
  dafür da.
- **Genau eine Medienroute prüft eine Berechtigung** (F156, E40).
  `/api/media/messages/:id/attachment` gibt das Bild einer Nachricht nur an ein
  **Mitglied** des Gesprächs. Die Begründung von F115/F124 trägt dort **nicht**:
  ein Logo ist eine Marke, ein Avatar reist mit einer Id, die sein Leser
  ohnehin sehen darf — ein Chatbild ist Inhalt in einem privaten Gespräch.
  Adressiert wird über die **Nachricht**, nicht über die Datei: Mitgliedschaft
  ist eine Eigenschaft des Gesprächs, und eine Anhangs-Id sagt darüber nichts.
  Die Sitzung verlangt `@RequiresParticipant()` — ein Dekorator, der nur
  **verschärfen** kann, weshalb er F69 nicht aufhebt (der Fehler in seiner
  Richtung ist ein 401, das nie kommt, nie ein offener Endpunkt). Kein `?v=`,
  weil eine Nachricht nicht bearbeitet werden kann (E14). Der Veranstalter liest
  dieselben Bytes **nicht** hier: zwei Zielgruppen, zwei Präfixe, zwei Guards
  (E33) — ein Guard, der beide Cookies nimmt, ist der, den E34 verbietet. Und
  `GET /api/admin/attachments/:id` bedient seit AP 6 **nur** Anmeldungsdateien
  (F155), sonst käme ein Veranstalter mit einer Id an ein privates Bild.
- **Der Chat antwortet mit zwei Codes, und jeder sagt eine Sache** (F157). Ein
  Gespräch **beginnen** ist **403** für alles, was nicht angeschrieben werden
  darf — unbekannt, unbestätigt, kein Opt-in, zurückgenommen —, wortgleich
  (F124); **400** nur für die **eigene** Id, denn die kennt der Fragende.
  Alles danach fragt nur nach Mitgliedschaft, und „nicht deins" ist ein **404**
  mit dem Wortlaut einer unbekannten Id. Die Bildroute hat ihren **eigenen**
  dritten Satz für ihre drei Fehlschläge — sie darf den des Gesprächs nicht
  borgen.
- **Ein Gespräch hat eine eigene Leseroute, und sie ist keine neue Fähigkeit**
  (F165). `GET /api/participant/conversations/:id` gibt die Zeile der Übersicht
  für eine Id — die Gesprächsansicht braucht sie, um zu sagen, mit wem sie ist,
  denn Namen sind eine Eigenschaft des Gesprächs und nicht der Nachricht (E39).
  Beantwortet von `overviewFor`, das die Mitgliedschaft seit AP 6 in derselben
  Anweisung führt (F152); „nicht deins" ist derselbe 404 wie eine unbekannte Id.
- **Der Verlauf eines Gesprächs paginiert über einen Cursor** (F154), als
  einzige Liste dieser Anwendung. `?before=<Nachrichten-Id>`, Vergleich über
  `(created_at, id)`, `hasMore` statt `total`. Der Grund ist, was die Liste ist:
  sie wächst am Ende, während sie gelesen wird, also bedeutet „Seite 2" eine
  Sekunde später etwas anderes. Eine Id aus einem fremden Gespräch ergibt ein
  **leeres** Fenster, keinen Fehler.
- **Der Socket ist ein Vertrag wie ein Endpunkt, und er steht unter `/api`**
  (F160, F132, E41). `REALTIME_PATH` = `/api/socket.io`, Namensraum `/chat`,
  Ereignisnamen und Nutzlasten in `shared-models` — Server, beide Clients, der
  Reverse Proxy und das Prüfskript haben eine Schreibweise. Der Pfad ist nicht
  der socket.io-Standard, weil das Sitzungscookie `Path=/api` trägt: ein
  Handshake außerhalb kommt ohne Sitzung an, und **der Handshake ist die
  Authentifizierung**. Gefragt werden dort Sitzung und `chat`-Schalter, in
  derselben Reihenfolge wie auf der HTTP-Seite; abgelehnt wird als
  `connect_error` mit dem Satz des Servers, nie als Socket, der verbunden
  aussieht. Ein `@UseGuards` auf einem Gateway ist dafür das falsche Werkzeug
  — es läuft je **Nachricht**, also nach dem Handshake. Zwei Räume: der eines
  Gesprächs wird nur auf `chat:join` und nur von einem Mitglied betreten (drei
  Fehlschläge, ein `{ joined: false }`, F157), der eines Mitglieds am Handshake
  und ohne Prüfung (F161). Wer einen zweiten Gateway anlegt, gibt ihm einen
  eigenen Namensraum und **wiederholt die Türprüfung nicht** — er ruft sie auf.
- **Eine Medienroute nimmt nie einen Pfad, aber auch keinen Status** (F113, F115).
  `/api/media/branding/{logo,app-icon}` löst über `app_config` auf,
  `/api/media/series/:id/logo`, `…/events/:id/logo` und
  `…/profiles/:id/avatar` über die Zeile — mehr Routen zu gespeicherten Bytes
  gibt es nicht, und keine davon nimmt einen Dateinamen. Der **Status** wird
  dabei bewusst **nicht** geprüft: das Logo einer unveröffentlichten Reihe wird
  ausgeliefert, weil die Adresse die uuid braucht, die Bytes eine Marke sind und
  die Gegenrichtung die Vorschau des Veranstalters genau im Entwurfszustand
  kaputt machen würde. Das 404 sagt nur „hier ist kein Bild" und nie, ob die
  Zeile existiert.
- **Beim Avatar trägt dieselbe Regel eine andere Begründung** (F124). Zwei der
  drei Argumente aus F115 greifen dort **nicht**: ein Profilbild _ist_ ein
  Teilnehmerdatum, und es gibt keine Veranstalter-Vorschau, die eine strengere
  Regel kaputt machen würde. Was trägt, ist die uuid — plus E34: ein
  sitzungsgeschützter Avatar müsste **entweder** das Teilnehmer- **oder** das
  Veranstalter-Cookie akzeptieren (der Guard, den E34 verbietet) oder es gäbe
  zwei Routen zu denselben Bytes (was E19 verbietet). Folge, die man beim
  nächsten Paket braucht: **wer eine Id herausgibt, gibt das Bild mit heraus** —
  die Profilsuche darf die Id eines Profils, das sie nicht zeigt, nicht nennen.
- **Der Profil-Baukasten ist eine flache Sammlung** (F122, E35):
  `/api/admin/profile-fields`, ohne Elternteil im Pfad, weil die Fragen
  instanzweit sind. Das Anmeldeformular liegt aus dem umgekehrten Grund unter
  seinem Event. Lesen darf der Teilnehmer (`/api/participant/profile-fields`) —
  er füllt das Formular aus —, schreiben nur der Veranstalter.
- **`PATCH /api/participant/me` ist oben teilweise und unten ganz.** Ein nicht
  gesendetes Feld ändert sich nicht; `customFields` ist, **wenn** es mitkommt,
  die vollständige Antwortmenge. Sonst ließe sich „required" nicht beurteilen:
  eine Pflichtfrage ist eine Eigenschaft des Formulars, nicht eines Fragments.
  Wer nur den Namen korrigiert, darf deshalb nicht an einer Frage scheitern, die
  vor drei Monaten gestellt wurde. Die Kehrseite gilt für den Client (F146):
  „es gibt keine Fragen" und „die Fragen sind unbekannt" sind zwei Zustände, und
  wer sie verwechselt, schickt ein `{}`, das jede bisherige Antwort löscht.
- **Ein Parameter, der nichts ändert, wird nicht deklariert.** Die Kehrseite der
  Zeile über `forbidNonWhitelisted` weiter unten: `GET /api/participant/profiles`
  nimmt **kein** `?locale=`, weil an seiner Antwort nichts übersetzt ist — ein
  Name ist ein Name, der Tätigkeitsbereich ist der Text des Menschen selbst, und
  die Beschriftungen der Profilfragen kommen aus dem Feld-Baukasten. Ein
  mitdeklariertes `locale` wäre die Zusage, dass es etwas bewirkt; so ist es ein
  400, und das ist die ehrliche Antwort. Der Client schickt es dort deshalb
  nicht.
- **`?locale=` hat drei Antworten, und nur eine ist ein Fehler** (F94): fehlt der
  Parameter, stehen die Originale (kostenlos); eine wohlgeformte Sprache, in die
  niemand übersetzt hat, ist **kein** Fehler; was kein Sprachtag ist, ist ein 400.
  In der Query, nicht in `Accept-Language`. `LocaleQueryPipe` + `ApiLocaleQuery()`
  in `business/common/`.
- **Die Statuscodes der Ersteinrichtung sind der Vertrag** (F64): 401 =
  „unbeansprucht, Token fehlt oder ist falsch", 404 = „es gibt einen
  Administrator". Existenzbedingung ist bei jedem Aufruf die Datenbankfrage
  „kann sich überhaupt jemand anmelden?" — kein Flag, keine Datei.
- **Ein Versand an viele Adressen ist ein Vorgang, keine Anfrage** (F56): der
  `POST` schreibt die Empfängerzeilen und antwortet **202**; die Zeilen _sind_ die
  Warteschlange, der Fortschritt wird aus ihnen **gezählt**, nie daneben
  gespeichert.
- **Der Widerspruch gegen Einladungen hat zwei Türen, und die zweite hat eine
  eigene Begründung gegen E5b** (F208, RFC 8058). `POST
/api/user/invitations/opt-out` ist die Seite: ein Mensch klickt einen Link,
  die Seite widerspricht per `POST`, weil ein Linkvorschau-Dienst das nicht für
  den Leser entscheiden darf. `POST …/opt-out/one-click?token=` ist die
  Kopfzeile: **ein Mailprogramm** ruft sie auf, wenn sein Nutzer den eigenen
  Abmeldeknopf drückt. Drei Dinge machen sie zu einer anderen Anfrage und nicht
  zu einer Aufweichung von E5b: sie steht in einer **Kopfzeile**, nicht im
  Rumpf, also rendert sie niemand; sie verlangt im Rumpf das Feld
  `List-Unsubscribe=One-Click`, das ein URL-abklappernder Dienst nicht
  mitschickt (ein `GET` ist dort gar keine Route); und sie kann nur
  **wegnehmen**, und zwar der Person, die den Brief bekommen hat (F58) — der
  Bestätigungslink, für den E5b geschrieben wurde, ist das Gegenteil, er
  **erzeugt** eine Anmeldung. Antwort ist `204`: keine Seite, kein Rumpf,
  niemand, der es liest — und ein zweiter Aufruf antwortet genauso, weil
  Anbieter Zeitüberschreitungen wiederholen. Der Pfad steht **einmal**, in
  `invitations.routes.ts`, weil Controller und Mailvorlage dieselbe
  Zeichenkette brauchen: zwei Schreibweisen ergäben eine Kopfzeile, die ins
  Leere zeigt, und gemerkt hätte es zuerst ein Spamfilter.
- **Ein Objekt-Query und `?locale=` müssen sich einig sein.**
  `forbidNonWhitelisted` (in `core/validation.ts`) prüft die **ganze** Query
  gegen das DTO, das ein Handler mit `@Query()` entgegennimmt — ein Endpunkt mit
  Query-Objekt **und** Sprache antwortet deshalb 400, bevor er läuft, und der
  Fehlschlag sieht nach einem kaputten Client aus. Das DTO **deklariert** die
  Sprache mit (`ListMyRegistrationsDto.locale`), gelesen wird sie weiter über
  `@Query('locale', LocaleQueryPipe)`, weil dort die Regel liegt (F94). Zum
  ersten Mal aufgetreten in AP 4 der Phase 3, als „meine Anmeldungen" beides
  brauchte.
- **Die Selbstbedienung hat zwei Ansprüche und eine Regelstrecke** (F148).
  `SelfServiceService.require` nimmt einen `SelfServiceClaim`: das signierte
  Token aus der Mail (E11) oder eine Sitzung plus Anmelde-Id, aufgelöst über
  **Adressgleichheit** (E31). Ab der Statusprüfung ist es derselbe Code — wer
  eine Ausnahme nur für einen der beiden Wege braucht, hat den Schnitt falsch
  gelegt. Eine Anmeldung, die einer **anderen** Adresse gehört, ist ein 404 mit
  demselben Wortlaut wie eine unbekannte Id; alles andere sagt einem
  angemeldeten Teilnehmer, welche Anmeldungen existieren. Und: die Liste
  (`/api/participant/registrations`) zeigt jeden Zustand, das Storno über die
  Sitzung fehlt bis AP 12 bewusst.
- **Die Profilsuche nennt kein Profil, das sie nicht zeigt** (F126, F150, F152).
  Zwei Lesezugriffe unter `/api/participant/profiles`, und beide antworten nur
  über Zeilen mit `searchable = true` **und** bestätigter Adresse — die Regel
  liegt in der SQL des Ports, nicht in den Aufrufern (E37). Verborgen,
  unbestätigt und unbekannt sind **eine** Antwort, ein wortgleiches 404: wer eine
  Id herausgibt, gibt das Profilbild mit heraus (F124). Eine Trefferzeile trägt
  Name, Bild und Tätigkeitsbereich, die Einzelansicht zusätzlich die Antworten
  auf die Profilfragen — und **keine** der beiden eine Adresse: Kontakt ist ein
  Gespräch, nie ein Postfach aus einer Antwort (F55). Der eigene Eintrag fehlt in
  der eigenen Suche, und zwar in der Abfrage: nachträglich entfernt wäre die
  Gesamtzahl eine zu hoch.
- **`/api/participant/**` braucht keine eigene Drosselung, `/api/user/**`
  schon.** Die tokenbasierten Selbstbedienungsrouten tragen `@Throttle` (60 je 5
  min), weil ein Token im Prinzip erratbar ist und jeder Aufruf einen HMAC
  kostet (E4); hinter einer Sitzung greift die globale Grenze.
  **Zwei Schreibweisen seit AP 2 der Phase 5, und sie meinen Verschiedenes:**
  `@Throttle({ default: { limit: KONSTANTE, … } })` ist eine Zahl, die im Bau
  feststeht, und `@RateLimit('login' | 'registration' | 'newsletter-signup' |
'confirmation')` benennt eine Zahl, die aus der Umgebung kommt (E60) — ein
  Dekorator kann nicht injiziert werden, also nennt die Route die **Art** der
  Tür und nicht ihr Maß. Wer eine neue öffentliche Route baut, fragt zuerst, ob
  sie eine der vier Arten ist; nur wenn nicht, bekommt sie eine eigene
  Konstante.
- **Eine Route, die an eine Adresse mailt, die der Aufrufer wählt, zählt
  zweimal.** `@ThrottleByRecipient()` neben die Drosselung des Aufrufers — die
  vier Zähler oben zählen den Absender, und der sucht sich seine Adresse aus.
  Heute tragen es das Anmeldeformular, die Newsletter-Anmeldung und das
  Kontoformular. **Wo die Route auch `multipart` annimmt, steht der Dekorator
  hinter dem Multipart-Interceptor im selben `@UseInterceptors`** — ein Guard
  wäre hier falsch, weil er läuft, bevor irgendetwas den Rumpf geparst hat, und
  eine Anmeldung mit Datei käme ungezählt durch. Was jede
  Teilnehmerroute dagegen **braucht**, sind `@UseGuards(CoreModuleEnabledGuard)`
  und `@CoreModuleController(<Schlüssel>)` — eine Instanz ohne das Modul
  antwortet dort 404, nicht 401 (F53). Der Schlüssel ist der des Moduls, nicht
  `profiles`: die Profilsuche prüft `profile-search`, der Chat `chat`, und einer
  genügt, weil die Voraussetzung dort erzwungen wird, wo geschaltet wird (E42).
  **Reihenfolge beachten:** der Teilnehmer-Guard ist global und läuft **vor**
  einem Controller-Guard, also antwortet eine Route ohne Cookie 401, auch wenn
  ihr Modul aus ist.
- **Die Nachrichten der Organisation liegen unter `admin/conversations`** (F173,
  AP 10): die Übersicht, ein Gespräch, sein Verlauf, die Antwort, die
  Kandidaten einer Gruppe (`?eventId=`), die Gruppe selbst (`POST` auf die
  Sammlung — eine Gruppe ist die einzige Art, die ein Veranstalter anlegt) und
  das Bild einer Nachricht. Zwei Eigenschaften sind der Vertrag: **es gibt keine
  Ungelesen-Zahl** (die Organisation hat kein `last_read_at`, F133 — die Zeile
  sagt stattdessen, **wer zuletzt geschrieben hat**, und `awaitsAnswer` in
  `shared-models` liest das), und **ein `direct`-Gespräch ist hier kein 403,
  sondern derselbe 404 wie eine unbekannte Id** — was zwei Teilnehmende
  einander schreiben, darf ein Veranstalter nicht einmal bestätigen können.
- **Ein Modulschalter darf an einer einzelnen Route hängen** (F175). `admin/
conversations` ist der Fall: Lesen und Antworten sind FR 3.4 und damit **P1**,
  müssen also auch bei ausgeschaltetem `chat` antworten — sonst kämen die
  Kontaktanfragen aus AP 9 nirgends an; eine Gruppe anzulegen ist FR 4.5 und
  fragt deshalb nach dem Schalter. Dafür `@CoreModuleRoute(<Schlüssel>)` **plus
  `@UseGuards(CoreModuleEnabledGuard)` an der Methode**: auf der Klasse würde
  der Guard jede unmarkierte Route ablehnen. Wer das prüft, prüft beide Hälften
  — die eine Route antwortet, die andere 404.
- **Die Antwort einer Antwort sagt, was aus ihrer Mail wurde** (F174).
  `POST /api/admin/conversations/:id/messages` gibt die Zeile **und**
  `delivery`: `none` (eine Gruppe liest in der App), `sent`, `failed`. Drei
  Werte statt eines `boolean`, weil „nichts zu senden" und „senden
  fehlgeschlagen" verschiedene Tatsachen sind — und ein Feld auf einer
  erfolgreichen Antwort statt eines Fehlers, weil die Nachricht in jedem Fall
  gespeichert ist. Ein Bild nimmt diese Route **nicht**: eine Antwort muss auch
  als Mail funktionieren.
- **Für das Bild einer Nachricht gibt es zwei Routen, weil es zwei Fragen
  sind** (F133, F156). Die Medienroute unter `/api/media` entscheidet über
  **Mitgliedschaft**; die Organisation hat keine, also liest sie über
  `GET /api/admin/conversations/:id/messages/:messageId/image` hinter dem
  Admin-Guard — und der Client **holt** die Bytes und zeigt sie aus einem Blob,
  wie bei der Datei einer Anmeldung (E9). Ein Guard, der beide Cookies
  akzeptiert, wäre genau das, was E34 verbietet.
- **`POST/DELETE /api/user/push/subscriptions` bleiben anonym, und eine Sitzung
  ändert ihre Bedeutung** (F134, E43). Beide Antworten sind richtig: ohne
  Sitzung entsteht eine Zeile, die niemandem gehört, mit Sitzung eine, die an
  das Konto gebunden ist — und dieselbe Route bindet auch wieder los, wenn
  dasselbe Gerät sie ohne Cookie schickt. Der globale Teilnehmer-Guard kann das
  nicht: er kennt erlauben oder ablehnen. Also liest der Controller das Cookie
  **optional**, durch denselben Dienst wie der Guard (E34) und über
  `participantSessionFromRequest`, damit es nicht einen dritten Leser gibt.
  **Es gibt weiter keinen Testversand-Endpunkt** — ein unauthentifizierter wäre
  ein Spam-Vektor, und seit AP 11 ist die Event-Änderung selbst der Versand.
- **Query-Parameter kommen als `undefined` an**, auch wenn ein Angular-`input()`
  einen Standardwert hat. `ApiClient.put/delete/post` nehmen ebenfalls
  Query-Parameter — auch ein `PUT` muss die Sprache tragen können.
- **Ein `DELETE` bedeutet in dieser API „für immer weg"** (F179). Deshalb
  storniert eine Sitzung ihre Anmeldung über
  `POST /api/participant/registrations/:id/cancellation` und nicht über ein
  `DELETE` auf der Anmeldung: `DELETE /api/admin/registrations/:id` löscht sie
  wirklich, und das ist die Antwort auf ein Löschverlangen. Dieselbe Gestalt hat
  der Weg über den Mail-Link seit Phase 1 (`POST
/api/user/registrations/me/cancellation`), also liest sich die eine Operation
  über beide Ansprüche gleich (F148). Die Abweichung von der API-Tabelle des
  Phasenplans ist protokolliert.
- **Ein öffentliches Formular, das eine Adresse annimmt, antwortet immer gleich
  — auch wenn die Mail nicht rausgeht** (F181, E32, E45). Der
  Newsletter-Endpunkt schluckt einen `MailDeliveryError` und loggt ihn: ein 503
  für die eine und ein 200 für die nächste Adresse wäre die Auskunft, welche
  Adressen die Instanz kennt. Das ist die Umkehrung von F174, wo ein Fehlschlag
  sichtbar sein **muss** — der Unterschied ist, wer die Antwort liest.
- **`GET /api/admin/newsletter` hat keinen Filter nach Quelle** und keine Suche:
  jede Zeile sagt ihre Quelle, und ein Filter wäre ein zweiter Weg zu einer
  Frage, die die Liste in jeder Zeile beantwortet. Wer eine Person sucht, sucht
  sie in der Teilnehmerübersicht.
- **Eine Auswahl, die nur existieren oder nicht existieren kann, ist `PUT` und
  `DELETE` auf ihrer eigenen Adresse — beide 204, beide ohne Rumpf.** Der
  individuelle Programmplan (AP 9 der Phase 4) ist die Vorlage: `PUT
/…/program-items/:id` stellt eine Tatsache fest statt einer Sammlung etwas
  hinzuzufügen, also ist das zweite Mal dieselbe Antwort wie das erste. Ein
  Rumpf müsste etwas sagen, und es gibt nichts zu sagen — die Adresse ist die
  ganze Anfrage.
- **Die zwei Richtungen sind dabei bewusst unsymmetrisch:** Hineinlegen
  antwortet **404** für etwas, das es nicht gibt, Herausnehmen antwortet **204**
  für etwas, das nie drin war. Der Grund ist der Zustand, den der Aufrufer
  bestellt hat: „nicht im Plan" ist erreichbar, „im Plan, obwohl es die Session
  nicht gibt" nicht. Und weil eine Prüfung das Rennen mit einer Löschung nicht
  gewinnt, gibt der Fremdschlüssel dieselbe 404 noch einmal aus.
- **Ein Plug-in erfindet keine 404 über etwas, wofür es keinen Port hat.** Ein
  Event, das es nicht gibt, ist für den Plan eine **leere Liste** — der Vertrag
  veröffentlicht keinen Port für die Existenz eines Events, und die Antwort
  darüber wäre eine Behauptung über etwas, das das Plug-in nicht sehen kann.
  Dieselbe Entscheidung wie beim öffentlichen Raumplan, der nicht prüft, ob ein
  Event veröffentlicht ist.

- **Der Weg zurück ins Konto sind zwei Routen, und die erste antwortet immer
  gleich** (F209, F210, E10, E32). `POST /api/user/profiles/password-reset`
  nimmt eine Adresse und antwortet **200 mit genau dieser Adresse** — ob sie ein
  bestätigtes Konto hat, ein unbestätigtes oder gar keines. Der Unterschied
  steht ausschließlich im Postfach, und weil **jeder** der drei Fälle einen
  Brief schickt, verrät auch die **Laufzeit** der Antwort nichts; das ist die
  Hälfte, die ein Statuscode allein nicht abdeckt.
  `POST /api/user/profiles/password` setzt das Passwort, **204**, Token im
  **Rumpf** (F44, E5b) — ein Linkvorschau-Dienst darf kein Passwort setzen —,
  und es kommt **keine** Sitzung zurück: der Link belegt eine Adresse, das
  Anmelden danach belegt, dass jemand das eben gewählte Passwort kennt.
- **Ein 503 ist hier für jede Adresse einer** — anders als beim Newsletter, der
  einen `MailDeliveryError` schluckt und trotzdem 200 sagt (F181). Beide Wege
  sind zulässig, **gemischt ist keiner**: was zählt, ist, dass zwei Adressen
  dieselbe Antwort bekommen. Das Kontoformular wirft (E32), also wirft der
  Rücksetzweg auch — er ist dessen Nachbar, nicht der des Newsletters.
- **Ein Token, das etwas _übergibt_, wird gegen den Zustand geprägt, den es
  ersetzt** (F209). Der Rücksetz-Link trägt als Subjekt die Konto-ID **und**
  eine geheime Marke über dem Passwort-Hash; das gesetzte Passwort ändert den
  Hash, also löst der Link nichts mehr auf. So wirkt er **einmal**, ohne dass
  irgendetwas gespeichert wird — und ohne die Spalte, die F23 und F180
  ausdrücklich nicht wollen. Wer einen fünften Tokenzweck baut, fragt zuerst:
  gewährt er etwas, das man zweimal haben darf? Nur dann genügt eine ID.
- **Jede Ablehnung eines Rücksetz-Links ist derselbe Satz** — gefälscht,
  abgelaufen, verbraucht, vom Profil überholt. Für den Menschen mit dem Link
  sind sie eine Lage mit einer Antwort (neuen anfordern), und auseinanderhalten
  hieße sagen, ob es zu der Adresse ein Konto gibt.

Siehe auch: [Schichten und Ports im Server](server-layers.md), [Mehrsprachigkeit und Katalog](i18n.md).

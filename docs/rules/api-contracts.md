# Verträge der Endpunkte

Wie ein Endpunkt in dieser Anwendung geschnitten ist, wie er geschützt wird und
was er antwortet.

Diese Formen sind mehrfach gegen Alternativen entschieden worden; die
Alternativen waren jeweils ein offener Endpunkt, eine Sackgasse oder ein toter
Link.

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
- **Slugs sind je Elternteil eindeutig** (E7), nicht je Instanz → öffentliche
  Adressen sind geschachtelt (`/series/:reihe/events/:event`), die API-Pfade
  folgen (F28). Die öffentliche Adresse wird an **einer** Stelle gebaut:
  `publicEventPath`, `publicSeriesPath`, `publicUrl(origin, pfad)` in
  `shared-models` (F112) — den Origin kennt nur das Deployment
  (`publicUserClientUrl` aus `/api/config`). Verlinkt wird nur Veröffentlichtes.
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
- **Ein zurückkehrender Modulschlüssel bringt eine Altlast mit.** Phase 2 zog
  fünf Attrappen-Deskriptoren zurück und ließ ihre `module_config`-Zeilen liegen
  („Abschalten löscht nie Daten"). Für eine `true`-Zeile ist das richtig — jemand
  hat sie gewollt. Für eine **`false`**-Zeile nicht: sie ist der Vorgabewert einer
  Zeit, in der der Schalter nichts tat, und sie überstimmt den Deskriptor
  stillschweigend am Tag, an dem das Modul wirklich kommt — der Veranstalter
  findet es aus, ohne es je ausgeschaltet zu haben. Deshalb löscht die Migration
  des Arbeitspakets die `false`-Zeile des zurückkehrenden Schlüssels;
  `ensureDefaults` schreibt sie beim nächsten Start aus dem Deskriptor neu. Gilt
  noch für `chat` und `profile-search`.
- **Das Selbstbedienungs-Token steht beim Lesen in der Query, beim Ändern im
  Rumpf** (F44): Lesen ist, was der Link in der Mail tut; ändern darf kein
  Linkvorschau-Dienst können. Nur eine **bestätigte** Anmeldung hat eine
  Selbstbedienungsseite, und gelesen wird über die **Event-Id**, nicht die
  öffentliche Adresse — sonst wäre jeder Link tot, sobald das Event auf Entwurf
  zurückgeht. `ProgramService.listForEvent` und `EventsService.locate` sind genau
  dafür da.
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
- **`/api/participant/**` braucht keine eigene Drosselung, `/api/user/**`
  schon.** Die tokenbasierten Selbstbedienungsrouten tragen `@Throttle` (60 je 5
  min), weil ein Token im Prinzip erratbar ist und jeder Aufruf einen HMAC
  kostet (E4); hinter einer Sitzung greift die globale Grenze. Was jede
  Teilnehmerroute dagegen **braucht**, sind `@UseGuards(CoreModuleEnabledGuard)`
  und `@CoreModuleController(PROFILES_MODULE_KEY)` — eine Instanz ohne Konten
  antwortet dort 404, nicht 401 (F53).
- **Query-Parameter kommen als `undefined` an**, auch wenn ein Angular-`input()`
  einen Standardwert hat. `ApiClient.put/delete/post` nehmen ebenfalls
  Query-Parameter — auch ein `PUT` muss die Sprache tragen können.

Siehe auch: [Schichten und Ports im Server](server-layers.md), [Mehrsprachigkeit und Katalog](i18n.md).

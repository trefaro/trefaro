# Phase 4 — Plug-ins: die fünf kuratierten Fachlichkeiten

**Status: geplant** (04.09.2026). Kein Arbeitspaket ist begonnen. Dieses Dokument
ist der **Plan**; er wird ab AP 1 nicht mehr rückwirkend korrigiert, sondern
unten unter _Fortschritt_ fortgeschrieben — wie in [`PHASE1.md`](PHASE1.md),
[`PHASE2.md`](PHASE2.md) und [`PHASE3.md`](PHASE3.md).

Grundlage: Kapitel 6, Phase 4 in
[`Anforderungsanalyse_und_Umsetzungsplan.md`](Anforderungsanalyse_und_Umsetzungsplan.md)
(FR 3.11, 3.13, 3.14, 3.16, 3.17, 4.6; Entscheidungen F6, F14, F21, F45, F47,
F68). Was Phase 3 offen gelassen hat, steht in [`todo.md`](../todo.md) unter
_Checkable after phase 4_ — acht Einträge, jeder ist unten einem Arbeitspaket
zugeordnet.

Die Entscheidungen zählen bei **E46** weiter (Phase 1: E1–E16, Phase 2:
E17–E30, Phase 3: E31–E45); Ergänzungen am Referenzdokument bekommen **F186**
und folgende (F1–F185 sind vergeben, F62 und F129–F131 nie).

**Drei Entscheidungen hat Marius am 04.09.2026 vorab getroffen**, bevor dieser
Plan geschrieben wurde — sie sind der Rahmen, nicht Vorschläge:

1. **Fünf Plug-ins statt vier.** Der **individuelle Programmplan** (FR 3.17) ist
   drin, nicht optional. Er ist damit das erste Plug-in, das ein
   **Teilnehmender** liest — und löst die Frage aus, die `todo.md` dafür
   aufgehoben hat (übersetzte Programmpunkte im Lese-Port).
2. **Das `icon`-Feld des Vertrags bekommt einen Satz, statt gestrichen zu
   werden.** Selbst gehostet, im Image, kein CDN (NFR 9) — womit der Vertrag in
   dieser Phase nur **wächst** und keinen Major-Schritt braucht.
3. **Der QR-Code reist als Seite hinter dem Mail-Link, nicht als Anhang.** Die
   Empfangsbestätigung verlinkt die Selbstbedienungsseite längst (E11); dort
   hängt sich das Check-In-Plug-in ein. Keine Anhangsmaschinerie, keine zehnte
   Mail, und keine Kernmail, die Plug-in-Inhalt trägt.

## Ziel

Am Ende der Phase ist der Plug-in-Mechanismus keine Zusage mehr, sondern eine
Sammlung von fünf Fachlichkeiten, die ihn benutzen — und der Vertrag ist an
allen Stellen bewiesen, die die Thesis für ihn vorgesehen hat:

- **Teilnehmende beteiligen sich am Programm** (FR 3.13): sie schlagen
  Programmpunkte vor, der Veranstalter gibt frei oder lehnt ab, und der Status
  ist für den Vorschlagenden sichtbar (FR 3.14).
- **Jede Veranstaltung kann ein Diskussionsforum haben** (FR 4.6) — mit
  Freigabe-Workflow und einem Moderationsaufwand, der aus **einer** Entscheidung
  je Beitrag besteht, weil die Umfrage genau das verlangt hat.
- **Der Raumplan ist echt** (FR 3.11, F14): Räume mit Kapazitäten, Sessions in
  Räumen, und die zwei Warnungen, für die Phase 1 die Zahlen bereitgestellt hat
  — mehr Anmeldungen als Stühle, und zwei Sessions zur selben Zeit im selben
  Raum. Ein Teilnehmender sieht den Raumplan auf der Event-Seite (FR 3.6).
- **Am Einlass gibt es einen Code** (FR 3.16): der Mensch bringt ihn aus seinem
  Postfach mit, die Organisation liest ihn mit der Kamera — oder tippt ihn ein,
  weil eine Tür nicht von einem Kameratreiber abhängen darf.
- **Wer will, stellt sich sein eigenes Programm zusammen** (FR 3.17), in seiner
  Sprache, ohne damit einen Platz zu buchen.
- Und der Vertrag selbst: **zwei Einhängepunkte mehr, drei Lese-Ports mehr,
  Sprache und Worte für jedes Plug-in, und Icons, die jemand zeichnet.** Ein
  Schritt, `PLUGIN_API_VERSION` 1.1.0 → **1.2.0**, jede Erweiterung von einem
  Paket dieser Phase gefüllt.

**Nicht** Teil von Phase 4: Härtung, konfigurierbare Drosselung,
Passwort-Zurücksetzen, Löschen eines Profils, Lasttests, DSGVO-Werkzeuge, der
Usability-Test mit Democracy International und `CONTRIBUTING.md` (alles Phase 5);
Gamification (FR 4.9, bewusst nie).

## Scope

### Drin

| FR / Quelle       | Inhalt                                                             | Arbeitspaket |
| ----------------- | ------------------------------------------------------------------ | ------------ |
| — (Vertrag)       | Icons aus dem Image, Sprache und Worte für Plug-ins, API 1.2.0     | AP 1         |
| 3.13 · 3.14       | Programmvorschläge: Server, Freigabe, Voraussetzung `profiles`     | AP 2         |
| 3.13 · 3.14 · F47 | Programmvorschläge in beiden Clients, Einhängepunkt am Dashboard   | AP 3         |
| 4.6               | Diskussionsforum: Server, Threads, Beiträge, Freigabe je Beitrag   | AP 4         |
| 4.6               | Forum in beiden Clients                                            | AP 5         |
| 3.11 · 3.6 · F14  | Raumplanung wird echt: Editor, Warnungen, Ansicht für Teilnehmende | AP 6         |
| 3.16              | QR-Check-In: Server, eigener Code, Einlassliste                    | AP 7         |
| 3.16              | QR-Check-In in beiden Clients: Ticketseite und Einlass             | AP 8         |
| 3.17              | Individueller Programmplan, übersetzt gelesen                      | AP 9         |
| —                 | Phasenabschluss                                                    | AP 10        |

### Bewusst draußen

- **Session-Notizen (FR 3.18) und Event-Erinnerungen (FR 3.19).** Beide sind P3
  und keine der beiden ist ein Plug-in, das die Thesis benennt. Die Notiz wäre
  eine Spalte am individuellen Programmplan — billig, aber sie fügt einem
  Datenschutzversprechen einen Text hinzu, den niemand angefordert hat; die
  Erinnerung ist ein **Zeitplan** (Cron, Zustellfenster, Zeitzone je Event) und
  gehört zur Härtung. Der individuelle Programmplan ist so gebaut, dass eine
  Notizspalte später eine Migration kostet und keine Umstellung.
- **Der Raumplan als Karte.** OpenStreetMap/Leaflet bleibt die Ausbaustufe
  (F14) — und niemals eine Google-Karte (NFR 9). Was diese Phase baut, ist die
  strukturierte Raumverwaltung, die F14 für v1 festgelegt hat.
- **Fremdinstallation von Plug-ins zur Laufzeit** (F6). Kuratiert heißt: im
  Image, per Konfiguration schaltbar. Fünf Plug-ins ändern daran nichts.
- **Ein freigegebener Vorschlag wird kein Programmpunkt** (E52). Die Freigabe
  veröffentlicht den Vorschlag; die Session daraus anzulegen bleibt die
  Kernhandlung des Veranstalters im Programm-Editor.
- **Ein Forum über ein Event hinaus.** FR 4.6 sagt „pro Event". Ein instanzweites
  Forum hätte eine Moderationsfläche ohne Anlass und eine Sichtbarkeitsfrage
  ohne Antwort (wer darf lesen, wenn niemand angemeldet war?).
- **Benachrichtigungen für Beiträge und Freigaben.** Push ist eine **Korrektur
  an einem Plan, den jemand schon hat** (F176, F8), und ein neuer Forumsbeitrag
  ist keine. Wer eine Diskussion verfolgen will, öffnet sie; was ein Veranstalter
  moderieren muss, steht auf seinem Dashboard.
- **Volltextsuche im Forum.** `ILIKE` je Wort, wie überall (F32). Keine
  Datenbankerweiterung für Suche.
- **Eine Meldefunktion für Beiträge.** Die Moderation ist die Freigabe **vor**
  der Veröffentlichung; was danach noch gemeldet werden müsste, entscheidet der
  Pilotpartner (Eintrag in `todo.md`).
- **Bilder in Beiträgen und Vorschlägen.** Der Bildweg dieser Anwendung ist eine
  `attachment`-Zeile mit Signaturprüfung und einer Route mit
  Berechtigungsprüfung (E9, F38, F156) — für ein Plug-in heißt das ein eigener
  Teilbaum, eine eigene Medienroute und ein eigener Purge-Weg. Das ist ein
  Arbeitspaket, nicht ein Feld, und FR 4.6/3.13 verlangen es nicht.

---

## Der Ist-Zustand, auf dem diese Phase aufbaut

Damit nicht gebaut wird, was schon steht:

- **Der Vertrag steht seit Phase 0 und ist einmal gewachsen.**
  `apps/server/src/app/business/plugin-api/` trägt `ServerPlugin` (Schlüssel,
  Version, `apiVersion`, `titleKey`, Modul, Persistenz, Client-Beitrag,
  `enabledByDefault`), zwei Einhängepunkte (`navigation`, `event-detail`), den
  Lese-Port `PluginProgramReads` (E12, F45) und `PLUGIN_API_VERSION` **1.1.0**
  mit `isCompatiblePluginApiVersion` samt Test.
- **`PluginHostModule` ist global und veröffentlicht genau eine Fähigkeit.** Ein
  Plug-in injiziert ein Symbol aus `plugin-api` und importiert **kein**
  Kernmodul. Genau dieser Baustein wächst in dieser Phase — und nur da, wo ein
  Plug-in es hier auch benutzt.
- **`PluginManagerModule` montiert alle kuratierten Plug-ins beim Start**, ihre
  Tabellen existieren immer, und `module_config` entscheidet, ob die API
  antwortet (404) und ob `/api/config` das Plug-in nennt. Der Registry-Cache
  liest alle 15 s neu.
- **Die Raumplanung ist die Referenzimplementierung** und weiter als der Name
  vermuten lässt: `plugin_room_planning_room` und
  `plugin_room_planning_program_item_room`, Ports und Repositories im Plug-in,
  Routen für Anlegen, Auflisten, Zuordnen und Lösen einer Zuordnung, und
  `GET …/rooms/:roomId/schedule`, das Kapazität, Zeiten und Anmeldezahlen
  **nebeneinander** berichtet und nichts beurteilt. Was fehlt: Ändern und
  Löschen eines Raums, die Warnungen, jede Oberfläche und die Ansicht für
  Teilnehmende.
- **Drei Plug-in-Verzeichnisse enthalten nur eine README.** `forum`,
  `program-proposals`, `qr-checkin` sind absichtlich **nicht** als
  Attrappen-Plug-ins registriert (E21): `CURATED_PLUGINS` nennt heute genau
  eines.
- **Der Client-Plug-in-Manager lädt, wartet und meldet.**
  `PluginLoaderService` holt jedes Bundle, wartet bis zu 10 s auf die
  Elementdefinition und protokolliert `loading | ready | failed`; die
  Modulverwaltung zeigt das an. `PluginSlot` montiert die Elemente imperativ,
  setzt `id="plugin-<key>"` (`pluginElementId`) und weist die Werte aus
  `context` als DOM-Eigenschaften zu. Beide Clients haben den
  `navigation`-Einhängepunkt, der Nutzer-Client zusätzlich `event-detail` auf
  der Event-Landingpage; die Kacheln dort sind Sprungmarken (F68).
- **Was der Slot heute nicht durchreicht:** Sprache und Worte. Das
  Raumplanungs-Element trägt seinen Titel als **englischen Text im Template** —
  ein Verstoß gegen E22, der seit Phase 0 im Repository steht, weil bisher
  niemand das Element gelesen hat.
- **`PluginClientContribution.icon` liest niemand.** `meeting_room` steht im
  Deskriptor, kein Client zeichnet ein Icon, und einen Satz gibt es nicht — die
  Schriften dagegen sind seit AP 1 der Phase 2 selbst gehostet
  (`libs/shared-theming/assets/fonts`, Lizenztexte daneben), und das ist die
  Vorlage.
- **Am Veranstalter-Dashboard fehlt der Einhängepunkt** (F47). Die Kacheln für
  Programmvorschläge und Forumsbeiträge stehen in den Mockups; Phase 1 hat sie
  **weggelassen** statt eine harte Null zu zeigen, und AP 10 der Phase 3 hat den
  Einhängepunkt bewusst nicht gezogen, als er die Nachrichten-Kachel als
  **Kern**kachel hinzufügte — ein Einhängepunkt, den niemand füllt, ist eine
  Fähigkeit, die nur so aussieht. Diese Phase füllt ihn.
- **Der Modulschalter kennt Voraussetzungen — aber nur für Kernmodule** (E42,
  F128). `CoreModuleDescriptor.requires`, `ModuleSummary.requires`, 409 in beide
  Richtungen **vor** dem Schreiben. Für Plug-ins ist das Feld nicht vorgesehen;
  die Begründung („ein Plug-in erreicht Kerndaten über den Vertrag, und der ist
  immer da") trägt für **Daten** und nicht für **Menschen**.
- **Drei Präfixe, drei Zugangsstufen** (E33, E16): `/api/user` anonym,
  `/api/participant` angemeldet, `/api/admin` Veranstalter — der Guard hängt am
  **deklarierten** Pfad und überschätzt (F69). Für ein Plug-in heißt das: seine
  Zugangsstufe steht in seinem Pfad, und mehr braucht es nicht.
- **Die Selbstbedienung hat zwei Ansprüche und eine Regelstrecke** (F148,
  E11): das signierte Token aus der Mail oder eine Sitzung. Der Nutzer-Client
  hat dafür `pages/my-registration` und `pages/my-registrations`; die
  Empfangsbestätigung verlinkt die Seite (`mail.receipt.selfService`).
- **Der Katalog trägt 956 Schlüssel**, davon zwei für Plug-ins
  (`plugins.roomPlanning.title`, `plugins.roomPlanning.label`). Englisch ist die
  Schlüsselliste (E23), Deutsch muss vollständig bleiben (`catalogues.spec.ts`).
- **Die E2E-Suiten teilen einen Server und damit dessen Drosselbudgets** (E4).
  Der letzte Lauf der Phase 3 war deshalb rot: zwei Suiten hatten sich dasselbe
  Budget geteilt, ohne es zu addieren. Wer in dieser Phase eine Suite dazu legt,
  rechnet vorher (`docs/rules/e2e-tests.md`).
- **Neun Prüfskripte laufen gegen eine laufende Instanz**, darunter
  `verify-plugin-toggle.mjs`, das heute **ein** Plug-in an- und ausschaltet und
  prüft, dass `/api/config` und die API sich einig sind.

---

## Entscheidungen, die diese Phase festlegt

**E46 — Fünf Fachlichkeiten, ein Vertragsschritt.** `PLUGIN_API_VERSION` geht
**einmal** auf 1.2.0, und jede Erweiterung wird von einem Paket **dieser** Phase
gefüllt. Fünf Minor-Schritte für fünf Plug-ins wären fünfmal dieselbe
Entscheidung mit fünf Kompatibilitätsfällen; eine Erweiterung, die am Ende der
Phase leer bliebe, wäre eine Fähigkeit, die nur so aussieht (F47). Deshalb steht
unten eine Tabelle, in der neben jeder Erweiterung das Paket steht, das sie
benutzt — und wer eine Erweiterung hinzufügt, ohne die Spalte füllen zu können,
baut sie nicht.

**E47 — Ein Plug-in darf eine Voraussetzung haben.** `ServerPlugin.requires`,
mit derselben Mechanik wie bei den Kernmodulen (E42, F128): Einschalten ohne die
Voraussetzung ist ein **409 mit dem fehlenden Schlüssel**, Ausschalten der
Voraussetzung unter einem laufenden Abhängigen ein **409 mit den Abhängigen**,
beides **vor** dem Schreiben. Drei der fünf Plug-ins brauchen `profiles`:
Programmvorschläge, Forum und individueller Programmplan schreiben einem
**Menschen** etwas zu, und Konten entstehen nur mit `profiles`. F128 hat Plug-ins
ausgenommen, weil ein Plug-in Kerndaten über den Vertrag erreicht und der immer
da ist — das gilt für Programmpunkte und Anmeldungen, nicht für Autoren. Die
Raumplanung und das Check-In haben deshalb **keine**: ein Raum gehört einem
Event, und ein Einlass liest eine Anmeldung.

**E48 — Der Vertrag reicht Sprache und Worte durch, nie Text.** Der
Einhängepunkt setzt an jedem montierten Element zwei weitere Eigenschaften:
`locale` und `strings` — die Schlüssel unter `plugins.<key>.` als Karte,
aufgelöst gegen den Katalog, den der Server ausliefert (E22; der Katalog ist
flach, F70, also ist es eine Auswahl nach Präfix und kein Baum) — und weist sie
bei einem Sprachwechsel neu zu. Damit sind die Worte eines Plug-ins von der
Organisation pflegbar wie jeder andere Satz der Anwendung (Sprachverwaltung,
Export, Import), **ohne** dass ein Bundle Transloco mitbringt oder den Katalog
selbst holt. Ein Plug-in liefert seine Schlüssel in `en.json` und `de.json` wie
jeder neue Bildschirm (E23, F70). Die Alternative — jedes Bundle holt
`/api/i18n/:locale` selbst — wäre eine zweite Ladekette, ein zweiter Cache und
fünf Stellen, an denen ein Sprachwechsel hängen bleibt.

**E49 — Icons kommen aus einem geschlossenen Satz im Repository.** Kein CDN
(NFR 9), keine Ikonenschrift, kein Upload: die Pfaddaten der Glyphen, die
Deskriptoren nennen dürfen, liegen als TypeScript in `shared-theming`, gezeichnet
von **einem** Bauteil, Lizenztext neben den Schriftlizenzen (Material Symbols,
Apache-2.0). Die erlaubten Namen sind ein Katalog in `shared-models` — dieselbe
Linie wie `UPLOAD_TYPES` (F38) und die Schriftfamilien (E18): **kein Eintrag ohne
seine Datei.** Ein Deskriptor, der einen unbekannten Namen nennt, bekommt
**kein** Icon, und die Modulverwaltung sagt es; sie ist der Ort, an dem
Plug-in-Fehler schon heute stehen. Eine Ikonenschrift wäre eine zweite
Schriftmaschinerie mit Ligaturen und einem Ladezustand, ein `<use>` auf eine
externe Sprite-Datei eine Anfrage mit einer Vererbungsfrage — die Pfaddaten
kosten wenige Kilobyte im Bundle und `currentColor` tut, was es soll.

**E50 — Was ein Raumplan tut, ist zeigen, nicht verweigern.** Mehr Anmeldungen
als Stühle und zwei Sessions zur gleichen Zeit im selben Raum sind **Warnungen**,
beim Lesen gerechnet, an Raum und Session sichtbar — abgelehnt wird nichts. Die
Vorlage ist F41: Überschneidungen im Programm werden angezeigt, weil zwei
Sessions zur gleichen Zeit ein zweigleisiger Kongress sind. Ein Werkzeug, das
einen Raum verweigert, wird umgangen (zweiter Raum „Saal A (2)"), und dann steht
die Wahrheit nicht mehr drin. Was ein Veranstalter **stattdessen** wollen könnte
— eine harte Grenze —, bleibt die Frage an den Pilotpartner, die `todo.md` dafür
aufgehoben hat.

**E51 — Eine Freigabe ist eine Entscheidung, kein Vorgang.** Eine Spalte mit
`pending | approved | rejected`, eine Route je Entscheidung
(`POST …/approval`, `POST …/rejection`), kein Kommentarfaden an der
Entscheidung, kein zweiter Prüfer, keine Benachrichtigungskette. Die Umfrage hat
im Freitext ausdrücklich verlangt, dass der Moderationsaufwand minimal bleibt;
FR 3.14 verlangt, dass der **Status** für den Menschen sichtbar ist, nicht dass
er verhandelbar wird. Ein abgelehnter Beitrag bleibt stehen (E14) und ist genau
zwei Parteien sichtbar: seinem Autor und der Organisation.

**E52 — Ein freigegebener Vorschlag wird kein Programmpunkt.** Ein Plug-in
besitzt seine Tabellen und fasst keine Kerntabelle an (F21) — die Freigabe
**veröffentlicht** den Vorschlag, die Session daraus anzulegen bleibt die
Kernhandlung im Programm-Editor. Die Alternative wäre ein Schreib-Port in
`program_item`: die erste Fähigkeit, mit der ein Plug-in Kerndaten **ändert**,
eingezogen für ein Plug-in, das ein Veranstalter abschalten kann — und dann
stünden Programmpunkte in der Datenbank, deren Herkunft abgeschaltet ist. Was
bleibt, ist Übernehmen per Hand; der Vorschlag steht mit Titel und Beschreibung
daneben.

**E53 — Der Check-In-Code ist ein eigener Code, nie das
Selbstbedienungs-Token.** Das signierte Token aus der Mail kann eine Anmeldung
**stornieren** (F44, F148); ein QR-Code wird abfotografiert, an einer Tür
herumgezeigt und auf Bildschirmen gespiegelt. Also erzeugt das Plug-in einen
eigenen, undurchsichtigen Code in **seiner** Tabelle, je Anmeldung einen, und
dieser Code beweist nichts als „diese Anmeldung existiert". Gespeichert wird er,
und das ist kein Widerspruch zu F23: dort geht es um den Nachweis einer
**Einwilligung**, hier um eine Eintrittskarte.

**E54 — Der Ticket-Code reist als Seite, nicht als Anhang.** Es gibt keine
zehnte Mail und keine Anhangsmaschinerie: die Empfangsbestätigung verlinkt die
Selbstbedienungsseite längst (E11), und die bekommt den Einhängepunkt
`my-registration`. Dort rendert das Plug-in den QR-Code im Browser aus dem Code,
den es ausgibt. Drei Gründe, in dieser Reihenfolge: eine **Kernmail** darf keinen
Plug-in-Inhalt tragen (sonst weiß der Kern von einem Plug-in), ein Bild im
Anhang oder als `data:`-URI wird von Postfächern gefiltert und lässt sich nach
einem Verlust nicht erneuern, und der Mail-Port dieser Anwendung nimmt heute
keine Anhänge — ihn dafür zu erweitern hieße, die eine Sache zu bauen, die eine
Mail unzustellbar macht. FR 3.16 sagt „QR-Code per Mail"; die Mail trägt den Weg
dorthin, und die **Abweichung wird protokolliert** (F198).

**E55 — Der individuelle Programmplan ist eine Auswahl, keine Anmeldung.** Eine
Session in meinen Plan zu legen bucht **keinen** Platz; Plätze bucht FR 3.10 im
Kern, und eine Session mit Anmeldung sagt das in der Timeline, wo der Platz
gebucht wird. Sonst gäbe es zwei Listen, die beide „meine Sessions" heißen, und
die, die nichts reserviert, würde für die gelesen, die es tut. Umgekehrt gilt:
der Plan zeigt an, wo ich einen Platz habe — lesen darf er das, weil die
Anmeldezahlen ohnehin über den Vertrag kommen.

**E56 — Ein Plug-in liest übersetzt, wenn ein Teilnehmender es liest.**
`PluginProgramReads` bekommt eine Sprache und eine zweite Methode: bisher gab der
Port fünf **unübersetzte** Felder je Programmpunkt heraus, was für den Raumplan
richtig ist (der Veranstalter arbeitet in der Sprache seiner Instanz) und für den
individuellen Programmplan falsch wäre (der Mensch liest seinen Plan). Also
`listForEvent(eventId, locale)` mit Titel und Zeiten, und `locale` optional an
`findItem` — eine **Erweiterung**, kein zweiter Port, wie `todo.md` es
vorgezeichnet hat. Ein Plug-in gegen 1.1.0 fragt einfach nicht.

**E57 — Ein Plug-in bekommt seine Zugangsstufe aus dem Pfad.**
`admin/plugins/<key>/…`, `participant/plugins/<key>/…`, `user/plugins/<key>/…` —
und dazu an **jedem** Plug-in-Controller `@PluginController(<key>)` plus
`PluginEnabledGuard`. Ein Plug-in erfindet keine Authentifizierung, deklariert
keinen Guard für Sitzungen und bekommt keinen Weg, `AllowAnonymous` zu setzen:
E16 hat den Adminschutz an den Pfad gehängt, weil ein vergessenes `@UseGuards` in
einem Plug-in ein offener Endpunkt wäre, und F69 lässt `isAdminPath`
absichtlich **überschätzen**. Ein Vertragstest läuft über alle montierten
Plug-in-Controller und hält beides fest.

**E58 — Beiträge sind Interaktionen und stehen hinter dem Login.** Vorschläge
und Forumsbeiträge werden unter `/api/participant/…` gelesen und geschrieben,
nicht unter `/api/user/…`. Die Produktregel ist älter als diese Phase: Startseite
und Landingpage sind ohne Login erreichbar, **Teilnehmerinfos und Interaktionen
nur nach Login** — und ein Beitrag trägt den Namen eines Menschen, in einer
Anwendung, die für Organisationen mit Aktivistendaten gebaut ist. Das Element auf
der Event-Seite wird trotzdem für alle montiert und zeigt ohne Sitzung einen
Hinweis, sich anzumelden: eine Kachel, die nur Angemeldeten erscheint, wäre eine
Funktion, von der niemand erfährt. Der **Raumplan** ist die Gegenprobe und
bleibt öffentlich (FR 3.6): ein Raumname ist keine Person.

**E59 — Die Kachel eines Plug-ins springt, sie zählt nicht.** Am
Veranstalter-Dashboard bekommt jedes montierte Plug-in eine Kachel im
vorhandenen Raster — Beschriftung aus `labelKey`, Icon aus `icon` — und die
Kachel ist eine **Sprungmarke** auf den Abschnitt, den das Plug-in weiter unten
selbst rendert; die **Zahl** steht in diesem Abschnitt, gezeichnet vom Plug-in.
Eine Zahl auf der Kachel müsste der **Host** kennen, also müsste er ein Plug-in
fragen — die erste Fähigkeit in umgekehrter Richtung, mit einem
Auffrisch-Problem, für eine Zahl, die zwei Zentimeter weiter unten steht.
Dieselbe Bauweise wie beim Teilnehmenden (F68): das Plug-in rendert **in** der
Seite, auf der es hängt, und die Kachel zeigt dorthin.

---

## Der Plug-in-Vertrag: 1.1.0 → 1.2.0

### Die fünf Schlüssel

Ein Plug-in-Schlüssel ist auch sein `module_config.module_key` und darf sich nach
der Freigabe **nie** ändern (Deskriptor-Regel seit Phase 0). Also stehen sie
hier, einmal, mit allem, was an ihnen hängt:

| Plug-in                    | Schlüssel           | Katalog                      | Voraussetzung | Einhängepunkte                       |
| -------------------------- | ------------------- | ---------------------------- | ------------- | ------------------------------------ |
| Programmvorschläge         | `program-proposals` | `plugins.programProposals.*` | `profiles`    | `event-detail`, `event-dashboard`    |
| Diskussionsforum           | `forum`             | `plugins.forum.*`            | `profiles`    | `event-detail`, `event-dashboard`    |
| Raumplanung                | `room-planning`     | `plugins.roomPlanning.*`     | —             | `event-detail`, `event-dashboard`    |
| QR-Check-In                | `qr-checkin`        | `plugins.qrCheckin.*`        | —             | `my-registration`, `event-dashboard` |
| Individueller Programmplan | `personal-program`  | `plugins.personalProgram.*`  | `profiles`    | `event-detail`                       |

Drei Verzeichnisse gibt es schon (`forum`, `program-proposals`, `qr-checkin`,
je mit einer README), `room-planning` steht, `personal-program` kommt in AP 9
dazu. `CURATED_PLUGINS` wächst damit von einem auf **fünf** Einträge — und diese
Liste ist auch die Reihenfolge, in der die Kacheln am Dashboard und die
Abschnitte darunter erscheinen: registriert, nicht entdeckt, also auch sortiert
und nicht zufällig.

### Was 1.2.0 hinzufügt

Alles in dieser Tabelle ist eine **Erweiterung** — ein Plug-in gegen 1.1.0
bleibt montiert und fragt nicht. Die rechte Spalte ist die Bedingung aus E46:
ohne Füller keine Erweiterung.

| Erweiterung                                                                   | Warum                                                     | Gefüllt in |
| ----------------------------------------------------------------------------- | --------------------------------------------------------- | ---------- |
| Einhängepunkt `event-dashboard` (Veranstalter-Client)                         | F47: die Kacheln für Vorschläge und Forum aus den Mockups | AP 3, AP 5 |
| Einhängepunkt `my-registration` (Nutzer-Client)                               | E54: die Ticketseite hinter dem Mail-Link                 | AP 8       |
| Slot-Kontext `locale` und `strings`                                           | E48: Worte aus dem Katalog, von der Organisation pflegbar | AP 1       |
| `PluginClientContribution.icon` wird gelesen, Namen aus geschlossenem Satz    | E49: das Feld liest endlich jemand                        | AP 1       |
| `ServerPlugin.requires`                                                       | E47: drei Plug-ins brauchen Konten                        | AP 2       |
| Port `PluginParticipantReads` — wer fragt, und wie ein Autor heißt            | E58: ein Beitrag gehört einem Menschen                    | AP 2, AP 4 |
| Port `PluginRegistrationReads` — Anspruch auflösen, bestätigte Anmeldungen    | E53/E54: Ticket und Einlassliste                          | AP 7       |
| `PluginProgramReads.listForEvent(eventId, locale)` und `locale` an `findItem` | E56: ein Teilnehmender liest seinen Plan                  | AP 9       |

Was **nicht** dazukommt, und warum es genannt wird, damit es nicht nachträglich
hineinwächst:

- **Kein Schreib-Port in Kerntabellen** (E52).
- **Keine Fähigkeit in umgekehrter Richtung** — der Host fragt kein Plug-in
  (E59). Der Kern erfährt von einem Plug-in nur, was im Deskriptor steht.
- **Keine Mail für Plug-ins.** Die Sprache, der Rückfall je Mail (E24) und die
  Empfängerauflösung (F55, F125) sind eine Maschinerie, die ein Plug-in nicht zur
  Hälfte benutzen kann; wer eine Plug-in-Mail will, plant ein Paket dafür.
- **Kein eigener Einhängepunkt je Bildschirm.** Zwei kommen dazu, weil zwei
  Bildschirme in dieser Phase Plug-in-Inhalt zeigen. Der Satz bleibt geschlossen
  (`PluginMountPoint`), und ihn zu erweitern bleibt ein Vertragsschritt.

---

## Datenbankschema der Phase

Vier Migrationen, je eine im Verzeichnis ihres Plug-ins, explizites SQL, `down`
mitgeschrieben. **Jede Tabelle heißt `plugin_<key>_<name>`**, wie die zwei der
Raumplanung, und jede Migration ist **nach** der Kernmigration gestempelt, auf
die sie zeigt — beide Ströme werden gemeinsam nach Zeitstempel geordnet. Eine
Kerntabelle wird **nicht** angefasst (F21).

```
plugin_program_proposals_proposal
  (id uuid pk, event_id → event ON DELETE CASCADE,
   author_id → user_profile ON DELETE CASCADE,
   title varchar(200) NOT NULL, description text NOT NULL,
   status varchar(16) NOT NULL DEFAULT 'pending',
   decided_at timestamptz?, decided_by → admin_user ON DELETE SET NULL,
   created_at, updated_at)
   CHECK status IN ('pending','approved','rejected')      ← E51: drei Zustände,
                                                            kein Vorgang
   CHECK (status = 'pending') = (decided_at IS NULL)      ← eine Entscheidung hat
                                                            einen Zeitpunkt
   index (event_id, status, created_at desc, id)          ← die Moderationsliste
   index (author_id, created_at desc)                     ← „meine Vorschläge"

plugin_forum_thread
  (id uuid pk, event_id → event ON DELETE CASCADE,
   title varchar(200) NOT NULL, created_by → user_profile ON DELETE CASCADE,
   created_at, updated_at, last_post_at timestamptz NOT NULL)
   index (event_id, last_post_at desc, id)
   ← kein Status: ein Thread ist sichtbar, wenn ein Beitrag freigegeben ist
     (F195). Eine zweite Statusspalte wäre eine zweite Moderationsfläche für
     dieselbe Entscheidung.

plugin_forum_post
  (id uuid pk, thread_id → plugin_forum_thread ON DELETE CASCADE,
   author_id → user_profile ON DELETE CASCADE, body text NOT NULL,
   status varchar(16) NOT NULL DEFAULT 'pending',
   decided_at timestamptz?, decided_by → admin_user ON DELETE SET NULL,
   created_at)
   CHECK status IN ('pending','approved','rejected')
   CHECK btrim(body) <> ''                                ← wie CHK_message_body
   index (thread_id, created_at, id)
   index (status, created_at) WHERE status = 'pending'     ← die Moderationsliste
                                                            fragt nach einem
                                                            Zustand, nicht nach
                                                            allen

plugin_qr_checkin_ticket
  (registration_id → registration ON DELETE CASCADE PRIMARY KEY,
   code varchar(64) NOT NULL UNIQUE, issued_at timestamptz NOT NULL,
   checked_in_at timestamptz?, checked_in_by → admin_user ON DELETE SET NULL)
   ← eine Zeile je Anmeldung, und `checked_in_at` NULL heißt „noch nicht da"
     (dieselbe Form wie `confirmed_at`, E32). Zwei Tabellen für Code und
     Anwesenheit wären zwei Wahrheiten über einen Menschen an einer Tür.

plugin_personal_program_entry
  (user_id → user_profile ON DELETE CASCADE,
   program_item_id → program_item ON DELETE CASCADE,
   added_at timestamptz NOT NULL,
   PRIMARY KEY (user_id, program_item_id))
   ← ein Platz existiert oder nicht, wie `program_item_signup` — und genau
     deshalb ist es keine Anmeldung (E55): die Tabelle hat keine Kapazität.
```

Die Raumplanung braucht **keine** Migration: Warnungen werden gerechnet, nicht
gespeichert (E50), und die Kapazität steht längst auf
`plugin_room_planning_room`.

---

## API-Oberfläche

Jeder Pfad trägt seine Zugangsstufe (E57) und an seinem Controller
`@PluginController(<key>)` + `PluginEnabledGuard`; abgeschaltet ist jede Zeile
ein 404.

| Methode + Pfad                                                           | Zweck                                                        | AP  |
| ------------------------------------------------------------------------ | ------------------------------------------------------------ | --- |
| `GET /api/participant/plugins/program-proposals/events/:id/proposals`    | FR 3.13: freigegebene plus eigene, mit Status (E51, E58)     | 2   |
| `POST /api/participant/plugins/program-proposals/events/:id/proposals`   | FR 3.13: einreichen, entsteht als `pending`                  | 2   |
| `GET /api/admin/plugins/program-proposals/events/:id/proposals?status=`  | FR 3.14: die Moderationsliste, serverseitig paginiert        | 2   |
| `POST /api/admin/plugins/program-proposals/proposals/:id/approval`       | FR 3.14: freigeben — eine Entscheidung, eine Route (E51)     | 2   |
| `POST /api/admin/plugins/program-proposals/proposals/:id/rejection`      | FR 3.14: ablehnen, die Zeile bleibt (E14)                    | 2   |
| `GET /api/admin/plugins/program-proposals/events/:id/summary`            | die Zahl für den Abschnitt am Dashboard (E59)                | 3   |
| `GET /api/participant/plugins/forum/events/:id/threads`                  | FR 4.6: Threads, nach letztem Beitrag                        | 4   |
| `POST /api/participant/plugins/forum/events/:id/threads`                 | FR 4.6: Thread mit erstem Beitrag, beides `pending`          | 4   |
| `GET /api/participant/plugins/forum/threads/:id/posts`                   | FR 4.6: freigegebene plus eigene                             | 4   |
| `POST /api/participant/plugins/forum/threads/:id/posts`                  | FR 4.6: antworten                                            | 4   |
| `GET /api/admin/plugins/forum/events/:id/posts?status=`                  | FR 4.6: Moderation, je Beitrag eine Entscheidung             | 4   |
| `POST /api/admin/plugins/forum/posts/:id/approval` · `…/rejection`       | FR 4.6: freigeben, ablehnen                                  | 4   |
| `GET /api/admin/plugins/forum/events/:id/summary`                        | die Zahl für den Abschnitt am Dashboard                      | 5   |
| `GET /api/user/plugins/room-planning/events/:id/rooms`                   | FR 3.6: der Raumplan, öffentlich (E58)                       | 6   |
| `PATCH/DELETE /api/admin/plugins/room-planning/rooms/:id`                | FR 3.11: ändern und löschen — was Phase 1 offen ließ         | 6   |
| `GET /api/admin/plugins/room-planning/events/:id/schedule`               | FR 3.11: der ganze Plan mit beiden Warnungen (E50)           | 6   |
| `GET /api/user/plugins/qr-checkin/ticket?token=`                         | FR 3.16: der Code, aufgelöst über den Anspruch (F44, E53)    | 7   |
| `GET /api/participant/plugins/qr-checkin/tickets`                        | FR 3.16: dieselbe Karte über die Sitzung (F148)              | 7   |
| `POST /api/admin/plugins/qr-checkin/checkins`                            | FR 3.16: einlesen, mit Code im Rumpf — kein GET (E57, Regel) | 7   |
| `GET /api/admin/plugins/qr-checkin/events/:id/checkins`                  | FR 3.16: die Einlassliste, paginiert, mit Zustand            | 7   |
| `GET /api/participant/plugins/personal-program/events/:id/plan?locale=`  | FR 3.17: das Programm mit „in meinem Plan" je Punkt (E56)    | 9   |
| `PUT/DELETE /api/participant/plugins/personal-program/program-items/:id` | FR 3.17: hinein, heraus — idempotent, 204 (E55)              | 9   |

`GET /api/config` wächst um **nichts Neues**: die fünf Plug-ins reisen im
vorhandenen `plugins`-Feld, ihre Voraussetzung (E47) steht wie bei den
Kernmodulen im Deskriptor und in `ModuleSummary.requires`, und die zwei neuen
Einhängepunkte sind Werte in `mountPoints`. Jeder Nutzlast-Typ liegt in
`libs/shared-models` — auch die der Plug-ins: ein Client, der ein Plug-in-Bundle
lädt, teilt mit ihm die Modelle, nicht die Implementierung.

---

## Arbeitspakete

Reihenfolge = Abhängigkeits- **und** Prioritätsreihenfolge, wie sie das
Plan-Dokument für diese Phase vorgibt: Programmvorschläge, Forum, Raumplanung,
QR-Check-In — und danach der individuelle Programmplan, weil FR 3.17 wie FR 3.16
**P3** ist. AP 1 steht davor, weil vier Pakete auf ihm stehen.

Jedes Paket endet mit lauffähiger, prüfbarer Software, eigenen Unit-Tests,
mindestens einem E2E- oder API-Vertragstest und einem Conventional Commit.

### AP 1 — Icons, und der Vertrag lernt Sprache (E48, E49; zwei `todo.md`-Einträge)

Das Fundament der Phase, und das einzige Paket ohne Fachlichkeit. Client:
`libs/shared-theming` bekommt den Icon-Satz als Pfaddaten, ein Bauteil, das ihn
zeichnet, und den Lizenztext neben den Schriftlizenzen; `shared-models` bekommt
den geschlossenen Namenskatalog. Das Bauteil liegt dort, weil in
`shared-theming` schon die Marke wohnt (Farben, Schriften, `--trefaro-*`) — es
ist **keine** Antwort auf die offene Frage nach einer geteilten
Oberflächenbibliothek (F145), und wer sie stellen will, zählt weiter Aufrufer. Beide Clients lesen `icon` — Navigationseintrag,
Event-Kachel, und ab AP 3 die Dashboard-Kachel. `PluginSlot` reicht `locale` und
`strings` durch und weist sie beim Sprachwechsel neu zu (F72 gilt auch hier: der
Slot liest das Sprachsignal, sonst bleiben die Worte stehen).
`PLUGIN_API_VERSION` geht auf **1.2.0**, mit einem Fall je Erweiterung im
Kompatibilitätstest. Das Raumplanungs-Element verliert seinen englischen
Template-Text und nimmt Titel und Beschriftung aus `strings` — der E22-Verstoß,
der seit Phase 0 im Repository steht. Migration: keine.

**Fertig, wenn** eine Kachel und ein Navigationseintrag das Icon zeigen, das ihr
Deskriptor nennt, aus Dateien dieser Instanz; ein Deskriptor mit unbekanntem
Namen **kein** Icon bekommt und die Modulverwaltung das sagt; das
Raumplanungs-Element auf einer deutschen Instanz deutsch überschreibt und nach
einem Sprachwechsel **ohne Neuladen** englisch; ein Plug-in, das `1.1.0`
deklariert, weiter montiert wird; und der Katalog Englisch **und** Deutsch für
jeden neuen Schlüssel trägt.

### AP 2 — Programmvorschläge: Server (FR 3.13, 3.14)

Das erste Plug-in, das gegen den erweiterten Vertrag gebaut wird, und der
Beweis, dass die Referenzstruktur trägt:
`apps/server/src/plugins/program-proposals/` mit `api/`, `business/` (Service +
Ports), `data-access/` (Entities, Repositories, Migration), einem `ServerPlugin`
und `enabledByDefault: false`. Neu am Host: `ServerPlugin.requires` samt der
409-Mechanik in der Modulverwaltung (E47) und `PluginParticipantReads` im
`PluginHostModule` — wer fragt, und wie ein Autor heißt (Name und Avatar-Adresse,
keine E-Mail: F55). Dazu der Vertragstest über alle Plug-in-Controller aus E57.
Migration: **eine** (die des Plug-ins).

**Fertig, wenn** ein Vorschlag als `pending` entsteht und für **niemanden außer
Autor und Organisation** sichtbar ist; die Freigabe ihn in die Liste aller
Teilnehmenden bringt; eine Ablehnung die Zeile behält und den Status zeigt;
Einschalten ohne `profiles` ein 409 mit `profiles` ist und Ausschalten von
`profiles` ein 409, das das Plug-in nennt; jede Route des Plug-ins bei
abgeschaltetem Schalter 404 gibt und `/api/config` es nicht nennt; und der
Vertragstest für jeden montierten Plug-in-Controller Präfix und Guard belegt.

### AP 3 — Programmvorschläge in beiden Clients (FR 3.13, 3.14, F47) → **Meilenstein M9**

Nutzer-Client: das Plug-in-Element am Einhängepunkt `event-detail` — einreichen,
eigene Vorschläge mit Status, freigegebene Vorschläge der anderen; ohne Sitzung
der Hinweis, sich anzumelden (E58). Veranstalter-Client: der **neue**
Einhängepunkt `event-dashboard` — eine Kachel im vorhandenen Raster als
Sprungmarke (E59, mit ihrem Icon aus AP 1) und darunter der Abschnitt, den das
Plug-in rendert: die offenen Vorschläge, je einer mit zwei Knöpfen. Alle Texte in
Englisch und Deutsch, im Namensraum `plugins.programProposals.*`. Migration:
keine.

**Fertig, wenn** ein Teilnehmender im Browser einen Vorschlag einreicht, ihn mit
Status wiederfindet, der Veranstalter ihn auf seinem Dashboard sieht, freigibt,
und der Vorschlag danach bei einem **zweiten** Teilnehmenden erscheint — in
Chromium, Firefox und WebKit, mobil-zuerst auf der Teilnehmerseite; und wenn das
Abschalten des Plug-ins Kachel **und** Abschnitt verschwinden lässt, ohne dass
eine Zeile verloren geht. **M9: das erste kuratierte Plug-in steht vollständig,
und der Vertrag 1.2.0 hat einen zweiten Implementierer.**

### AP 4 — Diskussionsforum: Server (FR 4.6)

Dasselbe Muster, zweite Fachlichkeit — und die Probe darauf, dass AP 2 nichts
gebaut hat, das nur für Vorschläge passt: Threads und Beiträge, Freigabe **je
Beitrag** (E51), ein Thread ohne Statusspalte, der sichtbar ist, sobald ein
Beitrag freigegeben ist (F195). Listen serverseitig gefiltert, sortiert und
paginiert, Id als letztes Sortierkriterium — **kein** Cursor: ein Forum ist keine
Unterhaltung, die am Ende wächst, während man sie liest (F154 gilt für den Chat
und bleibt dort). `requires: ['profiles']`. Migration: **eine**.

**Fertig, wenn** ein Thread erst mit einem freigegebenen Beitrag in der Liste
steht; ein abgelehnter Beitrag nur seinem Autor und der Organisation sichtbar
ist; ein Beitrag aus Leerzeichen ein 400 ist; die Moderationsliste eines Events
nur dessen Beiträge zeigt; und ein zweites Plug-in denselben Host-Port benutzt,
ohne dass er dafür geändert wurde.

### AP 5 — Forum in beiden Clients (FR 4.6)

Nutzer-Client: Threadliste, Threadansicht, Schreiben — am
`event-detail`-Einhängepunkt, mit der Anmeldeaufforderung ohne Sitzung.
Veranstalter-Client: die **zweite** Kachel am Dashboard und der Abschnitt mit den
offenen Beiträgen, je einer im Kontext seines Threads. Namensraum
`plugins.forum.*`, Englisch und Deutsch. Migration: keine.

**Fertig, wenn** zwei Teilnehmende im Browser einen Thread führen, dessen
Beiträge einzeln freigegeben werden; die zwei Plug-in-Kacheln am Dashboard
nebeneinander stehen und jede auf ihren eigenen Abschnitt springt; und der
Einhängepunkt mit **zwei** Plug-ins dasselbe tut wie mit einem.

### AP 6 — Raumplanung wird echt (FR 3.11, 3.6, F14) → **Meilenstein M10**

Das Paket, das die Referenzimplementierung fertig macht. Server: Ändern und
Löschen eines Raums, ein Plan über das ganze Event, und die zwei Warnungen aus
E50 — mehr Anmeldungen als Stühle (Anmeldezahlen über den Port, F45) und zwei
Sessions zur gleichen Zeit im selben Raum —, beim Lesen gerechnet und nirgends
gespeichert. Dazu die **öffentliche** Leseroute für den Raumplan (E58, FR 3.6).
Veranstalter-Client: der Raum-Editor am `event-dashboard`-Einhängepunkt, den AP 3
gezogen hat — anlegen, ändern, löschen, Sessions zuordnen und lösen, Warnungen am
Raum und an der Session; der Deskriptor der Raumplanung bekommt dafür den zweiten
Einhängepunkt. Nutzer-Client: der
Raumplan als Abschnitt am `event-detail`-Einhängepunkt — der Platz, an dem seit
Phase 0 die Demo aus dem Spike steht. Migration: keine.

**Fertig, wenn** ein Raum mit Kapazität angelegt, umbenannt und gelöscht werden
kann (und das Löschen seine Zuordnungen mitnimmt, nicht die Sessions); der Plan
eine Überbuchung **und** eine Doppelbelegung anzeigt, ohne eine Zuordnung
abzulehnen; ein Teilnehmender den Raumplan **ohne Login** sieht; und das Plug-in
weiterhin keine Kerntabelle abfragt — geprüft daran, dass in seinem Teilbaum
kein Kern-Entity und kein Repository des Kerns importiert wird.

### AP 7 — QR-Check-In: Server (FR 3.16)

Server: `PluginRegistrationReads` im `PluginHostModule` — einen
Selbstbedienungsanspruch auflösen (Token **oder** Sitzung, dieselbe Regelstrecke
wie F148) und die bestätigten Anmeldungen eines Events seitenweise lesen, mit
Namen und ohne Adresse. Das Plug-in bekommt seine Tabelle, gibt je Anmeldung
**einen** eigenen Code aus (E53, erzeugt beim ersten Lesen), liest ihn beim
Einlass ein und schreibt `checked_in_at`; ein zweiter Scan ist **kein** Fehler,
sondern die Antwort „schon da, seit …". Dazu die Einlassliste mit Zustand.
Migration: **eine**.

**Fertig, wenn** ein Token aus einer Empfangsbestätigung einen Code liefert und
ein fremdes Token denselben 404 wie eine unbekannte Id (F148); derselbe Code
zweimal eingelesen zweimal 200 mit demselben Zeitpunkt ergibt; ein unbekannter
Code ein 404 ist, das nichts über Anmeldungen sagt; eine **unbestätigte**
Anmeldung keinen Code bekommt; und die Einlassliste eines Events die
bestätigten Anmeldungen mit ihrem Zustand zeigt, ohne dass das Plug-in
`registration` abfragt.

### AP 8 — QR-Check-In in beiden Clients (FR 3.16) → **Meilenstein M11**

Nutzer-Client: der **neue** Einhängepunkt `my-registration` auf der
Selbstbedienungsseite, und das Plug-in rendert dort den QR-Code im Browser aus
seinem Code — als SVG, mit `qrcode` (MIT, im Bundle, nicht aus einem CDN), und
**schwarz auf weiß**: das eine Bauteil dieser Anwendung, das der Marke nicht
folgt, weil ein eingefärbter Code am Einlass nicht gelesen wird.
Veranstalter-Client: die Einlassseite am Event — Kamera, wo der Browser eine
hergibt, **und** ein Eingabefeld für den Code sowie ein Knopf je Zeile der
Einlassliste (F199): eine Tür darf nicht von einem Kameratreiber abhängen, und
genau diese Hälfte kann eine Testsuite prüfen. Die Entscheidung über die
Dekodier-Bibliothek fällt hier, gegen zwei Kriterien: Lizenz verträglich mit
AGPL-3.0-or-later, und im Bundle statt aus dem Netz. Migration: keine.

**Fertig, wenn** ein Mensch den Link aus seiner Empfangsbestätigung öffnet und
einen scanbaren Code sieht; ein Veranstalter denselben Code eintippt und die
Anmeldung als anwesend markiert; die Liste den Zustand danach zeigt; ein
zweiter Einlass „schon da" sagt; und **eine** Zeile der Gerätematrix in
`todo.md` steht, weil eine Kamera keine Suite dieses Repositories prüfen kann.
**M11: eine Tür funktioniert — mit Kamera und ohne.**

### AP 9 — Individueller Programmplan (FR 3.17, P3)

Das fünfte Plug-in, und das erste, das Kerninhalte **übersetzt** liest:
`PluginProgramReads` bekommt `listForEvent(eventId, locale)` und `locale` an
`findItem` (E56) — der eine offene `todo.md`-Eintrag, den der Port seit Phase 2
mit sich trägt. Das Plug-in besitzt die Auswahl je Mensch und Programmpunkt,
zeigt das Programm eines Events mit „in meinem Plan" je Punkt und markiert, wo
ein Platz gebucht ist, ohne einen zu buchen (E55). Nutzer-Client: der Abschnitt
am `event-detail`-Einhängepunkt, mobil-zuerst, mit einer kompakten Tagesansicht.
`requires: ['profiles']`. Migration: **eine**.

**Fertig, wenn** ein angemeldeter Teilnehmender Sessions in seinen Plan legt und
herausnimmt (idempotent, 204), der Plan die Titel in **seiner** Sprache zeigt
und ein Raumplan-Aufruf weiterhin die Originale bekommt; das Hinzufügen **keine**
Zeile in `program_item_signup` erzeugt; und ein Plug-in gegen 1.1.0 den Port
unverändert benutzen kann.

### AP 10 — Abschluss der Phase → **Meilenstein M12**

Kein neuer Code außer dem, was der Abschluss findet:

- **E46–E59 gegen die Umsetzung geprüft**, Abweichungen protokolliert statt
  nachgebaut.
- **`todo.md` unter _Checkable after phase 4_ durchgearbeitet** — jeder Eintrag
  geschlossen oder mit Begründung in den Abschnitt gezogen, dem er gehört
  (Pilotpartner, Phase 5, _Decided_).
- **F186–F201 stehen im Referenzdokument.**
- **Der Fünf-Container-Stack läuft aus leerem Volume**, mit den vier neuen
  Migrationen, und die Prüfskripte laufen gegen genau diese Instanz —
  `verify-plugin-toggle.mjs` erweitert auf **fünf** Plug-ins, samt der
  Voraussetzung: Einschalten ohne `profiles` ist ein 409.
- **Katalogzahl, README, `CLAUDE.md`, `docs/rules/`** nachgezogen; die Regeln
  dieser Phase gehören nach `docs/rules/` (Plug-in-Vertrag, Einhängepunkte,
  Icons), nicht in `CLAUDE.md`. Dort ändern sich **eine Zeile in der Phasenliste
  und die Zahlen darunter** — kein Absatz je Paket, das war die Diät vom
  07.09.2026 (`docs/rules/README.md`, _Pflege_).
- **Dieses Dokument von Plan auf Protokoll korrigiert**, mit einem phasenweiten
  _Was anders lief_.

**Fertig, wenn** die Definition of Done unten Punkt für Punkt belegt ist.

---

## Meilensteine

| Meilenstein | Nach  | Inhalt                                                                                   |
| ----------- | ----- | ---------------------------------------------------------------------------------------- |
| M9          | AP 3  | Das erste kuratierte Plug-in steht vollständig; Vertrag 1.2.0 mit zweitem Implementierer |
| M10         | AP 6  | Die drei P2-Plug-in-Anforderungen sind erfüllt: 3.13/3.14, 4.6, 3.11                     |
| M11         | AP 8  | Eine Tür funktioniert: ein Code am Einlass, mit Kamera und ohne                          |
| M12         | AP 10 | Phase 4 abgeschlossen, fünf Plug-ins zur Laufzeit schaltbar                              |

**M10 ist der Zeitpunkt, an dem der Usability-Test der Phase 5 vorbereitet
werden kann**: ab hier gibt es die Funktions-Kacheln der Mockups wirklich —
Programmplan, Raumplan, Vernetzung, Programmvorschläge, Forum. Vorschlag, keine
Zusage; wann der Pilotpartner sich das ansieht, entscheidet Marius.

## Querschnittsregeln für jedes Arbeitspaket

- **Erst der Test, dann der Code.** Unit-Tests je Service und Guard, API-Vertrag
  in `apps/server-e2e`, Oberfläche in `apps/*-e2e` (Chromium, Firefox, WebKit).
- **Ein Plug-in importiert aus `plugin-api` und aus sonst nichts im Server**, und
  es fasst **keine** Kerntabelle an (F21). Bei einem Linter-Verstoß wird ein Port
  eingezogen, nicht die Regel gelockert; ein von zwei Plug-ins gebrauchter
  Host-Port gehört in den Vertrag, nicht in ein Plug-in.
- **Jede Plug-in-Tabelle heißt `plugin_<key>_<name>`**, ihre Migration liegt im
  Plug-in und ist nach der Kernmigration gestempelt, auf die sie zeigt. **Eine
  Migration pro Arbeitspaket**, explizites SQL, `down` mitgeschrieben und einmal
  wirklich ausgeführt.
- **Der Vertrag wächst nur, wo diese Phase die Erweiterung füllt** (E46), und
  jede Erweiterung bekommt einen Fall im Kompatibilitätstest.
- **Jedes neue Plug-in ist ab Werk aus** (`enabledByDefault: false`), antwortet
  abgeschaltet 404, fehlt dann in `/api/config` — und **Abschalten löscht nie
  Daten**.
- **Kein Schalter, der nichts liest** (E21), kein Feld ohne Bedeutung, und kein
  neuer Wert, den `infra/docker-compose.yml` nicht durchreicht.
- **Jeder neue Bildschirm liefert seine Katalogschlüssel** in Englisch und
  Deutsch (E22, E23, F70, F80) — auch die eines Plug-in-Bundles, das seine Worte
  vom Host bekommt (E48). Kein Text im Template.
- **Nichts, das den Zustand ändert, ist ein GET.** Ein Code am Einlass reist im
  Rumpf.
- **Die E2E-Budgets werden addiert, bevor eine Suite dazukommt** (E4,
  `docs/rules/e2e-tests.md`). Die Drosselung wird dafür nie angefasst — ein
  Fixture wird geseedet.
- **Englisch mit Marius, Englisch im Code, Deutsch in der Dokumentation**;
  Conventional Commits.
- **Nach jedem Paket** `nx run-many -t lint test build` und die E2E-Suiten grün,
  dann committen — und wer „grün" sagt, hat den **Abschluss** des CI-Laufs
  gelesen, nicht den Rückgabewert eines Wartens.

## Risiken

| Risiko                                                                                                                                    | Gegenmaßnahme                                                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Fünf Plug-ins in einer Phase**, und zwei davon (3.16, 3.17) sind P3                                                                     | Die Reihenfolge ist die Prioritätsreihenfolge; AP 7/8 und AP 9 sind ausdrücklich streichbar, ohne dass ein anderes Paket auf ihnen steht. Was gestrichen wird, geht mit Begründung in `todo.md` |
| **Der Vertrag wächst an acht Stellen** — und eine leere Erweiterung ist eine Attrappe (F47)                                               | E46: die Tabelle oben nennt je Erweiterung das Paket, das sie füllt, und AP 10 prüft die Spalte. Was am Ende leer wäre, wird zurückgezogen statt dokumentiert                                   |
| **Eine Kamera kann keine Suite dieses Repositories prüfen** — dieselbe Klasse wie Push auf echten Geräten                                 | Die Tür funktioniert ohne Kamera (F199), und **das** ist die Hälfte, die Playwright fährt. Die Kamera bekommt eine Zeile in _On a device — waiting for Marius_, mit Gerät und Datum             |
| **Moderation ist eine neue Zugangsfläche**: zwei Plug-ins mit Schreibrouten für Teilnehmende und Entscheidungsrouten für den Veranstalter | E57 plus ein Vertragstest über **alle** montierten Plug-in-Controller (Präfix, `@PluginController`, `PluginEnabledGuard`), und die Freigabe ist eine Route, kein Feld in einem PATCH            |
| **Ein Beitrag trägt einen Namen** — und diese Anwendung ist für Organisationen mit Aktivistendaten gebaut                                 | E58: Beiträge stehen hinter dem Login, der Autor kommt über einen Host-Port ohne Adresse (F55), und der Raumplan ist die begründete Gegenprobe                                                  |
| **Der individuelle Programmplan sieht aus wie eine Anmeldung** und würde dann Plätze versprechen, die er nicht bucht                      | E55, und die Tabelle hat deshalb keine Kapazität. Der Plan markiert, wo ein Platz gebucht ist, und die Buchung bleibt in der Timeline des Kerns                                                 |
| **Ein Icon-Satz ist eine Designentscheidung über beide Clients**, und die kostet leicht mehr Zeit als das Plug-in danach                  | AP 1 nimmt genau die Glyphen, die Deskriptoren und Kacheln nennen — der Satz ist geschlossen (E49), und ein fehlender Name ist kein Fehler, sondern kein Icon                                   |
| **Die Zahl auf einer Dashboard-Kachel** ist die naheliegende Stelle, an der der Host ein Plug-in fragen würde                             | E59: die Kachel springt, die Zahl steht im Abschnitt des Plug-ins. Eine Fähigkeit in umgekehrter Richtung wird in dieser Phase nicht gebaut                                                     |
| **Vier neue Migrationen von Plug-ins** werden mit dem Kernstrom nach Zeitstempel geordnet                                                 | Jede zeigt nur auf Tabellen, die es beim Stempel schon gab; AP 10 fährt den Stack **aus leerem Volume** und zählt Tabellen und Migrationen                                                      |

## Nachträge am Referenzdokument — geplant

Wird beim jeweiligen Paket eingetragen, nicht am Ende gesammelt:

| Nr.  | Inhalt                                                                                             | AP  |
| ---- | -------------------------------------------------------------------------------------------------- | --- |
| F186 | Fünf Fachlichkeiten, ein Vertragsschritt — und keine leere Erweiterung (E46, Bezug F47)            | 1   |
| F187 | Der Vertrag reicht Sprache und Worte durch, nie Text (E48, Bezug E22, E23)                         | 1   |
| F188 | Icons kommen aus einem geschlossenen Satz im Repository (E49, Bezug E18, F38, NFR 9)               | 1   |
| F189 | Ein Plug-in bekommt seine Zugangsstufe aus dem Pfad (E57, Bezug E16, E33, F69)                     | 2   |
| F190 | Ein Plug-in darf eine Voraussetzung haben (E47, Bezug F128, E42)                                   | 2   |
| F191 | Eine Freigabe ist eine Entscheidung, kein Vorgang (E51, Bezug FR 3.14, 4.6)                        | 2   |
| F192 | Beiträge sind Interaktionen und stehen hinter dem Login (E58, Bezug E33, F13)                      | 2   |
| F193 | Die Kachel eines Plug-ins springt, sie zählt nicht (E59, Bezug F47, F68)                           | 3   |
| F194 | Ein freigegebener Vorschlag wird kein Programmpunkt (E52, Bezug F21, E12)                          | 3   |
| F195 | Ein Thread ist sichtbar, wenn ein Beitrag freigegeben ist — keine zweite Statusspalte (Bezug E51)  | 4   |
| F196 | Was ein Raumplan tut, ist zeigen, nicht verweigern (E50, Bezug F41, F14)                           | 6   |
| F197 | Der Check-In-Code ist ein eigener Code, nie das Selbstbedienungs-Token (E53, Bezug F44, F23, F148) | 7   |
| F198 | Der Ticket-Code reist als Seite, nicht als Anhang — Abweichung von FR 3.16 (E54, Bezug E11)        | 8   |
| F199 | Die Tür funktioniert ohne Kamera (Bezug NFR 4, E10)                                                | 8   |
| F200 | Ein Plug-in liest übersetzt, wenn ein Teilnehmender es liest (E56, Bezug F45, E12, F95)            | 9   |
| F201 | Der individuelle Programmplan ist eine Auswahl, keine Anmeldung (E55, Bezug FR 3.10, F42)          | 9   |

Die Nummern sind reserviert, nicht garantiert: was sich beim Bauen als dieselbe
Entscheidung entpuppt, wird zusammengelegt, und die freigewordene Nummer bleibt
unvergeben (wie F62 und F129–F131).

## Definition of Done für Phase 4

1. **Jedes Arbeitspaket hat sein Abnahmekriterium nachweislich erfüllt**;
   `nx run-many -t lint test build`, die Server-Unit-Tests, die API-Vertragstests
   und beide Browsersuiten sind grün — nacheinander gefahren, nie zusammen (die
   geteilten Drosselbudgets, E4).
2. **Fünf kuratierte Plug-ins lassen sich zur Laufzeit schalten**: an heißt, die
   API antwortet und beide Clients montieren; aus heißt 404, kein Eintrag in
   `/api/config`, keine Kachel, kein Abschnitt — **und keine verlorene Zeile**.
   Jedes benutzt nur eigene Tabellen mit dem Präfix `plugin_<key>_`.
3. **Ein Teilnehmender beteiligt sich am Programm und diskutiert**, und der
   Veranstalter moderiert beides von seinem Event-Dashboard aus — am laufenden
   Fünf-Container-Stack durchgespielt.
4. **Ein Veranstalter plant Räume**, sieht eine Überbuchung und eine
   Doppelbelegung als Warnung, und **nichts wird abgelehnt** (E50).
5. **Ein Einlass funktioniert**: der Code aus dem Postfach wird an der Tür
   gelesen — auf einem echten Gerät mit Kamera abgehakt oder mit Gerät und Datum
   als gescheitert protokolliert — **und** ohne Kamera, per Eingabe.
6. **Ein individueller Programmplan steht in der Sprache seines Menschen** und
   hat keinen Platz gebucht.
7. **`todo.md` unter _Checkable after phase 4_ ist durchgearbeitet** und
   F186–F201 stehen im Referenzdokument. Verschobene Einträge tragen eine
   Begründung, gestrichene ebenfalls.
8. **Dieses Dokument ist von Plan auf Protokoll korrigiert** und hat je Paket
   einen Abschnitt „erledigt" sowie am Ende ein phasenweites _Was anders lief_.

---

## Fortschritt

Noch kein Arbeitspaket begonnen. Je Paket kommt hier ein Abschnitt „erledigt"
mit dem, was tatsächlich passierte — Abweichungen vom Plan stehen hier, damit
AP 10 sie nicht rekonstruieren muss.

# 8 Querschnittliche Konzepte

Dieser Abschnitt erzählt nichts nach (E70). Was beim Bauen quer liegt, steht in
**[`docs/rules/`](../rules/README.md)** — dreizehn Dateien, je eine pro Bereich,
und was dort steht, ist schon einmal schiefgegangen. Hier steht nur, **welches
Konzept wo nachzulesen ist** — und danach das eine, das es noch nirgends gab: der
Plug-in-SDK-Leitfaden.

## 8.1 Wo die Konzepte stehen

| Konzept                                                                                             | Nachlesen in                                        |
| --------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| **Schichten und Ports** — wie ein Port aussieht, wann einer entsteht, was die Lint-Regeln verbieten | [`server-layers.md`](../rules/server-layers.md)     |
| **Verträge der Endpunkte** — Namensräume, Statuscodes, Paginierung, Fehlercodes                     | [`api-contracts.md`](../rules/api-contracts.md)     |
| **Datenmodell** — Entities, Migrationen, Zeiten und ihre Zonen, Löschregeln                         | [`data-model.md`](../rules/data-model.md)           |
| **Mail** — Sprache, Vorlagen, Drosselung, was ein zweiter Versuch ist                               | [`mail.md`](../rules/mail.md)                       |
| **i18n** — Schlüssel als Ort, Fehlercodes, Inhaltsübersetzungen, `?locale=`                         | [`i18n.md`](../rules/i18n.md)                       |
| **Angular-Fallen** — Templates, Formulare, Signals, berechnete Beschriftungen                       | [`angular-clients.md`](../rules/angular-clients.md) |
| **Browsersuiten** — Budgets, Aufräumen, Selektoren, die drei Browser                                | [`e2e-tests.md`](../rules/e2e-tests.md)             |
| **Whitelabel und PWA** — Custom Properties, Icons, Manifest, Kontraste                              | [`whitelabel-pwa.md`](../rules/whitelabel-pwa.md)   |
| **Deployment** — Umgebungsvariablen, Proxy, TLS, Prüfskripte                                        | [`deployment.md`](../rules/deployment.md)           |
| **Infrastruktur** — Ports, Plug-in-Schalter, geteilte Bibliotheken                                  | [`infrastructure.md`](../rules/infrastructure.md)   |
| **Beobachtbarkeit** — was ins Protokoll darf, Metriken, Lasttests                                   | [`observability.md`](../rules/observability.md)     |
| **Werkzeugfallen** — unerklärliche Zählwerte, Pfade, `pkill`                                        | [`tooling-traps.md`](../rules/tooling-traps.md)     |
| **Bestätigte Entscheidungen** — was nicht noch einmal aufgemacht wird                               | [`decisions.md`](../rules/decisions.md)             |

Vier Konzepte durchziehen alles und seien wenigstens benannt, damit man sie
suchen kann:

- **Sicherheit.** Sitzungen für zwei Rollen, Guards am **Pfad** statt an einem
  Dekorator (ein Plug-in kann ihn also nicht vergessen), Drosselung aus der
  Umgebung, Kopfzeilen am Proxy, und ein Review mit Befund je Punkt in
  [`docs/SECURITY-REVIEW.md`](../SECURITY-REVIEW.md).
- **Mehrsprachigkeit.** Was ein Schlüssel ist, welche Datei die Liste führt und
  was ein neuer Bildschirm mitliefert: [`i18n.md`](../rules/i18n.md).
- **Zeit.** In welcher Zone eine Uhrzeit steht und wer sie formatieren darf:
  [`data-model.md`](../rules/data-model.md). Seit Plug-in-API 1.3.0 gilt das
  auch am Plug-in-Port.
- **Fehler.** Eine Ablehnung reist als **Code mit Werten**, nie als Satz (E64):
  `{ message: code, code, params }`. Der Satz entsteht im Client aus dem
  Katalog.

---

# Der Plug-in-SDK-Leitfaden

Alles, was man braucht, um ein Trefaro-Plug-in zu bauen — **ohne eine der fünf
kuratierten Umsetzungen zu lesen**. Wer es nach diesem Leitfaden baut und danach
doch hineinsieht, findet dort dieselben Teile.

Der Vertrag steht bei **`PLUGIN_API_VERSION = '1.3.0'`** und ist für v1.0
**geschlossen**. Das heißt: gegen 1.3.0 gebaute Plug-ins bleiben gültig, und es
kommt vor v1.0 nichts mehr dazu.

## A. Die drei Dinge, die man vorher wissen muss

Sie stammen aus den Spikes der Phase 0, und sie sind genau die drei, die
überraschen:

1. **Ein Bündel wird same-origin geladen und läuft mit vollem Seitenzugriff.**
   Es ist ein `<script type="module">` im Dokument des Clients — keine Sandbox,
   kein iframe, keine Rechtetrennung. Es sieht dasselbe DOM, dieselben Cookies
   und dieselbe Herkunft wie der Client selbst. Daraus folgt: **die Prüfung
   eines Plug-ins ist ein menschlicher Schritt**, und v1 installiert deshalb
   nichts zur Laufzeit nach — was eine Organisation einschalten kann, ist das,
   was im Image liegt.
2. **Eingaben kommen als Eigenschaften, nicht als Attribute.** Der Wirt schreibt
   `element.eventId = …`, nicht `setAttribute('event-id', …)`. Angular Elements
   reicht objektartige Eingaben nicht durch Attribute, und ein Plug-in ohne
   Angular liest Eigenschaften genauso. Wer auf `attributeChangedCallback`
   wartet, wartet vergebens.
3. **Eine Plug-in-Migration muss nach jeder Kernmigration gestempelt sein, auf
   die sie zeigt.** Beide Migrationsströme — Kern und Plug-ins — werden
   **gemeinsam nach Zeitstempel** geordnet. Eine Fremdschlüsselreferenz auf
   `program_item` in einer Migration mit kleinerem Zeitstempel als die, die
   `program_item` anlegt, scheitert beim ersten Start einer frischen Instanz —
   und nur dort.

## B. Was ein Plug-in darf und was nicht

| Erlaubt                                                          | Verboten                                                     |
| ---------------------------------------------------------------- | ------------------------------------------------------------ |
| Eigene Tabellen mit Präfix `plugin_<key>_`                       | Eine Kerntabelle anfassen — anlegen, ändern, hineinschreiben |
| Eine **Referenz** von einer eigenen Tabelle auf eine Kerntabelle | Eine Spalte an einer Kerntabelle                             |
| Aus `plugin-api` importieren                                     | Irgendetwas anderes aus dem Server importieren (Lint-Regel)  |
| Kerndaten über die drei Lese-Ports lesen                         | Ein Repository des Kerns einspritzen                         |
| `shared-models` und `shared-plugin-kit` im Bündel                | `shared-plugins` oder eine Client-Bibliothek im Bündel       |
| Eigene Farben aus `--trefaro-*` ableiten                         | Eigenes CSS ausliefern oder eine Farbe fest verdrahten       |
| Eigene Katalogschlüssel unter `plugins.<camelKey>.`              | Text im Template                                             |

Und die Regel, die in beide Richtungen gilt: **der Wirt fragt ein Plug-in
nichts** (E59). Was der Kern über ein Plug-in weiß, steht in dessen Deskriptor.
Es gibt keine Stelle, an der der Kern eine Methode eines Plug-ins aufruft.

## C. Die Serverhälfte

### C.1 Verzeichnisse

```
apps/server/src/plugins/<key>/
├── <key>.plugin-key.ts    export const <KEY>_PLUGIN_KEY = '<key>';
├── <key>.plugin.ts        der Deskriptor
├── <key>.module.ts        das NestJS-Modul
├── api/                   Controller + DTOs
├── business/              Service + eigene Ports (Interface + Token)
└── data-access/           Entities, Repository-Implementierung, Migrationen
```

Die Schichtregel gilt **innerhalb** des Plug-ins: `business/` importiert weder
`typeorm` noch `@nestjs/typeorm` noch `pg` noch irgendetwas aus `data-access/`.
Der Service kennt seinen Port, das Repository erfüllt ihn.

Die Moduldatei liegt **über** beiden Schichten und darf deshalb beide sehen:
`TypeOrmModule.forFeature([…])` und die Bindung des eigenen Ports gehören dorthin.

```ts
@Module({
  imports: [TypeOrmModule.forFeature([NoteEntity])],
  controllers: [SessionNotesController],
  providers: [SessionNotesService, { provide: NOTE_REPOSITORY, useClass: TypeormNoteRepository }],
})
export class SessionNotesModule {}
```

### C.2 Der Deskriptor

Die eine Stelle, an der ein Plug-in dem Wirt alles über sich sagt:

```ts
import { PROFILES_MODULE_KEY } from '@trefaro/shared-models';
import { PLUGIN_API_VERSION, type ServerPlugin } from '../../app/business/plugin-api';

export const notesPlugin: ServerPlugin = {
  key: 'session-notes', // = module_config.module_key, nie mehr änderbar
  version: '0.1.0', // die eigene Version, für Diagnose und Admin-UI
  apiVersion: PLUGIN_API_VERSION, // die Vertragsversion, gegen die gebaut wurde
  titleKey: 'plugins.sessionNotes.title',
  module: SessionNotesModule,
  persistence: {
    entities: [NoteEntity],
    migrations: [CreateSessionNotes1790000000000],
  },
  requires: [PROFILES_MODULE_KEY], // optional: was vorher an sein muss
  client: {
    elementName: 'trefaro-plugin-session-notes',
    bundleUrl: '/api/plugins/session-notes/main.js',
    mountPoints: ['event-detail'],
    labelKey: 'plugins.sessionNotes.label',
    icon: 'event_note', // ein Name aus ICON_NAMES in shared-models
  },
  enabledByDefault: false, // kuratierte Plug-ins sind aus (NFR 1)
};
```

Zu `icon`: **Die Namen sind ein geschlossener Satz** — `ICON_NAMES` in
`libs/shared-models/src/lib/config/icons.ts`, derzeit rund zwanzig Material-
Symbols-Namen, deren Pfaddaten im Image liegen (E49). Ein Name, der nicht darin
steht, bekommt **kein** Icon — nie einen Platzhalter, nie einen Fehler, der eine
Seite anhält —, und die Modulverwaltung meldet ihn dort, wo Plug-in-Probleme
ohnehin stehen. Für ein **kuratiertes** Plug-in ist es schärfer: `curated-
plugins.spec.ts` lässt einen unbekannten Namen nicht durch. Wer ein Glyph
braucht, das es nicht gibt, trägt es in beide Dateien ein — Name hier, Pfad in
`shared-theming` —, denn „kein Eintrag ohne sein Glyph und kein Glyph ohne
seinen Eintrag" ist dort ein Typ und keine Verabredung.

Dazu ein Eintrag in `CURATED_PLUGINS` (`apps/server/src/plugins/index.ts`) —
**registriert, nicht gefunden**: ein versehentliches Verzeichnis wird kein
montiertes Plug-in, und die Reihenfolge der Liste ist die Reihenfolge, in der
der Veranstalter-Client die Kacheln zeichnet.

Zu `requires`: Es wird **in beide Richtungen** durchgesetzt und **nie still
aufgelöst**. Einschalten, während eine Voraussetzung aus ist → 409 mit Nennung
des fehlenden Schlüssels. Eine Voraussetzung ausschalten, während dieses Plug-in
an ist → 409 mit Nennung dieses Plug-ins. Wer Zeilen an ein Konto hängt, braucht
`profiles`.

Zu `client`: **weglassen**, wenn das Plug-in nur serverseitig etwas tut. Ein
Deskriptor ohne Client-Beitrag ist gültig; der Wirt zeichnet dann nichts und
lädt nichts.

### C.3 Controller

```ts
@ApiTags('plugin: session notes')
@PluginController(SESSION_NOTES_PLUGIN_KEY)
@UseGuards(PluginEnabledGuard)
@Controller('participant/plugins/session-notes')
export class SessionNotesController {
  @Get('events/:eventId/notes')
  list(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @CurrentPluginParticipant() me: PluginParticipant,
  ) { … }
}
```

Drei Dinge daran sind Pflicht:

- **Die Zugangsstufe steht im Pfad, nicht in einem eigenen Guard.**
  `admin/plugins/<key>/…` liegt hinter der Veranstaltersitzung,
  `participant/plugins/<key>/…` hinter der eines Nutzers, `user/plugins/<key>/…`
  hinter keiner. Diese Guards sind global und am Pfad festgemacht — ein Plug-in
  kann keinen vergessen und **keinen zurückziehen**. Das ist der Zweck.
- **`@PluginController(key)` und `@UseGuards(PluginEnabledGuard)` gehören
  zusammen.** Ohne das erste weiß der Guard nicht, welcher Schalter gilt, und
  lehnt ab.
- **Ein ausgeschaltetes Plug-in antwortet 404, nicht 403.** Es soll abwesend
  aussehen, nicht verboten — und so sieht es auch der Client, dem
  `/api/config` es gar nicht erst nennt. **Aber der Pfad-Guard ist zuerst
  dran:** wer ohne Sitzung an eine `participant/`- oder `admin/`-Adresse klopft,
  bekommt **401**, ob das Plug-in an ist oder aus. Die 404 gilt für jemanden,
  der eine Sitzung hat. Wer einen Test schreibt, der „ausgeschaltet ist 404"
  behauptet, meldet sich vorher an — sonst prüft er den anderen Guard.

Wer fragt, kommt über `@CurrentPluginParticipant()` bzw.
`@CurrentPluginOrganizer()`. Eine Ablehnung reist als **Code mit Werten** (E64),
nie als Satz.

### C.4 Kerndaten lesen

Drei Ports, absichtlich schmal. Jeder wird über sein Token eingespritzt:

```ts
constructor(
  @Inject(PLUGIN_PROGRAM_READS) private readonly program: PluginProgramReads,
) {}
```

| Port                      | Token                       | Was er kann                                                                                                     |
| ------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `PluginProgramReads`      | `PLUGIN_PROGRAM_READS`      | `findItem(id)`, `listForEvent(eventId, locale?)`, `countSignups(ids)` — jeder Punkt mit `timezone` (seit 1.3.0) |
| `PluginRegistrationReads` | `PLUGIN_REGISTRATION_READS` | `resolveClaim(...)`, `findRegistration(id)`, `findForEvent(eventId, window)` — mit `total` für die Seitenzahl   |
| `PluginParticipantReads`  | `PLUGIN_PARTICIPANT_READS`  | `findAuthors(ids)` — Id, Name, Avatar-URL. Mehr trägt ein Autor nicht                                           |

Was **nicht** dabei ist, ist ebenso Vertrag: keine Mailadresse, kein
Registrierungsformular, kein Schreibzugriff auf irgendetwas des Kerns. Wer mehr
braucht, braucht einen Versionsschritt — und der Vertrag ist für v1.0
geschlossen.

Zwei Helfer kommen durch denselben Import, damit sie nicht je Plug-in neu
entstehen: `pageWindow` für „Seite 0" und `LocaleQueryPipe`/`ApiLocaleQuery` für
die Lesart von `?locale=`.

### C.5 Persistenz

- **Tabellen heißen `plugin_<key>_<name>`**, mit **Unterstrichen statt
  Bindestrichen** im Schlüssel: aus `session-notes` wird
  `plugin_session_notes_note`. In `psql` ist dann sofort erkennbar, wem eine
  Tabelle gehört — was zählt, wenn die Admin einer Organisation in die Datenbank
  sieht.
- **Migrationen laufen beim Start**, mit `migrationsTransactionMode: 'each'`.
  `down` wird mitgeschrieben und einmal wirklich ausgeführt.
- **Der Zeitstempel ist die Ordnung** — siehe Punkt 3 in Abschnitt A.
- **Ausschalten löscht nie Daten.** Nur `down` entfernt die Tabellen eines
  Plug-ins. Ein Forum für eine Saison auszuschalten darf seine Beiträge nicht
  wegwerfen.
- Der Deskriptor typisiert `entities` und `migrations` als `unknown[]`, weil die
  Geschäftsschicht die ORM nicht kennen darf. Nur
  `data-access/plugin-data-access/` führt sie zurück.

## D. Die Clienthälfte — das Bündel

### D.1 Das Projekt ist eine App, aber keine Anwendung

Das Bündel entsteht als ganz gewöhnliches Angular-**Anwendungsprojekt** unter
`apps/plugins/<key>/` — `nx g @nx/angular:application` oder eine Kopie der
`project.json`, `tsconfig*.json` und `eslint.config.mjs` eines bestehenden
Bündels. Das Bauziel bleibt `@angular/build:application`. Drei Einstellungen
machen daraus ein ladbares Bündel:

| Einstellung                                          | Warum                                                                   |
| ---------------------------------------------------- | ----------------------------------------------------------------------- |
| `"index": false`                                     | Es gibt keine HTML-Hülle — das Bündel wird in eine fremde Seite geladen |
| **kein** `styles`-Eintrag                            | Ein globales Stylesheet wäre eine zweite Datei und ein eigenes Design   |
| `"outputHashing": "none"` + `outputPath.browser: ""` | Die Bündel-URL steht im Deskriptor und darf sich je Bau nicht ändern    |

Angular 22 erzeugt zoneless: `zone.js` ist keine Abhängigkeit, und zwischen Wirt
und Bündel muss für die Änderungserkennung nichts geteilt werden.

**Die URL aus dem Deskriptor zeigt auf ein gebautes Bündel.** Der Server liefert
`/api/plugins/<key>/main.js` als statische Datei aus dem Verzeichnis, in das die
Bündel bauen — `dist/apps/plugins/<key>/main.js`. Wer das Plug-in registriert
und `nx build plugin-<key>` vergisst, bekommt an dieser Adresse 404, der Lader
vermerkt `failed`, und die Modulverwaltung sagt es. Ein Bündel ist also kein
Teil des Serverbaus, sondern ein eigenes Bauziel neben ihm.

### D.2 Der Einstiegspunkt

```ts
import { createApplication } from '@angular/platform-browser';
import { createCustomElement } from '@angular/elements';
import { SessionNotesPlugin } from './app/session-notes-plugin';

const ELEMENT_NAME = 'trefaro-plugin-session-notes';

async function register(): Promise<void> {
  const app = await createApplication();
  const element = createCustomElement(SessionNotesPlugin, { injector: app.injector });
  // Denselben Namen zweimal zu definieren wirft — beim Hot Reload und wenn
  // zwei Clients sich eine Seite teilen.
  if (!customElements.get(ELEMENT_NAME)) customElements.define(ELEMENT_NAME, element);
}

register().catch((error: unknown) => {
  console.error(`Trefaro plug-in ${ELEMENT_NAME} failed to register`, error);
});
```

Der Name muss **buchstabengleich** dem `elementName` des Deskriptors
entsprechen: der Lader wartet auf `customElements.whenDefined(elementName)` und
gibt nach zehn Sekunden auf.

Ein Plug-in ohne Angular baut dasselbe mit `customElements.define` und einer
eigenen Klasse. Der Wirt kennt nur den Elementnamen und die Eigenschaften.

### D.3 Was der Wirt an das Element schreibt

Immer, an jedem Einhängepunkt (zugesagt seit 1.2.0):

| Eigenschaft  | Inhalt                                                                    |
| ------------ | ------------------------------------------------------------------------- |
| `locale`     | Die aktive Sprache des Lesers, z. B. `de`                                 |
| `strings`    | Die Katalogschlüssel dieses Plug-ins, **ohne Präfix**, als flaches Objekt |
| `mountPoint` | Der Einhängepunkt, an dem gerade gezeichnet wird                          |

Dazu, je Einhängepunkt, dessen eigene Werte — an `event-detail` und
`event-dashboard` die `eventId`, an `my-registration` die Angaben der
Registrierung. Die vier Einhängepunkte sind **geschlossen**:

`navigation` · `event-detail` · `event-dashboard` · `my-registration`

Ein Bündel darf an mehreren montiert sein und an jedem etwas anderes zeichnen —
dafür ist `mountPoint` da.

**Ein Sprachwechsel weist neu zu, er montiert nicht neu.** Das Element
überlebt, seine Eigenschaften werden neu geschrieben. Ein Plug-in darf also
Zustand halten — muss aber auf eine Änderung von `locale` reagieren.

### D.4 Das Werkzeug: `@trefaro/shared-plugin-kit`

Die einzige Bibliothek des Wirts, die ein Bündel benutzen darf — sie enthält
nichts vom Wirt, nur das, was sonst jedes Bündel kopieren würde:

```ts
import { readJson, sendJson, NotSignedInError, wordsOf, when, day, clock } from '@trefaro/shared-plugin-kit';

const words = wordsOf('session-notes'); // an den eigenen Namensraum gebunden
words.word(this.strings, 'empty'); // fehlt sie, ist der volle Schlüssel die Antwort

const notes = await readJson<Note[]>(`/api/participant/plugins/session-notes/events/${id}/notes`);
await sendJson('PUT', `/api/participant/plugins/session-notes/notes/${noteId}`, { text });

clock(this.locale, item.startsAt, item.timezone); // 09:05 am Veranstaltungsort
```

- **`NotSignedInError` ist kein Fehler, sondern ein Zustand.** Ein Plug-in
  hinter dem Login ist für alle montiert; „keine Sitzung" wird **gezeichnet** —
  als Einladung, sich anzumelden —, nicht als Defekt gemeldet.
  `PluginRequestError` trägt den Statuscode für die Konsole.
- **Der `/api`-Pfad ist Vertrag, keine Umgebung.** Beide Clients werden von
  derselben Herkunft ausgeliefert wie die API, also reist das Cookie mit und in
  keinem Bündel steht die Adresse eines fremden Hosts (NFR 9).
- **Die dritte Angabe an `when`/`day`/`clock` ist die Zone des Events.** Ohne
  sie zeichnet ein Bündel die Uhr des Lesers — und genau das war der Fehler, den
  1.3.0 geschlossen hat. Wer „wann etwas passiert ist" zeichnet (ein Beitrag,
  ein Vorschlag), lässt sie zu Recht weg: das hat keinen Ort.

### D.5 Worte und Farben

**Worte.** Die Schlüssel des Plug-ins stehen im Katalog unter
`plugins.<camelKey>.` — aus `session-notes` wird `plugins.sessionNotes.`. Sie
gehören nach `libs/shared-i18n/catalogues/en.json` **und** `de.json`; `en.json`
ist die Schlüsselliste, was dort fehlt, existiert nicht. Der Wirt löst sie auf
und reicht sie ohne Präfix als `strings` herein — ein Bündel trägt **kein**
Transloco und holt `/api/i18n/:locale` **nicht** ein zweites Mal.

**Farben.** Ein Bündel liefert kein CSS aus und verdrahtet keine Farbe. Es
gestaltet sein eigenes **Layout** — das ist seine Sache — und liest jede Farbe
aus einer `--trefaro-*`-Eigenschaft. Die stehen auf dem Wurzelelement des
Dokuments und überqueren die Shadow-DOM-Grenze von allein; ein Farbwechsel der
Organisation wirkt ohne Neubau.

**Die Liste ist geschlossen und steht in `libs/shared-theming/`** — sie ist
kürzer, als man vermutet, und man rät keinen Namen dazu:

| Familie             | Eigenschaften                                                                                                                     |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Markenfarben        | `--trefaro-color-primary`, `-primary-strong`, `-primary-soft`, `-primary-muted`, `--trefaro-color-on-primary`                     |
| Akzent              | `--trefaro-color-accent`, `-accent-strong`, `-accent-soft`, `-accent-muted`, `--trefaro-color-on-accent`                          |
| Flächen und Schrift | `--trefaro-color-surface`, `-surface-muted`, `--trefaro-color-on-surface`, `--trefaro-color-text-muted`, `--trefaro-color-border` |
| Form                | `--trefaro-radius-sm`, `--trefaro-radius-md`, `--trefaro-icon-size`, `--trefaro-font-family`, `--trefaro-logo-url`                |

Es gibt **kein** `--trefaro-color-text` — Text auf einer Fläche ist
`--trefaro-color-on-surface`. Das ist kein Detail: was kein `--trefaro-*`
ausliefert, darf ein Bauteil nicht nennen (F222), und eine Deklaration mit
unbekannter Custom Property fällt **still** aus. Sie sieht auf dem Rechner des
Autors richtig aus, weil der Browser die Zeile einfach überspringt und die
geerbte Farbe stehen lässt.

## E. Prüfen, bevor man es ausliefert

1. **`nx test`** für die Bündel-Komponente und den Server-Service. Ein Test, der
   eine Uhrzeit prüft, erzwingt eine fremde Zeitzone — sonst ist er auf dem
   Rechner des Autors grün und beim Leser falsch.
2. **`nx run-many -t lint test build`** — die Lint-Regeln sind es, die die
   Schichten und den erlaubten Importbereich durchsetzen.
3. **Gegen eine laufende Instanz**: Plug-in einschalten, Seite laden, Element im
   DOM suchen. Erscheint es nicht, sagt die Modulverwaltung warum — sie kennt
   `loading`, `ready` und `failed` samt Grund.
4. **Aus leerem Volume starten.** Nur dort zeigt sich ein falsch gestempelter
   Migrationszeitstempel.

## F. Was ein Plug-in ausdrücklich nicht kann

Damit niemand danach sucht:

- **Kein Einhängepunkt außerhalb der vier.** Einen fünften gäbe es nur mit einem
  Versionsschritt, und der Vertrag ist geschlossen.
- **Keine Schreibzugriffe auf Kerndaten.** Die Lese-Ports heißen so.
- **Kein Platz in einem Datenexport.** Ein Export nennt die eingeschalteten
  Module, trägt aber nicht, was ein Plug-in gespeichert hat — die Begründung
  steht in `docs/PHASE5.md` unter AP 11.
- **Keine Installation zur Laufzeit.** v1 kennt nur, was im Image liegt.
- **Keine Isolation.** Siehe Abschnitt A, Punkt 1. Ein Plug-in ist so
  vertrauenswürdig wie der Mensch, der es gelesen hat.

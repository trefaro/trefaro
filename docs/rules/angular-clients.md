# Fallen in den Angular-Clients

Fehlerklassen, die in diesen beiden Angular-Clients wiederholt aufgetreten sind
und die typischerweise **nur** der Browserdurchlauf findet.

`tsc --noEmit` prüft keine Templates, ein Unit-Test setzt Eingaben genau
einmal, und zoneless Angular zeichnet nur neu, wo eine Signal-Abhängigkeit
besteht. Jede Zeile hier hat einmal einen halben Tag gekostet.

- **`private` reicht für ein Angular-Template nicht**, und `tsc --noEmit` merkt
  das nicht — Template-Prüfung passiert erst im Testbuild des Clients.
- **Keine Backticks in Angular-Template-Kommentaren.** Sie beenden das
  Template-Literal, und der Compiler meldet die Folgefehler an ganz anderen
  Stellen.
- **Ein `<select>`, dessen Optionen aus einem `@for` kommen, nimmt kein
  `[value]`** — Angular schreibt die Eigenschaft, bevor die Optionen existieren,
  und die Zuweisung fällt wortlos weg. `[selected]` an den Optionen; mit
  `formControlName` tritt das Problem nicht auf.
- **Ein `<input type="number">` schreibt eine Zahl in ein `string`-Control.**
  Angulars `NumberValueAccessor` konvertiert, `tsc` merkt nichts — wer den Wert
  weiterverarbeitet, nimmt `string | number` an, sonst stirbt `.trim()` still.
- **`<input type="color">` kann nur `#rrggbb`.** Ein gespeichertes `#fff` (E17
  erlaubt es) muss beim Laden erweitert werden, sonst zeigt der Wähler wortlos
  Schwarz und schreibt es beim ersten Öffnen zurück.
- **Ein reiner Fragment-Link funktioniert in diesen Clients nicht.** Beide tragen
  ein `<base href>`, `href="#program"` löst dagegen auf und verlässt die Seite.
  Sprungmarken über den Router (`[routerLink]="[]"` + `fragment`); der
  Nutzer-Client hat dafür `withInMemoryScrolling({ anchorScrolling: 'enabled' })`.
- **Ein Formular, das sich selbst leert, wird währenddessen geschlossen.** Wer
  nach dem Absenden weitertippt, verlöre das Getippte beim Reset →
  `<fieldset [disabled]>`, solange eine Anfrage läuft.
- **Zoneless + Transloco verträgt sich — die Falle ist eine andere** (F72). Pipe,
  Strukturdirektive und `translateSignal` zeichnen nach einem Sprachwechsel neu.
  Aber eine Beschriftung, die **in TypeScript** entsteht, hat keine Pipe, und
  `TranslocoService.translate()` liest eine gewöhnliche Map ohne
  Signal-Abhängigkeit. **Wer eine Beschriftung berechnet, liest
  `TranslationService.locale()` in derselben `computed()`.** Und ein Fake in einem
  solchen Test muss die **Nicht**-Reaktivität nachbilden — ein reaktiveres Fake
  hielt den Test grün, gefunden hat es der Browserdurchlauf.
- **Eine Template-Methode zeichnet neu, ein `computed()` nicht.** Methoden werden
  neu ausgewertet, sobald eine `transloco`-Pipe derselben Seite den View markiert;
  memoisierte `computed()` **müssen** `locale()` selbst lesen. Beide Sorten stehen
  nebeneinander, und der Unterschied ist nur nach einem Sprachklick sichtbar.
- **Die Identität eines Übersetzungsformulars ist (Ding, Sprache)** (F102). Der
  Entwurf wird zurückgesetzt, wenn Reiter oder Session wechselt — **nicht**, wenn
  ein Elternteil eine neue Feldliste baut: die wird `untracked` gelesen. Der erste
  Entwurf baute sie in einer Template-Methode, und das Formular leerte sich
  zwischen zwei Tastenanschlägen.
- **Eine Seite, deren Inhalt der Server übersetzt, lädt bei einem Sprachwechsel
  neu** — `i18n.locale()` im `effect()`, nicht in `load()`. **Und sie verwirft
  die Antwort auf die alte Frage** (AP 5 der Phase 4): zwei Ladevorgänge sind
  in Flug, sobald jemand die Sprache wechselt, bevor die Seite steht, und die
  Antworten kommen in der Reihenfolge des Netzes. Ohne Wächter malte eine späte
  englische Antwort einen englischen Event unter eine deutsche Seite — genau
  das, was `content-translations.spec.ts` unter acht Arbeitern zweimal fand
  und allein gefahren nie. Die Event-Landingpage zählt deshalb ihre
  Ladevorgänge (`loadSequence`) und schreibt nach einem `await` nur, wenn ihr
  Lauf noch der jüngste ist. Dieselbe Bauweise fehlt noch an vier Seiten mit
  demselben Effekt (Reihe, Startseite, Anmeldung, „meine Anmeldung"), siehe
  `todo.md` unter Phase 5.
- **Ein laufender Client wird nur von seiner eigenen Seite umgefärbt.** Die
  Design-Seite ruft `ThemeService.apply()` mit dem Entwurf; `DestroyRef` stellt
  beim Verlassen wieder her, `Discard` beim Klick. Nach jedem Schreiben wird
  `/api/config` über `AppConfigService.reload()` **neu gelesen**, nie gemergt.
- **Das Theme wird genau einmal angewendet** (Startlauf). `reload()` frischt nur
  die Daten auf — wer Konfiguration schreibt und _sofort_ eine Wirkung sehen soll,
  ruft zusätzlich `ThemeService.apply()` (E20).
- **Zwei Felder dürfen nicht „Name" heißen.** Person und Organisation im selben
  Formular sind für einen Screenreader nicht unterscheidbar (NFR 4).
- **Ein Bauteil, das ein Formularfeld zeichnet, bekommt sein Control übergeben**
  (F140). `[formControl]` mit einem Control, das der Aufrufer besitzt — nicht
  `formControlName`, das den `ControlContainer` aus der Umgebung auflöst: das
  Bauteil funktioniert dann unabhängig davon, wo es steht, und ist mit einem
  Control und ohne Formular testbar. Beide Baukästen halten ihre Antworten in
  einem `FormRecord` und geben das Mitglied zu dieser Frage weiter. Und: die
  Controls werden **vor** der Feldliste gesetzt, sonst liest das Template einen
  Zyklus lang ein Control, das es noch nicht gibt.
- **Ein `<section>` ohne zugänglichen Namen ist keine `region`.** Ohne
  `aria-labelledby` (oder `aria-label`) taucht der Abschnitt nicht im
  Accessibility-Baum als Bereich auf — ein Screenreader kündigt eine namenlose
  Gruppe an, und `getByRole('region', { name: … })` einer Browsersuite findet
  gar nichts. Die Überschrift bekommt eine `id`, der Abschnitt zeigt darauf.
- **Der Nutzer-Client fragt nur nach einer Sitzung, wenn dieser Browser schon
  einmal angemeldet war** (F143). Sein Normalzustand ist anonym, und `GET
/api/participant/me` antwortet dann 401 — eine rote Konsolenzeile und eine
  sinnlose Anfrage bei jedem öffentlichen Seitenaufruf. Der Hinweis dafür steht
  in `localStorage` (`trefaro.participant-session`) und ist **kein** Token: das
  HttpOnly-Cookie bleibt die Autorität (E34). Gefunden von `start-up.spec.ts`,
  die „ohne Konsolenfehler" prüft — die Prüfung wurde nicht gelockert.
- **Ein Control, dessen Kästchen nicht auf dem Bildschirm steht, schickt
  trotzdem seinen Wert** (F151). Ein `@if` im Template entfernt die Ansicht, nicht
  das Mitglied der `FormGroup` — `getRawValue()` liefert weiter den Vorgabewert.
  Auf der Profilseite hätte das auf einer Instanz mit abgeschalteter
  Teilnehmersuche `searchable: false` geschrieben und jemandem still die
  Sichtbarkeit genommen, die er auf einer anderen Konfiguration gewählt hat
  (Abschalten löscht nichts, E14). Regel: **wer ein Feld nur bedingt zeigt,
  schickt es auch nur bedingt** — dieselbe Bedingung, an einer Stelle.
- **Ein Formular sperrt nicht, weil eine Nebenanfrage fehlschlug** (F146). Die
  Profilseite füllt ihre eigenen Felder, sobald das Profil da ist, und die
  Antworten erst, wenn auch die Fragen da sind — zwei Effekte, zwei Marken. Der
  erste Entwurf wartete auf beides, und eine nicht ladbare Fragenliste machte ein
  Pflichtfeld leer und das ganze Formular unabsendbar.
- **`FormData.set(name, file, filename)` kopiert die Datei.** Das dritte
  Argument ist für einen `Blob` da, der keinen Namen hat; eine `File` trägt ihren
  eigenen. Wer ihn trotzdem mitgibt, findet im Formular ein **anderes**
  `File`-Objekt mit gleichem Inhalt — ein Test auf Identität wird rot, und ein
  Vergleich per `toBe` ist die einzige Stelle, an der es auffällt. Gefunden beim
  Bildversand des Chats (AP 8).
- **Der Chat-Socket gehört der Sitzung, nicht der Seite** (F166). `ChatConnection`
  hängt in der Shell und verbindet, solange jemand angemeldet ist und `chat` an
  ist. Eine Verbindung je Bildschirm wäre nicht nur unruhiger, sie hätte **E44
  gebrochen**: Push geht nur raus, wenn niemand einen offenen Socket _in diesem
  Gespräch_ hat, und der Raum eines Gesprächs wird allein von der
  Gesprächsansicht betreten. Wer einen zweiten Echtzeitbildschirm baut, betritt
  dort einen Raum — er verbindet nicht.
- **Ein Verbindungszustand wird gesagt, nicht verschwiegen** (F169, F110 auf den
  Socket angewandt). `trefaro-live-status` kennt vier Sätze und behauptet nie
  mehr, als es weiß: „verbunden" heißt nicht „dieses Gespräch wird aktualisiert"
  — das ist eine zweite Frage mit einer zweiten Antwort (ein abgelehnter `join`).
  Ein Chat, der still nichts mehr empfängt, sieht wie ein Chat aus, in dem
  niemand schreibt.
- **`[maxlength]` gibt es nicht — es heißt `[attr.maxlength]`.** Auf `<input>`
  und `<textarea>` ist die Länge ein Attribut, kein Property, und Angular lehnt
  das Binding mit `NG8002` ab. Der Fehler kommt erst im `build`: `tsc --noEmit`
  liest keine Templates.
- **Der Veranstalter-Client hat keinen Socket** (AP 10, F132/F133). Seine
  Nachrichtenübersicht lädt beim Öffnen und sonst auf Zuruf; live ist nur der
  Teilnehmer-Client. Der Grund ist nicht Sparsamkeit: der Handshake
  authentifiziert eine **Teilnehmer**-Sitzung, und die Organisation hat keine
  Mitgliedschaft, an die zugestellt würde. Was an ihre Stelle tritt, ist die
  Benachrichtigungsmail (F172) — deshalb darf ein Bildschirm hier auch nicht
  behaupten, er sei aktuell.
- **Ein Bild, das nur mit Sitzung lesbar ist, wird geholt und aus einem Blob
  gezeigt** (E9, F133). Der Veranstalter-Client folgt der `imageUrl` einer
  Nachricht **nicht** — die gehört Mitgliedern —, sondern lädt über
  `ApiClient.file(...)`, macht eine Object-URL daraus und gibt sie beim
  Zerstören wieder frei. Erst wenn die Zeilen stehen, nie davor: ein Gespräch
  liest sich auch ohne Bilder.
- **Ein Client-Test, der Dateien liest, braucht `"node"` in
  `tsconfig.spec.json`** (Iconliste gegen `public/`, Manifest-Adresse gegen
  `index.html`).
- **Eine Systemberechtigung wird erklärt, bevor sie erfragt wird** (F178,
  NFR 4). Der Dialog des Browsers nennt eine Domain, nicht die Organisation, er
  sagt nichts darüber, was geschickt würde, und die falsche Antwort ist von der
  Seite aus nicht wiederholbar. Also steht der Satz **vorher** auf dem
  Bildschirm, und nur ein Klick löst den Dialog aus. Dazu: den Zustand
  **lesen** statt raten — `Notification.permission` fragt niemanden; ein „jetzt
  nicht" in `localStorage` gilt dauerhaft (wie F109); und gezeigt wird nur, was
  gehen kann (kein Service Worker, kein Schlüssel, blockiert oder abgelehnt =
  gar nichts).
- **Was nur im Produktionsbuild lebt, braucht einen erklärten Zustand.** Angular
  registriert den Service Worker nur dort, also ist `swPush.isEnabled` in jeder
  Browsersuite `false`. Ein Bauteil, das dann **nichts** zeichnet, ist nicht
  prüfbar und sieht auf einem iPhone in einem Safari-Tab kaputt aus — dem Fall,
  von dem F7 abhängt. Der Schalter auf der Profilseite sagt deshalb „dieser
  Browser kann das nicht" **und** den iOS-Hinweis, und genau das prüft die
  Browsersuite.
- **Ein Abonnement, das der Sitzung folgt, ist ein `effect` mit Gedächtnis**
  (F134). Der Client schickt es beim An- und Abmelden erneut; verglichen wird
  gegen den **zuletzt geschickten** Besitzer (`undefined` = noch nie geschickt,
  was von `null` = „als niemand" verschieden ist), sonst postet jeder Start
  zweimal. Und geschickt wird nur, wenn der Browser überhaupt ein Abonnement
  hält: Anmelden abonniert niemanden — das ist eine Entscheidung mit einem
  Browserdialog darin.
- **Client-Start-Sequenz:** erst Konfiguration (Design + aktivierte Module) laden,
  dann Theming anwenden, dann die Plug-in-Webkomponenten laden.
- **Ein `OnPush`-Bauteil wird für einen Wert, der kein Signal ist, nicht neu
  geprüft** (AP 12). Ein Modulschalter aus `AppConfigService.isModuleEnabled()`
  ist so ein Wert: er steht beim Start fest, also darf ein Test ihn **vor** dem
  ersten `detectChanges()` setzen und nicht dazwischen — sonst zeichnet die
  Ansicht weiter das, was beim ersten Durchlauf galt, und der Test behauptet,
  ein Bauteil ignoriere seinen Schalter.
- **Zwei Platzierungen eines Bauteils sind ein Bauteil mit zwei Eingängen**
  (F182, wie F178). Das Newsletter-Formular steht auf der Startseite (ohne
  Reihe) und auf einer Reihenseite (mit Slug und Namen); der Unterschied ist ein
  `input()` und ein Satz. Zwei Bauteile wären zwei Orte für die Formulierung
  einer Einwilligung — und die driftet.

- **Ein Plug-in-Bündel ist ein Web Component, kein zweiter Client** (AP 3 der
  Phase 4, das erste Bündel mit Fachlichkeit). Was es vom Host bekommt, sind
  genau die zugesagten Eigenschaften des Slots — `locale`, `strings`,
  `mountPoint` — plus was der Einhängepunkt dazulegt (die Event-Id, und an
  `my-registration` seit AP 8 der Phase 4 `token` **oder** `registrationId`,
  je nachdem, womit dieser Besuch die Seite geöffnet hat). Alles
  andere holt es sich selbst, und zwar **schmal**: die vier Aufrufe der
  Programmvorschläge sind `fetch` auf die eigenen Routen des Plug-ins, weil ein
  Statuscode alles ist, was sie brauchen. Kein `ApiClient`, kein `HttpClient`,
  kein `AppConfigService` — ein Client teilt mit einem Bündel die **Modelle**,
  nie die Implementierung. Der `/api`-Präfix darf dabei fest im Bündel stehen:
  die Zugangsstufe eines Plug-ins **ist** sein Pfad (E57), also ist er Vertrag
  und nicht Deployment.
- **Ein Bündel mit zwei Einhängepunkten braucht `mountPoint`, nicht Raten**
  (F202). Der Vertrag gibt ein `elementName` und eine `bundleUrl`, also
  entscheidet die dritte zugesagte Eigenschaft, welche Hälfte gezeichnet wird —
  die Adresszeile zu lesen würde das Deployment der zwei Clients zum Vertrag
  machen, und „welcher Aufruf antwortet 401" ist auch das Aussehen einer
  abgelaufenen Sitzung.
- **Ein Bündel hinter dem Login erfährt nicht, ob es eine Sitzung gibt.** Es
  fragt und liest den 401 — für einen anonymen Besucher also eine
  fehlgeschlagene Anfrage in der Konsole, die der **Host** sich mit F143 gerade
  abgewöhnt hat. Der Hinweis im `localStorage` gehört einem der zwei Clients und
  ist für ein Bündel, das in beiden läuft, keine Antwort. Ein 401 heißt in einem
  Plug-in deshalb **Einladung, sich anzumelden**, und nie „Fehler" (E58).
- **Drei Bündel teilen Code über `shared-plugin-kit`, nicht durch Abschreiben**
  (F138, AP 6 der Phase 4). Zwei Kopien waren erlaubt (AP 5); das dritte Bündel
  mit denselben Zeilen war die Raumplanung — früher als die Regel dachte —, und
  die Zeilen zogen in `libs/shared-plugin-kit`: `wordsOf(key)` (Wort mit
  Rückfall auf den vollen Schlüssel, Statuswort), `when`/`day`/`clock`
  (Zeitpunkt in Sprache und Zone des Lesers) und `readJson`/`sendJson` mit
  `NotSignedInError` und `PluginRequestError` (der 401 als Zustand, E58).
  Framework-frei, nur an `shared-models` hängend, und **nicht** `shared-plugins`
  — das gehört dem Host und injiziert dessen Angular-Dienste. Ein Bündel
  importiert vom Host genau zwei Bibliotheken: `shared-models` und
  `shared-plugin-kit`. Je Bündel bleibt eine `plugin-words.ts` mit einer
  Zeile: der Bindung an den eigenen Schlüssel.
- **`*ngTemplateOutlet` in einem Standalone-Bauteil braucht `NgTemplateOutlet`
  in `imports`.** Der Build sagt nichts; der Unit-Test meldet NG0303 („Can't
  bind to 'ngTemplateOutlet'") — an einer Stelle, die nach einem falschen
  Selektor klingt.
- **Ein Formular in einem Bündel wird beim Absenden gelesen, nicht gebunden**
  (AP 6). `FormData` aus dem `submit`, ein laufender Vorgang sperrt das
  `fieldset`, ein gescheiterter lässt das Getippte stehen (nichts wurde
  geschrieben, also darf nichts geschrieben aussehen), und ein leeres
  optionales Feld reist als `null` — das ist, was eine Etage leert; ein leerer
  String scheiterte am `Length(1, …)` des DTOs. Kein `[value]` an einem
  `<select>` aus `@for`, siehe oben; das Bündel liest die Auswahl aus dem
  Formular.
- **Ein Formular steht unter dem, was es ändert, nicht an dessen Stelle.** Das
  Bearbeitungsformular eines Raums ersetzte zuerst die Überschrift — der Mensch
  davor sah nicht mehr, welchen Raum er änderte, und der Locator der
  Browsersuite, der den Raum über seinen Namen fand, verlor ihn.
- **Ein Abschnitt, dessen Titel der Server übersetzt, lädt bei einem
  Sprachwechsel neu und zählt seine Ladevorgänge** — die Regel der Landingpage
  (oben, AP 5) gilt für ein Bündel genauso: `participant-rooms.ts` liest
  `locale()` im `effect()` und verwirft eine späte Antwort auf die alte Frage.
  Dort von Anfang an, mit dem Test, der die zwei Antworten in der falschen
  Reihenfolge auflöst.
- **Ein Bündel, das eine Bibliothek nur für eine Hälfte braucht, lädt sie
  nach** (AP 8 der Phase 4). Der Dekoder des Check-Ins (`jsqr`) wiegt ein
  Drittel des Bündels, und die Hälfte, die ein Teilnehmender auf einem Telefon
  lädt, **zeichnet** Codes und liest keine — also steht er hinter einem
  `await import(…)` im Moment des Einschaltens der Kamera. Der Brocken landet
  neben `main.js` im selben Verzeichnis, und der Server liefert dieses
  Verzeichnis statisch aus (`useStaticAssets` auf `/api/plugins/`), also
  stimmt der relative Pfad in beiden Betriebsarten. Statisch importiert wären
  es 314 kB gewesen — über der Budgetwarnung von 250 kB — und die Teilnehmer
  hätten einen Scanner geladen, um ein Bild anzusehen.
- **Ein Element, das man selbst anhängt, trägt keine
  Encapsulation-Attribute.** Emulierte Kapselung wählt über ein `_ngcontent`
  am Element aus; ein per `DOMParser` gebautes `<svg>` hat keines, also greift
  keine Regel des Bauteils darauf zu. Größe und Attribute gehören deshalb an
  das Element selbst (`element.style.width = '100%'`), nicht in `styles`. Der
  Umweg über `innerHTML` mit `bypassSecurityTrustHtml` wäre die andere Lösung
  gewesen — ein Sanitizer, dem man zuredet, für etwas, das man selbst erzeugt
  hat.
- **Ein Abstand zwischen Zeichen ist ein `margin`, kein Leerzeichen** (AP 8).
  Der Check-in-Code steht in Vierergruppen, damit man ihn vorlesen kann; die
  Gruppen sind eigene `<span>` mit `margin-inline-start`, also ist der
  Textinhalt der Zeile **exakt** der Code. Wer stattdessen Leerzeichen
  einsetzt, gibt jedem, der die Zeile kopiert, etwas, das die Tür ablehnt —
  und Angulars Umgang mit Leerraum im Template ist keine Zusicherung, auf die
  man das stützt. Ein Unit-Test bewacht den Textinhalt, weil das nächste
  Umformatieren des Templates es sonst still ändert.
- **Eine Sprungmarke braucht `anchorScrolling`.** Beide Clients haben es jetzt
  (`withInMemoryScrolling` in `provideRouter`); ohne das ändert
  `[routerLink]="[]" [fragment]="…"` die Adresse und sonst nichts. Und immer
  über den Router: beide Clients tragen ein `<base href>`, gegen das ein nacktes
  `href="#ziel"` auflöst — und dann verlässt der Klick die Seite.
- **Ein Bündel mit genau einem Einhängepunkt deklariert kein `mountPoint`**
  (AP 9). Vier der fünf Bündel sind oben ein Schalter über die übergebene
  Eigenschaft (F202); der individuelle Programmplan hängt nur am
  `event-detail`, also wäre der `input()` ein Wert, den niemand liest (E21).
  Der Slot weist ihn trotzdem zu — `Object.assign` auf ein Custom Element legt
  eine gewöhnliche Eigenschaft an, und das stört nichts.
- **Nach Tagen gruppiert wird nach der gezeichneten Beschriftung, nicht nach dem
  ISO-Datum** (AP 9). `startsAt.slice(0, 10)` ist der Tag in UTC, die Überschrift
  darüber steht in der Uhr des Lesers — bei einer Session am späten Abend sind
  das zwei verschiedene Tage, und dann widerspricht eine Überschrift den Zeilen
  unter ihr. Also ist der Schlüssel der Gruppe dieselbe Zeichenkette, die auch
  angezeigt wird.
- **Ein Schreibvorgang, der 204 antwortet, schreibt die Zeile am Ort um und
  liest die Liste nicht neu** (AP 9). Ein 204 sagt, dass der Zustand der
  bestellte ist; noch einmal zu lesen verschiebt die Seite unter einem Daumen,
  der gerade die nächste Zeile drücken will. Währenddessen liegt die Id in
  einem `busy`-Set, damit zwei Antippen nicht zwei Anfragen werden.

Siehe auch: [Browsersuiten und E2E-Tests](e2e-tests.md), [Mehrsprachigkeit und Katalog](i18n.md), [Whitelabel und PWA](whitelabel-pwa.md).

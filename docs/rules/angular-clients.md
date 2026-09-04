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
  neu** — `i18n.locale()` im `effect()`, nicht in `load()`.
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

Siehe auch: [Browsersuiten und E2E-Tests](e2e-tests.md), [Mehrsprachigkeit und Katalog](i18n.md), [Whitelabel und PWA](whitelabel-pwa.md).

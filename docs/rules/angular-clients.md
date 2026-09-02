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
- **Ein Client-Test, der Dateien liest, braucht `"node"` in
  `tsconfig.spec.json`** (Iconliste gegen `public/`, Manifest-Adresse gegen
  `index.html`).
- **Client-Start-Sequenz:** erst Konfiguration (Design + aktivierte Module) laden,
  dann Theming anwenden, dann die Plug-in-Webkomponenten laden.

Siehe auch: [Browsersuiten und E2E-Tests](e2e-tests.md), [Mehrsprachigkeit und Katalog](i18n.md), [Whitelabel und PWA](whitelabel-pwa.md).

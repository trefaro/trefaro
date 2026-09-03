# Ausgehende Mail

Wie diese Anwendung Mail verschickt und was dabei nicht verhandelbar ist.

Eine Mail ist raus — sie lässt sich nicht neu laden. Deshalb ist hier
mehr in Typen und Konstanten gegossen als anderswo, und der Rückfall greift
gröber als in der Oberfläche.

- **Der Double-Opt-In ist der Einwilligungsnachweis.** Das Token ist signiert,
  nicht gespeichert (F23, inzwischen drei Tokenzwecke). Bestätigen kann nur der
  Mensch hinter der Adresse — ein Veranstalter darf stornieren und
  wiederherstellen, **nicht** bestätigen (F31). Die Gültigkeitsdauer kommt aus
  `CONFIRMATION_TOKEN_TTL_MS`, nicht aus dem Katalogtext (F85): „14 Tage" als
  Prosa in zwei Sprachen hätte beim nächsten Wechsel zweimal gelogen.
- **`contact_opt_out` stoppt Einladungen, nicht transaktionale Mail** (F59).
  Bestätigung, Empfangsbestätigung und Stornohinweis gehen unabhängig davon raus.
  Der **Stornohinweis** nur, wenn der **Veranstalter** eine **bestätigte**
  Anmeldung storniert; Selbstabsage und Wiederherstellen schicken nichts —
  deshalb hat `setStatus` einen `actor`, nicht als Berechtigung, sondern damit
  diese Entscheidung an der Aufrufstelle sichtbar ist.
- **Keine Schnittstelle nimmt eine E-Mail-Adresse an, um etwas hinzuschicken**
  (F55). Die Adresse kommt beim Verfassen über den Fremdschlüssel. **Das
  Kontaktformular ist keine Ausnahme:** die Adresse, die ein Gast tippt, wird
  auf dem Gespräch gespeichert und in die Benachrichtigung an die Organisation
  **geschrieben**, damit ein Mensch sie liest — geschickt wird an sie nichts
  (F172). **AP 10 antwortet dorthin, und zwar über die Zeile des Gesprächs** — siehe die achte Mail unten.
- **Eine immer gleiche Antwort braucht eine Mail, die den Unterschied trägt**
  (E32). Das Registrierungsformular für ein Konto antwortet identisch, ob die
  Adresse unbekannt, unbestätigt oder längst in Benutzung ist — den Unterschied
  erfährt nur das Postfach: entweder der Bestätigungslink oder „es gibt schon ein
  Konto" (ohne Token, ohne Wirkung). Daraus folgt eine Regel, die man leicht
  bricht: **auch der Fehlschlag muss gleich aussehen.** Ein 503 bei
  unerreichbarem Mailserver für die eine und ein 200 für die andere Adresse wäre
  genau die Auskunft, die das Formular nicht geben darf.
- **Die Texte kommen aus demselben Katalog wie die Oberfläche** (38 Schlüssel
  unter `mail.`, acht Mails). Je Mail **ein** `MailTemplate` aus Schlüsselliste
  **und** Renderer (F87) — eine daneben geführte Liste driftet, und dann prüft E24 die
  falsche Menge.
- **Die Einheit des Rückfalls ist eine Mail** (E24, F87), nicht der Katalog und
  nicht ein Schlüssel: wer die drei Anmeldemails übersetzt hat und die Einladung
  nicht, schickt drei deutsche und eine englische.
- **Die Sprache gehört dem Empfänger, wenn er eine gewählt hat** (F125).
  `MailCatalogue.strings(keys, to)` fragt `ProfileDirectory.localeFor` — die
  Kette ist **Empfänger → Vorgabe der Instanz → Englisch**, und der Sprung nach
  Englisch ist Absicht: wer Swahili gewählt hat, liest das Deutsch der
  Organisation nicht, und die Vorgabe wäre ein zweites Raten. Auch ein
  **unbestätigtes** Konto zählt; die einzige Mail, die es je bekommt, ist seine
  eigene Bestätigung, und die Sprache stand einen Augenblick vorher auf dem
  Formular.
- **Der Inhalt folgt der Sprache des Briefes, nicht umgekehrt** (F125). E24 kann
  die Sprache noch kippen, also darf ein Absender seinen Kontext **nicht** vorher
  bauen: `MailService` nimmt `MailContent<T>` — einen Kontext **oder** eine
  Funktion, die mit der endgültigen Sprache aufgerufen wird. Wer einen Eventtitel
  in eine Mail schreibt, holt ihn in dieser Funktion (`events.locate(id, locale)`),
  sonst steht der deutsche Titel im englischen Brief. Ein Stapelversand löst **je
  Sprache** einmal auf, nicht je Empfänger; die Worte des Veranstalters bleiben
  unübersetzt.
- **Eine Mail an die Organisation ist die siebte, und sie ist anders** (F172).
  Die Benachrichtigung über eine Kontaktanfrage (FR 3.4, UC 14) geht an die
  **Kontaktadresse der Reihe** — die Adresse, die die Reihenseite schon
  öffentlich zeigt —, sonst an die Mailbox aus `SMTP_FROM` (ohne Anzeigenamen),
  und dann sagt eine Logzeile, dass die Reihe keine hat. **Nicht** an die
  Adressen der Administratorkonten: ein Login ist kein gemeinsam gelesenes
  Postfach. Ihre Sprache ist die **Vorgabe der Instanz**, weil der Empfänger
  kein Konto hat (F125). Sie **grüßt niemanden** — die einzige Mail ohne
  `mail.greeting`, denn ein geteiltes Postfach hat keinen Vornamen. Und der
  Text darin ist der einzige in diesem Verzeichnis, den ein **Fremder**
  geschrieben hat: er wird maskiert wie die Absätze einer Einladung.
- **Eine Benachrichtigung, die nicht Teil des Vorgangs ist, lässt den Vorgang
  nicht scheitern** (F172, E10). Beim Double-Opt-In ist die Mail der Vorgang,
  also ist ein unerreichbarer Mailserver dort ein **503**. Bei der
  Kontaktanfrage ist die Mail eine Abkürzung — der Datensatz ist das Gespräch
  und schon geschrieben —, also wird der `MailDeliveryError` protokolliert und
  die Antwort bleibt **202**. Zwei Gründe, und beide zählen: ein 503 wäre eine
  Auskunft, die dieses Formular nicht geben darf, und ein zweiter Versuch wäre
  eine zweite Anfrage. **An den Gast selbst geht keine Mail** — damit landet der
  einzige Brief, den ein anonymer Aufrufer auslösen kann, im eigenen Postfach
  der Organisation.
- **Die achte Mail ist die Antwort auf die siebte, und sie ist die einzige, die
  ein Veranstalter schreibt** (F11, F174). Sie geht an `guest_email` — die
  Adresse **von der Zeile des Gesprächs**, nie eine, die ein Aufrufer mitgibt
  (F55) —, grüßt mit dem Namen, den der Gast getippt hat, trägt den Event-Block
  und **keinen Handlungsknopf**: die einzige sinnvolle Adresse ist die
  Veranstaltungsseite, und die verlinkt der Block schon. Die Worte des
  Veranstalters werden maskiert wie die einer Einladung. Ihre Sprache ist die
  Vorgabe der Instanz, weil der Empfänger kein Konto hat — es sei denn, die
  Adresse hat doch eines, dann bekommt sie die gewählte (F125 ist die Regel,
  nicht ihre Ausnahme).
- **Hier muss ein Fehlschlag sichtbar sein** (F174), und das ist die Umkehrung
  der Regel eine Zeile höher. Bei der Benachrichtigung darf man ihn nicht sehen,
  weil das Formular keine Auskunft geben darf (E10); bei der Antwort **muss**
  man ihn sehen, sonst glaubt der Veranstalter, er habe jemandem geantwortet,
  der nie etwas gehört hat. Deshalb: **erst speichern, dann senden**, und
  `delivery` (`none` | `sent` | `failed`) reist in der Antwort des Endpunkts
  mit. Ein zweiter Versuch ist eine zweite Zeile.
- **In den Katalog wandern Sätze, nie die Auszeichnung um sie herum** (F86).
  `<div>`, `<p>`, `<strong>` und der Link bleiben Code. Daraus die Reihenfolge:
  **erst den Katalogtext maskieren, dann interpolieren** — Platzhalter überstehen
  das Maskieren, ein zuerst eingesetzter Wert wäre doppelt maskiert.
- **Text- und HTML-Teil sind zwei Darstellungen eines Satzes** (F88). Derselbe
  Schlüssel ist Linkbeschriftung und Zeile über der nackten Adresse; der
  Doppelpunkt dazwischen ist `mail.actionLine` und kein Zeichen im Code
  (Französisch setzt `Label :`).
- **`Html` ist ein Typ, kein Kommentar** (F92). Alles, was Auszeichnung baut, gibt
  ihn zurück; alles, was sie annimmt, verlangt ihn; die einzige Tür von `string`
  dorthin ist `escapeHtml`.
- **Welche Sprachen Mail können, wird gefragt, nicht importiert** (F89):
  `MailCatalogue.localesForMail()`, und streng — eine Sprache zählt nur, wenn sie
  **jede** Mail abdeckt. `SetupModule` importiert dafür `MailModule`.
- **Ein regionaler Tag ist eine eigene Sprache** (F90): kein Rückfall `de-AT` →
  `de`; zwei Antworten hätten englische Oberfläche mit deutscher Mail ergeben.
- **Ein Platzhalter, den niemand füllt, bleibt in einer Mail stehen** (F91) —
  anders als auf einem Bildschirm. `{{tage}}` ist meldbar, eine Lücke nicht.
- **`defaultLocale` schreibt nur die Ersteinrichtung** (`setLocales` als eigene
  Port-Methode, nicht `save`): `AppConfigChange` ist der Rumpf der Design-Seite,
  und die Sprache jeder ausgehenden Mail darf dort nicht mitreisen.
- **Nachweis ist `tools/spike-verification/verify-mail.mjs`** gegen Mailpit: es
  registriert, bestätigt, storniert und lädt ein, liest die vier Mails, ändert
  einen Betreff über die API und prüft ihn an der **nächsten** Mail, und stellt
  die Instanz auf eine halb übersetzte Sprache, um E24 zu zeigen.

Siehe auch: [Mehrsprachigkeit und Katalog](i18n.md), [Bestätigte Zuschnitt-Entscheidungen](decisions.md).

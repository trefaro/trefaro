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
  (F55). Die Adresse kommt beim Verfassen über den Fremdschlüssel.
- **Die Texte kommen aus demselben Katalog wie die Oberfläche** (21 Schlüssel
  unter `mail.`). Je Mail **ein** `MailTemplate` aus Schlüsselliste **und**
  Renderer (F87) — eine daneben geführte Liste driftet, und dann prüft E24 die
  falsche Menge.
- **Die Einheit des Rückfalls ist eine Mail** (E24, F87), nicht der Katalog und
  nicht ein Schlüssel: wer die drei Anmeldemails übersetzt hat und die Einladung
  nicht, schickt drei deutsche und eine englische.
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

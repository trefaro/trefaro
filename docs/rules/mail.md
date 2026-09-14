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
- **Die Texte kommen aus demselben Katalog wie die Oberfläche** (53 Schlüssel
  unter `mail.`, elf Mails). Je Mail **ein** `MailTemplate` aus Schlüsselliste
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
- **Die neunte Mail grüßt niemanden, und das ist die Regel und nicht die
  Ausnahme** (F181, E45). Der Double-Opt-In einer Newsletter-Anmeldung hat
  keinen Namen zu grüßen, weil das Formular keinen erfragt (F42) — „Liebe
  Abonnentin" wäre ein Gruß an jemanden, den die Instanz nicht kennt. Sie sagt
  stattdessen, **worum** es geht (Instanz oder eine Reihe, in der Sprache des
  Briefes aufgelöst) und dass **ohne den Klick nichts passiert**: ein
  öffentliches Formular nimmt jede Adresse an, also kann dieser Brief jemanden
  erreichen, der nie etwas wollte.
- **Es gibt keine zehnte Mail für „du stehst schon auf der Liste"** (F181). E32s
  Muster — die immer gleiche Antwort braucht eine Mail, die den Unterschied
  trägt — gilt hier mit einer Einschränkung: ein solcher Brief hätte nichts
  enthalten, was man tun kann (es gibt keinen Selbstabmelde-Link, F183). Also
  sagt das **Formular** von sich aus, dass eine Mail nur kommt, wenn die Adresse
  noch nicht dabei ist, und der Unterschied bleibt unsichtbar, ohne dass ein
  Brief erfunden wird.
- **Eine Anmeldung ohne Konto speichert keine Sprache** (F181, F125). Es gibt
  keine Zeile, auf der eine stünde, und keinen zweiten Brief, der sie benutzen
  würde — also entscheidet die Kette von F125: Empfänger (falls die Adresse ein
  Konto hat), sonst die Vorgabe der Instanz. Das Formular schickt **kein**
  `preferredLocale`; ein Feld, das eine Mail entscheidet und danach verschwindet,
  wäre ein Feld, das nichts liest.

- **Die zehnte und die elfte Mail gehören zusammen, und die elfte ist die
  Begründung der zehnten** (F210, E10, E32). „Passwort vergessen" schickt an
  eine bestätigte Adresse den Rücksetz-Link, an eine **unbestätigte** noch
  einmal die Kontobestätigung (der fehlende Schritt ist die Bestätigung, nicht
  das Passwort) und an eine **unbekannte** den Satz, dass es hier kein Konto
  gibt. Der dritte Brief ist kein Luxus: nur weil es ihn gibt, kostet jede
  Anfrage dasselbe Mailserver-Gespräch, und erst damit verrät auch die Laufzeit
  der Antwort nichts. F181 („keine zehnte Mail für ‚du stehst schon auf der
  Liste'") widerspricht nicht — dort hätte der Brief nichts enthalten, was man
  tun kann, hier schon: die richtige Adresse suchen oder ein Konto anlegen.
- **Die elfte Mail grüßt niemanden, und zwar aus dem umgekehrten Grund wie die
  neunte** (F210). Die Newsletter-Bestätigung kennt keinen Namen, weil das
  Formular keinen erfragt; diese kennt keinen, weil es zu der Adresse **keine
  Zeile gibt**. Sie trägt auch kein Token — es gibt nichts zu autorisieren.
- **Ein Brief, dessen Link ein Konto übergibt, sagt zwei Dinge mehr** (F209):
  wie lange der Link gilt (als Parameter, wie die vierzehn Tage aus F85 — hier
  in **Minuten**, weil die Zahl ein Parameter ist und „1 Stunde" eine
  Pluralform bräuchte, die ein Mailkatalog nicht hat), und dass ohne Klick
  nichts passiert. Das zweite, weil ein öffentliches Formular jede Adresse
  annimmt: dieser Brief kann jemanden erreichen, der nichts wollte.
- **Die Mail bei wiederholter Registrierung zeigt seit AP 4 der Phase 5 auf die
  Wiederherstellung** (F210). Vorher stand dort „es gibt schon ein Konto" und
  sonst nichts — für den wahrscheinlichsten Leser, jemanden, der nicht
  hineinkommt, war das eine Sackgasse mit Briefmarke.

- **Verschlüsselt wird nicht nach Gutdünken der Leitung, sondern auf Verlangen**
  (E62). Zwei Formen, und eine Instanz benutzt genau eine: `SMTP_SECURE=true`
  ist implizites TLS ab dem ersten Byte (Port 465), `SMTP_REQUIRE_TLS=true` ist
  STARTTLS, **das stattfinden muss** (Port 587, 25). Die Vorgabe von
  `SMTP_REQUIRE_TLS` ist `true` in Produktion und `false` sonst — die einzige
  umgebungsabhängige Vorgabe in `env.ts`, und der Grund steht in `core/config/
smtp.ts`: der Mailpit des Entwicklungsstacks hat kein Zertifikat, und eine
  Vorgabe, die `nx serve` das Mailen unmöglich macht, ist eine Vorgabe, die
  jemand einmal abschaltet und nie wieder anschaltet. `SMTP_SECURE=true` auf
  Port 587 ist **keine** stärkere Einstellung, sondern ein anderes Protokoll auf
  dem falschen Port: es wird nichts versendet. Genau so stand es bis AP 3 der
  Phase 5 als Vorgabe in `infra/docker-compose.yml`.
- **Ein Zertifikat wird benannt, die Prüfung nie abgeschaltet** (E62).
  `NODE_EXTRA_CA_CERTS` zeigt auf die Datei, `infra/ca/` ist der Ort dafür, und
  es gibt in diesem Repository keine Zeile `rejectUnauthorized: false` — ein
  Unit-Test in `smtp-mailer.spec.ts` wird rot, wenn jemand eine schreibt. Der
  Unterschied ist nicht Geschmack: ein abgeschalteter Test gilt für **jede**
  Verbindung dieses Prozesses, für immer, und niemand sieht ihm an, welches
  Problem er einmal gelöst hat. Beweis in beide Richtungen ist
  `tools/secure-mail/`: mit benanntem Zertifikat geht die Mail durch, ohne es
  lehnt schon die Verbindung ab.
- **Zwischen zwei Mails wird gewartet, und wie lange, entscheidet die
  Organisation** (`SMTP_PAUSE_BETWEEN_MAILS_MS`, Vorgabe eine Sekunde). Zwei
  Sender gibt es nicht — nur die Einladung schickt Briefe hintereinander (F56) —,
  aber der Grund gehört zum Mailserver und nicht zur Einladung: zweihundert
  Nachrichten in zwanzig Sekunden beantwortet ein geteilter Maildienst mit
  Drosselung, im schlimmeren Fall mit einer Sperre der Domain, auf der die
  Organisation auch **empfängt**. Eine **verkürzte** Pause steht im Startlog, so
  wie ein erhöhter Grenzwert (E60) — die gefährliche Richtung ist hier die
  kleinere Zahl.
- **„Jetzt nicht" ist nicht „nie"** (F207). Eine 4xx-Antwort des Mailservers
  bekommt **einen** zweiten Versuch nach dem Zehnfachen der Pause; eine
  5xx-Antwort und ein Verbindungsfehler bekommen keinen. Die Unterscheidung
  fällt am Port (`TemporaryMailFailure` in `ports/mailer.ts`), weil „eine Zahl
  zwischen 400 und 499" SMTP-Wissen ist und in der Geschäftsschicht nichts zu
  suchen hat; gelesen wird sie von genau einem Aufrufer, dem Einladungsversand.
  **Ein Verbindungsfehler ist bewusst ausgenommen**: ein Mailserver, der liegt,
  lehnt zweihundert Empfänger nacheinander ab, und ein zweiter Versuch je
  Empfänger macht aus einem Ausfall den doppelten Ausfall — die Zeilen bleiben
  ohnehin `pending` und werden beim nächsten Start weitergeschickt.
- **Die Einladung ist die einzige Mail mit einer Kopfzeile** (F208, RFC 8058).
  `List-Unsubscribe` und `List-Unsubscribe-Post` werden **von der Vorlage**
  geschrieben, nicht vom Absender: die Kopfzeile und der Link im Fußtext sind
  derselbe Widerspruch für dieselbe Person, und zwei Stellen wären zwei
  Meinungen. Das ist keine Höflichkeit — Gmail und Outlook gewichten das Fehlen
  der Kopfzeile, und eine Einladung im Spam-Ordner hat einen Widerspruchslink,
  den niemand sieht. Der Endpunkt dahinter nimmt einen nackten `POST` an und hat
  **eigene** Begründung gegen E5b (`api-contracts.md`), keine Kopie der
  Abmeldeseite.
- **Zustellbarkeit steht nicht in diesem Verzeichnis** (E63). SPF, DKIM, DMARC,
  Reverse-DNS und die Frage „Posteingang oder Spam" hängen an den DNS-Einträgen
  der Organisation, und keine Suite dieses Repositories kann sie beantworten.
  Sie sind eine Prüfliste in `docs/INSTALL.md` (Abschnitt 7.3) und bleiben es.

Siehe auch: [Mehrsprachigkeit und Katalog](i18n.md), [Bestätigte Zuschnitt-Entscheidungen](decisions.md), [Deployment und Prüfung](deployment.md).

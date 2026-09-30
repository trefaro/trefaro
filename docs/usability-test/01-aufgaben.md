# Das Skript

Drei Teile: die **sieben Aufgaben der Thesis** (Teil A), die
**Anwendungsfälle, die sie nie getestet hat** (Teil B), und der **Abschluss**
(Teil C). Teil A wird vollständig gefahren, aus Teil B werden vier Aufgaben
gewählt, Teil C ist in jeder Sitzung gleich.

Jede Aufgabe hat eine **Rolle** (Teilnehmende Person oder Veranstalter\*in), ein
**Gerät** und eine **Startseite**, auf der der Browser steht, bevor vorgelesen
wird. Die Startseite wird eingerichtet, bevor die Person den Bildschirm sieht —
niemand soll beim Eintippen einer URL zuschauen müssen.

## Teil A — die sieben Aufgaben der Thesis

Die Thesis hat 2024 interaktive Mockups mit drei Fachleuten getestet, in sieben
Aufgaben, bewertet auf einer Skala von 1 bis 4. Das Ergebnis war überwiegend
4/4, und die einzige gefundene Korrektur war: **die E-Mail-Adresse muss in der
Teilnehmerübersicht sichtbar sein.** Sie ist umgesetzt — und Aufgabe A6 ist
dieselbe Aufgabe, an der sie gefunden wurde.

> **Bevor der Test läuft, einmal gegen Kapitel 6 der Thesis prüfen.** Die Thesis
> selbst liegt bewusst nicht in diesem Repository (Entscheidung vom 26.08.2026 —
> Diagramme und Mockups reichen als Referenz für die Umsetzung). Wörtlich
> festgehalten ist hier nur **Aufgabe 4**: „Interessent ohne Teilnehmerstatus
> kontaktiert Veranstalter". Die übrigen sechs sind aus dem
> **Use-Case-Diagramm**, den **vier Mockup-Bögen** und der einen dokumentierten
> Korrektur rekonstruiert. Sie treffen die Anwendungsfälle; ob sie den Wortlaut
> von 2024 treffen, kann nur die Thesis sagen — und genau davon hängt ab, ob die
> Zahlen mit 2024 vergleichbar sind. Zwei Kandidaten wurden erwogen und nicht
> genommen: **„Anwendung konfigurieren"** (Farben, Logo, Schrift — steht jetzt
> als B8 in Teil B) und **„Profil erstellen"** (2024 gab es noch keinen
> Teilnehmer-Login — steht als B1). Wenn Kapitel 6 einen davon führt, wird er
> getauscht und die Nummerierung mitgezogen.

### A1 · Was ist das hier, und wann ist das nächste Mal?

**Rolle** Teilnehmende Person · **Gerät** Telefon · **Start** die Startseite der
Instanz

> „Du hast von Bekannten gehört, dass es hier eine Reihe von Bürgerräten gibt.
> Finde heraus, worum es geht und wann die nächste Veranstaltung ist."

**Gelöst, wenn** die Person auf der Event-Seite von „Bürgerrat Klima — Sitzung
3" steht und Datum und Ort benennen kann.

**Worauf zu achten ist:** Wird die Reihe oder direkt das Event angesteuert?
Wird die Kachelreihe auf der Event-Seite als Inhaltsverzeichnis gelesen oder
übersehen? Fällt auf, dass eine der drei Reihen (Jugendforum 2027) öffentlich
nicht zu sehen ist — und stört das?

### A2 · Anmelden

**Rolle** Teilnehmende Person · **Gerät** Telefon · **Start** wo A1 geendet hat

> „Melde dich für diese Veranstaltung an. Du kommst vor Ort und isst vegetarisch."

**Gelöst, wenn** das Formular abgeschickt ist **und** die Person die
Bestätigungsmail im Briefkasten geöffnet und den Link angeklickt hat.

**Worauf zu achten ist:** Wird der Anmeldeknopf gefunden (er steht nicht ganz
oben)? Wie werden Pflichtfelder wahrgenommen? Was passiert beim Feld
„Visa-Dokument" — wird es als optional erkannt? **Und vor allem: rechnet die
Person damit, dass nach dem Absenden noch etwas kommt?** Double-Opt-In ist der
Schritt, an dem Anmeldungen in der Praxis verloren gehen.

### A3 · Den eigenen Tag planen

**Rolle** Teilnehmende Person · **Gerät** Telefon · **Start** die
Bestätigungsseite aus A2

> „Am ersten Tag laufen zwei Arbeitsgruppen parallel. Sichere dir einen Platz in
> der, die dich interessiert."

**Gelöst, wenn** die Person für eine der beiden Arbeitsgruppen angemeldet ist —
oder erkannt hat, dass „Arbeitsgruppe B" voll ist und deshalb A gewählt hat.

**Worauf zu achten ist:** Wird der Weg über den persönlichen Link aus der Mail
gefunden, oder wird er auf der öffentlichen Seite gesucht? Ist „4 von 4 Plätzen
belegt" als _voll_ lesbar? Wird der Unterschied zwischen „für die Veranstaltung
angemeldet" und „für diesen Programmpunkt angemeldet" verstanden?

### A4 · Ohne Anmeldung eine Frage stellen

**Rolle** Interessierte Person **ohne** Anmeldung · **Gerät** Telefon ·
**Start** die Event-Seite, in einem **privaten Fenster**

_Die einzige Aufgabe, deren Wortlaut aus der Thesis belegt ist: „Interessent
ohne Teilnehmerstatus kontaktiert Veranstalter"._

> „Du überlegst noch, ob du kommst, und willst vorher wissen, ob der Ort
> barrierefrei ist. Frag nach — ohne dich anzumelden."

**Gelöst, wenn** die Nachricht abgeschickt ist.

**Worauf zu achten ist:** Wird das Kontaktformular gefunden, oder wird erst eine
Anmeldung versucht? Ist klar, dass die Antwort per E-Mail kommt und nicht auf der
Seite erscheint? Sucht jemand nach einer Telefonnummer?

### A5 · Ein Event anlegen und sein Programm planen

**Rolle** Veranstalter\*in · **Gerät** Laptop · **Start** die Übersicht der
Veranstaltungsreihen im Veranstalter-Client

> „Es kommt eine vierte Sitzung dazu, am 12. März 2027. Leg sie an und trag zwei
> Programmpunkte ein — eine Begrüßung und eine Arbeitsgruppe mit begrenzter
> Platzzahl."

**Gelöst, wenn** Event und beide Programmpunkte gespeichert sind und die
Arbeitsgruppe eine Kapazität hat.

**Worauf zu achten ist:** Wird der Unterschied zwischen _Entwurf_ und
_veröffentlicht_ verstanden? Wird die Mehrsprachigkeit der Felder als Aufwand
empfunden oder als Angebot? Wo wird das Programm gesucht — auf dem Event oder in
einer eigenen Ansicht?

### A6 · Wer hat sich angemeldet, und eine Person erreichen

**Rolle** Veranstalter\*in · **Gerät** Laptop · **Start** das Dashboard von
„Bürgerrat Klima — Sitzung 3"

_Dies ist die Aufgabe, an der 2024 die einzige Korrektur gefunden wurde._

> „Eine Person hat angerufen und gefragt, ob ihre Anmeldung angekommen ist. Sie
> heißt Moretti. Finde sie, sag mir ihren Status — und schreib ihr eine Mail."

**Gelöst, wenn** die Zeile gefunden ist, der Status genannt wird (_pending_) und
die E-Mail-Adresse **aus der Tabelle heraus** benutzt wird.

**Worauf zu achten ist:** **Wird die E-Mail-Adresse in der Tabelle gesehen, oder
wird sie im Detail gesucht?** Das ist die Nachprüfung der Korrektur von 2024, und
sie ist der wichtigste einzelne Befund dieses Teils. Außerdem: werden die vier
Zustände (bestätigt, offen, storniert) auseinandergehalten?

### A7 · Die Ehemaligen einladen

**Rolle** Veranstalter\*in · **Gerät** Laptop · **Start** die Reihenansicht von
„Bürgerräte für Europa"

> „Die Leute von der Auftaktkonferenz sollen von der neuen Sitzung erfahren. Lade
> sie ein."

**Gelöst, wenn** die Einladung abgeschickt ist und die Person im Briefkasten
sieht, dass sie herausgegangen ist.

**Worauf zu achten ist:** Wird gefunden, dass die Empfänger aus einer früheren
Veranstaltung kommen? Ist erkennbar, dass eine Einladung **langsam** verschickt
wird und eine Weile läuft? Wird bemerkt, dass eine Person (Bergström) bereits
widersprochen hat und deshalb nicht mehr angeschrieben wird?

## Teil B — was die Thesis nie getestet hat

Konten, Profile, Teilnehmersuche, Chat und fünf Plug-ins sind nach 2024
entstanden. Sie sind aus derselben Anforderungsanalyse abgeleitet, aber
**abgeleitet ist nicht geprüft** — hier wird zum ersten Mal jemand darauf
losgelassen, der sie nicht gebaut hat.

**Vier je Sitzung**, nach dieser Rotation, damit über vier Sitzungen jede Aufgabe
zweimal drankommt:

| Sitzung | Aufgaben             |
| ------- | -------------------- |
| 1       | B1, B2, B5, B9       |
| 2       | B3, B4, B6, B10      |
| 3       | B1, B7, B8, B2       |
| 4       | B5, B6, B9, B3       |
| 5 / 6   | frei, nach Interesse |

Wer Veranstaltungen organisiert, bekommt eher B5–B9; wer teilnimmt, eher B1–B4
und B10.

### B1 · Ein Konto machen und entscheiden, wer dich findet

**Rolle** Teilnehmende Person · **Gerät** Telefon · **Start** die Startseite

> „Leg dir hier ein Konto an und fülle dein Profil aus. Entscheide dabei selbst,
> ob andere dich in der Community finden können sollen."

**Gelöst, wenn** das Konto bestätigt, das Profil gefüllt und der Schalter
_auffindbar_ bewusst gesetzt ist — in welche Richtung auch immer.

**Worauf zu achten ist:** **Wird der Schalter überhaupt bemerkt, und wird
verstanden, was er tut?** Er entscheidet zugleich, ob man gefunden _und_ ob man
angeschrieben werden kann. Wenn das nicht ankommt, ist es der schwerste Befund
dieses Tests — hier geht es um Aktivistendaten.

### B2 · Jemanden finden und anschreiben

**Rolle** Teilnehmende Person · **Gerät** Telefon · **Start** angemeldet, auf der
Profilseite

> „Du suchst jemanden, der sich mit Verkehr beschäftigt, und willst ihm eine
> Frage stellen."

**Gelöst, wenn** ein Gespräch mit Dimitris Papadakis eröffnet und eine Nachricht
abgeschickt ist.

**Worauf zu achten ist:** Welches der beiden Suchfelder wird benutzt? Wird
erwartet, dass alle Teilnehmenden auffindbar sind — und wie wird
aufgenommen, dass es nur sieben von zehn sind?

### B3 · Im Forum mitlesen und antworten

**Rolle** Teilnehmende Person · **Gerät** Telefon · **Start** die Event-Seite,
angemeldet

> „Andere haben sich schon über die Anreise ausgetauscht. Schau nach und schreib
> dazu, wie du kommst."

**Gelöst, wenn** ein Beitrag in einem bestehenden Thema geschrieben ist.

**Worauf zu achten ist:** Wird das Forum auf der Event-Seite gefunden? **Und
was passiert, wenn der eigene Beitrag nach dem Absenden nicht sofort für andere
sichtbar ist** — wird der Freigabe-Workflow verstanden oder für einen Fehler
gehalten?

### B4 · Einen Programmpunkt vorschlagen

**Rolle** Teilnehmende Person · **Gerät** Telefon · **Start** die Event-Seite,
angemeldet

> „Du hast eine Idee für eine Session und möchtest sie vorschlagen."

**Gelöst, wenn** der Vorschlag eingereicht ist.

**Worauf zu achten ist:** Ist der Unterschied zwischen _Programmvorschlag_ und
_Forumsbeitrag_ klar, oder wirken die beiden austauschbar? Wird erwartet, dass
über den Vorschlag entschieden wird, und ist sichtbar, dass er noch offen ist?

### B5 · Die Warteschlange abarbeiten

**Rolle** Veranstalter\*in · **Gerät** Laptop · **Start** das Event-Dashboard

> „Seit gestern ist einiges reingekommen. Geh durch, was auf eine Entscheidung
> wartet."

**Gelöst, wenn** die zwei offenen Forumsbeiträge und die zwei offenen
Programmvorschläge entschieden sind.

**Worauf zu achten ist:** Werden beide Warteschlangen gefunden — sie sind zwei
getrennte Abschnitte? Ist klar, was ein _Freigeben_ bewirkt (der Beitrag wird
sichtbar; ein Vorschlag wird veröffentlicht, aber **nicht** zum Programmpunkt)?
Wird eine Ablehnung als endgültig empfunden?

### B6 · Räume verteilen und das finden, was nicht passt

**Rolle** Veranstalter\*in · **Gerät** Laptop · **Start** das Event-Dashboard

> „Die Räume sind eingetragen. Schau, ob der Plan aufgeht."

**Gelöst, wenn** die Person **von selbst** darauf stößt, dass Seminarraum 1 fünf
Plätze hat und die Arbeitsgruppe darin sieben Anmeldungen — und sagt, was sie
dagegen tun würde.

**Worauf zu achten ist:** Wird die Warnung gesehen, ohne dass jemand darauf
zeigt? Wird erwartet, dass die Anwendung die Überbuchung **verhindert**, statt
sie nur anzuzeigen? Wird der Weg zur Behebung gefunden (Raum tauschen, Kapazität
ändern, zweiten Raum dazunehmen)?

### B7 · Jemanden am Einlass einlassen

**Rolle** Veranstalter\*in · **Gerät** Laptop · **Start** das Event-Dashboard

> „Hier ist ein Code von einem Ticket. Lass die Person ein — und dann noch
> einmal dieselbe."

Der Code wird vom Testteam vorbereitet: im Teilnehmer-Client unter _Meine
Anmeldung_ steht er, oder er wird aus dem Briefkasten geholt.

**Gelöst, wenn** die Person eingecheckt ist und die zweite Eingabe als _schon
da_ erkannt wird.

**Worauf zu achten ist:** Ist die zweite Antwort als „schon eingecheckt" und
nicht als Fehler lesbar? Wäre das am Einlass unter Zeitdruck schnell genug?
(Die **Kamera** ist nicht Teil dieser Aufgabe — sie ist eine Zeile der
Gerätematrix.)

### B8 · Die Organisation sichtbar machen

**Rolle** Veranstalter\*in · **Gerät** Laptop · **Start** die Einstellungen

> „Eure Hausfarbe ist ein anderes Blau. Stell die Anwendung darauf ein und schau
> dir das Ergebnis an."

**Gelöst, wenn** die Farbe geändert ist und die Person das Ergebnis in **beiden**
Clients gesehen hat.

**Worauf zu achten ist:** Wird erwartet, dass die Änderung sofort wirkt?
Wird die Warnung zum Kontrast verstanden? Wird gesucht, wo man ein Logo
hochlädt — und wird der Unterschied zwischen Instanz-Logo und Reihen-Logo
erwartet?

### B9 · Ein Wort korrigieren

**Rolle** Veranstalter\*in · **Gerät** Laptop · **Start** die Spracheinstellungen

> „Ihr sagt nicht ‚Teilnehmende', ihr sagt ‚Mitwirkende'. Ändere das."

**Gelöst, wenn** der Begriff in der Oberfläche geändert ist und die Person das im
Teilnehmer-Client nachgesehen hat.

**Worauf zu achten ist:** **Wird überhaupt erwartet, dass das geht?** Die meisten
Anwendungen können es nicht. Wird der Schlüssel gefunden, den man ändern muss —
und ist das Suchen darin zumutbar? Wird der Weg über Export und Import
angesteuert?

### B10 · Das Konto wieder loswerden

**Rolle** Teilnehmende Person · **Gerät** Telefon · **Start** die eigene
Profilseite, angemeldet

> „Du willst hier nicht mehr dabei sein. Lösche dein Konto."

**Gelöst, wenn** das Konto gelöscht ist.

**Worauf zu achten ist:** Wird der Weg gefunden — und ist er zu leicht oder zu
schwer? Wird verstanden, **was bleibt**: Anmeldungen und Konto gehen, geschriebene
Nachrichten und Forumsbeiträge bleiben stehen und nennen niemanden mehr. Wird
das als richtig oder als Bruch eines Versprechens empfunden? Danach im Forum und
in der Suche nachsehen und die Reaktion notieren.

> Diese Aufgabe verbraucht ein Konto. Danach entweder ein neues anlegen (B1) oder
> die Instanz vor der nächsten Sitzung zurücksetzen —
> [03-instanz.md](03-instanz.md).

## Teil C — der Abschluss

Zehn Minuten, ohne Aufgabe, ohne Bildschirm. Wörtlich mitschreiben.

1. **„Würdet ihr eure nächste Veranstaltungsreihe darauf fahren?"** Und wenn
   nein: **was müsste vorher da sein?** Diese Antwort ist das wichtigste Ergebnis
   des ganzen Tests.
2. **„Was hat heute am meisten genervt?"** Nicht „was war schwierig" — genervt.
   Die Antworten sind andere.
3. **„Was habt ihr gesucht und nicht gefunden — egal ob es das gibt?"** Hier
   kommen die Funktionen heraus, die niemand in ein Anforderungsdokument
   geschrieben hat.

Und zum Schluss die Frage, die keine Antwort braucht, aber oft eine bekommt:
**„Gibt es noch etwas, das ich hätte fragen sollen?"**

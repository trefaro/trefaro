# 6 Laufzeitsicht

Fünf Abläufe, bei denen das Zusammenspiel der Bausteine mehr erklärt als ihre
Aufzählung. Die Laufzeitdiagramme der Thesis liegen unter
[`docs/thesis/diagramme/`](../thesis/diagramme/) —
`Laufzeitdiagramm Nutzer.png` und `Laufzeitdiagramm Veranstalter.png`.

## 6.1 Der Start eines Clients

Die Sequenz, die [Abschnitt 4.5](04-loesungsstrategie.md) trägt. Sie gilt für
beide Clients.

```
Browser            Client                     Server
  │  lädt App        │                          │
  │─────────────────▶│                          │
  │                  │ 1. GET /api/config ──────▶│
  │                  │◀── Farben, Logo, Schrift, │
  │                  │    Sprachen, aktive       │
  │                  │    Module, Plug-in-Liste  │
  │                  │                           │
  │                  │ 2. --trefaro-* auf :root schreiben
  │                  │                           │
  │                  │ 3. je Plug-in:            │
  │                  │    <script src=bundleUrl> ▶│
  │                  │    customElements.whenDefined(...)
  │                  │                           │
  │◀─ gezeichnet ────│                           │
```

Drei Dinge daran sind Entscheidungen, keine Reihenfolge:

- **Zuerst die Konfiguration, dann das Theming.** Andernfalls blitzt die
  Standardfarbe auf, bevor die der Organisation ankommt.
- **Der Client wartet nicht unbegrenzt.** Läuft `/api/config` in eine Zeitgrenze,
  zeichnet er ungethemt weiter — eine Instanz, die hängt, weil die API langsam
  ist, wäre schlechter als eine, die grau aussieht.
- **`customElements.whenDefined()` ist das Signal, nicht `load`.** Das
  `load`-Ereignis eines Modul-Skripts feuert auch dann, wenn das Modul beim
  Auswerten wirft. Nur die definierte Elementklasse bedeutet „das Plug-in ist
  benutzbar".

**Isolation:** Jedes Bündel wird in seinem eigenen `try`/`catch` geladen und als
`loading`, `ready` oder `failed` vermerkt. Eines, das 404 liefert, beim Auswerten
wirft oder sein Element nie definiert, wird übersprungen — die Anwendung startet
ohne es (NFR 10). Und der Fehlschlag ist **sichtbar**: die Modulverwaltung sagt
dem Veranstalter, warum das Forum, das er eingeschaltet hat, nicht erscheint.

## 6.2 Registrierung mit Double-Opt-In

```
Interessierte Person        Server                       Mailserver
  │  POST /api/user/registrations                          │
  │──────────────────────────▶│ validieren                 │
  │                           │ speichern (unbestätigt)    │
  │                           │ signierten Link bauen      │
  │                           │───── Mail mit Link ───────▶│
  │◀── 202 „sieh in dein Postfach" ─│                      │
  │                                                         │
  │  klickt den Link                                        │
  │──────────────────────────▶│ Signatur prüfen            │
  │                           │ Registrierung bestätigen   │
  │◀── Weiterleitung zur Profilerstellung ─│               │
```

Vier Eigenschaften, die man nicht ändern darf, ohne eine Entscheidung zu treffen:

- **Der Link ist signiert und trägt keinen Geheimzustand.** Er wirkt genau
  einmal, ohne dass dafür etwas gespeichert würde.
- **Die Antwort ist immer dieselbe**, egal ob die Adresse schon bekannt war —
  und sie braucht immer gleich lange, damit auch die Laufzeit nichts verrät.
- **Wer schon ein Profil hat, bestätigt nur die Registrierung** und wird nicht
  ein zweites Mal zur Profilerstellung geschickt.
- **Der Versand ist gedrosselt** — pro Absenderadresse und pro Empfängeradresse.
  Das ist der Grund, warum Einladungen an zweihundert Ehemalige langsam
  hinausgehen und eine vorübergehende Ablehnung einen zweiten Versuch bekommt.

## 6.3 Wie ein Plug-in an seinen Platz kommt

Der Ablauf hat zwei Hälften, die nichts voneinander wissen.

**Beim Start des Servers:** `CURATED_PLUGINS` ist eine **Liste, kein
Verzeichnisfund** — ein versehentlicher Ordner wird kein montiertes Plug-in. Der
Plug-in-Manager montiert jedes davon, die Datenzugriff-Schicht registriert
dessen Entities und hängt dessen Migrationen in den nach Zeitstempel geordneten
Strom. **Alle Tabellen existieren immer**, auch bei einem ausgeschalteten
Plug-in; der Schalter entscheidet nur, ob die API antwortet und ob die Clients
das Bündel laden. Deshalb ist „Forum einschalten" ein Klick und kein Neustart.

**Im Browser:** `/api/config` nennt für jedes eingeschaltete Plug-in den
Elementnamen, die Bündel-URL, die Einhängepunkte, den Beschriftungsschlüssel und
das Icon. Der Slot an einem Einhängepunkt erzeugt das Element **imperativ** —
der Tag-Name kommt aus der Konfiguration, also kann kein Template ihn nennen —
und schreibt die Werte als **Eigenschaften**, nicht als Attribute.

Jedes Element bekommt zusätzlich zu den Werten des Einhängepunkts drei Dinge,
die der Vertrag zusagt: `locale`, `strings` und `mountPoint`. Sie werden
**zuletzt** zugewiesen: ein Einhängepunkt darf dem Kontext hinzufügen, was er
will, aber nicht überschreiben, was der Vertrag verspricht.

**Ein Sprachwechsel weist neu zu, er montiert nicht neu.** Ein Bündel kann
Zustand halten, den ein Besucher hineingelegt hat — ein offener Thread, ein
halb geschriebener Vorschlag —, und den an einen Klick auf „Deutsch" zu
verlieren wäre eine seltsame Art, die Sprache zu ändern.

## 6.4 Chat: die Tür und die Räume

**Der Handshake ist die Tür, nicht das Ereignis.** socket.io führt die Middleware
einer Namespace aus, bevor die Verbindung existiert — eine Ablehnung erreicht den
Client also als `connect_error` und nicht als verbundener Socket, der alles
ignoriert. Die Alternative — beim ersten Ereignis prüfen — hieße: ein nicht
authentifizierter Socket sitzt auf dem Server, und jeder Handler müsste daran
denken zu fragen.

An der Tür wird zweierlei gefragt, in derselben Reihenfolge wie auf der
HTTP-Seite: **die Sitzung** (aus demselben Cookie und durch denselben Dienst wie
der Guard der Endpunkte) und **der `chat`-Schalter** (aus demselben Register wie
die Endpunkte). Ein Client, der keinen Chat anbietet, ist keine Zusicherung — ein
Socket ist der eine Teil dieser Anwendung, den man öffnen kann, ohne je eine
Seite davon geladen zu haben.

**Zwei Räume:** einer je Gespräch, dem man nur auf Aufforderung und nur als
Mitglied beitritt; einer je Mitglied, dem man bei Verbindungsaufbau beitritt —
ein Socket muss nicht darum bitten, über sich selbst informiert zu werden.

**Wer schon verbunden ist, bleibt verbunden**, wenn der Veranstalter den Chat
abschaltet — und wird wirkungslos, weil die Endpunkte, an denen man schreibt,
dann 404 antworten. Laufende Sockets zu trennen wäre die einzige Stelle dieser
Anwendung, an der ein ausgeschaltetes Modul jemandem mitten im Satz etwas
wegnähme.

## 6.5 Ein Mensch verlangt seine Löschung

Der Ablauf, der E65 ausbuchstabiert — und der einzige, bei dem **Löschen die
Regel ist und Archivieren die Ausnahme**.

1. Der Mensch fordert seinen **Export** an: ein Archiv mit allem, was diese
   Instanz über ihn hält, samt einem `README.txt`, das benennt, was **nicht**
   darin ist und welche Module diese Instanz eingeschaltet hat.
2. Er fordert die **Löschung** an. Das Profil verschwindet wirklich.
3. Was jemand anderes geschrieben hat, bleibt und **trägt keinen Namen mehr**:
   ein Forum-Thread überlebt seinen Eröffner, ein Gespräch behält die
   Nachrichten der Gegenseite.
4. Die Plug-in-Tabellen werden erreicht, ohne dass die Löschung eines von ihnen
   **nennt** — ein Plug-in fasst keine Kerntabelle an, also muss die Löschung
   umgekehrt fragen.

**Export und Löschung sind ein Gegenstand, nicht zwei Funktionen.** Sie
beantworten dieselbe Frage von zwei Seiten, und sie müssen sich einig sein: eine
Tabelle, die der Export vergisst, vergisst die Löschung auch — und beides sieht
man von außen nicht. Deshalb teilen sie einen Port, und der Port hat eine
Implementierung.

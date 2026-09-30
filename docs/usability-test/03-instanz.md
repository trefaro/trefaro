# Die Instanz

Eine Instanz, die vor der ersten Sitzung steht und nach der letzten weggeworfen
wird. Sie läuft als der Fünf-Container-Stack, wie er ausgeliefert wird — nicht
als Entwicklungsserver: getestet werden soll, was eine Organisation bekommt.

Die vollständige Anleitung ist [`docs/INSTALL.md`](../INSTALL.md). Hier steht
nur, was für diesen Test davon abweicht.

## Hochfahren

```bash
git clone https://github.com/trefaro/trefaro.git && cd trefaro
npm ci
cp .env.example .env
```

In `.env` müssen vier Werte stehen, bevor irgendetwas startet:
`DATABASE_PASSWORD`, `AUTH_SECRET`, `SMTP_HOST` und `SMTP_FROM`. Für diesen Test
dazu:

```dotenv
ADMIN_BOOTSTRAP_EMAIL=admin@example.org
ADMIN_BOOTSTRAP_PASSWORD=<ein langes Passwort>

# Der Briefkasten läuft lokal und spricht kein STARTTLS; ein Produktionsbau
# verlangt es, solange nichts anderes dasteht. Die Lockerung steht hier und in
# keiner Zeile Code (E62) — und sie ist genau deshalb richtig, weil sie in
# einer .env steht, die ein echter Betrieb nicht hat.
SMTP_REQUIRE_TLS=false

# Zwanzig Anmeldeversuche je fünf Minuten je Absenderadresse ist für eine
# Organisation richtig und für einen Testraum falsch: alle sitzen hinter
# derselben Adresse, und zehn Demokonten plus ein Veranstalterzugang sind das
# Kontingent schon fast. Für die Testinstanz hochsetzen.
LOGIN_ATTEMPTS_PER_WINDOW=200
```

Dann:

```bash
docker compose -f infra/docker-compose.dev.yml up -d mailpit      # der Briefkasten
docker compose --env-file .env -f infra/docker-compose.yml up -d --build
docker network connect trefaro_default trefaro-mailpit            # Briefkasten an den Stack
```

Der Briefkasten muss **vom Server-Container aus** erreichbar sein — deshalb die
dritte Zeile, und deshalb `SMTP_HOST=trefaro-mailpit` in der `.env`. Auf Docker
Desktop geht auch `SMTP_HOST=host.docker.internal` mit `SMTP_PORT=1025`.

| Was            | Wo                             |
| -------------- | ------------------------------ |
| Teilnehmende   | `http://localhost:8080/`       |
| Veranstaltende | `http://localhost:8080/admin/` |
| Briefkasten    | `http://localhost:8025`        |

**Ohne TLS nur auf `localhost`.** Das Sitzungs-Cookie ist im Produktionsbau
`Secure`; sobald der Test an einer anderen Adresse läuft als `localhost`, gehört
`-f infra/docker-compose.tls.yml` dazu, sonst funktioniert keine Anmeldung.

## Füllen

```bash
node tools/demo-seed/seed.mjs
```

Der Seed geht **durch dieselbe API wie ein Mensch** — kein SQL, kein Griff in die
Datenbank. Er kann deshalb keinen Zustand herstellen, den die Anwendung ablehnen
würde: eine Anmeldung ist bestätigt, weil jemand den Link in der Mail geöffnet
hat, ein Platz ist belegt, weil er über den Endpunkt vergeben wurde, ein Ticket
ist gescannt, weil der Code eingelesen wurde. Ein Lauf, der durchläuft, ist
nebenbei ein Rauchtest der Installation.

Er braucht ein bis zwei Minuten und sagt am Ende, wo man hinschauen kann.

### Was danach drinsteht

**Das, was ein Veranstalter gebaut hat:**

- **3 Veranstaltungsreihen**, eine davon im Entwurf und deshalb öffentlich nicht
  zu sehen
- **5 Events** — eines vorbei, eines Entwurf, drei Arten (vor Ort, online, beides)
- ein **Logo** auf einer Reihe und einem Event, zusätzlich zum Logo der Organisation
- ein **Anmeldeformular** mit allen vier Feldarten, eine Frage ist Pflicht, eine
  nimmt eine Datei
- **10 Programmpunkte**, zwei davon parallel und beide mit Anmeldung —
  „Arbeitsgruppe B" ist mit **4 von 4** Plätzen **voll**
- **5 Medien-Links**, zwei davon an einer Session
- **9 Dinge auf Englisch übersetzt und der Rest bewusst nicht** — so sieht eine
  Organisation aus, die mittendrin ist
- **40 Anmeldungen**: 35 bestätigt, 5 warten auf ihre Bestätigung, 4 hat der
  Veranstalter storniert; eine bringt ein PDF mit
- **1 Einladung** an 12 Ehemalige, wirklich verschickt — und **1 Widerspruch**
  aus dem Link in einer dieser Mails

**Das, was eine Community daraus gemacht hat:**

- **10 Teilnehmerkonten**, **7 davon auffindbar** — die anderen drei haben das
  Häkchen nicht gesetzt und sind weder zu finden noch anzuschreiben
- **3 Profilfragen** der Instanz, eine je Art (Auswahl, Text, Häkchen)
- **3 Gespräche** mit 8 Nachrichten, eines davon ungelesen
- **2 Anfragen** von Menschen ohne Konto, im Posteingang des Veranstalters
- **3 Forumsthemen** mit 10 Beiträgen: 8 freigegeben, **2 warten** auf eine
  Entscheidung
- **4 Programmvorschläge**: einer angenommen, einer abgelehnt, **2 offen**
- **3 Räume** mit 10 Sessions darin — und **Seminarraum 1 ist überbucht**, weil
  er 5 Plätze hat und die Arbeitsgruppe darin 7 Anmeldungen
- **8 Programmpunkte** in den persönlichen Plänen von 3 Personen
- **6 Personen** sind am Einlass eingecheckt, der Rest wird erwartet

Jeder Name ist erfunden, jede Adresse liegt unter `example.org` und kann keine
Post empfangen.

### Zugänge

| Wer              | Adresse             | Passwort                                |
| ---------------- | ------------------- | --------------------------------------- |
| Veranstalter     | `admin@example.org` | was in `ADMIN_BOOTSTRAP_PASSWORD` stand |
| Alle zehn Konten | siehe unten         | `demo-passwort-2026`                    |

**Auffindbar** (können gesucht und angeschrieben werden):
`annika.srensen@`, `bartosz.lewandowski@`, `camille.duvivier@`,
`dimitris.papadakis@`, `elif.yldrm@`, `greta.lindqvist@`,
`hannes.baumgartner@` — alle `@example.org`.

**Nicht auffindbar** (haben Konto und Profil, sind aber nicht in der Suche):
`ilaria.bellandi@`, `jakub.havelka@`, `katrin.moosbrugger@example.org`.

> Ein gemeinsames Passwort für zehn Konten ist für eine Vorführung richtig und
> für alles andere falsch. Es ist der deutlichste Satz darüber, was diese
> Instanz ist: **eine Demonstration, und niemals ein Betrieb.** Anderes Passwort
> über `SEED_PARTICIPANT_PASSWORD`.

### Was an ist und was bewusst nicht

Eingeschaltet: **Profile, Profilsuche, Chat, Medien-Links, Newsletter-Anmeldung**
und **alle fünf Plug-ins** — Programmvorschläge, Diskussionsforum, Raumplanung,
QR-Check-In, individueller Programmplan.

**Push ist aus.** Es braucht VAPID-Schlüssel in der Umgebung und ein echtes
Gerät, um etwas zu bedeuten; eine Instanz, die eine Benachrichtigung anbietet,
die sie nicht senden kann, ist schlechter als eine, die sie nicht anbietet. Push
und die Installation als App stehen in `todo.md` unter _On a device — waiting for
Marius_ und gehören nicht in diese Sitzungen.

Umschalten lässt sich alles unter _Module_ im Veranstalter-Client — was
übrigens selbst eine gute Aufgabe wäre, wenn die Zeit reicht.

## Zwischen zwei Sitzungen zurücksetzen

Nach einer Sitzung mit Aufgabe B10 (Konto löschen) oder nachdem mehrere Personen
sich angemeldet haben:

```bash
node tools/demo-seed/seed.mjs --reset
```

`--reset` löscht die Demo-Reihen mit allem darunter und legt sie neu an. Was die
Reihen **nicht** betrift, bleibt stehen und wird beim zweiten Lauf
wiederverwendet statt verdoppelt:

- die **Gestaltung** der Instanz (Name, Farben, Logo, Schrift) — es gibt nichts,
  worauf sie zurückzusetzen wäre
- die **eingeschalteten Module**
- die **Profilfragen**
- die **Teilnehmerkonten** und ihre **Gespräche** — ein Konto gehört einem
  Menschen und nicht einer Veranstaltung, und **kein Veranstalter kann fremde
  Konten löschen** (das ist Absicht)

Ein in B10 gelöschtes Konto ist deshalb **weg und kommt nicht wieder.** Der Lauf
merkt das und legt es neu an — mit demselben Passwort, aber leerem Profil.

**Zwei Läufe hintereinander gehen nicht.** Das öffentliche Anmeldeformular
erlaubt sechzig Absendungen je fünf Minuten je Absenderadresse — absichtlich, es
schickt Post an eine Adresse, die der Aufrufer wählt — und ein Lauf verbraucht
davon fünfzig. Der zweite bricht mit einer Meldung ab, die genau das sagt.
Entweder fünf Minuten warten oder den Server neu starten, dessen Zähler im
Arbeitsspeicher liegt:

```bash
docker compose --env-file .env -f infra/docker-compose.yml restart server
```

**Ganz sauber wird es nur so:**

```bash
docker compose --env-file .env -f infra/docker-compose.yml down -v
docker compose --env-file .env -f infra/docker-compose.yml up -d
docker network connect trefaro_default trefaro-mailpit
node tools/demo-seed/seed.mjs
```

Das `-v` wirft die Datenbank und die hochgeladenen Dateien weg. Danach ist es
wieder eine fabrikneue Instanz — und der Seed richtet sie in einem Zug ein, was
für sich schon einen Blick wert ist.

Den Briefkasten zwischendurch leeren macht die Suche nach der richtigen Mail
leichter: auf `http://localhost:8025` oben rechts _Delete all_.

## Danach

**Die Instanz wird weggeworfen, nicht weiterbenutzt.** Zehn Konten mit einem
bekannten Passwort, ein Bootstrap-Zugang in einer Datei und ein Briefkasten, der
alles mitliest — das ist für eine Vorführung genau richtig und für eine
Organisation, die echte Teilnehmendendaten verwaltet, genau falsch.

```bash
docker compose --env-file .env -f infra/docker-compose.yml down -v
docker compose -f infra/docker-compose.dev.yml down
```

Eine echte Installation beginnt bei [`docs/INSTALL.md`](../INSTALL.md), Punkt 1,
mit einer leeren Datenbank und ohne eine Zeile aus dieser Datei.

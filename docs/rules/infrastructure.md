# Infrastruktur-Entscheidungen

Die Entscheidungen aus Phase 0, die in einer frischen Sitzung sonst improvisiert
würden.

Jede davon hat eine Alternative, die naheliegend aussieht und einen
konkreten Schaden anrichtet — beim Port eine Kollision, bei Nx Cloud ein
Datenschutzbruch, bei der Plug-in-Aktivierung Datenverlust.

- **`SERVER_PORT`, nicht `PORT`** — Vite/Angular-Dev-Server lesen `PORT` auch mit
  und würden auf den Serverport wandern.
- **Kein Nx Cloud.** Task-Metadaten verlassen die Infrastruktur der Organisation
  nicht.
- **Plug-in-Aktivierung zur Laufzeit** heißt: alle kuratierten Plug-ins sind
  gemountet und ihre Tabellen existieren **immer**; das `module_config`-Flag
  steuert, ob die API antwortet (sonst 404) und ob die Clients davon erfahren. Der
  Registry-Cache wird alle 15 s neu gelesen.
- **Plug-in-Distribution v1:** kuratierte Plug-ins sind im Image enthalten und
  werden zur Laufzeit per Konfiguration aktiviert/deaktiviert. **Keine
  Fremdinstallation zur Laufzeit.**
- **Deaktivieren löscht nie Daten.** Nur `down`-Migrationen entfernen Tabellen.
- **Ein Client-Plug-in ist ein eigenes Nx-Projekt, und es muss gebaut werden.**
  Je Bündel ein Verzeichnis unter `apps/plugins/<key>` (Projektname
  `plugin-<key>`, Tag `type:plugin-bundle`), Ausgabe nach
  `dist/apps/plugins/<key>`, ausgeliefert vom **Server** unter
  `/api/plugins/<key>/main.js` (`PLUGIN_BUNDLE_DIR`) — eine Adresse, die in der
  Entwicklung und in Produktion dieselbe ist. Wer ein Bündel anlegt, trägt es an
  **zwei** weiteren Stellen nach: `infra/docker/server.Dockerfile` (sonst fehlt
  es im Image, obwohl der Deskriptor es nennt) und `.github/workflows/ci.yml`
  vor `nx run-many -t e2e` (sonst montiert der Browser nichts, und die Suite,
  die davon abhängt, prüft eine leere Seite und hält das für grün).
- **`CORE_MODULES` nennt nur Module, die es gibt** (E21, F63): derzeit
  `profiles`, `profile-search`, `chat`, `media-links`, `push` und
  `newsletter-opt-in` — die ersten drei seit Phase 3 (AP 1, AP 5, AP 6), mit
  `profiles` als Voraussetzung der beiden anderen (E42, F128), der letzte seit
  AP 12. **`newsletter` entfällt endgültig** und ist nicht dasselbe wie
  `newsletter-opt-in`: dieser Schlüssel schaltet ein Anmeldeformular und eine
  Übersicht und **nie einen Versand** (F8, F136). Zeilen entfallener Schlüssel
  werden **nicht gelöscht** — `ModuleFlagCache` ignoriert, was kein Deskriptor
  beansprucht.
- **Zwei Module sind aus vorgegeben, aus zwei verschiedenen Gründen.** `push`,
  weil es ohne VAPID-Paar in der Umgebung **nicht kann** (ein angebotenes
  Abonnement wäre eines, das nicht gespeichert wird). `newsletter-opt-in`, weil
  es sehr wohl kann und trotzdem nichts versendet: eine Instanz mit dem Schalter
  an sammelt Adressen für Neuigkeiten, die von woanders rausgehen müssen, und
  eine Organisation ohne Newsletter sollte dafür kein Formular zeigen. Eine
  Voraussetzung hat es **nicht** — eine Anmeldung fragt nach einer Adresse und
  nicht nach einem Konto (E45), also ist das Modul auch auf einer Instanz mit
  ausgeschaltetem `profiles` nützlich.
- **`push` ist ein echter Schalter:** Endpunkte mit Guard, `webPushPublicKey`
  `null`, solange das Modul aus ist. Wer Push testet, schaltet das Modul vorher ein
  und stellt den Schalter zurück. **Seit AP 11 der Phase 3 fragt `PushService`
  die Flagge auch selbst** — eine Benachrichtigung entsteht aus einer
  Event-Änderung und nicht aus einer Anfrage, also fragt sonst niemand für sie
  (E21, F63). Zwei unabhängige Bedingungen, und beide müssen erfüllt sein: das
  Modul **und** ein VAPID-Paar in der Umgebung. Aus heißt: die Abonnements
  bleiben liegen, es geht nur nichts raus.
- **Sieben geteilte Bibliotheken:** `shared-http`, `shared-config`,
  `shared-models`, `shared-theming` (die vier des Ursprungsplans),
  `shared-plugins` (Client-Plug-in-Manager + Einhängepunkt-Komponente, seit
  Phase 0), `shared-i18n` (mitgelieferte Kataloge + Transloco-Verkabelung +
  Sprachumschalter + `TrefaroTitleStrategy`, seit AP 6 der Phase 2) und
  `shared-plugin-kit` (seit AP 6 der Phase 4). Ein Plug-in-Bündel darf davon
  genau **zwei** benutzen: `shared-models` und `shared-plugin-kit`. Bis AP 6
  der Phase 4 war es genau eine, und die Regel stimmt weiter in ihrem Kern —
  ein Client teilt mit einem Bündel die **Modelle**, nie die Implementierung,
  denn der Rest wäre ein zweiter HTTP-Stapel, eine zweite Übersetzungskette
  oder ein zweiter Konfigurationszustand in etwas, das zur Laufzeit
  nachgeladen wird. `shared-plugin-kit` ist die Ausnahme, die das bestätigt:
  sie ist die einzige Bibliothek, die **kein Client** benutzt (der Host hat
  seine eigenen Wege), sie hängt nur an `shared-models`, sie bringt kein
  Framework mit, und sie enthält genau die Zeilen, die sonst in jedem Bündel
  ein zweites Mal stünden — `wordsOf`, `when`/`day`/`clock` und
  `readJson`/`sendJson` mit den zwei Fehlerklassen (F138). Ein Helfer, der ab
  jetzt in ein Bündel kopiert wird, ist ein Rückschritt und keine zweite
  Kopie.
- **Der Plug-in-Vertrag steht nach Phase 4 auf 1.2.0, und das ist der Stand,
  von dem die nächste Erweiterung ausgeht** (E46, geprüft in AP 10): **fünf**
  kuratierte Plug-ins (`program-proposals`, `forum`, `room-planning`,
  `qr-checkin`, `personal-program` — in dieser Reihenfolge registriert, und
  die Reihenfolge ist auch die der Kacheln), **vier** Einhängepunkte in einem
  geschlossenen Satz (`navigation`, `event-detail`, `event-dashboard`,
  `my-registration`), drei zugesagte Eigenschaften an jedem montierten Element
  (`locale`, `strings`, `mountPoint`) und drei Lese-Ports
  (`PluginProgramReads`, `PluginParticipantReads`, `PluginRegistrationReads`).
  Zwei Regeln daraus überleben die Phase, und beide sind einmal wehgetan:
  **eine Erweiterung ohne Füller wird nicht gebaut** — die für AP 9 geplante
  Sprache an `findItem` wurde gestrichen, weil ihr einziger Aufrufer sie nicht
  gelesen hätte (F200, E21) —, und **ein Feld, ohne das ein Bildschirm etwas
  Falsches behauptet, wird gebaut, auch wenn es im Plan nicht steht**
  (`registrationEnabled`, F201). Was der Vertrag weiterhin **nicht** hat:
  einen Schreib-Port in Kerntabellen (E52), eine Fähigkeit in umgekehrter
  Richtung (E59) und Mail (die Sprachwahl je Mail ist eine Maschinerie, die
  ein Plug-in nicht zur Hälfte benutzen kann).
- **Ein zweiter Server-Container braucht einen socket.io-Adapter.** Räume
  leben im Speicher **eines** Prozesses, also erreicht eine Nachricht bei zwei
  Containern nur die Hälfte der Sockets. Für die Zielgruppe (eine Instanz je
  Organisation) kein Thema; wer je horizontal skaliert, holt einen geteilten
  Adapter (Redis oder Postgres) — und das ist die einzige Stelle, an der die
  Echtzeit von AP 7 eine Annahme über den Betrieb macht.
- Alle vier Spikes der Phase 0 sind verifiziert: `docs/spikes/01-client-plugin`,
  `02-server-plugin`, `03-web-push`, `04-websocket-through-nginx`.
- **`add_header` in einem `location`-Block schaltet die geerbten ab.** Die
  klassische nginx-Falle, und in AP 9 der Phase 5 fast getreten: die
  Content-Security-Policy sollte nur an den zwei Client-Locations hängen — dann
  hätten genau diese zwei `X-Content-Type-Options`, `X-Frame-Options` und
  `Referrer-Policy` verloren, weil eine Ebene, die selbst ein `add_header`
  setzt, gar keins mehr erbt. Alle Kopfzeilen stehen deshalb auf **Server-Ebene**
  in `trefaro-locations.conf`, und wer eine hinzufügt, fügt sie dort hinzu.
- **Eine Kopfzeile auf Server-Ebene liegt auch auf den `/api/`-Antworten.** Das
  ist gewollt und nicht folgenlos: eine Medienroute setzt für ihre Bytes selbst
  `default-src 'none'; sandbox`, und der Browser bekommt dann **zwei**
  `Content-Security-Policy`-Zeilen und setzt beide durch. Für hochgeladene Bytes
  ist die Schnittmenge genau richtig; wer die Regel der Seite lockert, lockert
  damit nicht die der Datei.

Siehe auch: [Deployment und Prüfung](deployment.md), [Schichten und Ports im Server](server-layers.md).

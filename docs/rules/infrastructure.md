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
- **Sechs geteilte Bibliotheken:** `shared-http`, `shared-config`,
  `shared-models`, `shared-theming` (die vier des Ursprungsplans),
  `shared-plugins` (Client-Plug-in-Manager + Einhängepunkt-Komponente, seit
  Phase 0) und `shared-i18n` (mitgelieferte Kataloge + Transloco-Verkabelung +
  Sprachumschalter + `TrefaroTitleStrategy`, seit AP 6 der Phase 2).
- **Ein zweiter Server-Container braucht einen socket.io-Adapter.** Räume
  leben im Speicher **eines** Prozesses, also erreicht eine Nachricht bei zwei
  Containern nur die Hälfte der Sockets. Für die Zielgruppe (eine Instanz je
  Organisation) kein Thema; wer je horizontal skaliert, holt einen geteilten
  Adapter (Redis oder Postgres) — und das ist die einzige Stelle, an der die
  Echtzeit von AP 7 eine Annahme über den Betrieb macht.
- Alle vier Spikes der Phase 0 sind verifiziert: `docs/spikes/01-client-plugin`,
  `02-server-plugin`, `03-web-push`, `04-websocket-through-nginx`.

Siehe auch: [Deployment und Prüfung](deployment.md), [Schichten und Ports im Server](server-layers.md).

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
  `media-links` und `push`. `newsletter` entfällt endgültig,
  `chat`/`profiles`/`profile-search` kommen mit Phase 3 zurück. Zeilen entfallener
  Schlüssel werden **nicht gelöscht** — `ModuleFlagCache` ignoriert, was kein
  Deskriptor beansprucht.
- **`push` ist ein echter Schalter:** Endpunkte mit Guard, `webPushPublicKey`
  `null`, solange das Modul aus ist. Wer Push testet, schaltet das Modul vorher ein
  und stellt den Schalter zurück.
- **Sechs geteilte Bibliotheken:** `shared-http`, `shared-config`,
  `shared-models`, `shared-theming` (die vier des Ursprungsplans),
  `shared-plugins` (Client-Plug-in-Manager + Einhängepunkt-Komponente, seit
  Phase 0) und `shared-i18n` (mitgelieferte Kataloge + Transloco-Verkabelung +
  Sprachumschalter + `TrefaroTitleStrategy`, seit AP 6 der Phase 2).
- Alle vier Spikes der Phase 0 sind verifiziert: `docs/spikes/01-client-plugin`,
  `02-server-plugin`, `03-web-push`, `04-websocket-through-nginx`.

Siehe auch: [Deployment und Prüfung](deployment.md), [Schichten und Ports im Server](server-layers.md).

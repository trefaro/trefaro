# Verträge der Endpunkte

Wie ein Endpunkt in dieser Anwendung geschnitten ist, wie er geschützt wird und
was er antwortet.

Diese Formen sind mehrfach gegen Alternativen entschieden worden; die
Alternativen waren jeweils ein offener Endpunkt, eine Sackgasse oder ein toter
Link.

- **Der Admin-Schutz hängt am URL-Präfix `/api/admin`** (E16), nicht an einem
  Dekorator — ein vergessenes `@UseGuards` in einem Plug-in wäre ein offener
  Endpunkt. `isAdminPath` liest jeden _deklarierten_ Pfad einzeln und
  **überschätzt** (F69): `@Post('admin')` unter `@Controller('setup')` sieht für
  ihn aus wie `/api/admin/…`. Absicht, weil der Fehler in die andere Richtung ein
  offener Endpunkt wäre. Wer so eine Route braucht, setzt `@AllowAnonymous()`
  **und** einen eigenen Guard davor.
- **Slugs sind je Elternteil eindeutig** (E7), nicht je Instanz → öffentliche
  Adressen sind geschachtelt (`/series/:reihe/events/:event`), die API-Pfade
  folgen (F28). Die öffentliche Adresse wird an **einer** Stelle gebaut:
  `publicEventPath`, `publicSeriesPath`, `publicUrl(origin, pfad)` in
  `shared-models` (F112) — den Origin kennt nur das Deployment
  (`publicUserClientUrl` aus `/api/config`). Verlinkt wird nur Veröffentlichtes.
- **Ein Endpunkt für einen Bildschirm** (F49). Das Dashboard ist eine Anfrage,
  nicht vier. `GET …/events/:id/translations` bringt Event **und** Programm;
  geschrieben wird aber je Ding und je Sprache (F97), damit ein Fehler in der
  neunzehnten Session die achtzehn davor nicht wegwirft.
- **Listen sind serverseitig gefiltert, sortiert und paginiert**, mit der ID als
  letztem Sortierkriterium. Kein Endpunkt liefert „alles". **Keine
  Datenbankerweiterung für Suche** (F32): `ILIKE '%wort%'` je Wort, kein
  `pg_trgm` — Installierbarkeit vor Mikrooptimierung (13 ms bei 2 000
  Anmeldungen).
- **Ein Event hat eine Startseite, und die ist nicht sein Formular** (F48).
  `/series/:reihe/events/:event` ist das Dashboard, `…/edit` das Formular —
  dieselbe Ordnung wie bei der Reihe. Speichern führt zurück aufs Dashboard, ein
  _neues_ Event weiterhin auf die Reihe.
- **Das öffentliche Registrierungsformular antwortet immer gleich** (E10), sonst
  wird es zur Abfrage über die Teilnehmerliste.
- **Ein abgeschaltetes Kernmodul antwortet 404**, wie ein Plug-in (F53):
  `@CoreModuleController(key)` + `CoreModuleEnabledGuard`. `/api/config` und der
  Guard lesen **denselben** Zwischenspeicher (`ModuleFlagCache`, 15 s), damit
  nicht ein Client von einem Modul erfährt, dessen API 404 gibt. Ein neues
  optionales Modul braucht Deskriptor **und** Guard, sonst ist der Schalter eine
  Attrappe. Wer den Schalter zur Laufzeit umlegt, ruft `refresh()` — und die
  Modulverwaltung liest den Zustand aus den **Registries**, nie aus der Tabelle;
  ein unbekannter Schlüssel ist ein 404, keine neue Zeile.
- **Das Selbstbedienungs-Token steht beim Lesen in der Query, beim Ändern im
  Rumpf** (F44): Lesen ist, was der Link in der Mail tut; ändern darf kein
  Linkvorschau-Dienst können. Nur eine **bestätigte** Anmeldung hat eine
  Selbstbedienungsseite, und gelesen wird über die **Event-Id**, nicht die
  öffentliche Adresse — sonst wäre jeder Link tot, sobald das Event auf Entwurf
  zurückgeht. `ProgramService.listForEvent` und `EventsService.locate` sind genau
  dafür da.
- **Eine Medienroute nimmt nie einen Pfad, aber auch keinen Status** (F113, F115).
  `/api/media/branding/{logo,app-icon}` löst über `app_config` auf,
  `/api/media/series/:id/logo` und `…/events/:id/logo` über die Zeile — mehr
  Routen zu gespeicherten Bytes gibt es nicht, und keine davon nimmt einen
  Dateinamen. Der **Status** wird dabei bewusst **nicht** geprüft: das Logo einer
  unveröffentlichten Reihe wird ausgeliefert, weil die Adresse die uuid braucht,
  die Bytes eine Marke sind und die Gegenrichtung die Vorschau des Veranstalters
  genau im Entwurfszustand kaputt machen würde. Das 404 sagt nur „hier ist kein
  Bild" und nie, ob die Zeile existiert.
- **`?locale=` hat drei Antworten, und nur eine ist ein Fehler** (F94): fehlt der
  Parameter, stehen die Originale (kostenlos); eine wohlgeformte Sprache, in die
  niemand übersetzt hat, ist **kein** Fehler; was kein Sprachtag ist, ist ein 400.
  In der Query, nicht in `Accept-Language`. `LocaleQueryPipe` + `ApiLocaleQuery()`
  in `business/common/`.
- **Die Statuscodes der Ersteinrichtung sind der Vertrag** (F64): 401 =
  „unbeansprucht, Token fehlt oder ist falsch", 404 = „es gibt einen
  Administrator". Existenzbedingung ist bei jedem Aufruf die Datenbankfrage
  „kann sich überhaupt jemand anmelden?" — kein Flag, keine Datei.
- **Ein Versand an viele Adressen ist ein Vorgang, keine Anfrage** (F56): der
  `POST` schreibt die Empfängerzeilen und antwortet **202**; die Zeilen _sind_ die
  Warteschlange, der Fortschritt wird aus ihnen **gezählt**, nie daneben
  gespeichert.
- **Query-Parameter kommen als `undefined` an**, auch wenn ein Angular-`input()`
  einen Standardwert hat. `ApiClient.put/delete/post` nehmen ebenfalls
  Query-Parameter — auch ein `PUT` muss die Sprache tragen können.

Siehe auch: [Schichten und Ports im Server](server-layers.md), [Mehrsprachigkeit und Katalog](i18n.md).

# 12 Glossar

Die Dokumentation dieses Repositories ist **deutsch**, der Code **englisch**.
Dieses Glossar ist deshalb vor allem eine **Übersetzungstabelle**: welcher
deutsche Begriff welchem Bezeichner im Code entspricht. Wer einen Begriff hier
nachschlägt, kann ihn danach suchen.

## 12.1 Fachbegriffe

| Deutsch                                 | Im Code / in der API                            | Bedeutung                                                                                                                                       |
| --------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Veranstaltungsreihe**, kurz **Reihe** | `EventSeries`, `event_series`, `/api/*/series`  | Die oberste Klammer: eine wiederkehrende Reihe von Events einer Organisation. Trägt Name, Beschreibung, eigenes Logo.                           |
| **Event**                               | `Event`, `event`, `/api/*/events`               | Eine einzelne Veranstaltung einer Reihe. Trägt Ort, Zeitraum, **Zeitzone**, Registrierungsformular, Programm.                                   |
| **Programmpunkt**                       | `ProgramItem`, `program_item`                   | Eine Sitzung im Programm eines Events: Titel, Anfang, Ende, optional Anmeldung und Platzzahl.                                                   |
| **Registrierung**                       | `Registration`, `registration`                  | Die Anmeldung **zu einem Event**, mit Double-Opt-In. Nicht zu verwechseln mit der Anmeldung zu einem Programmpunkt.                             |
| **Anmeldung zu einem Programmpunkt**    | `registrationEnabled`, `countSignups`           | FR 3.10: Für einen einzelnen Programmpunkt wird ein Platz belegt. Nur hier wird ein Platz gebucht — nicht im persönlichen Plan (E55).           |
| **Konto / Profil**                      | `ParticipantAccount`, `user_profile`            | Das dauerhafte Konto eines Menschen, unabhängig von einzelnen Registrierungen. Nur mit Opt-in (`searchable`) auffindbar.                        |
| **Teilnehmerübersicht**                 | `participants`                                  | Die Tabelle des Veranstalters über alle Registrierungen eines Events — **mit der Mailadresse direkt in der Zeile** (Usability-Test der Thesis). |
| **Selbstbedienung**                     | `self-service`, `my-registration`               | Die Seite, auf der jemand seine eigene Registrierung ansieht, ändert oder storniert — auch ohne Konto, über einen signierten Link.              |
| **Double-Opt-In**                       | –                                               | Bestätigung einer Mailadresse über einen signierten Link, der genau einmal wirkt. Gilt für Registrierung, Konto und Newsletter.                 |
| **Einladung**                           | `Invitation`, `invitation`                      | Die Ansprache ehemaliger Teilnehmender einer Reihe zu einem neuen Event.                                                                        |
| **Follow-Up**                           | –                                               | Informationen, die nach dem Ende eines Events auf dessen Seite erscheinen.                                                                      |
| **Medien-Link**                         | `MediaLink`, `media_link`                       | Eine **externe** Stream- oder Mediathek-URL. Wird verlinkt, nie eingebettet.                                                                    |
| **Feld-Baukasten**                      | `fields`, `registration_field`, `profile_field` | Die vom Veranstalter zusammengestellten Formularfelder — Text, Auswahl, Checkbox, Datei-Upload.                                                 |

## 12.2 Architekturbegriffe

| Deutsch                | Im Code                                                                   | Bedeutung                                                                                                                                              |
| ---------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Instanz**            | –                                                                         | Eine laufende Installation für **eine** Organisation. Es gibt keine Mandanten.                                                                         |
| **Kernmodul**          | `CORE_MODULES`, `module_config`                                           | Eine Fachlichkeit des Kerns, die ein Veranstalter ein- und ausschalten kann — Profile, Profilsuche, Chat, Medien-Links, Push, Newsletter-Opt-in.       |
| **Plug-in**            | `ServerPlugin`, `CURATED_PLUGINS`                                         | Eine Erweiterung mit **eigenen Tabellen**, eigener API und eigener Webkomponente. Fünf sind kuratiert und im Image enthalten.                          |
| **Deskriptor**         | `ServerPlugin`, `PluginDescriptor`                                        | Die eine Erklärung, in der ein Plug-in dem Wirt alles über sich sagt. **Der Wirt fragt nichts darüber hinaus** (E59).                                  |
| **Bündel**             | `apps/plugins/<key>`, `main.js`                                           | Die gebaute Webkomponente eines Plug-ins — eine Datei, kein eigenes CSS, zur Laufzeit geladen.                                                         |
| **Einhängepunkt**      | `PluginMountPoint`                                                        | Eine der vier Stellen, an denen ein Bündel gezeichnet werden darf: `navigation`, `event-detail`, `event-dashboard`, `my-registration`.                 |
| **Slot**               | `<trefaro-plugin-slot>`, `PluginSlot`                                     | Das Bauteil, das einen Einhängepunkt im Client umsetzt: es erzeugt die Elemente und schreibt die Eigenschaften.                                        |
| **Wirt**               | `PluginHostModule`, `PluginRegistryService`                               | Der Kern in seiner Rolle gegenüber Plug-ins: montiert sie, kennt ihre Schalter, liefert die Lese-Ports.                                                |
| **Lese-Port**          | `PluginProgramReads`, `PluginRegistrationReads`, `PluginParticipantReads` | Die schmalen Schnittstellen, über die ein Plug-in Kerndaten liest — und der einzige Weg dorthin.                                                       |
| **Port**               | `…Repository`, `…Reads`, Symbol-Token                                     | Allgemein: ein Interface mit Injection-Token, über das die Geschäftsschicht etwas erreicht, dessen Umsetzung sie nicht kennen darf.                    |
| **Whitelabel**         | `--trefaro-*`, `/api/config`                                              | Farben, Logo und Schrift der Organisation. Wirken sofort auf beide Clients **und alle Plug-ins**, ohne Neubau.                                         |
| **Katalog**            | `catalogues/en.json`, `translation_override`                              | Die Sätze der Oberfläche. `en.json` ist die **Schlüsselliste**; was dort fehlt, existiert nicht. Eine Organisation kann jeden Schlüssel überschreiben. |
| **Schlüssel**          | `event.detail.title`                                                      | Ein **Ort in der Oberfläche**, kein Wort. Zwei gleiche Wörter an zwei Orten sind zwei Schlüssel.                                                       |
| **Inhaltsübersetzung** | `*_translation`                                                           | Die Übersetzung von **Inhalten** (Eventtitel, Programmpunkt), im Gegensatz zum Katalog der Oberfläche.                                                 |
| **Fehlermarke**        | –                                                                         | Die kurze Kennung, die eine Fehlermeldung dem Menschen zeigt, damit der Betreiber die Logzeile findet — **ohne dass ein Name im Log steht**.           |
| **Migration**          | `data-access/migrations/`                                                 | Ein versioniertes Schemaänderungsskript. Läuft beim Start; Kern- und Plug-in-Migrationen werden **gemeinsam nach Zeitstempel** geordnet.               |

## 12.3 Die drei Rollen

| Deutsch                  | Im Code                                                  | Wer das ist                                                                                                           |
| ------------------------ | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Veranstalter**         | `admin`, `PluginOrganizer`, `/api/admin/…`               | Die Organisation. Verwaltet Reihen, Events, Programm, Teilnehmende, Design, Module, Sprachen.                         |
| **Nutzer**               | `participant`, `PluginParticipant`, `/api/participant/…` | Ein Mensch mit Konto. Sieht Programm, Profile, Nachrichten und seine eigenen Registrierungen.                         |
| **Interessierte Person** | anonym, `/api/user/…`                                    | Ohne Konto. Sieht Startseite, Reihen und Event-Landingpage, kann sich registrieren und den Veranstalter kontaktieren. |

## 12.4 Die fünf kuratierten Plug-ins

| Deutsch                        | `key`               | FR               |
| ------------------------------ | ------------------- | ---------------- |
| **Programmvorschläge**         | `program-proposals` | FR 3.13, FR 3.14 |
| **Diskussionsforum**           | `forum`             | FR 4.6           |
| **Raumplanung**                | `room-planning`     | FR 3.11          |
| **QR-Code-Check-In**           | `qr-checkin`        | FR 3.16          |
| **Individueller Programmplan** | `personal-program`  | FR 3.17          |

## 12.5 Englische Begriffe, die deutsch bleiben

Damit niemand sie übersetzt und damit unauffindbar macht: **Slot**, **Plug-in**,
**Bündel** (für _bundle_), **Einhängepunkt** (für _mount point_ / _hook point_),
**Double-Opt-In**, **Whitelabel**, **Follow-Up**, **PWA**, **Port**. Die
Entscheidungskürzel **E** und **F** stehen für „Entscheidung" und „Frage" und
sind in beiden Sprachen dieselben.

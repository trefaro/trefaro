# 1 Einführung und Ziele

## 1.1 Aufgabenstellung

Trefaro ist eine **Open-Source-Whitelabel-Anwendung für Eventmanagement und
Community-Bildung in gemeinnützigen Organisationen**. Der Name ist ein Kunstwort
aus dem deutschen „Treff" und dem Esperanto-Sammelsuffix „-aro" — eine Sammlung
von Treffen, also eine Veranstaltungsreihe.

Grundlage ist die Masterthesis von Marius Schulze (WBH, 2024), die per
Mixed-Methods-Forschung — Experteninterviews bei Democracy International e. V.
und eine Online-Umfrage mit 42 Teilnehmenden — Anforderungen, Architektur und
Design empirisch hergeleitet hat. Alle vier Hypothesen der Thesis wurden
bestätigt.

Zielgruppe sind **kleine NGOs**, in der Regel unter zwanzig Mitarbeitende und
mit sehr begrenztem Budget, die Veranstaltungsreihen planen und durchführen und
dabei langfristige Communities aufbauen wollen.

Die vollständigen funktionalen Anforderungen stehen als Tabelle in
[Kapitel 3 des Referenzdokuments](../Anforderungsanalyse_und_Umsetzungsplan.md);
die Akteure und die sechzehn Use Cases in Kapitel 2 desselben Dokuments. Sie
werden hier nicht wiederholt.

Was die Anwendung **kann**, in einem Absatz: eine Organisation legt
Veranstaltungsreihen und darin Events an, pflegt Programm, Räume und
Registrierungsformulare, lädt ehemalige Teilnehmende ein, moderiert Vorschläge
und Forumsbeiträge und sieht die Teilnehmerübersicht. Eine interessierte Person
findet Reihen und Events ohne Anmeldung, registriert sich per Double-Opt-In,
legt ein Profil an, liest das Programm, stellt sich einen eigenen Plan
zusammen, sucht andere Profile, schreibt Nachrichten und checkt am Einlass per
QR-Code ein.

## 1.2 Qualitätsziele

Die Thesis nennt fünfzehn nicht funktionale Anforderungen; alle gelten.
[Abschnitt 10](10-qualitaetsanforderungen.md) ordnet sie als Qualitätsbaum mit
Szenarien. Die **drei**, die im Zweifel entscheiden, stehen hier — sie sind die,
an denen in fünf Phasen tatsächlich Entscheidungen gekippt sind:

| Ziel                           | Warum es vorne steht                                                                                                                                                                                                                                           |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Datenschutz** (NFR 7, NFR 9) | Die Zielgruppe verwaltet Daten von Aktivistinnen und Aktivisten. Daraus folgen: eine Instanz je Organisation, kein Google-Dienst, keine fremde Ressource auf einer Seite dieser Anwendung, Profile nur mit ausdrücklichem Opt-in auffindbar.                   |
| **Installierbarkeit** (NFR 15) | Wer keine IT-Abteilung hat, richtet nichts ein, was mehr als `docker compose up` und eine ausgefüllte `.env` verlangt. Migrationen laufen beim Start, die Ersteinrichtung geht über einen Token, und was der Betreiber selbst tun muss, steht in `INSTALL.md`. |
| **Nachhaltigkeit** (NFR 3)     | Zweitwichtigste Anforderung der Umfrage (Ø 3,83/4). Sie ist der Grund für LTS-Technologien mit großer Community, für AGPL statt GPL und dafür, dass eine Erweiterung ein Plug-in ist und kein Fork.                                                            |

Direkt dahinter, und in der Umfrage sogar noch höher bewertet: die
**Teilnehmerübersicht** (3,86/4) und die **intuitive Bedienung** (3,76/4). Die
erste ist eine funktionale Anforderung und kein Qualitätsziel; die zweite ist
NFR 4 und der Grund, warum Phase 5 ein eigenes Paket für den Abgleich mit den
Mockups hat.

**Der Prioritäten-Kompass**, wenn zwei Dinge sich widersprechen:
Teilnehmerübersicht (3,86) > Nachhaltigkeit (3,83) > intuitive Bedienung (3,76)

> Info-Darstellung für Teilnehmende (3,74) > Registrierung (3,69). Und
> übergreifend: **Eventmanagement (Ø 3,39) vor Community-Bildung (Ø 2,89)** — im
> Zweifel wird zuerst das Eventmanagement fertig.

## 1.3 Stakeholder

| Stakeholder                                              | Erwartung an die Architektur                                                                                                                                                  |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Veranstalter** (Admin-Rolle einer NGO)                 | Eine Oberfläche, die ohne Schulung bedienbar ist, und eine Instanz, die er selbst konfiguriert — Farben, Logo, Schrift, Sprachen, Module.                                     |
| **Nutzer / Teilnehmende**                                | Mobile-first, ohne Login bis zur Landingpage, mit Login alles Weitere. Installierbar als PWA, weil vor Ort das Netz schlecht ist.                                             |
| **Interessierte Person**                                 | Kommt ohne Konto bis zur Kontaktaufnahme. Wird per Mail beantwortet, nicht in einer App, die sie nicht hat.                                                                   |
| **Betreiber** (oft dieselbe Person wie der Veranstalter) | Fünf Container, eine `.env`, ein Backup-Verfahren. Keine Kubernetes-Kenntnisse, kein Cloud-Konto. → [`INSTALL.md`](../INSTALL.md)                                             |
| **Plug-in-Autor**                                        | Ein versionierter Vertrag, der sich nicht unter ihm wegbewegt, und eine Anleitung, die ohne Lektüre fremden Codes ausreicht. → [Abschnitt 8](08-querschnittliche-konzepte.md) |
| **Pilotpartner** Democracy International e. V.           | Ein Usability-Test, der die sieben Aufgaben der Thesis wiederholt, und eine Instanz mit Demo-Daten dafür.                                                                     |
| **Wissenschaftlicher Kontext** (WBH)                     | Nachvollziehbarkeit: jede Abweichung von der Thesis ist als Entscheidung protokolliert, nicht als Zufall. → [Abschnitt 9](09-architekturentscheidungen.md)                    |

Ein Stakeholder fehlt hier bewusst: **der zahlende Kunde.** Es gibt keinen. Das
Projekt hat kein Geschäftsmodell, keinen SaaS-Betrieb und keine
Mandantenfähigkeit — und das ist eine Architekturentscheidung, keine Lücke
(siehe [Abschnitt 2](02-randbedingungen.md)).

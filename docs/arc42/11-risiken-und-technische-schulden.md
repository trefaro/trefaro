# 11 Risiken und technische Schulden

Die vollständige Liste steht in **[`todo.md`](../../todo.md)**, nach Phase
gruppiert und nach jeder Phase durchgegangen. Dieser Abschnitt sagt, **wie sie
gelesen wird** und welche vier Dinge v1.0 offen lässt. Eine zweite Kopie der
Liste stünde hier in dem Moment falsch, in dem jemand einen Haken setzt (E70).

## 11.1 Wie `todo.md` gelesen wird

| Abschnitt                            | Was darin steht                                                                                                            |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| **Known gaps in the current state**  | **Zuerst lesen.** Nicht aufgeschobene Prüfung, sondern das, was wirklich fehlt und weh täte, wäre die Instanz heute offen. |
| **On a device — waiting for Marius** | Was einen Produktionsbau und echte Geräte braucht. In diesem Repository nicht abhakbar.                                    |
| **Questions for the pilot partner**  | Was hier niemand entscheiden kann, weil es die Organisation betrifft. Absichtlich später gefragt.                          |
| **Checkable after phase N**          | Was mit dem Ende einer Phase prüfbar wird. Jeder Umzug zwischen den Abschnitten trägt einen Grund.                         |
| **Decided**                          | Was entschieden und damit aus dem Weg ist.                                                                                 |

Und die Regel, die die Liste ehrlich hält: **ein Eintrag wird abgehakt, nicht
gelöscht**, und ein Haken bekommt die Begründung dazu. Wer einen Eintrag
verschiebt, schreibt hin, warum.

## 11.2 Der Stand zum Abschluss der Phase 5

**Der Abschnitt _Known gaps_ ist leer** — alle Einträge sind abgehakt. Die
letzten drei fielen in Phase 5: die Ersteinrichtung einer frischen
Produktionsinstanz, der kombinierte E2E-Lauf, der nicht mehr lesbar war, und die
Vertragssuite, die Zeilen hinterließ.

Was bleibt, ist **nicht** unbekannt, sondern benannt:

| Offen                                                               | Warum es offen bleibt                                                                                                                 |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Die Gerätematrix** — PWA-Installation und Push auf echten Geräten | Braucht Geräte in der Hand. Kein Emulator beantwortet, ob iOS die Installation anbietet und ob eine Benachrichtigung ankommt.         |
| **Eine Kamera am Einlass**                                          | Der QR-Check-In ist gebaut und funktioniert auch ohne Kamera (Eingabe des Codes). Die Kamerazeile der Matrix ist die eine, die fehlt. |
| **Die Zustellbarkeit beim Betreiber**                               | SPF, DKIM, DMARC stehen in der DNS-Zone der Organisation. E63 hat daraus ausdrücklich eine Betreiberaufgabe mit Prüfliste gemacht.    |
| **Der Usability-Test mit dem Pilotpartner**                         | Wird vorbereitet und übergeben; gefahren wird er von Menschen. M16 hängt nicht daran.                                                 |

Dazu ein **Flackern in der Veranstaltersuite**, das seit AP 10 der Phase 4 einen
Testnamen hat — kein Produktfehler, aber eine Stelle, an der ein Lauf gelegentlich
lügt.

## 11.3 Architekturrisiken, die bleiben

Nicht Schulden, sondern Eigenschaften dieses Entwurfs, die man kennen muss:

| Risiko                                                                                                 | Was ihm entgegensteht                                                                                                                                |
| ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Ein Plug-in läuft mit vollem Seitenzugriff.** Es gibt keine Sandbox.                                 | v1 installiert nichts zur Laufzeit nach; kuratiert heißt gelesen. Die Prüfung ist ein **menschlicher Schritt** und wird im SDK-Leitfaden so benannt. |
| **Der Vertrag ist für v1.0 geschlossen.** Eine fehlende Fähigkeit ist ein Hauptversionsschritt.        | Zwei Fähigkeiten wurden vor dem Schluss ausdrücklich geprüft und begründet nicht gebaut — die Entscheidung steht, nicht das Versehen.                |
| **Eine Instanz je Organisation** heißt: so viele Instanzen wie Organisationen.                         | Fünf Container, ein `docker compose up`, Migrationen beim Start. Der Preis für Mandantenfähigkeit wäre ein anderes Produkt gewesen.                  |
| **Keine Telemetrie** heißt: niemand erfährt von einem Fehler, wenn der Betreiber nicht hinsieht.       | Betriebszahlen und Log lokal, eine Fehlermarke in der Oberfläche, mit der ein Mensch die Zeile findet — ohne dass ein Name darin steht.              |
| **Der Katalog wächst mit jedem Bildschirm.** 1289 Schlüssel, und `en.json` ist die Liste.              | Jeder neue Bildschirm liefert seine Schlüssel in beiden Sprachen; eine Vollständigkeitszahl zeigt der Organisation, was fehlt.                       |
| **Zwei Clients heißen zwei Browsersuiten**, und ein geteiltes Bauteil muss in beiden angesehen werden. | Die Suiten zeigen auf Rollen und Beschriftungen statt auf CSS-Klassen; geteilte Bauteile haben eigene Unit-Tests.                                    |

## 11.4 Und der Tag

**v1.0 taggt ein Mensch** (E71). Das Abschlusspaket der Phase 5 stellt die
Release-Fähigkeit fest und listet, worauf sie sich stützt und was offen bleibt —
es setzt keinen Tag und baut nichts nach, was ein Pilotpartner erst noch sagen
muss.

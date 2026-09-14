# Der Stack, wie er ausgeliefert wird

Ein Skript, das die fünf Container aus `infra/docker-compose.yml` **aus leerem
Volume** hochfährt, die Instanz so einrichtet, wie ein Betreiber es tut, und
einen echten Browser darauf loslässt — Produktionsbuilds, echter Service
Worker, echtes NGINX.

```bash
tools/shipped-stack/verify.sh
```

Aus der Wurzel des Arbeitsbereichs. Das Skript braucht Docker und einen freien
Port (Vorgabe 8080).

## Warum es das gibt

Am 28.08.2026 war der Veranstalter-Client im Produktionsbetrieb nicht
erreichbar, und **jede** Suite dieses Repositories war grün. Der Service Worker
des Nutzer-Clients hat Scope `/` — also auch `/admin/` —, und `navigationUrls`
schloss `/admin` nicht aus; die Wildcard-Route des Nutzer-Clients leitete jede
Navigation dorthin auf `/` um.

Gesehen hat es nichts, und zwar aus je einem guten Grund:

| Prüfung             | blind, weil                                            |
| ------------------- | ------------------------------------------------------ |
| Unit-Tests          | kein Service Worker                                    |
| API-Vertragssuite   | benutzt `fetch`, das keinen Worker ausführt            |
| Beide Browsersuiten | laufen gegen `nx serve`, wo Angular keinen registriert |
| `images`-Job der CI | **baut** die Images, ohne sie je zusammen zu starten   |

Dieses Skript ist das fehlende Netz. Es läuft im CI-Job `stack` und lokal mit
demselben Kommando — absichtlich dasselbe, damit „bei mir lief es" und „die CI
sagt grün" dieselbe Sache bedeuten.

## Was es der Reihe nach tut

1. Schreibt ein `.env` mit **je Lauf erzeugten** Geheimnissen
   (`AUTH_SECRET` mit 32 Byte — ein handgeschriebenes unterschreitet das leicht,
   und der Server läuft dann in einer Absturzschleife).
2. `docker compose … up -d --build` gegen ein **leeres** Volume, unter eigenem
   Projektnamen (`trefaro-shipped`), damit keine Entwicklungsinstanz in die
   Quere kommt.
3. Wartet auf `/api/health`.
4. **Richtet die Instanz über den geführten Weg ein** — `ADMIN_BOOTSTRAP_*`
   bleibt leer, das Skript liest den Setup-Token aus dem Serverlog und fährt
   `verify-setup.mjs`. Das ist der Pfad, den ein echter Betreiber geht, und der
   einzige, den **keine** Suite dieses Repositories erreichen kann: die
   Endpunkte existieren nur, solange `admin_user` leer ist, und der letzte
   Administrator ist nicht löschbar.
5. `verify-proxy.mjs` — Proxy, Manifest, und das `ngsw.json` gegen ngsws eigene
   Auswahlregel.
6. `nx run stack-e2e:e2e-stack` — ein Browser mit dem Worker **wirklich
   registriert und in Kontrolle** der Seite. Das ist die verhaltensmäßige
   Hälfte; Punkt 5 ist die statische.
7. Räumt ab — `down -v`, auch wenn es fehlschlägt — und nennt die Laufzeit.

## Umgebung

| Variable        | Vorgabe           | Bedeutung                                   |
| --------------- | ----------------- | ------------------------------------------- |
| `STACK_PROJECT` | `trefaro-shipped` | Compose-Projektname                         |
| `STACK_PORT`    | `8080`            | Port, den der Proxy veröffentlicht          |
| `STACK_KEEP`    | —                 | auf `1` setzen, um den Stack stehenzulassen |

`STACK_KEEP=1` ist der Weg, um nach einem Fehlschlag hineinzusehen; abgeräumt
wird dann von Hand mit `docker compose -p trefaro-shipped down -v`.

## Was es ausdrücklich nicht ist

**Kein Ersatz für `tools/spike-verification/`.** Jene Skripte prüfen eine
_laufende_ Instanz, die jemand anders hochgefahren hat — ein echtes Deployment,
mit TLS, mit echter Mail. Dieses hier erzeugt seine eigene Wegwerf-Instanz und
prüft die Montage. Die Trennung ist beabsichtigt (`docs/rules/deployment.md`).

**Keine zweite Kopie der Browsersuiten.** `apps/stack-e2e` hält bewusst eine
Handvoll Tests, und jeder davon behauptet etwas, das nur im ausgelieferten
Stack existiert. Was auf einer geseedeten Zeile steht, gehört in eine der
beiden Client-Suiten.

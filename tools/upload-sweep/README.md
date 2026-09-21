# Upload sweep

Listet das Upload-Volume, verbindet es mit jeder Spalte der Datenbank, die
einen gespeicherten Pfad hält, und **meldet**, wo beide auseinanderlaufen. Er
löscht nichts — und wird es nie tun.

```bash
# gegen den Container-Stack (infra/docker-compose.yml, Projekt `trefaro`)
node tools/upload-sweep/sweep.mjs

# gegen einen Stack unter einem anderen Compose-Projekt
SERVER_CONTAINER=trefaro-look-server-1 \
  POSTGRES_CONTAINER=trefaro-look-postgres-1 \
  node tools/upload-sweep/sweep.mjs
```

## Warum es das gibt

`AttachmentsService` hält Datenbank und Volume in Übereinstimmung, und wo das
nicht geht — es gibt keine Transaktion über PostgreSQL und ein Dateisystem —
gleicht er **zugunsten der Bytes** aus: ein Bytebereich, auf den niemand zeigt,
kostet Platz und wird protokolliert; eine Zeile, die auf eine gelöschte Datei
zeigt, kostet einen Veranstalter das Dokument, das er einsammeln sollte. Das ist
die richtige Richtung, und sie hat eine Folge: **ein Absturz zwischen zwei
Schritten kann eine Datei hinterlassen, auf die keine Zeile zeigt** — und bisher
fand die niemand.

Gemeldet wird in **beide** Richtungen. Die zweite ist die ernstere: eine Zeile
ohne ihre Datei ist ein Download, der einem Veranstalter 404 antwortet, und der
Server sagt das erst, wenn zufällig jemand danach fragt.

## Was er nicht tut

- **Löschen.** Ein Werkzeug, das wegen einer falschen Abfrage das Visum einer
  Teilnehmerin löschen kann, ist ein größeres Problem als das, welches es löst.
  Die Liste ist für einen Menschen mit der Datei vor sich.
- **Über ein Schema urteilen, das er nicht kennt.** Vor dem ersten Vergleich
  fragt er `information_schema`, welche Spalten nach einem Pfad aussehen. Findet
  er eine, die nicht in `PATH_COLUMNS` steht, meldet er **gar nichts** und
  bricht ab — sonst wäre jede Datei eines neuen Moduls „vergessen".
- **Frische Dateien anfassen.** `store()` schreibt erst die Datei und dann die
  Zeile; zwischen den beiden Momenten ist eine Datei zu Recht unreferenziert.
  Alles, was jünger ist als `SWEEP_GRACE_MINUTES` (15), bleibt außen vor.

## Umgebung

| Variable              | Vorgabe              | Wofür                          |
| --------------------- | -------------------- | ------------------------------ |
| `SERVER_CONTAINER`    | `trefaro-server-1`   | Wo das Volume gemountet ist    |
| `POSTGRES_CONTAINER`  | `trefaro-postgres-1` | Wo die Zeilen liegen           |
| `DATABASE_USER`       | `trefaro`            | Für `psql`                     |
| `DATABASE_NAME`       | `trefaro`            | Für `psql`                     |
| `UPLOAD_DIR`          | `/app/uploads`       | `UPLOAD_DIR` des Server-Images |
| `SWEEP_GRACE_MINUTES` | `15`                 | Wie jung eine Datei sein darf  |

Kein Containername als Literal — die Regel von `tools/CLAUDE.md`: ein Lauf, der
rät, listet das eine Volume gegen die Zeilen des anderen.

## Rückgabewerte

| Code | Bedeutung                                                     |
| ---- | ------------------------------------------------------------- |
| `0`  | Volume und Datenbank stimmen überein                          |
| `2`  | Es gibt etwas anzusehen — verwaiste Dateien oder fehlende     |
| `1`  | Der Lauf konnte nicht stattfinden (Container weg, Zugang weg) |

Drei statt zwei, damit ein Cron-Eintrag „da ist etwas" von „das lief nicht"
unterscheiden kann.

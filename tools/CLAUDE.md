# Hinweise für diesen Teilbaum

Beide Werkzeuge hier laufen gegen eine **laufende** Instanz, nicht im CI:
`spike-verification/` prüft ein Deployment, `demo-seed/` füllt es — ausschließlich
über die API, damit kein Zustand entsteht, den die Anwendung selbst ablehnen
würde.

Vor Änderungen: [`docs/rules/deployment.md`](../docs/rules/deployment.md).
Die zwei Regeln, die hier am häufigsten gebrochen wurden:

- **Kein Containername als Literal.** Die Adresse kommt aus `BASE`, der
  Datenbankzugriff zusätzlich aus `POSTGRES_CONTAINER`, `DATABASE_USER`,
  `DATABASE_NAME` — sonst prüft ein Lauf die eine Instanz und verändert die andere.
- **Ein Prüfskript nagelt keinen konfigurierbaren Wert fest, sondern seine Form.**
  Eine gebrandete Instanz ist der Normalfall.

# Hinweise für diesen Teilbaum

Bevor du hier Code schreibst, lies die Regeln zu diesem Bereich — sie enthalten
Entscheidungen, die aus dem Code nicht ablesbar sind:

- [`docs/rules/server-layers.md`](../../docs/rules/server-layers.md) — Schichten,
  Ports, Zusammensetzungen, Plug-in-Vertrag. **Layer-Grenzen sind ESLint-Regeln
  in `eslint.config.mjs`: bei einem Verstoß einen Port einziehen, nie die Regel
  lockern.**
- [`docs/rules/api-contracts.md`](../../docs/rules/api-contracts.md) — bevor du
  einen Endpunkt anlegst (Admin-Präfix, Slugs, ein Endpunkt je Bildschirm,
  Modul-404, `?locale=`).
- [`docs/rules/data-model.md`](../../docs/rules/data-model.md) — bevor du eine
  Entity oder Migration schreibst.
- [`docs/rules/mail.md`](../../docs/rules/mail.md) — bevor du an ausgehender Mail
  arbeitest.
- [`docs/rules/i18n.md`](../../docs/rules/i18n.md) — Katalog, Fehlermeldungen,
  Inhaltsübersetzungen.
- [`docs/rules/tooling-traps.md`](../../docs/rules/tooling-traps.md) — wenn ein
  Zählwert oder ein Pfad im Test unerklärlich ist.

# Hinweise für diesen Teilbaum

Bevor du hier Code schreibst, lies die Regeln zu diesem Bereich — sie enthalten
Entscheidungen, die aus dem Code nicht ablesbar sind:

- [`docs/rules/angular-clients.md`](../../docs/rules/angular-clients.md) —
  Template-, Formular- und Signal-Fallen, die `tsc` nicht findet. **Dieser Client
  läuft zoneless: eine in TypeScript gebaute Beschriftung muss
  `TranslationService.locale()` in derselben `computed()` lesen (F72).**
- [`docs/rules/i18n.md`](../../docs/rules/i18n.md) — bevor du einen
  Übersetzungsschlüssel anlegst oder eine Beschriftung fest verdrahtest.
- [`docs/rules/whitelabel-pwa.md`](../../docs/rules/whitelabel-pwa.md) — Farben,
  Kontrast, Branding-Dateien, Icons, Manifest.
- [`docs/rules/e2e-tests.md`](../../docs/rules/e2e-tests.md) — für die
  Browsersuite dieses Clients (`../admin-client-e2e`).

# Hinweise für diesen Teilbaum

Bevor du hier etwas änderst, lies
[`docs/rules/deployment.md`](../docs/rules/deployment.md) und
[`docs/rules/infrastructure.md`](../docs/rules/infrastructure.md).

Die zwei Fehler, die hier am teuersten waren:

- **Eine Umgebungsvariable lebt an drei Stellen** — `env.ts`, `.env.example` und
  `docker-compose.yml` muss sie an den Container **durchreichen**. Genau das
  fehlte bei `ADMIN_BOOTSTRAP_*`, und eine frische Produktionsinstanz hatte
  keinen Administrator.
- **Was nur im Containerbetrieb oder nur im Produktionsbuild passiert, sieht
  keine Testsuite dieses Repositories.** Wer „grün" sagen will, hat den Stack
  hochgefahren und `tools/spike-verification/` dagegen laufen lassen.

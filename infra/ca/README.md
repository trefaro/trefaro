# Zusätzliche Zertifikate für ausgehende Verbindungen

Dieses Verzeichnis wird vom Server-Container unter `/etc/trefaro/ca` eingehängt
(`infra/docker-compose.yml`). Normalerweise ist es leer.

Es gibt genau einen Grund, etwas hineinzulegen: **der Mailserver der
Organisation hat ein Zertifikat, für das keine öffentliche Zertifizierungsstelle
bürgt** — ein interner Server, eine eigene CA. Dann kommt die Zertifikatsdatei
hierher und `NODE_EXTRA_CA_CERTS` in der `.env` zeigt darauf:

```
NODE_EXTRA_CA_CERTS=/etc/trefaro/ca/mail.pem
```

**Nie** gibt es stattdessen einen Schalter, der die Prüfung abschaltet (E62).
Ein solcher Schalter gilt für jede Verbindung dieses Prozesses, für immer, und
niemand sieht ihm an, welches Problem er einmal gelöst hat. Ein benanntes
Zertifikat gilt für genau einen Server und steht in der `.env`, wo es jeder
findet.

Wie das lokal aussieht, zeigt `tools/secure-mail/` — inklusive eines
Mailservers, der ohne Anmeldung und ohne Verschlüsselung ablehnt.

# shared-config

The start-up sequence both clients share: fetch `/api/config` first, apply the
theme, then load the plug-in bundles. `provideTrefaroConfig()` wires it up,
`AppConfigService` holds the answer as signals, and `startup-timeout.ts` decides
how long a client waits before rendering without the server — a client that hangs
because the API is slow is a worse instance than one that renders unthemed.

```bash
nx test shared-config
```

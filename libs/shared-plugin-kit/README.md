# shared-plugin-kit

What a **plug-in bundle** needs of the host, without the host: the words the
slot hands over (E48), instants in the reader's language, and a plug-in's own
routes over `fetch` with the two errors every bundle reads (E58).

Created in AP 6 of phase 4, when the third bundle would have copied the same
lines a third time (F138). Framework-free on purpose — a bundle is a web
component fetched at runtime and carries no second HTTP stack or translation
library; and deliberately **not** `shared-plugins`, which belongs to the host
and injects the host's Angular services.

Depends on `shared-models` alone, for the catalogue prefix a plug-in key
derives.

```bash
nx test shared-plugin-kit    # Jest — no browser environment needed
```

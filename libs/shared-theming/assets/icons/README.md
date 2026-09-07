# Bundled icons

The glyphs a plug-in descriptor, a tile or a navigation entry may name (E49).
Unlike the fonts, nothing here is served: the path data is TypeScript in
`../../src/lib/icon-paths.ts`, drawn by `TrefaroIcon`, so an icon costs no
request at all. This directory holds what the data brings with it — its licence
and where it came from.

**Material Symbols**, by Google, licensed under the **Apache License 2.0**; the
full text is in `licenses/MaterialSymbols-Apache-2.0.txt`. Apache-2.0 permits
bundling and redistribution and does not conflict with the AGPL of the
surrounding code — the glyphs stay a separate work under their own licence, as
the fonts do under the OFL.

| Vendored from                      | Style      | Taken                                          |
| ---------------------------------- | ---------- | ---------------------------------------------- |
| `@material-symbols/svg-400@0.47.1` | `outlined` | the `d` attribute of each `<path>`, unmodified |

Upstream is https://github.com/google/material-design-icons; the npm package
above (https://github.com/marella/material-symbols) is the optimized SVG mirror
the files were copied out of. It is deliberately **not** a dependency of this
repository: an instance builds from a checkout without it, the same reason the
`.woff2` files were copied in rather than pulled from `node_modules` at build
time. The version above is what to update against.

Seven glyphs, chosen because something names them: five plug-ins of phase 4
(`meeting_room`, `lightbulb`, `forum`, `qr_code_2`, `event_note`) and the two
core tiles of the participant's event page (`event`, `link`). The set is closed
and the names live in `ICON_NAMES` in `@trefaro/shared-models` — adding one
means adding both halves, and the compiler says so if only one arrives.

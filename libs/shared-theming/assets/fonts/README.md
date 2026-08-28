# Bundled fonts

Four families an organization can pick in the design settings (FR 1.4), plus
`system-ui`, which needs no file. Self-hosted because NFR 9 rules out
third-party services — a webfont from a foreign origin hands that origin the IP
address of every visitor.

All four are licensed under the **SIL Open Font License 1.1**; the full texts
are in `licenses/`, one per family. The OFL permits bundling and redistribution
and does not conflict with the AGPL of the surrounding code — the fonts stay
separate works under their own licence.

| Family                     | Upstream                                                  | Vendored from                                           |
| -------------------------- | --------------------------------------------------------- | ------------------------------------------------------- |
| Inter                      | https://github.com/rsms/inter                             | `@fontsource-variable/inter@5.3.0`                      |
| Source Sans 3              | https://github.com/adobe-fonts/source-sans                | `@fontsource-variable/source-sans-3@5.3.0`              |
| Atkinson Hyperlegible Next | https://github.com/googlefonts/atkinson-hyperlegible-next | `@fontsource-variable/atkinson-hyperlegible-next@5.3.0` |
| Lora                       | https://github.com/cyrealtype/Lora-Cyrillic               | `@fontsource-variable/lora@5.3.0`                       |

The files are copied in rather than pulled from `node_modules` at build time on
purpose: the packages are not dependencies of this repository, so an instance
builds from a checkout without them, and the licence text sits next to the bytes
it belongs to. The versions above are what to update against.

Taken from each package: the `wght`-axis variable `.woff2`, upright, in the
`latin` and `latin-ext` subsets — eight files, ~380 kB in total. `fonts.css` one
level up says why those and not others, and is where a new family is declared.

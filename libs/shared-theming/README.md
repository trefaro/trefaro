# shared-theming

Whitelabel theming through CSS custom properties: `theme-variables.ts` computes
the shades of the primary and accent colour, `ThemeService` writes them onto the
document root.

Custom properties rather than compiled styles because plug-ins are web components
that bring no CSS of their own (architecture rule 3) — they inherit the
organization's colours by being inside the page, and that only works if the
theme lives in inherited properties.

`assets/` holds the other half of the design settings: the four bundled font
families (`assets/fonts/`, all SIL OFL 1.1) and `assets/fonts.css`, which
declares them. Both client builds list `fonts.css` in their `styles`, so the
bundler emits the `.woff2` files as hashed build assets — nothing is ever
fetched from a foreign origin (NFR 9). `assets/fonts/README.md` records where
each family came from; the keys that select them are `FONT_FAMILIES` in
`@trefaro/shared-models`, and a test there fails if a family is offered without
being declared.

`icon-paths.ts` and `icon.ts` are the icons (E49): the glyph data of the closed
catalogue `ICON_NAMES` in `@trefaro/shared-models`, and the one component that
draws it. Inline SVG rather than an icon font, so an icon inherits
`currentColor` and needs no theming rule; `assets/icons/README.md` records the
provenance and keeps the Apache-2.0 text beside the font licences. A name the
catalogue does not know renders nothing at all — the module administration is
where a plug-in that names one is reported.

```bash
nx test shared-theming
```

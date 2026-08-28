# shared-theming

Whitelabel theming through CSS custom properties: `theme-variables.ts` computes
the shades of the primary and accent colour, `ThemeService` writes them onto the
document root.

Custom properties rather than compiled styles because plug-ins are web components
that bring no CSS of their own (architecture rule 3) — they inherit the
organization's colours by being inside the page, and that only works if the
theme lives in inherited properties.

```bash
nx test shared-theming
```

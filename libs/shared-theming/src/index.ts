/**
 * Whitelabel theming shared by both clients (FR 1.4).
 *
 * The theme reaches plug-in web components through inherited CSS custom
 * properties, which is what allows the architecture to forbid plug-ins from
 * shipping CSS.
 */
export { deriveThemeVariables, readableTextColor } from './lib/theme-variables';
export { FALLBACK_THEME, ThemeService } from './lib/theme.service';

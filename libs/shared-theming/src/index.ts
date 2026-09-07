/**
 * Whitelabel theming shared by both clients (FR 1.4).
 *
 * The theme reaches plug-in web components through inherited CSS custom
 * properties, which is what allows the architecture to forbid plug-ins from
 * shipping CSS.
 *
 * Since AP 1 of phase 4 the library also holds the icons (E49): the glyph data
 * of the closed catalogue in `@trefaro/shared-models` and the one component
 * that draws it. They are here because this is where the brand already is, and
 * because an icon that inherits `currentColor` needs no theming rule at all.
 */
export {
  MIN_DERIVED_TEXT_CONTRAST,
  MIN_SURFACE_CONTRAST,
  MIN_TEXT_CONTRAST,
  PAGE_BACKGROUND_COLOR,
  contrastRatio,
  deriveThemeVariables,
  readableTextColor,
} from './lib/theme-variables';
export { FALLBACK_THEME, ThemeService } from './lib/theme.service';
export { ICON_PATHS, ICON_VIEW_BOX, iconPath } from './lib/icon-paths';
export { TrefaroIcon } from './lib/icon';

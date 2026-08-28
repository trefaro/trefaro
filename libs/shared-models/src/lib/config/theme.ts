/**
 * Whitelabel theme as the server hands it to the clients (FR 1.4).
 *
 * Only the two brand colours, the logo and the font are configured; every other
 * shade is derived in the clients so an organization has two colours to pick,
 * not twenty. The derived steps are published as CSS custom properties, which
 * is also how plug-in web components inherit the design without shipping CSS.
 */
export interface Theme {
  /** Primary brand colour, always hexadecimal — see {@link isHexColor}. */
  readonly primaryColor: string;
  /** Accent colour used for calls to action and highlights. */
  readonly accentColor: string;
  /** URL of the organization's logo, or `null` while none is uploaded. */
  readonly logoUrl: string | null;
  /**
   * The font stack, expanded from the stored catalogue key by
   * `fontFamilyStack`. Fonts are self-hosted — never loaded from a CDN, because
   * NFR 9 rules out third-party services that leak visitor data.
   */
  readonly fontFamily: string;
}

/**
 * The only colour notation a brand colour may be given in (E17).
 *
 * `#rgb` or `#rrggbb`, no alpha. Narrow on purpose: `readableTextColor` has to
 * decide whether a button gets black or white text, and it returns white for
 * anything it cannot parse. A stored `oklch()` or a named colour would render
 * fine and silently take the wrong text colour with it — an unreadable button
 * that no test catches, because the value is valid CSS.
 *
 * Alpha is refused for the same reason: a half-transparent brand colour composites
 * against whatever is behind it, and what that is depends on the page.
 */
export const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** Whether a value may be stored as a brand colour (E17). */
export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOR_PATTERN.test(value);
}

/**
 * Whitelabel theme as the server hands it to the clients (FR 1.4).
 *
 * Only the two brand colours, the logo and the font are configured; every other
 * shade is derived in the clients so an organization has two colours to pick,
 * not twenty. The derived steps are published as CSS custom properties, which
 * is also how plug-in web components inherit the design without shipping CSS.
 */
export interface Theme {
  /** Primary brand colour as a CSS colour, e.g. `#1f6f5c`. */
  readonly primaryColor: string;
  /** Accent colour used for calls to action and highlights. */
  readonly accentColor: string;
  /** URL of the organization's logo, or `null` while none is uploaded. */
  readonly logoUrl: string | null;
  /**
   * Font family stack. Fonts are self-hosted — never loaded from a CDN, because
   * NFR 9 rules out third-party services that leak visitor data.
   */
  readonly fontFamily: string;
}

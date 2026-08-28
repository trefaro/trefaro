import type { Theme } from '@trefaro/shared-models';

/**
 * Turns the two configured brand colours into the full set of CSS custom
 * properties the applications and all plug-ins render against (FR 1.4).
 *
 * The graduated shades are expressed as `color-mix()` rather than computed here
 * on purpose:
 *
 * - the browser mixes in a perceptual space (oklab), which keeps a light and a
 *   dark brand colour equally usable — naive RGB interpolation does not;
 * - a shade stays derived. Change `--trefaro-color-primary` at runtime and every
 *   step follows, including inside plug-in web components.
 *
 * Custom properties inherit across shadow DOM boundaries, which is exactly why
 * the architecture can require plug-ins to ship no CSS of their own.
 */
export function deriveThemeVariables(theme: Theme): Record<string, string> {
  return {
    '--trefaro-color-primary': theme.primaryColor,
    '--trefaro-color-primary-soft':
      'color-mix(in oklab, var(--trefaro-color-primary) 12%, white)',
    '--trefaro-color-primary-muted':
      'color-mix(in oklab, var(--trefaro-color-primary) 40%, white)',
    '--trefaro-color-primary-strong':
      'color-mix(in oklab, var(--trefaro-color-primary) 78%, black)',
    '--trefaro-color-on-primary': readableTextColor(theme.primaryColor),

    '--trefaro-color-accent': theme.accentColor,
    '--trefaro-color-accent-soft':
      'color-mix(in oklab, var(--trefaro-color-accent) 12%, white)',
    '--trefaro-color-accent-muted':
      'color-mix(in oklab, var(--trefaro-color-accent) 40%, white)',
    '--trefaro-color-accent-strong':
      'color-mix(in oklab, var(--trefaro-color-accent) 78%, black)',
    '--trefaro-color-on-accent': readableTextColor(theme.accentColor),

    '--trefaro-font-family': theme.fontFamily,
    // `none` rather than an empty value: a CSS `url()` with an empty string
    // resolves against the current document and would refetch the page.
    '--trefaro-logo-url': theme.logoUrl ? `url("${theme.logoUrl}")` : 'none',
  };
}

/**
 * Picks black or white text for a background colour.
 *
 * A whitelabel application cannot assume a dark brand colour: an organization
 * with a bright yellow logo must still get readable buttons. Uses the WCAG
 * relative luminance formula and the threshold where contrast against black and
 * against white is equal.
 *
 * Returns white for colours it cannot parse — the safer guess for brand colours,
 * which skew dark, and a case that only arises for notations the browser
 * understands but this function does not.
 */
export function readableTextColor(color: string): string {
  const rgb = parseSrgb(color);
  if (!rgb) return '#ffffff';

  const luminance =
    0.2126 * toLinear(rgb.r) +
    0.7152 * toLinear(rgb.g) +
    0.0722 * toLinear(rgb.b);

  return luminance > 0.179 ? '#000000' : '#ffffff';
}

interface Srgb {
  r: number;
  g: number;
  b: number;
}

/**
 * Parses the notations that can reach this function.
 *
 * A stored brand colour is hexadecimal since E17 — `isHexColor` is what the API
 * accepts — so the `rgb()` branch is for the fallback theme and for anything a
 * caller hands in directly. It stays because dropping it would silently turn a
 * readable button white, which is the failure this whole function exists to
 * avoid.
 */
function parseSrgb(color: string): Srgb | null {
  const value = color.trim().toLowerCase();

  const hex = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(
    value,
  );
  if (hex) {
    const digits = hex[1];
    // #rgb and #rgba are shorthand: each digit doubles.
    const step = digits.length <= 4 ? 1 : 2;
    const channel = (index: number): number => {
      const slice = digits.slice(index * step, index * step + step);
      const full = step === 1 ? slice + slice : slice;
      return parseInt(full, 16) / 255;
    };
    return { r: channel(0), g: channel(1), b: channel(2) };
  }

  const rgb = /^rgba?\(([^)]+)\)$/.exec(value);
  if (rgb) {
    const parts = rgb[1]
      .split(/[\s,/]+/)
      .filter(Boolean)
      .slice(0, 3);
    if (parts.length < 3) return null;
    const channels = parts.map((part) =>
      part.endsWith('%') ? Number(part.slice(0, -1)) / 100 : Number(part) / 255,
    );
    if (channels.some((channel) => !Number.isFinite(channel))) return null;
    return { r: channels[0], g: channels[1], b: channels[2] };
  }

  return null;
}

/** Reverses sRGB gamma encoding, as the luminance formula requires. */
function toLinear(channel: number): number {
  const clamped = Math.min(Math.max(channel, 0), 1);
  return clamped <= 0.04045
    ? clamped / 12.92
    : Math.pow((clamped + 0.055) / 1.055, 2.4);
}

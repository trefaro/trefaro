/**
 * The fonts an organization can choose (FR 1.4, E18).
 *
 * A catalogue rather than an upload, for now: the files ship in this repository
 * (`libs/shared-theming/assets/fonts/`), are served by the instance itself, and
 * carry a licence we can name. NFR 9 rules out loading a webfont from a foreign
 * origin, so "type in your house font" would mean an upload — and an upload
 * means asking an operator to warrant a licence for redistribution. That is a
 * decision about liability, not about code, and it is deferred rather than
 * refused (see `todo.md`).
 *
 * `app_config.font_family` stores the **key** of one of these entries, not the
 * stack. That is what lets a stack be corrected — a fallback added, a family
 * renamed upstream — without touching stored data, and it is where a later
 * per-instance uploaded font would attach: the key would name it, a second
 * column would say where its file is.
 *
 * The stack the clients actually receive comes from {@link fontFamilyStack} and
 * arrives as `--trefaro-font-family`, which is also how it reaches plug-in web
 * components.
 */
export interface FontFamilyOption {
  /** Stored in `app_config.font_family`; stable forever once shipped. */
  readonly key: string;
  /**
   * The family's own name, shown in the design settings.
   *
   * Not a translation key: three of these are proper nouns, and the fourth is
   * deliberately worded so it needs no translation either.
   */
  readonly label: string;
  /** The CSS value published as `--trefaro-font-family`. */
  readonly stack: string;
}

/** Used by a fresh instance, and whenever a stored key is no longer known. */
export const DEFAULT_FONT_FAMILY_KEY = 'system-ui';

/** The stack behind {@link DEFAULT_FONT_FAMILY_KEY}, needed before the list exists. */
export const DEFAULT_FONT_FAMILY_STACK = 'system-ui, sans-serif';

/**
 * Every family the instance can serve, in the order the design settings offer
 * them: the one that downloads nothing first, then the two neutral sans faces,
 * then the accessible one, then the serif.
 *
 * Each entry except the first has `@font-face` blocks in
 * `libs/shared-theming/assets/fonts.css` and a licence text beside its files.
 * All four are SIL OFL 1.1.
 */
export const FONT_FAMILIES: readonly FontFamilyOption[] = [
  {
    // Whatever the visitor's device uses for its own interface. Costs no
    // download and looks native on every platform — the right default for an
    // organization that has not decided.
    key: DEFAULT_FONT_FAMILY_KEY,
    label: 'System font',
    stack: DEFAULT_FONT_FAMILY_STACK,
  },
  {
    key: 'inter',
    label: 'Inter',
    stack: "'Inter', system-ui, sans-serif",
  },
  {
    key: 'source-sans-3',
    label: 'Source Sans 3',
    stack: "'Source Sans 3', system-ui, sans-serif",
  },
  {
    // In the catalogue for NFR 4: drawn so readers with low vision can tell
    // similar letterforms apart. "Next" is the current, variable-axis release
    // of the family; the key says so, because the key is what gets stored.
    key: 'atkinson-hyperlegible-next',
    label: 'Atkinson Hyperlegible Next',
    stack: "'Atkinson Hyperlegible Next', system-ui, sans-serif",
  },
  {
    key: 'lora',
    label: 'Lora',
    stack: "'Lora', Georgia, serif",
  },
];

/** The valid values of `app_config.font_family`, for validators and `<select>`s. */
export const FONT_FAMILY_KEYS: readonly string[] = FONT_FAMILIES.map(
  (font) => font.key,
);

export function isFontFamilyKey(value: unknown): value is string {
  return typeof value === 'string' && FONT_FAMILY_KEYS.includes(value);
}

/**
 * The CSS stack for a stored key.
 *
 * Falls back to the default rather than throwing: a key that vanished from the
 * catalogue — a family withdrawn between two releases — must not stop an
 * instance from rendering. The design settings then show the fallback, which is
 * a visible, correctable state.
 */
export function fontFamilyStack(key: string): string {
  return (
    FONT_FAMILIES.find((font) => font.key === key)?.stack ??
    DEFAULT_FONT_FAMILY_STACK
  );
}

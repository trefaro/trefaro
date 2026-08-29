/**
 * Minimal HTML for mail bodies.
 *
 * Everything is inline and self-contained: no stylesheet, no web font, no
 * tracking pixel and no remotely loaded image. A mail that fetches something
 * when it is opened tells a third party who read it and when, which for an
 * organization whose participants are activists is exactly the wrong thing to
 * do (NFR 9) — and the mail has to be readable in a plain client anyway.
 */

declare const HTML_BRAND: unique symbol;

/**
 * A string that is already safe to put into a mail body.
 *
 * A brand rather than a convention, since AP 10. The text of a mail now comes
 * from the catalogue and the values are interpolated into it, so "escape the
 * value" moved from one place per sentence to one place per parameter — and a
 * forgotten `escapeHtml` around a participant's name is a script tag in
 * somebody's inbox. With this type the compiler asks for it: everything that
 * builds markup returns {@link Html}, everything that consumes markup demands
 * it, and the only door from `string` into `Html` is {@link escapeHtml}.
 */
export type Html = string & { readonly [HTML_BRAND]: true };

/** Every value that reaches a body goes through this. */
export function escapeHtml(value: string): Html {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;') as Html;
}

/** Wraps paragraphs in a body that survives a narrow mobile client. */
export function htmlBody(...paragraphs: readonly Html[]): string {
  return [
    '<div style="font-family: system-ui, sans-serif; font-size: 16px; line-height: 1.5; max-width: 34rem;">',
    ...paragraphs.map((paragraph) => `  <p>${paragraph}</p>`),
    '</div>',
  ].join('\n');
}

/** Lines of one paragraph — an event block, for instance. */
export function htmlLines(...lines: readonly Html[]): Html {
  return lines.join('<br />') as Html;
}

/** Emphasis around something already safe. */
export function htmlStrong(content: Html): Html {
  return `<strong>${content}</strong>` as Html;
}

/** A link whose text is the destination — safe to read in a text-only client. */
export function htmlLink(url: string, label: string): Html {
  return `<a href="${escapeHtml(url)}">${escapeHtml(label)}</a>` as Html;
}

/**
 * The call to action, with the bare URL underneath.
 *
 * Deliberately not a coloured button: the organization's colours are configured
 * per instance (phase 2), and a hard-coded brand colour in a mail would be the
 * one place the whitelabel does not reach. Bold text and the visible address
 * survive a client that strips styling, which a button does not.
 */
export function htmlAction(url: string, label: string): Html {
  return (`<strong>${htmlLink(url, label)}</strong><br />` +
    `<span style="font-size: 14px; word-break: break-all;">${escapeHtml(url)}</span>`) as Html;
}

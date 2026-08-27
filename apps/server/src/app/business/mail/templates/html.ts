/**
 * Minimal HTML for mail bodies.
 *
 * Everything is inline and self-contained: no stylesheet, no web font, no
 * tracking pixel and no remotely loaded image. A mail that fetches something
 * when it is opened tells a third party who read it and when, which for an
 * organization whose participants are activists is exactly the wrong thing to
 * do (NFR 9) — and the mail has to be readable in a plain client anyway.
 */

/** Every value that reaches a body goes through this. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Wraps paragraphs in a body that survives a narrow mobile client. */
export function htmlBody(...paragraphs: readonly string[]): string {
  return [
    '<div style="font-family: system-ui, sans-serif; font-size: 16px; line-height: 1.5; max-width: 34rem;">',
    ...paragraphs.map((paragraph) => `  <p>${paragraph}</p>`),
    '</div>',
  ].join('\n');
}

/** A link whose text is the destination — safe to read in a text-only client. */
export function htmlLink(url: string, label: string): string {
  return `<a href="${escapeHtml(url)}">${escapeHtml(label)}</a>`;
}

/**
 * The call to action, with the bare URL underneath.
 *
 * Deliberately not a coloured button: the organization's colours are configured
 * per instance (phase 2), and a hard-coded brand colour in a mail would be the
 * one place the whitelabel does not reach. Bold text and the visible address
 * survive a client that strips styling, which a button does not.
 */
export function htmlAction(url: string, label: string): string {
  return (
    `<strong>${htmlLink(url, label)}</strong><br />` +
    `<span style="font-size: 14px; word-break: break-all;">${escapeHtml(url)}</span>`
  );
}

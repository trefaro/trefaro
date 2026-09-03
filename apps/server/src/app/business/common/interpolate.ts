/**
 * Fills `{{ name }}` placeholders, and leaves the ones nobody supplied.
 *
 * Left rather than emptied, which is the opposite of what Transloco does in the
 * clients — and on purpose. An organization may write `{{tage}}` into its own
 * German text where the template supplies `days`; on a screen the empty gap is
 * fixed by the next edit, but a mail has already been sent and a notification
 * has already been shown. A visible `{{tage}}` is something a recipient can
 * report and an organizer can find.
 *
 * Where escaping is involved, it happens **before** this and never after: the
 * placeholder syntax has no HTML-significant characters, so it survives
 * escaping intact, while a parameter inserted first would be escaped twice.
 *
 * In `business/common/` because two modules resolve organization-maintained
 * text against parameters — mail since AP 10 of phase 2, push since AP 11 of
 * phase 3 (F100). One implementation, because the rule above is the kind that
 * gets fixed in one copy.
 */
export function interpolate(
  template: string,
  params: Readonly<Record<string, string | number>>,
): string {
  return template.replace(/{{\s*([^}\s]+)\s*}}/g, (placeholder, name) =>
    name in params ? String(params[name]) : placeholder,
  );
}

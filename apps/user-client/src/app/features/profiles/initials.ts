/**
 * The two letters that stand in for a missing profile picture (FR 4.3, F138).
 *
 * The fourth copy of six lines was the one that moved them: the profile's own
 * picker, the search, somebody else's profile and now every row of the chat
 * draw the same circle, and they were drawing it four times. What they share
 * is not a component — that would be a shared component library, and the list
 * of shared libraries comes from the thesis' architecture — but this rule.
 *
 * Two properties are deliberate. It takes the **fields** rather than one
 * string, so a first and a last name each contribute one letter even when one
 * of them is two words; and the caller passes the locale, because
 * `toLocaleUpperCase` answers differently in Turkish and a name is a name in
 * the language its reader has chosen.
 */
export function initialsOf(parts: readonly string[], locale: string): string {
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => [...part][0] ?? '')
    .join('')
    .toLocaleUpperCase(locale);
}

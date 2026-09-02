/**
 * What the two field-kit editors do the same way.
 *
 * The registration form of an event (F12) and the profile form of the instance
 * (E35) are two screens and stay two screens — they sit under different
 * parents, ask about different things and one of them has file fields. What
 * they must not do differently is read a list of choices: "one per line, blank
 * lines dropped" is a rule an organizer learns once, and two implementations of
 * it would eventually disagree about a trailing space.
 *
 * The three event readers below are plumbing rather than rules. They are here
 * because the alternative is the same six lines in two files, and because a
 * template that reads `value($event)` in both places is one habit rather than
 * two.
 */

/** A text box of choices, one per line, blank lines dropped. */
export function lines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/** The inverse: stored choices as the text box shows them. */
export function choiceLines(options: readonly string[]): string {
  return options.join('\n');
}

export function inputValue(event: Event): string {
  return (event.target as HTMLInputElement | HTMLTextAreaElement).value;
}

export function inputChecked(event: Event): boolean {
  return (event.target as HTMLInputElement).checked;
}

export function inputNumber(event: Event): number {
  return Number((event.target as HTMLInputElement).value);
}

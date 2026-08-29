/**
 * The translations of what an organization writes (FR 3.12, E25).
 *
 * Two kinds of text live in this application and only one of them is here. The
 * *interface* is translated key by key against a shipped catalogue (E22–E24) —
 * every instance shows the same buttons, so the translations ship with the
 * image and an organization amends them. *Content* is the opposite: nobody but
 * this organization has ever written this event's description, so there is
 * nothing to ship and nothing to fall back to except the original.
 *
 * Hence the shape below. A translation is **field by field** and **additive**:
 * every field is nullable, `null` means "use what the organizer wrote", and a
 * missing translation is not a missing text but an untranslated one. A
 * participant reading German sees German where German exists and the original
 * everywhere else — never a gap, because a gap in a description is a page that
 * looks broken, while an untranslated sentence merely looks untranslated.
 *
 * What is deliberately **not** translatable: an address and a person's name.
 * `venueAddress` is the same street in every language, and translating it sends
 * people to a place that does not exist; `speaker` is what someone is called.
 * Both stay single-valued, which is also why they have no column here.
 */

/** One field of a translation: the text, or `null` for "use the original". */
export type TranslatedText = string | null;

/**
 * What can be translated on an event series — its two public sentences.
 *
 * A `type` and not an `interface`, and that is load-bearing rather than a matter
 * of taste: TypeScript gives an object *type* an implicit index signature and an
 * interface none, so only this form is assignable to
 * `Record<string, TranslatedText>` — which is what the one generic port, the one
 * generic repository and the one editing component are written against. Turning
 * any of these three into an interface puts a cast into each of them.
 */
export type EventSeriesTranslation = {
  readonly name: TranslatedText;
  readonly description: TranslatedText;
};

/**
 * What can be translated on an event.
 *
 * `venueName` is the name of a place ("Town Hall"), which does translate;
 * `venueAddress` is how to get there, which does not (E25).
 */
export type EventTranslation = {
  readonly name: TranslatedText;
  readonly description: TranslatedText;
  readonly venueName: TranslatedText;
  readonly followUpBody: TranslatedText;
};

/** What can be translated on a programme item. */
export type ProgramItemTranslation = {
  readonly title: TranslatedText;
  readonly description: TranslatedText;
};

/**
 * The translations of one thing, by language tag.
 *
 * Only languages that actually have a row appear — an absent key and a row of
 * nothing but `null` mean the same thing to a reader, and the editor shows an
 * empty form for both.
 */
export type TranslationsByLocale<T> = Readonly<Record<string, T>>;

/**
 * One editable thing on a translation screen: what it says, and what it says in
 * every other language.
 *
 * `source` travels with the translations because a translator needs the
 * original in front of them; fetching it separately would be a second request
 * for one screen, and a screen showing empty boxes with nothing to translate
 * from is not a translation screen.
 */
export interface TranslatableItem<T> {
  readonly id: string;
  readonly source: T;
  readonly translations: TranslationsByLocale<T>;
}

/** The series translation screen: one series, every language (FR 3.12). */
export type EventSeriesTranslations = TranslatableItem<EventSeriesTranslation>;

/**
 * One programme item on the event translation screen.
 *
 * `startsAt` is carried because two sessions of one event may share a title —
 * "Lunch" twice — and a translator needs to know which one they are looking at.
 */
export interface ProgramItemTranslations extends TranslatableItem<ProgramItemTranslation> {
  readonly startsAt: string;
}

/**
 * The event translation screen: the event and its programme in one answer.
 *
 * One request for one screen (F49). An organizer translating an event into
 * German does the header and the sessions in one sitting; splitting the read
 * into one request per session would be a request per row of a list that is
 * already bounded by `MAX_PROGRAM_ITEMS`.
 *
 * The *writes* stay separate, one per thing and language: a translator saves
 * the session they just finished, and a validation error in session nineteen
 * does not throw away session three.
 */
export interface EventTranslations extends TranslatableItem<EventTranslation> {
  readonly timezone: string;
  readonly programItems: readonly ProgramItemTranslations[];
}

/**
 * A translation is bounded by the same numbers as what it translates —
 * `MAX_CONTENT_NAME_LENGTH`, `MAX_CONTENT_DESCRIPTION_LENGTH`,
 * `MAX_VENUE_NAME_LENGTH`, `MAX_FOLLOW_UP_LENGTH`, `MAX_PROGRAM_TITLE_LENGTH`,
 * `MAX_PROGRAM_DESCRIPTION_LENGTH`. There are deliberately no second constants
 * here: a translation that could be longer than its original would fit in no
 * layout the original fits in, and German is the language that would find out.
 */

/**
 * An emptied box is not a translation.
 *
 * The same rule the interface catalogue follows (F74): a value that is blank
 * after trimming is stored as `null`, so "I cleared this field" and "I never
 * filled it in" cannot become two different states with one visible result.
 */
export function translatedText(
  value: string | null | undefined,
): TranslatedText {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Whether a translation holds anything at all.
 *
 * A row of nothing but `null` says exactly what no row says, so writing one
 * would leave a language looking translated in every list that counts rows.
 */
export function isEmptyTranslation(translation: object): boolean {
  return Object.values(translation).every((value) => value === null);
}

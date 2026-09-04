/**
 * The newsletter of FR 4.8 — an address, not a registration (E45).
 *
 * This module is the smallest of the phase, and the reason is F8: **nothing
 * here sends anything.** v1 has no newsletter dispatch and will not get one;
 * what an organization gets is the opt-in administration — the record that
 * somebody said yes, kept in a way the organization can show and export into
 * whatever tool it already sends with.
 *
 * Two sources therefore exist side by side, and the overview names both:
 *
 * - the **checkbox in the registration form**, which has been
 *   `registration.newsletter_opt_in` since phase 1, and
 * - the **sign-up in the app**, which is this module and needs no event and no
 *   account at all — that is the whole point of E45.
 *
 * They are deliberately not merged into one list of recipients: without a
 * dispatch there would be nobody to read it (F8), and a merged list would
 * quietly claim that the two consents mean the same thing. They do not — one
 * was given while registering for an event, the other as a standing interest in
 * the organization or in one series.
 */

/**
 * The module key of the opt-in administration (FR 1.5, F63).
 *
 * A key of its own, and **not** `newsletter`: that one was withdrawn in phase 2
 * as a switch wired to nothing and will never come back, because there is no
 * newsletter module to switch (F8). What this key decides is real and small —
 * whether the sign-up is offered and stored, and whether the organizer has a
 * list to look at.
 *
 * Off by default. An instance that starts today has no reason to promise news
 * it has no way of sending, and the organization that does run a newsletter
 * somewhere else switches this on in a second. It needs no prerequisite: the
 * sign-up asks for an address, not for an account (E45), so it works on an
 * instance with `profiles` switched off.
 */
export const NEWSLETTER_MODULE_KEY = 'newsletter-opt-in';

/**
 * Where the confirmation link in the mail points (E5b).
 *
 * A constant rather than a string in the mail template, because the server
 * writes the address and the participant client's router has to answer it —
 * the same reason `PROFILE_CONFIRMATION_PATH` is one.
 */
export const NEWSLETTER_CONFIRMATION_PATH = '/newsletter/confirm';

/**
 * What somebody signs up with.
 *
 * The address, and optionally the series they signed up from. Nothing else — a
 * newsletter address is an address, and a name nothing reads would be a field
 * nothing reads (F42).
 *
 * In particular **not the language of the page**. The confirmation mail follows
 * the chain every mail follows (F125): the recipient's own preference if that
 * address has an account, otherwise the language the organization writes in.
 * A sign-up stores no language of its own — there is no row to keep it on and
 * no second letter that would use it — so a `preferredLocale` here would be a
 * field that decided one mail and then vanished.
 */
export interface NewsletterSignupRequest {
  readonly email: string;
  /**
   * The series this sign-up is about, or nothing for the whole instance.
   *
   * A slug and not an id, because a public form knows the public address of a
   * page (E7). Absent means the sign-up was made on the start page, which is
   * the instance-wide list.
   */
  readonly seriesSlug?: string;
}

/**
 * The answer to a sign-up — the address, whatever happened (E45, E32).
 *
 * The same answer for a new address, for one that has signed up before and not
 * confirmed, and for one that is already on the list. Anything else would turn
 * a public form into a query for who is on the list, which is the disclosure
 * E32 spelled out for accounts and which applies here word for word.
 */
export interface NewsletterSignupAcknowledgement {
  readonly email: string;
}

/**
 * What the confirmation link achieved.
 *
 * `already-confirmed` rather than an error, for the reason every confirmation
 * in this application is idempotent (E5b): people click links twice, and
 * forwarded mail gets opened by a colleague.
 */
export interface NewsletterConfirmation {
  readonly state: 'confirmed' | 'already-confirmed';
}

/** Which of the two sources a consent came from (E45). */
export type NewsletterSource = 'form' | 'app';

/**
 * One consent in the organizer's overview.
 *
 * A row per consent and not per address: an address that ticked the box while
 * registering **and** signed up in the app has said yes twice, in two places,
 * about two different things, and an overview that folded those into one row
 * would be unable to say which is which — which is the one thing E45 asks it to
 * say.
 *
 * `subscriptionId` is the handle for taking a consent back, and only the app
 * source has one: a row of the registration form is part of a registration and
 * is administered there.
 */
export interface NewsletterConsent {
  readonly email: string;
  readonly source: NewsletterSource;
  /** When the double opt-in was completed; a row without one is not listed. */
  readonly confirmedAt: string;
  /** The series this consent is about, or `null` for the whole instance. */
  readonly seriesId: string | null;
  readonly seriesName: string | null;
  /** Present for the app source, `null` for the form (see above). */
  readonly subscriptionId: string | null;
}

/**
 * The overview (FR 4.8) — the consents, and what they add up to.
 *
 * `addresses` is the number a person actually wants when they ask "how many
 * people get our news": the distinct addresses behind the rows. It is smaller
 * than `total` exactly when somebody said yes in both places.
 */
export interface NewsletterAudiencePage {
  readonly rows: readonly NewsletterConsent[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly counts: NewsletterCounts;
}

export interface NewsletterCounts {
  readonly total: number;
  readonly fromForm: number;
  readonly fromApp: number;
  readonly addresses: number;
}

export const DEFAULT_NEWSLETTER_PAGE_SIZE = 50;
export const MAX_NEWSLETTER_PAGE_SIZE = 200;

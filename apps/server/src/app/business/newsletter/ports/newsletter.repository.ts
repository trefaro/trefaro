import type { NewsletterSource } from '@trefaro/shared-models';

/** One newsletter sign-up made in the app (FR 4.8, E45). */
export interface NewsletterSubscriptionRecord {
  readonly id: string;
  readonly email: string;
  /** `null` is the instance-wide list; an id is one series. */
  readonly seriesId: string | null;
  /** `null` while the confirmation link is unclicked — a request, not a consent. */
  readonly confirmedAt: Date | null;
  readonly createdAt: Date;
}

export interface NewsletterSubscriptionInput {
  readonly email: string;
  readonly seriesId: string | null;
}

/**
 * One row of the organizer's overview — a consent, whichever source it is from.
 *
 * The shape is the same for both sources on purpose: the overview is one list,
 * and a reader comparing two row shapes to answer "who may we write to" is a
 * reader who will get it wrong. What differs is `source` (which is the answer
 * E45 asks this list to give) and `subscriptionId`, which only the app source
 * has because only it is a row of its own.
 */
export interface NewsletterConsentRow {
  readonly email: string;
  readonly source: NewsletterSource;
  readonly confirmedAt: Date;
  readonly seriesId: string | null;
  readonly subscriptionId: string | null;
}

/** What the overview adds up to, over both sources at once. */
export interface NewsletterConsentCounts {
  readonly total: number;
  readonly fromForm: number;
  readonly fromApp: number;
  /** Distinct addresses — the number somebody actually means by "how many". */
  readonly addresses: number;
}

/**
 * Port for the newsletter opt-in administration (FR 4.8, E45).
 *
 * The interesting half is not the sign-up but {@link listConsents}: the
 * audience is a `UNION` of two sources in one statement, and three rules ride
 * inside that SQL rather than in a service above it (F152, F173) —
 *
 * 1. **Only confirmed consents exist here.** A request that was never
 *    confirmed, from either source, cannot be listed, counted or exported,
 *    because no method returns it. That is what makes the double opt-in of E45
 *    worth having: an address a stranger typed in is never on a list.
 * 2. **An objection wins over both sources.** An address that used the
 *    objection link of an invitation (`registration.contact_opt_out`, F24)
 *    appears in no further list — and this is a further list. Applied by
 *    address, because that is what the objection is about; the person did not
 *    object to one registration, they said stop writing.
 * 3. **A row per consent, not per address.** Somebody who ticked the box while
 *    registering *and* signed up in the app has said yes twice, about two
 *    different things. Folding those into one row would lose the one answer
 *    the overview owes (E45), so the counts carry the distinct number instead.
 *
 * There is deliberately no method that returns addresses without their source
 * and no "export all": v1 sends nothing (F8), and a list nothing sends from is
 * a list nothing needs to flatten.
 */
export interface NewsletterRepository {
  /**
   * Stores a sign-up, or hands back the row this address already has.
   *
   * The unique index decides what "already" means — one address per series,
   * and `NULLS NOT DISTINCT` makes the instance-wide list one of those. A
   * repeat therefore never creates a second row; what it does is up to the
   * service, which sends the mail that fits the state the row is in.
   */
  save(
    input: NewsletterSubscriptionInput,
  ): Promise<NewsletterSubscriptionRecord>;

  findById(id: string): Promise<NewsletterSubscriptionRecord | null>;

  /** Sets `confirmed_at` unless it is set; `null` for a row that is gone. */
  confirm(id: string): Promise<NewsletterSubscriptionRecord | null>;

  /**
   * Removes one sign-up made in the app.
   *
   * The one delete in this module, and it is how an organization honours a
   * withdrawal: somebody who asks to be taken off the list has withdrawn a
   * consent, and a withdrawn consent is not archived (which is the exception
   * E14's rule leaves room for — the record of a consent that no longer exists
   * would be the opposite of what the person asked for). `false` for a row
   * that is not there, so a second click is not an error.
   */
  remove(id: string): Promise<boolean>;

  /** One page of the overview, newest consent first. */
  listConsents(query: {
    readonly offset: number;
    readonly limit: number;
  }): Promise<readonly NewsletterConsentRow[]>;

  /**
   * The numbers under the page — over both sources, in one statement.
   *
   * Separate from the page rather than a `total` beside it, because the page
   * needs three numbers and not one: how many consents there are, how they
   * split between the two sources, and how many distinct addresses they add up
   * to. One count query for all three, instead of a page query that returns a
   * total nobody can break down.
   */
  countConsents(): Promise<NewsletterConsentCounts>;
}

export const NEWSLETTER_REPOSITORY = Symbol('TREFARO_NEWSLETTER_REPOSITORY');

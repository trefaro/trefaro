/**
 * Inviting former participants to the next event of a series (FR 2.4, F24).
 *
 * The whole feature rests on one restriction, and every type here exists to
 * make it hard to lose: an invitation goes to **addresses that registered for
 * an event of this very series and confirmed** (E15). Not to a list somebody
 * pasted, not to addresses from another series, and never to somebody who has
 * objected. That is what keeps this from being the newsletter module v1 does
 * not have (F8) — it is a message to people who already came.
 */

/** Where the objection link in an invitation points — a page, not the API (E5b). */
export const INVITATION_OPT_OUT_PATH = '/invitations/unsubscribe';

/** The subject line an organizer writes; a mail header, so deliberately short. */
export const MAX_INVITATION_SUBJECT_LENGTH = 200;

/** Plain text, wrapped by the template. Long enough for an actual invitation. */
export const MAX_INVITATION_BODY_LENGTH = 5000;

/**
 * How many addresses one invitation may name.
 *
 * Not a technical limit — the sending runs in the background precisely so that
 * the number of recipients does not decide whether a request survives (F56).
 * It is a guard against a mistyped request asking for a hundred thousand mails,
 * and it is far above the size of any series a small NGO runs.
 */
export const MAX_INVITATION_RECIPIENTS = 2000;

export const DEFAULT_CONTACT_PAGE_SIZE = 25;

/** The organizer's log of what was sent for a series. */
export const DEFAULT_INVITATION_PAGE_SIZE = 10;

export const MAX_INVITATION_PAGE_SIZE = 50;

/**
 * The largest page of contacts.
 *
 * Chosen so that the acceptance case of the work package — inviting two hundred
 * former participants — can be selected without paging, because a selection
 * that has to be assembled across nine pages is one an organizer gets wrong.
 */
export const MAX_CONTACT_PAGE_SIZE = 200;

/**
 * One address an invitation may go to.
 *
 * Identified by a registration rather than by the address itself: a selection
 * that named addresses would turn this endpoint into a way to mail anybody
 * through the instance (F55). Somebody who attended three events of the series
 * appears once — the address is the person — and `registrationId` is the most
 * recent of those registrations.
 */
export interface SeriesContact {
  readonly registrationId: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  /** How many events of this series this address is confirmed for. */
  readonly events: number;
  /** The most recent of those registrations, as an absolute instant (E8). */
  readonly lastRegisteredAt: string;
}

/** One page of contacts, plus how many the filter matched in total. */
export interface SeriesContactPage {
  readonly rows: readonly SeriesContact[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

/** What the organizer's contact list asks for. Sorted newest first, always. */
export interface ContactQuery {
  readonly page?: number;
  readonly pageSize?: number;
  /** Matches first name, last name or address; all words must match. */
  readonly search?: string;
}

/**
 * How far an invitation has got.
 *
 * Derived from the three counts rather than stored, so it cannot disagree with
 * them: `sending` while anything is still pending, `partial` when everything
 * has been attempted but some address could not be reached, `sent` otherwise.
 */
export type InvitationState = 'sending' | 'sent' | 'partial';

export interface Invitation {
  readonly id: string;
  readonly seriesId: string;
  /** The event invited to, if any — a plain message to former participants is
   * also an invitation in the sense of FR 2.4. `null` once that event is gone. */
  readonly eventId: string | null;
  readonly subject: string;
  readonly body: string;
  readonly state: InvitationState;
  readonly recipients: number;
  readonly sent: number;
  readonly failed: number;
  readonly createdAt: string;
  /** Set once no recipient is pending any more. */
  readonly finishedAt: string | null;
}

/** One page of a series' invitations, newest first. */
export interface InvitationPage {
  readonly rows: readonly Invitation[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

export interface InvitationQuery {
  readonly page?: number;
  readonly pageSize?: number;
}

/** What an organizer writes and whom it goes to. */
export interface InvitationInput {
  readonly subject: string;
  readonly body: string;
  /** An event of the same series, or nothing. */
  readonly eventId?: string | null;
  /** Registration ids from {@link SeriesContact}, never addresses (F55). */
  readonly recipients: readonly string[];
}

/** The answer of the objection page. Says nothing about who or where (E15). */
export interface ContactOptOutResult {
  readonly state: 'opted-out' | 'already-opted-out';
}

/** The three counts an invitation's state follows from. */
export interface InvitationCounts {
  readonly recipients: number;
  readonly sent: number;
  readonly failed: number;
}

/** @see InvitationState */
export function invitationState(counts: InvitationCounts): InvitationState {
  const pending = counts.recipients - counts.sent - counts.failed;
  if (pending > 0) return 'sending';
  return counts.failed > 0 ? 'partial' : 'sent';
}

/**
 * The paragraphs of an invitation body.
 *
 * One place decides what a blank line means, because the mail template and the
 * preview in the organizer client have to agree — an organizer who sees three
 * paragraphs must not send one block of text.
 */
export function invitationParagraphs(body: string): readonly string[] {
  return body
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}

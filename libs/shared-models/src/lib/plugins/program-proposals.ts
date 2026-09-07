/**
 * Payloads of the programme proposals plug-in (FR 3.13, FR 3.14).
 *
 * In `shared-models` like every other payload of this application, and for one
 * reason more: a client that loads a plug-in's bundle shares the **models** with
 * it, never the implementation. The plug-in's server DTOs implement these
 * interfaces, so a change to the contract breaks a build rather than a request.
 *
 * The plug-in's key and its catalogue namespace are declared by its server
 * descriptor; what lives here is only what travels over HTTP.
 */

/** The plug-in's stable key — also its `module_config.module_key`. */
export const PROGRAM_PROPOSALS_MODULE_KEY = 'program-proposals';

/**
 * The three states a proposal can be in (E51).
 *
 * A decision, not a process: there is no "under review", no second reviewer and
 * no comment thread on the decision. FR 3.14 asks that the **status** be visible
 * to the person who proposed something, and a rejected proposal stays in the
 * list rather than disappearing (E14).
 */
export const PROPOSAL_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

/** Same limit as a programme item's title — the two are read side by side. */
export const MAX_PROPOSAL_TITLE_LENGTH = 200;
/** Longer than a title and shorter than a page: a proposal is an argument. */
export const MAX_PROPOSAL_DESCRIPTION_LENGTH = 4000;

export const DEFAULT_PROPOSAL_PAGE_SIZE = 20;
export const MAX_PROPOSAL_PAGE_SIZE = 100;

/**
 * Who proposed something, as a reader sees them.
 *
 * A name and a picture, never an address (F55). The name is shown because a
 * proposal is attributed by nature: an organizer moderating one needs to know
 * who is asking, and the other participants see who suggested the session they
 * are reading about.
 */
export interface ProposalAuthor {
  readonly id: string;
  readonly name: string;
  readonly avatarUrl: string | null;
}

/**
 * One proposal.
 *
 * `author` may be absent, which is not an anonymous proposal but a missing
 * account: the row's owner closed it between two reads. The alternative — a
 * placeholder name — would invent a person.
 *
 * There is deliberately no "is this mine" flag. A participant reading the list
 * has their own id in their session, so the comparison belongs to the reader;
 * a field would have meant something different on the organizer's route, where
 * the answer is always no — and a field whose meaning depends on the endpoint
 * is one that gets read on the wrong one.
 */
export interface ProgramProposal {
  readonly id: string;
  readonly eventId: string;
  readonly title: string;
  readonly description: string;
  readonly status: ProposalStatus;
  readonly author: ProposalAuthor | null;
  /** ISO 8601, like every instant this application hands out. */
  readonly createdAt: string;
  /** When it was approved or rejected; `null` while it is pending. */
  readonly decidedAt: string | null;
}

/** What a participant sends to propose something. */
export interface NewProgramProposal {
  readonly title: string;
  readonly description: string;
}

/** One page of the organizer's moderation list, filtered and sorted in SQL. */
export interface ProposalPage {
  readonly rows: readonly ProgramProposal[];
  /** What the pages divide — the whole result, not this page's length. */
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

/**
 * How many proposals of one event are in each state (E59).
 *
 * The number the organizer's dashboard section draws — and it is the **plug-in**
 * that draws it, in the section it renders itself, never the host on the tile
 * above: a count on the tile would mean the host asking a plug-in a question,
 * the first capability pointing the wrong way, for a figure two centimetres
 * further down the page.
 *
 * Three counts rather than one, because the section says what the queue means:
 * a heading that reads "3 open · 12 approved · 1 rejected" tells an organizer
 * whether they are behind, and one request answers it. The moderation list's
 * own `total` cannot: narrowed to `?status=pending` it counts the queue and
 * nothing else, and three pages fetched for three numbers would be three
 * requests for one heading.
 */
export interface ProposalSummary {
  readonly pending: number;
  readonly approved: number;
  readonly rejected: number;
}

/** What the moderation list may ask for. */
export interface ProposalQuery {
  readonly status?: ProposalStatus;
  readonly page?: number;
  readonly pageSize?: number;
}

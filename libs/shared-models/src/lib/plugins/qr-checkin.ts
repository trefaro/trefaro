/**
 * Payloads of the QR code check-in plug-in (FR 3.16).
 *
 * In `shared-models` like every other payload of this application: a client
 * that loads a plug-in's bundle shares the **models** with it, never the
 * implementation. The plug-in's server DTOs implement these interfaces, so a
 * change to the contract breaks a build rather than a request.
 *
 * The plug-in's key and its catalogue namespace are declared by its server
 * descriptor; what lives here is only what travels over HTTP.
 */

/** The plug-in's stable key — also its `module_config.module_key`. */
export const QR_CHECKIN_MODULE_KEY = 'qr-checkin';

/**
 * How long a check-in code is, in characters.
 *
 * Twenty-six characters of Crockford's base32 alphabet — 130 bits of the 160
 * a random 20-byte value carries, which is far past anything that can be
 * guessed at a door. Long enough that nobody tries, short enough that somebody
 * can read it out over a telephone when a camera and a screen both fail.
 */
export const CHECKIN_CODE_LENGTH = 26;

/**
 * The longest code the door will look at.
 *
 * The column's width, and the bound on what a scan may send: a camera that
 * decodes a poster instead of a ticket must not turn into a query with a
 * kilobyte in it. Wider than {@link CHECKIN_CODE_LENGTH} on purpose — the code
 * this version issues is not the only one this table will ever hold.
 */
export const MAX_CHECKIN_CODE_LENGTH = 64;

export const DEFAULT_ADMISSION_PAGE_SIZE = 25;
export const MAX_ADMISSION_PAGE_SIZE = 100;

/** A person holds few registrations, and a page of them is still a page. */
export const DEFAULT_TICKET_PAGE_SIZE = 10;
export const MAX_TICKET_PAGE_SIZE = 50;

/**
 * One ticket: what somebody brings to the door (FR 3.16, E53, E54).
 *
 * The `code` is the plug-in's own, opaque, and issued once per registration —
 * never the signed self-service token, which can cancel a registration (F44,
 * F148). A QR code is photographed, held up at a door and mirrored on screens;
 * what it proves is that this registration exists, and nothing else.
 *
 * The name travels with it because the door reads it: a code and a face are
 * checked against each other by a person, not by the camera.
 */
export interface CheckinTicket {
  /** What the ticket is for. A registration has exactly one. */
  readonly registrationId: string;
  readonly eventId: string;
  readonly firstName: string;
  readonly lastName: string;
  /** Opaque, this plug-in's own (E53). */
  readonly code: string;
  /** ISO 8601, like every instant this application hands out. */
  readonly issuedAt: string;
  /** When they were let in, or `null` while they have not arrived. */
  readonly checkedInAt: string | null;
}

/** One page of tickets — what a session sees of its own (F148). */
export interface CheckinTicketPage {
  readonly rows: readonly CheckinTicket[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

/**
 * One row of the admission list.
 *
 * The organization's side of the same ticket: who is expected, and who is
 * already in. It carries the `code` so that the button beside the row sends
 * exactly what the camera would have read — one route for the door, whichever
 * way the code got there (F199).
 *
 * No address. The participant overview is where an organizer looks somebody
 * up (FR 3.3); a door list is a list of names and a state.
 */
export interface AdmissionRow {
  readonly registrationId: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly code: string;
  readonly checkedInAt: string | null;
}

export interface AdmissionPage {
  readonly rows: readonly AdmissionRow[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

/** What the door sends: the code that was scanned, or typed (F199). */
export interface CheckinScan {
  readonly code: string;
}

/**
 * What the door gets back.
 *
 * A second scan of the same code is **not** an error (E53): it answers 200
 * with the same instant and `alreadyCheckedIn`, because "already here, since
 * 09:12" is the sentence somebody at a door needs. An error would send them
 * looking for a fault that is not there.
 */
export interface CheckinResult {
  readonly registrationId: string;
  readonly eventId: string;
  readonly firstName: string;
  readonly lastName: string;
  /** When they were let in — the first time, never the latest. */
  readonly checkedInAt: string;
  readonly alreadyCheckedIn: boolean;
}

/** What a paginated list of this plug-in may be asked for. */
export interface CheckinPageQuery {
  readonly page?: number;
  readonly pageSize?: number;
}

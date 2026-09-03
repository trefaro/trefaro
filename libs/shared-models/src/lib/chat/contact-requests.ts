/**
 * Reaching the organizer without an account (FR 3.4, UC 14 — E39, F11).
 *
 * The one way into a conversation that needs no login, and the reason the
 * `organizer_contact` kind exists: somebody who reads an event landing page
 * has a question, and the thesis asks for the lowest possible entry barrier —
 * "Kontaktaufnahme mit dem Veranstalter ist auch ohne Registrierung möglich".
 *
 * What that means for the shapes here:
 *
 * - **An address instead of an account.** It is stored on the conversation
 *   (`guest_email`), not on an invented account row, and it is what the
 *   organizer answers to — by e-mail, because the person has no inbox in this
 *   application (F11).
 * - **Text only.** No picture, unlike every other message of the chat (E40): a
 *   public endpoint that accepted bytes from a stranger with no account behind
 *   them would be a second upload surface for no gain. The registration form's
 *   file field is the one exception this application makes, and it exists
 *   because an organizer asked the question.
 * - **The answer never varies** (E10). Nothing here is looked up against the
 *   accounts or the registrations, so a known address and an unknown one
 *   cannot produce different answers — the form is not a query against who is
 *   in this instance.
 */

/** Bounds that match the columns, so a request cannot fail in the database. */
export const MAX_GUEST_NAME_LENGTH = 200;

/** The longest address RFC 5321 allows, so nobody's real address is refused. */
export const MAX_GUEST_EMAIL_LENGTH = 320;

/**
 * What the contact form on an event landing page sends.
 *
 * One name field rather than two: a registration puts a person on a list and
 * is sorted by surname, a question is signed. The body is bounded by
 * `MAX_MESSAGE_LENGTH`, like every other message — it becomes one.
 */
export interface ContactRequestInput {
  readonly name: string;
  readonly email: string;
  readonly body: string;
}

/**
 * What the form gets back — the address it wrote to, and nothing else.
 *
 * The same shape as the registration's acknowledgement, for the same reason:
 * the answer repeats what the sender already knows, so it can be identical for
 * every address (E10). Deliberately **not** the conversation's id — a guest
 * has no session, so an id would be a handle on a conversation that nothing
 * can authorize them to read.
 */
export interface ContactRequestAcknowledgement {
  readonly email: string;
}

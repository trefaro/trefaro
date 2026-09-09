/**
 * What a plug-in may learn about registrations (E53, E54, F148).
 *
 * The third host port, and the one with the sharpest edges: a registration
 * carries a name, an address and the answers somebody gave on a form, and a
 * plug-in gets exactly two of those questions answered — **which registration
 * a self-service claim speaks for**, and **who is expected at one event**.
 *
 * What is deliberately *not* here:
 *
 * - **No address.** The same rule as {@link PluginParticipantReads}: a
 *   registration's address is what the participant overview shows (FR 3.3) and
 *   what a mail is addressed through a foreign key (F55). A door needs a name.
 * - **No custom fields.** The answers to a registration form are the most
 *   sensitive rows this application holds — a visa number lives there (F12) —
 *   and no plug-in of this phase has a reason to read one.
 * - **No unconfirmed and no cancelled registration.** Both methods answer over
 *   confirmed rows only, and the rule is in the adapter's statements rather
 *   than in a caller (F152): a ticket for a registration nobody confirmed
 *   would be an admission granted by an unverified address, and one for a
 *   cancelled registration would open a door somebody gave up.
 * - **No search, and no lookup of anything a plug-in was not handed.** A
 *   plug-in resolves a claim, reads one event's list, or resolves an id it has
 *   already stored — the same three shapes {@link PluginParticipantReads}
 *   allows, and for the same reason: there is no way to ask this port who
 *   exists, which is what keeps it from becoming a participant directory.
 *
 * Added in plug-in API 1.2.0. A plug-in built against 1.1.0 never asks.
 */

/** One registration, in the shape a plug-in shows it in. */
export interface PluginRegistration {
  readonly id: string;
  readonly eventId: string;
  readonly firstName: string;
  readonly lastName: string;
  /**
   * When the double opt-in happened.
   *
   * Never `null` here: this port answers over confirmed registrations only,
   * and a confirmed row always carries the instant (the table's own check
   * constraint says so, E32).
   */
  readonly confirmedAt: string;
}

/**
 * How a request proves it may act on a registration (E11, E31, F148).
 *
 * The plug-in's spelling of `SelfServiceClaim`, and deliberately the same two
 * ways in: the **link** from the confirmation receipt, which speaks for one
 * registration and belongs to whoever holds it, and the **account**, whose
 * registrations are the ones carrying its address. Below the resolution the
 * two are one stretch of track — the same status rule, the same answer to a
 * claim that names nothing.
 *
 * A plug-in does not build the account claim from an address: it has none, and
 * getting one would be a way around F55. It hands over the participant id it
 * already has from `CurrentPluginParticipant`, and the host resolves the
 * address behind it.
 */
export type PluginRegistrationClaim =
  | { readonly kind: 'link'; readonly token: string }
  | { readonly kind: 'account'; readonly participantId: string };

/** The claim a mailed link makes: this one registration, for whoever holds it. */
export function byPluginLink(token: string): PluginRegistrationClaim {
  return { kind: 'link', token };
}

/** The claim a session makes: every registration of this account (E31). */
export function byPluginAccount(
  participantId: string,
): PluginRegistrationClaim {
  return { kind: 'account', participantId };
}

/** The window a paginated read of this port takes. */
export interface PluginRegistrationWindow {
  readonly offset: number;
  readonly limit: number;
}

/** One page, with what the pages divide counted in the same statement. */
export interface PluginRegistrationSlice {
  readonly rows: readonly PluginRegistration[];
  readonly total: number;
}

export interface PluginRegistrationReads {
  /**
   * The confirmed registrations a self-service claim speaks for (F148).
   *
   * A link resolves to at most one row; a session resolves to every confirmed
   * registration carrying that account's address, newest event first. Both are
   * paginated, so the two claims answer in one shape and a person with thirty
   * registrations does not become an unbounded response.
   *
   * A forged, expired or orphaned token is an **empty** slice rather than an
   * error — the same reading `SelfServiceService` gives it, and the difference
   * between the three is not the holder's to learn. What the caller does with
   * "nothing" is the caller's decision.
   */
  resolveClaim(
    claim: PluginRegistrationClaim,
    window: PluginRegistrationWindow,
  ): Promise<PluginRegistrationSlice>;

  /**
   * The confirmed registration behind one id, or `null`.
   *
   * For an id a plug-in already stored — the check-in resolves a scanned code
   * to a registration and then needs the name to put in front of the person at
   * the door, which is the whole of FR 3.16. It grants nothing the other two
   * methods do not: every id a plug-in holds came from one of them, and both
   * already carry the name.
   *
   * `null` for an id nothing matches **and** for a registration that is not
   * confirmed any more — a ticket whose registration was cancelled resolves to
   * nothing, which is how a door closes behind a cancellation.
   */
  findRegistration(registrationId: string): Promise<PluginRegistration | null>;

  /**
   * One page of one event's confirmed registrations, ordered by name.
   *
   * Who is expected at the door, and nothing about who has arrived — that is
   * the plug-in's own table. Ordered by last name, first name and id, because
   * a door list is read by a person looking for a name; the id is the last
   * criterion, like every paginated list of this application.
   *
   * An unknown event is an empty page, not an error: a plug-in that needs the
   * 404 has the event's id from a route that already gave one.
   */
  findForEvent(
    eventId: string,
    window: PluginRegistrationWindow,
  ): Promise<PluginRegistrationSlice>;
}

/**
 * Injection token for {@link PluginRegistrationReads}.
 *
 * Published by the plug-in host module, which is global — so a plug-in injects
 * this symbol and imports no core module.
 */
export const PLUGIN_REGISTRATION_READS = Symbol(
  'TREFARO_PLUGIN_REGISTRATION_READS',
);

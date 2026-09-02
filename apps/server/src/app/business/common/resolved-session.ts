/**
 * What a resolved session says about itself, whoever it belongs to.
 *
 * The three fields both session kinds have in common (F100): which row said yes,
 * when it was last used, and when it lapses if it is not used again. Who the
 * session belongs to is added by each side — `AuthenticatedAdmin` carries an
 * administrator, `AuthenticatedParticipant` a profile — because that is the one
 * thing an organizer's session and a participant's session must never share a
 * type for: a guard that can read either would be a guard that can confuse them.
 */
export interface ResolvedSession {
  readonly sessionId: string;
  readonly lastSeenAt: Date;
  /** When the session lapses if it is not used again. */
  readonly expiresAt: Date;
}

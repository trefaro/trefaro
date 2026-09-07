/**
 * Where the authenticated participant is parked for the request (E33).
 *
 * In `business/common/` because two readers need it (F100): `ParticipantGuard`
 * writes it after resolving the session cookie, and the plug-in contract reads
 * it so a plug-in can learn who is asking without importing the module that
 * owns accounts.
 *
 * The name of the property is the whole of what is shared. The **type** stays
 * with the profiles module — `AuthenticatedParticipant` carries a full account,
 * including the password hash, and nothing outside that module may see one. What
 * a reader gets from here is an id, through {@link currentParticipantId}, which
 * is the only field a request-scoped identity has to hand out.
 */
export const CURRENT_PARTICIPANT_PROPERTY = 'trefaroParticipant';

/** As much of the parked participant as a reader outside `profiles` may know. */
interface ParkedParticipant {
  readonly profile: { readonly id: string };
}

/**
 * Who is behind this request, or `null` when nobody is.
 *
 * Structural on purpose: the value was parked by the guard and this function
 * does not care which of its fields exist beyond the one it returns. `null`
 * rather than a throw, because the caller decides what an unauthenticated
 * request means — a plug-in route below `participant/` cannot reach one at all,
 * and the decorator that says so raises its own error.
 */
export function currentParticipantId(request: unknown): string | null {
  if (typeof request !== 'object' || request === null) return null;
  const parked = (request as Record<string, unknown>)[
    CURRENT_PARTICIPANT_PROPERTY
  ] as ParkedParticipant | undefined;
  const id = parked?.profile?.id;
  return typeof id === 'string' && id !== '' ? id : null;
}

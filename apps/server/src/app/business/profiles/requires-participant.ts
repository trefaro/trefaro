import { ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';

const REQUIRES_PARTICIPANT_METADATA = 'trefaro:requiresParticipant';

/**
 * Demands a participant session on a route whose path does not say so.
 *
 * The mirror image of {@link AllowAnonymous}, and the direction of its mistake
 * is what makes it safe. `ParticipantGuard` keys on the **declared** path and
 * over-approximates deliberately, because the error in the other direction
 * would be an open endpoint (E33, F69). A decorator that *weakens* that would
 * be the thing F69 argues against; this one only ever adds a requirement, so a
 * forgotten one is a 401 that never comes — visible the first time the route is
 * called — and never an endpoint that answers when it should not.
 *
 * There is exactly one use, and it is the reason this exists at all:
 * `/api/media/messages/:id/attachment` serves the picture of a message to a
 * member of its conversation (E40). It cannot live under `/api/participant`
 * without breaking the rule that there is one prefix for stored bytes (E19,
 * F113), and it cannot be public like the other media routes, because it is
 * content inside a private conversation rather than a mark or a picture handed
 * out with an id its reader may already see (F115, F124).
 *
 * What it is **not** is a way to protect a normal endpoint. A route that needs
 * a session belongs under the prefix that says so — the whole argument of E33
 * is that the access level is in the address, not in a decorator somebody has
 * to remember.
 */
export const RequiresParticipant = (): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRES_PARTICIPANT_METADATA, true);

/** Whether the handler or its controller carries {@link RequiresParticipant}. */
export function requiresParticipant(
  reflector: Reflector,
  context: ExecutionContext,
): boolean {
  return (
    reflector.getAllAndOverride<boolean | undefined>(
      REQUIRES_PARTICIPANT_METADATA,
      [context.getHandler(), context.getClass()],
    ) === true
  );
}

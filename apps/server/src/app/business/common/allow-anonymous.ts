import { ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';

/**
 * The key under which the mark is stored.
 *
 * Exported since AP 9 of phase 5 for one reader that has no
 * `ExecutionContext` to ask with: the route inventory, which reads the
 * declarations of every controller in the image rather than a request
 * passing through one (`app/route-access.spec.ts`).
 */
export const ALLOW_ANONYMOUS_METADATA = 'trefaro:allowAnonymous';

/**
 * Marks a route below a guarded prefix as reachable without a session.
 *
 * The visible exception to deny-by-default, and read by both path guards
 * (`AdminGuard`, `ParticipantGuard`) — which is why it lives here rather than
 * beside either of them (F100).
 *
 * There are few legitimate uses, and they have a shape: logging in, which has no
 * session yet; logging out, which must not fail just because the session already
 * expired; and the first-run setup, which exists precisely while nobody can log
 * in. Every further use deserves a hard question in review.
 */
export const AllowAnonymous = (): MethodDecorator & ClassDecorator =>
  SetMetadata(ALLOW_ANONYMOUS_METADATA, true);

/** Whether the handler or its controller carries {@link AllowAnonymous}. */
export function allowsAnonymous(
  reflector: Reflector,
  context: ExecutionContext,
): boolean {
  return (
    reflector.getAllAndOverride<boolean | undefined>(ALLOW_ANONYMOUS_METADATA, [
      context.getHandler(),
      context.getClass(),
    ]) === true
  );
}

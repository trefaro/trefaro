import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { allowsAnonymous } from '../common/allow-anonymous';
import { requiresParticipant } from './requires-participant';
import type { AuthenticatedParticipant } from './ports/user-session.repository';
import { UserSessionService } from './user-session.service';
import { participantSessionFromRequest } from './user-session-cookie';

/** Where the authenticated participant is parked for the request. */
export const CURRENT_PARTICIPANT_PROPERTY = 'trefaroParticipant';

export interface RequestWithParticipant extends Request {
  [CURRENT_PARTICIPANT_PROPERTY]?: AuthenticatedParticipant;
}

/**
 * Does a route below this path need a participant session?
 *
 * Decided from the **declared** controller and handler paths, not from the
 * requested URL, and over-approximating in exactly the direction `isAdminPath`
 * does (F69): a declared segment that merely *starts* with `participant` counts,
 * because the mistake in the other direction would be an open endpoint. A route
 * that genuinely has to be reachable without a session says so with
 * `@AllowAnonymous()`.
 */
export function isParticipantPath(
  ...declaredPaths: readonly unknown[]
): boolean {
  return declaredPaths
    .filter((path): path is string => typeof path === 'string')
    .some((path) => /^\/*participant(\/|$)/.test(path));
}

/**
 * Requires a participant session for everything under `/api/participant`
 * (FR 4.2, E33).
 *
 * The third of three prefixes, and the reason there is a third one at all:
 * `/api/user` cannot carry this guard, because the start page, the event
 * landing page, the programme, the registration form and the token-based
 * self-service all live there and are reachable without a login by product
 * decision — not by accident. An exception list under the old prefix would put
 * that decision in a list somebody has to remember to extend; a new prefix puts
 * it in the address.
 *
 * Registered globally and keyed on the route path rather than on a decorator,
 * for the reason spelled out beside `AdminGuard`: a forgotten `@UseGuards`
 * would be an open endpoint, so it is deny by default with
 * {@link AllowAnonymous} as the visible exception — logging in, which has no
 * session yet, and logging out, which must not fail because one expired.
 *
 * Creating and confirming an account stay under `/api/user`: at that point
 * there is nobody to authenticate.
 *
 * One route asks for the session without having it in its path, and says so
 * with {@link RequiresParticipant}: the picture of a chat message, which lives
 * under the media prefix because that is where stored bytes are served from.
 */
@Injectable()
export class ParticipantGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: UserSessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Gateways carry no cookies through this path; the chat handshake
    // authenticates itself (E41).
    if (context.getType() !== 'http') return true;

    const guarded =
      isParticipantPath(
        this.reflector.get(PATH_METADATA, context.getClass()),
        this.reflector.get(PATH_METADATA, context.getHandler()),
      ) ||
      // The one route that needs a session without saying so in its path: the
      // picture of a message, which belongs under the media prefix (E19) and
      // must not be public (E40). A decorator that only ever *adds* a
      // requirement is safe in a way one that removed it would not be —
      // see `requires-participant.ts`.
      requiresParticipant(this.reflector, context);
    if (!guarded) return true;

    if (allowsAnonymous(this.reflector, context)) return true;

    const request = context.switchToHttp().getRequest<RequestWithParticipant>();
    const token = participantSessionFromRequest(request);
    if (!token) {
      throw new UnauthorizedException('Participant session required');
    }

    const participant = await this.sessions.resolve(token);
    if (!participant) {
      throw new UnauthorizedException('Participant session required');
    }

    request[CURRENT_PARTICIPANT_PROPERTY] = participant;
    return true;
  }
}

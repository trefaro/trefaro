import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import {
  CURRENT_PARTICIPANT_PROPERTY,
  type RequestWithParticipant,
} from './participant.guard';
import type { AuthenticatedParticipant } from './ports/user-session.repository';

/**
 * The participant behind the current request.
 *
 * Non-null wherever it can be used: {@link ParticipantGuard} has already run for
 * every route below `participant/`, and a route that is not below
 * `participant/` has no business asking.
 */
export const CurrentParticipant = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedParticipant => {
    const request = context.switchToHttp().getRequest<RequestWithParticipant>();
    const participant = request[CURRENT_PARTICIPANT_PROPERTY];
    if (!participant) {
      throw new Error(
        'CurrentParticipant used on a route that is not behind the participant guard',
      );
    }
    return participant;
  },
);

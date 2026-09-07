import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { currentOrganizerId } from '../common/current-organizer';
import { currentParticipantId } from '../common/current-participant';

/**
 * Who is asking, for a plug-in's handler (E57).
 *
 * A plug-in gets its access level from its path and both host guards are global
 * and keyed on the declared path (E16, E33) — so by the time a plug-in's handler
 * runs, the session has already been resolved and parked on the request. These
 * two decorators read it. A plug-in that resolved a cookie itself would be the
 * second implementation of "is this session still valid", and the second one is
 * the one that survives a revoked session.
 *
 * **Two decorators, never one.** An organizer's session and a participant's are
 * different credentials with different cookies, and neither guard accepts the
 * other's (E34). One decorator returning "whoever is logged in" would be the
 * shape in which a participant eventually approves their own proposal.
 *
 * **An id and nothing else.** A name, an address, a role and a locale are the
 * owning module's business (E33). What a plug-in needs is the value it stores in
 * its own table — an author, and whoever took a decision.
 *
 * Added in plug-in API 1.2.0.
 */

/** The participant behind the current request. */
export interface PluginParticipant {
  readonly id: string;
}

/** The organizer behind the current request. */
export interface PluginOrganizer {
  readonly id: string;
}

/**
 * The participant behind the current request.
 *
 * Non-null wherever a plug-in may use it: everything a plug-in declares below
 * `participant/` is behind the host's participant guard by virtue of its path,
 * so there is no branch in which a plug-in has to handle an absent session.
 * Used on a route that is not below `participant/`, it raises — a wiring
 * mistake in the plug-in, not a request to be answered.
 *
 * Narrower than the host's own `CurrentParticipant`, which hands out a whole
 * account. Whose name this id belongs to is a question for
 * {@link PluginParticipantReads}.
 */
export const CurrentPluginParticipant = createParamDecorator(
  (_data: unknown, context: ExecutionContext): PluginParticipant => {
    const id = currentParticipantId(context.switchToHttp().getRequest());
    if (!id) {
      throw new Error(
        'CurrentPluginParticipant used on a route that is not behind the participant guard',
      );
    }
    return { id };
  },
);

/**
 * The organizer behind the current request.
 *
 * The same shape one level up: everything below `admin/` is behind the
 * administrative guard by virtue of its path (E16), so a plug-in's moderation
 * route always has one. What it is for is the other half of a decision (E51) —
 * a decision has a time **and** somebody who took it, and three of the five
 * curated plug-ins store that pair.
 *
 * The name of that organizer is deliberately not available: a plug-in stores
 * the foreign key, and who may read a list of administrators is the login
 * module's decision, not a plug-in's.
 */
export const CurrentPluginOrganizer = createParamDecorator(
  (_data: unknown, context: ExecutionContext): PluginOrganizer => {
    const id = currentOrganizerId(context.switchToHttp().getRequest());
    if (!id) {
      throw new Error(
        'CurrentPluginOrganizer used on a route that is not behind the administrative guard',
      );
    }
    return { id };
  },
);

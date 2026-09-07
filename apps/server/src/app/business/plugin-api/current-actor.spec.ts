import type { ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import {
  CurrentPluginOrganizer,
  CurrentPluginParticipant,
} from './current-actor';

/**
 * The two decorators a plug-in learns who is asking from (E57).
 *
 * Nest hides the factory behind the decorator, so the test reaches it the way
 * the framework does: the metadata a parameter decorator writes carries the
 * factory, and calling it with a fabricated execution context is what a request
 * would do.
 *
 * What is worth asserting is not the happy path but the two mistakes: a plug-in
 * that mixes the two credentials up, and a plug-in that uses either on a route
 * with no session behind it.
 */
type Factory = (data: unknown, context: ExecutionContext) => { id: string };

/** The factory behind a `createParamDecorator`, as Nest stores it. */
function factoryOf(decorator: () => ParameterDecorator): Factory {
  class Handler {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    method(@decorator() _actor: unknown): void {}
  }
  const metadata = Reflect.getMetadata(
    ROUTE_ARGS_METADATA,
    Handler,
    'method',
  ) as Record<string, { factory: Factory }>;
  return Object.values(metadata)[0].factory;
}

const contextFor = (request: unknown): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => request }),
  }) as unknown as ExecutionContext;

describe('who a plug-in is allowed to know is asking', () => {
  const participant = factoryOf(CurrentPluginParticipant);
  const organizer = factoryOf(CurrentPluginOrganizer);

  const withParticipant = { trefaroParticipant: { profile: { id: 'p-1' } } };
  const withOrganizer = { trefaroAdmin: { admin: { id: 'a-1' } } };

  it('answers the participant id the host guard resolved', () => {
    expect(participant(undefined, contextFor(withParticipant))).toEqual({
      id: 'p-1',
    });
  });

  it('answers the organizer id the host guard resolved', () => {
    expect(organizer(undefined, contextFor(withOrganizer))).toEqual({
      id: 'a-1',
    });
  });

  it('never accepts the other credential (E34)', () => {
    // The mistake this shape exists to prevent: one decorator returning
    // "whoever is logged in" is how a participant ends up approving their own
    // proposal.
    expect(() => participant(undefined, contextFor(withOrganizer))).toThrow(
      /participant guard/,
    );
    expect(() => organizer(undefined, contextFor(withParticipant))).toThrow(
      /administrative guard/,
    );
  });

  it('raises on a route with no session behind it, rather than answering', () => {
    for (const request of [{}, null, undefined, { trefaroParticipant: {} }]) {
      expect(() => participant(undefined, contextFor(request))).toThrow();
    }
    expect(() => organizer(undefined, contextFor({}))).toThrow();
  });
});

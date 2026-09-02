import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { isAdminPath } from '../login';
import {
  CURRENT_PARTICIPANT_PROPERTY,
  ParticipantGuard,
  isParticipantPath,
  type RequestWithParticipant,
} from './participant.guard';
import type { AuthenticatedParticipant } from './ports/user-session.repository';
import type { UserSessionService } from './user-session.service';
import { USER_SESSION_COOKIE } from './user-session-cookie';

const authenticated = {
  sessionId: 'session-1',
  lastSeenAt: new Date(),
  expiresAt: new Date(Date.now() + 3_600_000),
  profile: {
    id: 'profile-1',
    email: 'amina@example.org',
    passwordHash: 'hashed:secret',
    firstName: 'Amina',
    lastName: 'Okonkwo',
    preferredLocale: 'de',
    avatarPath: null,
    activityAreas: null,
    customFields: {},
    searchable: false,
    confirmedAt: new Date('2026-09-01T10:00:00Z'),
    createdAt: new Date('2026-09-01T09:00:00Z'),
    updatedAt: new Date('2026-09-01T10:00:00Z'),
  },
} satisfies AuthenticatedParticipant;

describe('isParticipantPath', () => {
  it.each([
    'participant',
    '/participant',
    'participant/auth',
    'participant/conversations',
  ])('protects "%s"', (path) => {
    expect(isParticipantPath(path)).toBe(true);
  });

  it.each([
    'user/events',
    // Creating and confirming an account: nobody to authenticate yet (E33).
    'user/profiles',
    'admin/participants',
    'config',
    'health',
    '',
    // Must not match on a prefix: this is a different resource.
    'participants',
    undefined,
  ])('leaves "%s" alone', (path) => {
    expect(isParticipantPath(path)).toBe(false);
  });

  it('protects a public controller with a participant handler below it', () => {
    expect(isParticipantPath('', 'participant/me')).toBe(true);
  });

  it('over-approximates in the same direction as isAdminPath (F69)', () => {
    // The property that matters is not the regular expression, it is which way
    // the two guards are wrong. `@Controller('setup')` with
    // `@Post('participant')` is `/api/setup/participant`, which is not below
    // `/api/participant` at all — and both say yes to their own prefix in that
    // shape. Deliberate: the failure in the other direction is an open
    // endpoint. A route like that needs an explicit `@AllowAnonymous()`.
    expect(isParticipantPath('setup', 'participant')).toBe(true);
    expect(isAdminPath('setup', 'admin')).toBe(true);

    // And neither claims the other's prefix — three prefixes, three levels of
    // access (E33), with no route guarded twice or by the wrong guard.
    expect(isParticipantPath('admin/admins')).toBe(false);
    expect(isAdminPath('participant/me')).toBe(false);
  });
});

describe('ParticipantGuard', () => {
  const handler = () => undefined;
  class ConversationsController {}

  function contextFor(request: RequestWithParticipant): ExecutionContext {
    return {
      getType: () => 'http',
      getHandler: () => handler,
      getClass: () => ConversationsController,
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  }

  function guardFor(options: {
    controllerPath: string;
    allowAnonymous?: boolean;
    requiresParticipant?: boolean;
    resolves?: AuthenticatedParticipant | null;
  }): ParticipantGuard {
    const reflector = {
      get: (key: unknown, target: unknown) =>
        key === PATH_METADATA && target === ConversationsController
          ? options.controllerPath
          : undefined,
      // Two decorators are read here, and they pull in opposite directions —
      // so the double has to tell them apart.
      getAllAndOverride: (key: unknown) =>
        key === 'trefaro:requiresParticipant'
          ? options.requiresParticipant
          : options.allowAnonymous,
    } as unknown as Reflector;
    const sessions = {
      resolve: () => Promise.resolve(options.resolves ?? null),
    } as unknown as UserSessionService;
    return new ParticipantGuard(reflector, sessions);
  }

  it('lets the public landing page through without a cookie', async () => {
    const guard = guardFor({ controllerPath: 'user/series' });

    await expect(
      guard.canActivate(contextFor({ cookies: {} } as RequestWithParticipant)),
    ).resolves.toBe(true);
  });

  it('leaves the administrative area to its own guard', async () => {
    const guard = guardFor({ controllerPath: 'admin/participants' });

    await expect(
      guard.canActivate(contextFor({ cookies: {} } as RequestWithParticipant)),
    ).resolves.toBe(true);
  });

  it('demands a session below participant/, cookie or no cookie', async () => {
    const guard = guardFor({ controllerPath: 'participant/conversations' });

    await expect(
      guard.canActivate(contextFor({ cookies: {} } as RequestWithParticipant)),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a cookie that no longer resolves', async () => {
    const guard = guardFor({
      controllerPath: 'participant/me',
      resolves: null,
    });
    const request = {
      cookies: { [USER_SESSION_COOKIE]: 'stale-token' },
    } as unknown as RequestWithParticipant;

    await expect(guard.canActivate(contextFor(request))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('ignores the administrative cookie: two cookies, two identities (E34)', async () => {
    const guard = guardFor({
      controllerPath: 'participant/me',
      resolves: authenticated,
    });
    const request = {
      cookies: { trefaro_admin_session: 'an-organizers-session' },
    } as unknown as RequestWithParticipant;

    await expect(guard.canActivate(contextFor(request))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('parks the participant on the request for the controller to use', async () => {
    const guard = guardFor({
      controllerPath: 'participant/me',
      resolves: authenticated,
    });
    const request = {
      cookies: { [USER_SESSION_COOKIE]: 'good-token' },
    } as unknown as RequestWithParticipant;

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request[CURRENT_PARTICIPANT_PROPERTY]).toBe(authenticated);
  });

  it('lets the login through, which cannot have a session yet', async () => {
    const guard = guardFor({
      controllerPath: 'participant/auth',
      allowAnonymous: true,
    });

    await expect(
      guard.canActivate(contextFor({ cookies: {} } as RequestWithParticipant)),
    ).resolves.toBe(true);
  });

  it('demands a session where a decorator asks for one, whatever the path says', async () => {
    // `/api/media/messages/:id/attachment` (E40). Stored bytes are served
    // under the media prefix (E19), so this one route cannot say what it needs
    // in its path — and a decorator that only ever *adds* a requirement does
    // not undo the argument of F69.
    const guard = guardFor({
      controllerPath: 'media/messages',
      requiresParticipant: true,
    });

    await expect(
      guard.canActivate(contextFor({ cookies: {} } as RequestWithParticipant)),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('leaves the other media routes public', async () => {
    // The logos and the avatar (F113, F115, F124): no session, and no
    // decorator either — the difference between them and a chat picture is the
    // whole argument of E40.
    const guard = guardFor({ controllerPath: 'media/profiles' });

    await expect(
      guard.canActivate(contextFor({ cookies: {} } as RequestWithParticipant)),
    ).resolves.toBe(true);
  });

  it('ignores non-http contexts — the chat handshake authenticates itself (E41)', async () => {
    const guard = guardFor({ controllerPath: 'participant/me' });
    const context = { getType: () => 'ws' } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});

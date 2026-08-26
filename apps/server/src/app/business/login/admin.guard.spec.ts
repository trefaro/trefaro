import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import {
  AdminGuard,
  CURRENT_ADMIN_PROPERTY,
  isAdminPath,
  type RequestWithAdmin,
} from './admin.guard';
import type { AuthenticatedAdmin } from './ports/admin-session.repository';
import type { SessionService } from './session.service';
import { ADMIN_SESSION_COOKIE } from './session-cookie';

const authenticated = {
  sessionId: 'session-1',
  lastSeenAt: new Date(),
  expiresAt: new Date(Date.now() + 3_600_000),
  admin: {
    id: 'admin-1',
    email: 'organizer@example.org',
    name: 'Alex Weber',
    passwordHash: 'hashed:secret',
    createdAt: new Date(),
    lastLoginAt: null,
  },
} satisfies AuthenticatedAdmin;

describe('isAdminPath', () => {
  it.each(['admin', '/admin', 'admin/auth', 'admin/plugins/room-planning'])(
    'protects "%s"',
    (path) => {
      expect(isAdminPath(path)).toBe(true);
    },
  );

  it.each([
    'user/events',
    'config',
    'health',
    '',
    // Must not match on a prefix: this is a different resource.
    'administrators',
    undefined,
  ])('leaves "%s" public', (path) => {
    expect(isAdminPath(path)).toBe(false);
  });

  it('protects a public controller with an admin handler below it', () => {
    expect(isAdminPath('', 'admin/reports')).toBe(true);
  });
});

describe('AdminGuard', () => {
  const handler = () => undefined;
  class RoomPlanningController {}

  function contextFor(request: RequestWithAdmin): ExecutionContext {
    return {
      getType: () => 'http',
      getHandler: () => handler,
      getClass: () => RoomPlanningController,
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  }

  function guardFor(options: {
    controllerPath: string;
    allowAnonymous?: boolean;
    resolves?: AuthenticatedAdmin | null;
  }): AdminGuard {
    const reflector = {
      get: (key: unknown, target: unknown) =>
        key === PATH_METADATA && target === RoomPlanningController
          ? options.controllerPath
          : undefined,
      getAllAndOverride: () => options.allowAnonymous,
    } as unknown as Reflector;
    const sessions = {
      resolve: () => Promise.resolve(options.resolves ?? null),
    } as unknown as SessionService;
    return new AdminGuard(reflector, sessions);
  }

  it('lets a public route through without a cookie', async () => {
    const guard = guardFor({ controllerPath: 'user/events' });

    await expect(
      guard.canActivate(contextFor({ cookies: {} } as RequestWithAdmin)),
    ).resolves.toBe(true);
  });

  it('demands a session for a plug-in controller, without that plug-in doing anything', async () => {
    const guard = guardFor({ controllerPath: 'admin/plugins/room-planning' });

    await expect(
      guard.canActivate(contextFor({ cookies: {} } as RequestWithAdmin)),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a cookie that no longer resolves', async () => {
    const guard = guardFor({
      controllerPath: 'admin/admins',
      resolves: null,
    });
    const request = {
      cookies: { [ADMIN_SESSION_COOKIE]: 'stale-token' },
    } as unknown as RequestWithAdmin;

    await expect(guard.canActivate(contextFor(request))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('parks the administrator on the request for the controller to use', async () => {
    const guard = guardFor({
      controllerPath: 'admin/admins',
      resolves: authenticated,
    });
    const request = {
      cookies: { [ADMIN_SESSION_COOKIE]: 'good-token' },
    } as unknown as RequestWithAdmin;

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request[CURRENT_ADMIN_PROPERTY]).toBe(authenticated);
  });

  it('lets the login through, which is the one route below admin that cannot have a session yet', async () => {
    const guard = guardFor({
      controllerPath: 'admin/auth',
      allowAnonymous: true,
    });

    await expect(
      guard.canActivate(contextFor({ cookies: {} } as RequestWithAdmin)),
    ).resolves.toBe(true);
  });

  it('ignores non-http contexts — the websocket handshake is authenticated separately', async () => {
    const guard = guardFor({ controllerPath: 'admin/admins' });
    const context = {
      getType: () => 'ws',
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});

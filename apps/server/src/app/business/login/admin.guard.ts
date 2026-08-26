import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { AuthenticatedAdmin } from './ports/admin-session.repository';
import { SessionService } from './session.service';
import { ADMIN_SESSION_COOKIE } from './session-cookie';

const ALLOW_ANONYMOUS_METADATA = 'trefaro:allowAnonymous';

/**
 * Marks a route below `admin/` as reachable without a session.
 *
 * There are exactly two: logging in, which has no session yet, and logging out,
 * which must not fail just because the session already expired. Every further
 * use of this decorator deserves a hard question in review.
 */
export const AllowAnonymous = (): MethodDecorator & ClassDecorator =>
  SetMetadata(ALLOW_ANONYMOUS_METADATA, true);

/** Where the authenticated administrator is parked for the request. */
export const CURRENT_ADMIN_PROPERTY = 'trefaroAdmin';

export interface RequestWithAdmin extends Request {
  [CURRENT_ADMIN_PROPERTY]?: AuthenticatedAdmin;
}

/**
 * Does a route below this path need an administrative session?
 *
 * Decided from the **declared** controller and handler paths, not from the
 * requested URL. The declared path is written by us; a URL is written by the
 * caller, and Express routes case-insensitively, so `/api/ADMIN/…` would slip
 * past a naive string comparison on the request path.
 */
export function isAdminPath(...declaredPaths: readonly unknown[]): boolean {
  return declaredPaths
    .filter((path): path is string => typeof path === 'string')
    .some((path) => /^\/*admin(\/|$)/.test(path));
}

/**
 * Requires an administrative session for everything under `/api/admin`
 * (FR 1.3).
 *
 * Registered globally, and keyed on the route path rather than on a decorator:
 * plug-in controllers are written by plug-in authors, and a forgotten
 * `@UseGuards` would be an open endpoint. Deny by default, with
 * {@link AllowAnonymous} as the visible exception.
 *
 * `/api/config`, `/api/health` and everything under `/api/user` stay public —
 * the participant start page and the event landing page are reachable without a
 * login by design.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Gateways carry no cookies through this path; the chat handshake gets its
    // own authentication in phase 3.
    if (context.getType() !== 'http') return true;

    const guarded = isAdminPath(
      this.reflector.get(PATH_METADATA, context.getClass()),
      this.reflector.get(PATH_METADATA, context.getHandler()),
    );
    if (!guarded) return true;

    if (
      this.reflector.getAllAndOverride<boolean | undefined>(
        ALLOW_ANONYMOUS_METADATA,
        [context.getHandler(), context.getClass()],
      )
    ) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithAdmin>();
    const token = request.cookies?.[ADMIN_SESSION_COOKIE];
    if (typeof token !== 'string' || token.length === 0) {
      throw new UnauthorizedException('Administrative session required');
    }

    const admin = await this.sessions.resolve(token);
    if (!admin) {
      throw new UnauthorizedException('Administrative session required');
    }

    request[CURRENT_ADMIN_PROPERTY] = admin;
    return true;
  }
}

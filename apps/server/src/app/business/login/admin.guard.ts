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
import type { AuthenticatedAdmin } from './ports/admin-session.repository';
import { SessionService } from './session.service';
import { ADMIN_SESSION_COOKIE } from './session-cookie';

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
 * (FR 1.3). Its counterpart for participants is `ParticipantGuard` (E33).
 *
 * Registered globally, and keyed on the route path rather than on a decorator:
 * plug-in controllers are written by plug-in authors, and a forgotten
 * `@UseGuards` would be an open endpoint. Deny by default, with
 * {@link AllowAnonymous} as the visible exception.
 *
 * `/api/config`, `/api/health` and everything under `/api/user` stay public —
 * the participant start page and the event landing page are reachable without a
 * login by design. `/api/participant` is guarded too, by its own guard and its
 * own cookie: three prefixes, three levels of access (E33).
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

    if (allowsAnonymous(this.reflector, context)) return true;

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

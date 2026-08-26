import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle, minutes } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AdminUserService, toAdminSummary } from './admin-user.service';
import { AllowAnonymous } from './admin.guard';
import { CurrentAdmin } from './current-admin.decorator';
import { AdminSessionInfoDto, toAdminAccountDto } from './dto/admin.dto';
import { AdminLoginDto } from './dto/login.dto';
import type { AuthenticatedAdmin } from './ports/admin-session.repository';
import { SessionService } from './session.service';
import {
  ADMIN_SESSION_COOKIE,
  adminSessionCookieOptions,
} from './session-cookie';
import type { TrefaroEnv } from '../../core/config/env';
import { ENV } from '../../core/config/env.module';

/** Kept short so a stray value cannot fill the column. */
const USER_AGENT_MAX_LENGTH = 512;

/**
 * Login attempts allowed per address per five minutes.
 *
 * Exported because two things outside this file depend on the number:
 * `tools/spike-verification/verify-admin-access.mjs`, which proves the block
 * actually happens, and the end-to-end suites, which have to stay below it.
 */
export const LOGIN_ATTEMPTS_PER_WINDOW = 20;

/**
 * Administrative login (UC 01, FR 1.3).
 *
 * The session token travels in an HttpOnly cookie, so no script — injected or
 * otherwise — can read it, and the organizer client never has to store a
 * credential itself.
 */
@ApiTags('administration')
@Controller('admin/auth')
export class AuthController {
  constructor(
    private readonly admins: AdminUserService,
    private readonly sessions: SessionService,
    @Inject(ENV) private readonly env: TrefaroEnv,
  ) {}

  @Post('login')
  // No session exists yet — the one route below `admin/` that cannot require one.
  @AllowAnonymous()
  // Twenty attempts per five minutes, then fifteen minutes of silence. The
  // block is what makes guessing pointless — roughly 1 900 attempts a day
  // against an argon2id hash of a passphrase of at least twelve characters is
  // not an attack, it is a rounding error. A tighter count was tried first and
  // rejected for a practical reason worth writing down: the whole test suite
  // logs in from a single address, and a limit it cannot survive gets relaxed
  // for tests, which is how a limit stops being tested at all.
  @Throttle({
    default: {
      limit: LOGIN_ATTEMPTS_PER_WINDOW,
      ttl: minutes(5),
      blockDuration: minutes(15),
    },
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Log in as an administrator',
    description:
      'Sets an HttpOnly session cookie. Answers the same way for an unknown ' +
      'address as for a wrong password, so the form cannot be used to find out ' +
      'who works for the organization.',
  })
  @ApiOkResponse({ type: AdminSessionInfoDto })
  @ApiUnauthorizedResponse({ description: 'Wrong e-mail address or password.' })
  async login(
    @Body() body: AdminLoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AdminSessionInfoDto> {
    const admin = await this.admins.authenticate(body.email, body.password);
    if (!admin) {
      throw new UnauthorizedException('Wrong e-mail address or password');
    }

    const session = await this.sessions.issue(
      admin.id,
      request.headers['user-agent']?.slice(0, USER_AGENT_MAX_LENGTH) ?? null,
    );

    response.cookie(
      ADMIN_SESSION_COOKIE,
      session.token,
      adminSessionCookieOptions(this.env, session.expiresAt),
    );

    return {
      admin: toAdminAccountDto(toAdminSummary(admin)),
      expiresAt: session.expiresAt.toISOString(),
    };
  }

  @Post('logout')
  // Logging out with an expired session must succeed, not answer 401.
  @AllowAnonymous()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'End the current administrative session' })
  @ApiNoContentResponse({ description: 'Session ended, or there was none.' })
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const token = request.cookies?.[ADMIN_SESSION_COOKIE];
    if (typeof token === 'string' && token.length > 0) {
      await this.sessions.revoke(token);
    }
    response.clearCookie(
      ADMIN_SESSION_COOKIE,
      adminSessionCookieOptions(this.env),
    );
  }

  @Get('me')
  @ApiOperation({
    summary: 'Who is logged in, and until when',
    description:
      'The organizer client calls this on startup to decide whether to show ' +
      'the login form or the workspace.',
  })
  @ApiOkResponse({ type: AdminSessionInfoDto })
  @ApiUnauthorizedResponse({ description: 'No valid session.' })
  me(@CurrentAdmin() current: AuthenticatedAdmin): AdminSessionInfoDto {
    return {
      admin: toAdminAccountDto(toAdminSummary(current.admin)),
      expiresAt: current.expiresAt.toISOString(),
    };
  }
}

import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle, minutes } from '@nestjs/throttler';
import { PROFILES_MODULE_KEY } from '@trefaro/shared-models';
import type { Request, Response } from 'express';
import { AllowAnonymous } from '../common/allow-anonymous';
import { LOGIN_ATTEMPTS_PER_WINDOW } from '../common/login-throttle';
import { CoreModuleController, CoreModuleEnabledGuard } from '../config';
import { ParticipantLoginDto } from './dto/participant-login.dto';
import {
  ParticipantSessionInfoDto,
  toParticipantAccountDto,
} from './dto/participant.dto';
import { ProfilesService } from './profiles.service';
import { UserSessionService } from './user-session.service';
import {
  USER_SESSION_COOKIE,
  participantSessionFromRequest,
  userSessionCookieOptions,
} from './user-session-cookie';
import type { TrefaroEnv } from '../../core/config/env';
import { ENV } from '../../core/config/env.module';

/**
 * Participant login (FR 4.2, UC 09).
 *
 * The session token travels in an HttpOnly cookie of its own
 * (`trefaro_user_session`), so no script can read it and the participant client
 * never has to store a credential itself. Its own cookie rather than a role in
 * the administrative one (E34): an organizer who is also a participant holds
 * both at the same time, and a cookie carrying a role would decide
 * authorization in the browser.
 */
@ApiTags('profiles')
@UseGuards(CoreModuleEnabledGuard)
@CoreModuleController(PROFILES_MODULE_KEY)
@Controller('participant/auth')
export class ParticipantAuthController {
  constructor(
    private readonly profiles: ProfilesService,
    private readonly sessions: UserSessionService,
    @Inject(ENV) private readonly env: TrefaroEnv,
  ) {}

  @Post('login')
  // No session exists yet — one of the two routes below `participant/` that
  // cannot require one.
  @AllowAnonymous()
  // The same limit as the administrative login; the reasoning is with the
  // constant, which both share.
  @Throttle({
    default: {
      limit: LOGIN_ATTEMPTS_PER_WINDOW,
      ttl: minutes(5),
      blockDuration: minutes(15),
    },
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Log in as a participant',
    description:
      'Sets an HttpOnly session cookie. Answers the same way for an unknown ' +
      'address as for a wrong password, so the form cannot be used to find ' +
      'out who has an account here. The one exception is an address that has ' +
      'not been confirmed yet: somebody who can produce the right password ' +
      'already knows the account exists, and telling them nothing would leave ' +
      'them stuck (403).',
  })
  @ApiOkResponse({ type: ParticipantSessionInfoDto })
  @ApiUnauthorizedResponse({ description: 'Wrong e-mail address or password.' })
  @ApiForbiddenResponse({
    description: 'The address has not been confirmed yet (E32).',
  })
  async login(
    @Body() body: ParticipantLoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ParticipantSessionInfoDto> {
    const check = await this.profiles.checkCredentials(
      body.email,
      body.password,
    );
    if (check.outcome === 'rejected') {
      throw new UnauthorizedException('Wrong e-mail address or password');
    }
    if (check.outcome === 'unconfirmed') {
      throw new ForbiddenException(
        'Please confirm your address first — the link is in the mail you received.',
      );
    }

    const session = await this.sessions.issue(check.profile.id);

    response.cookie(
      USER_SESSION_COOKIE,
      session.token,
      userSessionCookieOptions(this.env, session.expiresAt),
    );

    return {
      participant: toParticipantAccountDto(check.profile),
      expiresAt: session.expiresAt.toISOString(),
    };
  }

  @Post('logout')
  // Logging out with an expired session must succeed, not answer 401.
  @AllowAnonymous()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'End the current participant session' })
  @ApiNoContentResponse({ description: 'Session ended, or there was none.' })
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const token = participantSessionFromRequest(request);
    if (token) await this.sessions.revoke(token);
    response.clearCookie(
      USER_SESSION_COOKIE,
      userSessionCookieOptions(this.env),
    );
  }
}

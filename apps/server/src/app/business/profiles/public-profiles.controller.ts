import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RateLimit } from '../../core/throttling/rate-limit.decorator';
import { ThrottleByRecipient } from '../../core/throttling/recipient-throttle.interceptor';
import { PROFILES_MODULE_KEY } from '@trefaro/shared-models';
import { CoreModuleController, CoreModuleEnabledGuard } from '../config';
import {
  ConfirmProfileDto,
  RegisterProfileDto,
} from './dto/register-profile.dto';
import {
  ProfileConfirmationDto,
  ProfileRegistrationAcknowledgementDto,
} from './dto/participant.dto';
import {
  PasswordResetAcknowledgementDto,
  RequestPasswordResetDto,
  ResetPasswordDto,
} from './dto/password-reset.dto';
import { ProfilesService } from './profiles.service';

/**
 * Creating, confirming and getting back into a participant account
 * (FR 4.1, UC 09, and since AP 4 of phase 5 the reset of a forgotten password).
 *
 * Under `/api/user` and not `/api/participant`, deliberately: at this point
 * there is nobody to authenticate, and the prefix is what carries the guard
 * (E33). These four are the only account routes reachable without a session,
 * and all four are shaped by the same rule — an unauthenticated caller must not
 * be able to learn from an answer whether an address has an account here
 * (E10, E32).
 *
 * The reset is two routes rather than one because it is two different moments:
 * asking for a link says an address, setting a password says a token. Nothing
 * in between is stored (E5) — what makes the link work exactly once is in
 * `password-reset-token.ts`.
 *
 * All of them answer 404 while the `profiles` module is switched off (F53) — an
 * organization that only runs events and keeps no accounts should not have a
 * registration form that works.
 */
@ApiTags('profiles')
@UseGuards(CoreModuleEnabledGuard)
@CoreModuleController(PROFILES_MODULE_KEY)
@Controller('user/profiles')
export class PublicProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  // The registration limit, because this is a registration form: it sends mail
  // to an address the caller chose, and the household behind one public address
  // is the case that must not break. Its number was a constant here until AP 4
  // of phase 5 — one the operator could not move and the four routes of AP 2
  // had already left behind (E60).
  @RateLimit('registration')
  // Like the registration and the newsletter: this route puts a link in an
  // inbox the caller names, so the inbox gets a budget of its own.
  @ThrottleByRecipient()
  @ApiOperation({
    summary: 'Create a participant account',
    description:
      'Answers the same way whether the address was unknown, waiting for its ' +
      'confirmation, or long since in use (E32). What differs is the message ' +
      'that goes out, and only its recipient reads it. 200 rather than 201: ' +
      'the caller learns that a mail is on its way, never whether a row was ' +
      'written.',
  })
  @ApiOkResponse({ type: ProfileRegistrationAcknowledgementDto })
  @ApiBadRequestResponse({
    description: 'The form is incomplete, or the password is too short.',
  })
  @ApiServiceUnavailableResponse({
    description: 'The mail server could not be reached; nothing was confirmed.',
  })
  register(
    @Body() body: RegisterProfileDto,
  ): Promise<ProfileRegistrationAcknowledgementDto> {
    return this.profiles.register(
      body,
    ) as Promise<ProfileRegistrationAcknowledgementDto>;
  }

  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  // A confirmation, like the other three: the only thing this limit defends
  // against is guessing an HMAC.
  @RateLimit('confirmation')
  @ApiOperation({
    summary: 'Confirm an account with the token from the mailed link',
    description:
      'A POST although the participant arrives by clicking a link: the link ' +
      'goes to a page, and the page posts here (E5b). A mail scanner that ' +
      'prefetches links therefore confirms nothing. Idempotent — a second ' +
      'click reports `already-confirmed` rather than failing.',
  })
  @ApiOkResponse({ type: ProfileConfirmationDto })
  @ApiBadRequestResponse({
    description: 'The token is malformed, forged or expired.',
  })
  @ApiNotFoundResponse({ description: 'The account no longer exists.' })
  confirm(@Body() body: ConfirmProfileDto): Promise<ProfileConfirmationDto> {
    return this.profiles.confirm(body.token) as Promise<ProfileConfirmationDto>;
  }

  @Post('password-reset')
  @HttpCode(HttpStatus.OK)
  // Its own limit, and the only route of this controller that has one: it is
  // the one somebody can point at an inbox that is not theirs without knowing
  // anything at all about it.
  @RateLimit('password-reset')
  // And the inbox gets its own budget on top, like every route that mails to an
  // address the caller named (F204).
  @ThrottleByRecipient()
  @ApiOperation({
    summary: 'Ask for a link that sets a new password',
    description:
      'Answers the same way — and in the same time — whether the address has ' +
      'a confirmed account, an unconfirmed one, or none at all (E10, E32). ' +
      'All three send a letter, and which letter it is, is the only place the ' +
      'difference appears. 200 rather than 202: the caller learns that a mail ' +
      'is on its way, never what it says.',
  })
  @ApiOkResponse({ type: PasswordResetAcknowledgementDto })
  @ApiBadRequestResponse({ description: 'That is not an e-mail address.' })
  @ApiServiceUnavailableResponse({
    description:
      'The mail server could not be reached — for every address alike, so a ' +
      'failure cannot be read as an answer either.',
  })
  requestPasswordReset(
    @Body() body: RequestPasswordResetDto,
  ): Promise<PasswordResetAcknowledgementDto> {
    return this.profiles.requestPasswordReset(
      body.email,
    ) as Promise<PasswordResetAcknowledgementDto>;
  }

  @Post('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RateLimit('confirmation')
  @ApiOperation({
    summary: 'Set a new password with the token from the mailed link',
    description:
      'The token is in the body, not the query (F44, E5b): the link goes to a ' +
      'page and the page posts here, so nothing that merely fetches an ' +
      'address can set a password. The link works once — it is minted against ' +
      'the password it replaces — and every session of the account ends ' +
      '(F139). No session is issued: the new password is proved by using it.',
  })
  @ApiNoContentResponse({ description: 'The password is set.' })
  @ApiBadRequestResponse({
    description:
      'The link is spent, expired or forged, or the password is too short. ' +
      'One sentence for all of them: to the person holding the link they are ' +
      'one situation, and telling them apart would say whether the address ' +
      'has an account.',
  })
  async resetPassword(@Body() body: ResetPasswordDto): Promise<void> {
    await this.profiles.resetPassword(body.token, body.password);
  }
}

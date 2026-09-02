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
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle, minutes } from '@nestjs/throttler';
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
import { ProfilesService } from './profiles.service';

/**
 * How many accounts one address may try to create per five minutes.
 *
 * Sixty, the same as the registration form and for the same reason: this
 * endpoint sends mail, so it is worth limiting, but a household or an office
 * behind one address must be able to sign several people up in a row. The
 * expensive part — argon2id — is bounded by the password length, not by this.
 */
export const PROFILE_REGISTRATIONS_PER_WINDOW = 60;

/**
 * Creating and confirming a participant account (FR 4.1, UC 09).
 *
 * Under `/api/user` and not `/api/participant`, deliberately: at this point
 * there is nobody to authenticate, and the prefix is what carries the guard
 * (E33). These are the only two account routes reachable without a session.
 *
 * Both answer 404 while the `profiles` module is switched off (F53) — an
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
  @Throttle({
    default: { limit: PROFILE_REGISTRATIONS_PER_WINDOW, ttl: minutes(5) },
  })
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
  @Throttle({
    default: { limit: PROFILE_REGISTRATIONS_PER_WINDOW, ttl: minutes(5) },
  })
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
}

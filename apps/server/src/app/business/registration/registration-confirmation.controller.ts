import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle, minutes } from '@nestjs/throttler';
import { ConfirmRegistrationDto } from './dto/create-registration.dto';
import { RegistrationConfirmationDto } from './dto/registration.dto';
import { RegistrationService } from './registration.service';

/**
 * Confirming a registration (E5b).
 *
 * A POST, although the participant arrives by clicking a link in a mail: the
 * link goes to a page in the participant client, and the page posts here. Two
 * reasons, both practical. A mail scanner that prefetches links would otherwise
 * confirm registrations nobody asked to confirm — and a GET that changes state
 * also breaks the `SameSite=Lax` reasoning the session cookie rests on (E2).
 *
 * Throttled because the token is guessable in principle, if not in practice.
 */
@ApiTags('registrations')
@Controller('user/registrations')
export class RegistrationConfirmationController {
  constructor(private readonly registrations: RegistrationService) {}

  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: minutes(5) } })
  @ApiOperation({
    summary: 'Confirm a registration with the token from the mailed link',
    description:
      'Idempotent: following the link twice reports `already-confirmed` rather ' +
      'than failing. Only `pending → confirmed` is a transition.',
  })
  @ApiOkResponse({ type: RegistrationConfirmationDto })
  @ApiBadRequestResponse({
    description: 'The token is malformed, forged or expired.',
  })
  @ApiNotFoundResponse({ description: 'The registration no longer exists.' })
  @ApiConflictResponse({
    description: 'The registration was cancelled and cannot be confirmed.',
  })
  confirm(
    @Body() body: ConfirmRegistrationDto,
  ): Promise<RegistrationConfirmationDto> {
    return this.registrations.confirm(
      body.token,
    ) as Promise<RegistrationConfirmationDto>;
  }
}

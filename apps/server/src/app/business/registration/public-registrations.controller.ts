import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle, minutes } from '@nestjs/throttler';
import { CreateRegistrationDto } from './dto/create-registration.dto';
import { RegistrationAcknowledgementDto } from './dto/registration.dto';
import { RegistrationService } from './registration.service';

/**
 * Attempts allowed per address per five minutes.
 *
 * Every registration sends a mail, so this endpoint is a way to send mail to
 * someone else's inbox — the reason it is throttled more tightly than the
 * default. Deliberately without a block period, unlike the login: a participant
 * who mistypes their address a few times has to be able to fix it, and the whole
 * end-to-end suite registers from a single address.
 */
export const REGISTRATIONS_PER_WINDOW = 30;

/**
 * Registering for an event, as a participant (UC 07, FR 3.5).
 *
 * No login: phase 1 has no participant accounts, and the thesis asks for the
 * lowest possible entry threshold. The address is verified by the double opt-in
 * mail instead of by an account.
 *
 * The path follows the event's public address, which is unique per series rather
 * than per instance (E7) — so `/series/:series/events/:event/registrations`,
 * not the flat `/events/:slug/registrations` the plan sketched.
 */
@ApiTags('registrations')
@Controller('user/series/:seriesSlug/events/:eventSlug/registrations')
export class PublicRegistrationsController {
  constructor(private readonly registrations: RegistrationService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({
    default: { limit: REGISTRATIONS_PER_WINDOW, ttl: minutes(5) },
  })
  @ApiOperation({
    summary: 'Register for a published event',
    description:
      'Answers 202 in every case in which the request was well formed — a ' +
      'known address, an unknown one and an already confirmed one are ' +
      'indistinguishable from the outside (E10). Nothing is registered until ' +
      'the mailed link is confirmed.',
  })
  @ApiAcceptedResponse({ type: RegistrationAcknowledgementDto })
  @ApiNotFoundResponse({
    description: 'No published event at that address.',
  })
  @ApiConflictResponse({ description: 'The event has already taken place.' })
  @ApiServiceUnavailableResponse({
    description:
      'The confirmation mail could not be sent. The attempt can be repeated; ' +
      'it will not create a second registration.',
  })
  register(
    @Param('seriesSlug') seriesSlug: string,
    @Param('eventSlug') eventSlug: string,
    @Body() body: CreateRegistrationDto,
  ): Promise<RegistrationAcknowledgementDto> {
    return this.registrations.register(
      seriesSlug,
      eventSlug,
      body,
    ) as Promise<RegistrationAcknowledgementDto>;
  }
}

import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { PROFILES_MODULE_KEY } from '@trefaro/shared-models';
import { ApiLocaleQuery, LocaleQueryPipe } from '../common/locale-query.pipe';
import { CoreModuleController, CoreModuleEnabledGuard } from '../config';
import { CurrentParticipant } from '../profiles/current-participant.decorator';
import type { AuthenticatedParticipant } from '../profiles/ports/user-session.repository';
import { MyRegistrationDto } from './dto/my-registration.dto';
import {
  ListMyRegistrationsDto,
  MyRegistrationPageDto,
} from './dto/my-registrations.dto';
import { SelfServiceService, byAccount } from './self-service.service';

/**
 * "My registrations" for somebody who is logged in (FR 4.7, E11's second half).
 *
 * The same operations as the token-authorized controllers next door, resolved
 * by the session instead of by a link — and deliberately not *instead* of them:
 * the links already in people's inboxes keep working, which is what E11
 * promised. What changes is only who may say "this registration is mine": a
 * signature, or an address (E31).
 *
 * Three consequences are visible in this file:
 *
 * 1. **No token anywhere.** Not in a query, not in a body. The session cookie
 *    is the credential, the path is the guard (E33), and there is nothing left
 *    to put in an access log.
 * 2. **The list is the one screen a link cannot open.** A token speaks for one
 *    registration; a person is not a registration.
 * 3. **No throttle of its own.** The token routes carry one because a token is
 *    guessable in principle and every call costs an HMAC (E4); a session is
 *    neither guessed nor cheap to obtain, and the global limit still applies.
 *
 * Behind the `profiles` module switch (F53) like everything under
 * `participant/`: an instance that keeps no accounts has nobody to answer here.
 *
 * Since AP 12 the cancellation is here as well, and it is a `POST` to
 * `:id/cancellation` rather than a `DELETE` on the registration (F179): in this
 * API, deleting a registration is what an organizer does to answer a request
 * for erasure, and a verb that means "gone for good" one path up must not mean
 * "cancelled but kept" here. It is also the same shape the mailed link has
 * used since phase 1, so the one operation reads the same way through both
 * claims.
 */
@ApiTags('registrations')
@UseGuards(CoreModuleEnabledGuard)
@CoreModuleController(PROFILES_MODULE_KEY)
@Controller('participant/registrations')
export class ParticipantRegistrationsController {
  constructor(private readonly selfService: SelfServiceService) {}

  @Get()
  @ApiOperation({
    summary: 'The registrations of the logged-in participant (FR 4.7)',
    description:
      'Found by address equality, because that is what a person is here — ' +
      '`registration` has no `user_id` and does not get one (E31). Ordered ' +
      'by the event that starts last first, every state included.',
  })
  @ApiLocaleQuery()
  @ApiOkResponse({ type: MyRegistrationPageDto })
  @ApiUnauthorizedResponse({ description: 'No valid session.' })
  list(
    @CurrentParticipant() current: AuthenticatedParticipant,
    @Query() query: ListMyRegistrationsDto,
    @Query('locale', LocaleQueryPipe) locale?: string,
  ): Promise<MyRegistrationPageDto> {
    return this.selfService.listFor(
      current.profile.email,
      query,
      locale,
    ) as Promise<MyRegistrationPageDto>;
  }

  @Get(':id')
  @ApiOperation({
    summary: 'One of them in full, with the programme and its seats',
    description:
      'The same view the mailed link opens, and the same rules: only a ' +
      'confirmed registration has a self-service page.',
  })
  @ApiLocaleQuery()
  @ApiOkResponse({ type: MyRegistrationDto })
  @ApiNotFoundResponse({
    description:
      'No registration of theirs has that id. Said the same way for an ' +
      'unknown id and for somebody else’s — the difference is not this ' +
      'reader’s to learn.',
  })
  @ApiConflictResponse({
    description: 'The registration was cancelled, or is not confirmed yet.',
  })
  view(
    @CurrentParticipant() current: AuthenticatedParticipant,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('locale', LocaleQueryPipe) locale?: string,
  ): Promise<MyRegistrationDto> {
    return this.selfService.view(
      byAccount(current.profile.email, id),
      locale,
    ) as Promise<MyRegistrationDto>;
  }

  @Put(':id/program-items/:itemId/signup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Claim a seat in one session (FR 3.10)',
    description:
      'Idempotent, and answers with the whole view: a seat can be taken ' +
      'between rendering the page and pressing the button.',
  })
  @ApiLocaleQuery()
  @ApiOkResponse({ type: MyRegistrationDto })
  @ApiNotFoundResponse({
    description: 'No such registration of theirs, or no such session in it.',
  })
  @ApiConflictResponse({
    description: 'The session takes no sign-up, is over, or is full.',
  })
  signUp(
    @CurrentParticipant() current: AuthenticatedParticipant,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Query('locale', LocaleQueryPipe) locale?: string,
  ): Promise<MyRegistrationDto> {
    return this.selfService.signUp(
      itemId,
      byAccount(current.profile.email, id),
      locale,
    ) as Promise<MyRegistrationDto>;
  }

  @Delete(':id/program-items/:itemId/signup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Give up a seat again (FR 3.10)',
    description:
      'Idempotent as well: giving up a seat one does not hold is not an ' +
      'error. The registration id is in the path rather than derived from the ' +
      'session, so this route says which registration it is acting on.',
  })
  @ApiLocaleQuery()
  @ApiOkResponse({ type: MyRegistrationDto })
  @ApiNotFoundResponse({
    description: 'No such registration of theirs, or no such session in it.',
  })
  signOff(
    @CurrentParticipant() current: AuthenticatedParticipant,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Query('locale', LocaleQueryPipe) locale?: string,
  ): Promise<MyRegistrationDto> {
    return this.selfService.signOff(
      itemId,
      byAccount(current.profile.email, id),
      locale,
    ) as Promise<MyRegistrationDto>;
  }

  @Post(':id/cancellation')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel one’s own registration through the session (FR 4.7)',
    description:
      'The second claim on the operation the mailed link has been able to ' +
      'make since phase 1 (F148), and the same rules below the claim: only a ' +
      'confirmed registration can be cancelled, the record stays (F23), and ' +
      'the seats in individual sessions go with it. No notice goes out — the ' +
      'participant is cancelling on their own page and reads the answer there ' +
      '(F59).',
  })
  @ApiLocaleQuery()
  @ApiOkResponse({ type: MyRegistrationDto })
  @ApiNotFoundResponse({
    description: 'No registration of theirs has that id — worded as above.',
  })
  @ApiConflictResponse({
    description: 'Already cancelled, or not confirmed yet.',
  })
  cancel(
    @CurrentParticipant() current: AuthenticatedParticipant,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('locale', LocaleQueryPipe) locale?: string,
  ): Promise<MyRegistrationDto> {
    return this.selfService.cancel(
      byAccount(current.profile.email, id),
      locale,
    ) as Promise<MyRegistrationDto>;
  }
}

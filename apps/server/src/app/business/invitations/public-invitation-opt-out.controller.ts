import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle, minutes } from '@nestjs/throttler';
import { ContactOptOutResultDto } from './dto/invitation.dto';
import { InvitationOptOutDto } from './dto/opt-out.dto';
import { OPT_OUT_CALLS_PER_WINDOW } from './invitations.limits';
import { InvitationsService } from './invitations.service';

/**
 * "Do not invite me again" (FR 2.4, E15).
 *
 * The one public endpoint of this module, and the only reason writing to former
 * participants is legitimate at all: every invitation carries a link here, the
 * link needs no account, and one click ends it — for this address, everywhere
 * in this instance (F57).
 *
 * Under `/api/user/**`, so outside the administrative guard (E16) and
 * authorized by the signed token instead. A `POST` rather than a `GET` for the
 * reason of E5b: a link previewer must not decide this on the reader's behalf.
 */
@ApiTags('invitations')
@Controller('user/invitations/opt-out')
@Throttle({ default: { limit: OPT_OUT_CALLS_PER_WINDOW, ttl: minutes(5) } })
export class PublicInvitationOptOutController {
  constructor(private readonly invitations: InvitationsService) {}

  @Post()
  // 200, not 201: nothing is created — a flag is set on rows that already
  // exist. The same choice as confirming a registration and as the self-service
  // operations, all of which are POSTs that change something.
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Object to being invited again (E15)',
    description:
      'Sets `contact_opt_out` on every registration of this address, across ' +
      'the whole instance — the objection belongs to the person, not to the row ' +
      'the link happened to be signed for (F57). Afterwards the address is in ' +
      'no contact list any more. Idempotent: a second click answers ' +
      '`already-opted-out`. Transactional mail — a confirmation, a cancellation ' +
      'notice — is unaffected (F59): somebody who does not want invitations ' +
      'still has to learn that their registration was cancelled.',
  })
  @ApiOkResponse({ type: ContactOptOutResultDto })
  @ApiBadRequestResponse({ description: 'Missing, forged or expired token.' })
  @ApiNotFoundResponse({
    description: 'The registration the link speaks for no longer exists.',
  })
  optOut(@Body() body: InvitationOptOutDto): Promise<ContactOptOutResultDto> {
    return this.invitations.optOut(
      body.token,
    ) as Promise<ContactOptOutResultDto>;
  }
}

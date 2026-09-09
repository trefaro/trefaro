import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  CurrentPluginParticipant,
  PluginController,
  PluginEnabledGuard,
  type PluginParticipant,
} from '../../../app/business/plugin-api';
import { QrCheckinService } from '../business/qr-checkin.service';
import { QR_CHECKIN_PLUGIN_KEY } from '../qr-checkin.plugin-key';
import { CheckinPageQueryDto, CheckinTicketPageDto } from './checkin.dto';

/**
 * The same card, over a session (FR 3.16, F148).
 *
 * The second of the two claims the self-service has had since phase 3: the
 * link speaks for one registration, an account speaks for every registration
 * carrying its address (E31). Both resolve through one port method, and from
 * the status rule down they are one stretch of track — a plug-in cannot pick
 * one of the two readings, it hands over a claim.
 *
 * **Plural, because a person is not a registration.** Whoever attends three
 * events of a series holds three tickets, and this is the list of them — the
 * one screen a mailed link cannot open.
 *
 * No throttle of its own: behind a session the global limit applies, and the
 * per-route budgets exist for routes a stranger can reach (E4).
 */
@ApiTags('plugin: QR check-in')
@ApiNotFoundResponse({
  description: 'The QR check-in plug-in is not enabled on this instance.',
})
@PluginController(QR_CHECKIN_PLUGIN_KEY)
@UseGuards(PluginEnabledGuard)
@Controller('participant/plugins/qr-checkin')
export class ParticipantTicketsController {
  constructor(private readonly checkin: QrCheckinService) {}

  @Get('tickets')
  @ApiOperation({
    summary: 'Every ticket of the logged-in participant (FR 3.16, F148)',
    description:
      'The confirmed registrations carrying this account’s address, newest ' +
      'event first, each with the code it is admitted by — created on first ' +
      'read and unchanged afterwards (E53). A registration that is pending or ' +
      'cancelled has no ticket and is absent, which is the same rule the ' +
      'mailed link follows.',
  })
  @ApiOkResponse({ type: CheckinTicketPageDto })
  @ApiBadRequestResponse({ description: 'A page or a size that is not one.' })
  @ApiUnauthorizedResponse({ description: 'No valid session.' })
  tickets(
    @CurrentPluginParticipant() me: PluginParticipant,
    @Query() query: CheckinPageQueryDto,
  ): Promise<CheckinTicketPageDto> {
    return this.checkin.myTickets(
      me.id,
      query,
    ) as Promise<CheckinTicketPageDto>;
  }
}

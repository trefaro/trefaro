import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle, minutes } from '@nestjs/throttler';
import {
  PluginController,
  PluginEnabledGuard,
} from '../../../app/business/plugin-api';
import { QrCheckinService } from '../business/qr-checkin.service';
import { QR_CHECKIN_PLUGIN_KEY } from '../qr-checkin.plugin-key';
import { TICKET_CALLS_PER_WINDOW } from '../qr-checkin.limits';
import { CheckinTicketDto } from './checkin.dto';

/**
 * The ticket behind the link in a confirmation receipt (FR 3.16, E54).
 *
 * Under `user/plugins/<key>/…`, which is the anonymous level (E57), and
 * authorized by the signed token instead of by a session — the same
 * arrangement `MyRegistrationController` has had since phase 1, because this
 * route hangs off the same link (E11). It is the only route of this plug-in a
 * stranger can reach, and the reason is E54: **the code travels as a page, not
 * as an attachment.** A core mail may not carry plug-in content, an image in an
 * attachment gets filtered by mailboxes and cannot be reissued after a loss,
 * and the mail port of this application takes no attachments at all. The
 * receipt links the self-service page; the plug-in draws the code there.
 *
 * The token is in the **query**, because that is what the link in the mail
 * carries and reading is what a link does (F44). Nothing here changes anything
 * — the code is issued on first read, which is idempotent by the primary key
 * of the plug-in's own table.
 *
 * Its own throttle, unlike every `participant/` route of this image: a token is
 * guessable in principle and each call costs an HMAC (E4).
 */
@ApiTags('plugin: QR check-in')
@ApiNotFoundResponse({
  description: 'The QR check-in plug-in is not enabled on this instance.',
})
@PluginController(QR_CHECKIN_PLUGIN_KEY)
@UseGuards(PluginEnabledGuard)
@Controller('user/plugins/qr-checkin')
@Throttle({ default: { limit: TICKET_CALLS_PER_WINDOW, ttl: minutes(5) } })
export class UserTicketController {
  constructor(private readonly checkin: QrCheckinService) {}

  @Get('ticket')
  @ApiOperation({
    summary: 'The ticket for one registration, by its personal link (E11, E54)',
    description:
      'The code is created the first time somebody looks (E53) and stays the ' +
      'same afterwards. Every way of failing is the same 404 — forged, ' +
      'expired, pointing at a registration that is gone, or at one that is ' +
      'not confirmed: the difference is not the holder’s to learn, and it ' +
      'does not change what they can do about it.',
  })
  @ApiQuery({
    name: 'token',
    description: 'From the personal link in the mail.',
  })
  @ApiOkResponse({ type: CheckinTicketDto })
  @ApiBadRequestResponse({ description: 'No token given.' })
  @ApiNotFoundResponse({ description: 'There is no ticket for this link.' })
  ticket(@Query('token') token?: string): Promise<CheckinTicketDto> {
    if (!token) {
      throw new BadRequestException('This link is missing its token.');
    }
    return this.checkin.ticketByLink(token) as Promise<CheckinTicketDto>;
  }
}

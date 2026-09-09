import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  CurrentPluginOrganizer,
  PluginController,
  PluginEnabledGuard,
  type PluginOrganizer,
} from '../../../app/business/plugin-api';
import { QrCheckinService } from '../business/qr-checkin.service';
import { QR_CHECKIN_PLUGIN_KEY } from '../qr-checkin.plugin-key';
import {
  AdmissionPageDto,
  CheckinPageQueryDto,
  CheckinResultDto,
  CheckinScanDto,
} from './checkin.dto';

/**
 * The door (FR 3.16).
 *
 * Behind the administrative session by virtue of its path (E16, E57): a plug-in
 * gets its access level from the address it declares and has no way to
 * authenticate anything itself.
 *
 * **A scan is a `POST` with the code in the body**, never a `GET` with it in
 * the path. Two reasons, in this order: it changes something, and nothing that
 * changes something is a `GET` in this application; and a code in a URL ends up
 * in a log and in a browser's history — on a shared screen at a door.
 *
 * **A second scan is a 200, not a 409.** It answers with the first instant and
 * says `alreadyCheckedIn` (E53), because "already here, since 09:12" is the
 * sentence somebody at a door needs, and an error would send them looking for a
 * fault that is not there. The 404 is reserved for a code that opens nothing,
 * and its wording says nothing about who is expected behind the door.
 */
@ApiTags('plugin: QR check-in')
@ApiNotFoundResponse({
  description: 'The QR check-in plug-in is not enabled on this instance.',
})
@PluginController(QR_CHECKIN_PLUGIN_KEY)
@UseGuards(PluginEnabledGuard)
@Controller('admin/plugins/qr-checkin')
export class AdminCheckinController {
  constructor(private readonly checkin: QrCheckinService) {}

  @Post('checkins')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Read a code at the door (FR 3.16)',
    description:
      'Scanned with a camera or typed in — the same route either way, because ' +
      'a door may not depend on a camera driver (F199). Answers with the ' +
      'person’s name, so whoever is holding the door can look up from the ' +
      'screen. Reading the same code twice answers 200 twice, with the same ' +
      'instant.',
  })
  @ApiOkResponse({ type: CheckinResultDto })
  @ApiBadRequestResponse({ description: 'A code that is missing or too long.' })
  @ApiNotFoundResponse({
    description:
      'No ticket has that code — and the answer says nothing about who is ' +
      'expected at this event.',
  })
  @ApiUnauthorizedResponse({ description: 'No administrative session.' })
  scan(
    @CurrentPluginOrganizer() organizer: PluginOrganizer,
    @Body() body: CheckinScanDto,
  ): Promise<CheckinResultDto> {
    return this.checkin.checkIn(
      body.code,
      organizer.id,
    ) as Promise<CheckinResultDto>;
  }

  @Get('events/:eventId/checkins')
  @ApiOperation({
    summary: 'The admission list of one event (FR 3.16)',
    description:
      'Who is expected and who has arrived: the event’s **confirmed** ' +
      'registrations by name, each with the instant they were let in or ' +
      '`null`. Read through the plug-in port (E53) — this plug-in never ' +
      'queries `registration` — and every row carries the code the button ' +
      'beside it sends, issued on first read like every other (F199).',
  })
  @ApiOkResponse({ type: AdmissionPageDto })
  @ApiBadRequestResponse({ description: 'A page or a size that is not one.' })
  @ApiUnauthorizedResponse({ description: 'No administrative session.' })
  admissions(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Query() query: CheckinPageQueryDto,
  ): Promise<AdmissionPageDto> {
    return this.checkin.admissionList(
      eventId,
      query,
    ) as Promise<AdmissionPageDto>;
  }
}

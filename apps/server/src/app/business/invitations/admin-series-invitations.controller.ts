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
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import {
  InvitationDto,
  InvitationPageDto,
  SeriesContactPageDto,
} from './dto/invitation.dto';
import { ListContactsDto, ListInvitationsDto } from './dto/list-contacts.dto';
import { InvitationsService } from './invitations.service';

/**
 * Inviting former participants of one series (UC 03, FR 2.4).
 *
 * Three endpoints in the order an organizer uses them: who can be written to,
 * writing to them, and what has been written before. Behind the administrative
 * guard by virtue of the path (E16).
 *
 * `POST` answers **202**, not 201. The invitation exists when it answers, but
 * its mails do not: two hundred SMTP conversations do not fit in a request, and
 * an organizer who watched a spinner for four minutes would reload the page
 * (F56). The client polls {@link AdminInvitationsController} for the progress.
 */
@ApiTags('invitations')
@Controller('admin/series/:seriesId')
export class AdminSeriesInvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Get('contacts')
  @ApiOperation({
    summary: 'The addresses this series may invite (FR 2.4, E15)',
    description:
      'Confirmed registrations of this series, folded by address and without ' +
      'anybody who has objected — somebody who attended three of its events ' +
      'appears once. Newest registration first, and there is no way to ask for ' +
      'another order. An objected address is in no list this endpoint returns, ' +
      'which is the promise E15 makes.',
  })
  @ApiOkResponse({ type: SeriesContactPageDto })
  @ApiUnauthorizedResponse({ description: 'No administrative session.' })
  @ApiNotFoundResponse({ description: 'No series with that id.' })
  contacts(
    @Param('seriesId', ParseUUIDPipe) seriesId: string,
    @Query() query: ListContactsDto,
  ): Promise<SeriesContactPageDto> {
    return this.invitations.audience(
      seriesId,
      query,
    ) as Promise<SeriesContactPageDto>;
  }

  @Get('invitations')
  @ApiOperation({
    summary: 'What has been sent for this series, newest first',
    description:
      'With the progress of each send, counted from its recipient rows rather ' +
      'than from a stored number (F56).',
  })
  @ApiOkResponse({ type: InvitationPageDto })
  @ApiUnauthorizedResponse({ description: 'No administrative session.' })
  @ApiNotFoundResponse({ description: 'No series with that id.' })
  list(
    @Param('seriesId', ParseUUIDPipe) seriesId: string,
    @Query() query: ListInvitationsDto,
  ): Promise<InvitationPageDto> {
    return this.invitations.list(seriesId, query) as Promise<InvitationPageDto>;
  }

  @Post('invitations')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Write to selected former participants (FR 2.4)',
    description:
      '`recipients` are registration ids from the contact list, never e-mail ' +
      'addresses (F55): every one of them is looked up again through the same ' +
      'filter, so an id from another series, an unconfirmed registration or ' +
      'somebody who objected is refused rather than written to. Every mail ' +
      'carries an objection link written by the template, not by the organizer ' +
      '(F58). Answers as soon as the recipients are recorded; the mails follow ' +
      'one at a time (F56).',
  })
  @ApiAcceptedResponse({ type: InvitationDto })
  @ApiBadRequestResponse({
    description:
      'An empty subject or message, an event of another series, or a selection ' +
      'that can no longer be written to.',
  })
  @ApiUnauthorizedResponse({ description: 'No administrative session.' })
  @ApiNotFoundResponse({ description: 'No series with that id.' })
  create(
    @Param('seriesId', ParseUUIDPipe) seriesId: string,
    @Body() body: CreateInvitationDto,
  ): Promise<InvitationDto> {
    return this.invitations.create(seriesId, body) as Promise<InvitationDto>;
  }
}

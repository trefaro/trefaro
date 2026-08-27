import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ParticipantDetailDto, ParticipantRowDto } from './dto/participant.dto';
import { UpdateRegistrationDto } from './dto/update-registration.dto';
import { ParticipantsService } from './participants.service';
import { RegistrationService } from './registration.service';

/**
 * What an organizer does to a single registration (FR 3.3, E14).
 *
 * Two services, on purpose. Reading and cancelling belong to the organizer's
 * view of the registration ({@link ParticipantsService}); deleting belongs to
 * the registration's own life cycle ({@link RegistrationService}), because from
 * AP 7 it also removes the files that were uploaded with it.
 *
 * Addressed by id rather than nested under the event: a registration does not
 * move between events, and the overview already holds the id.
 *
 * Behind the administrative guard by virtue of its path (E16).
 */
@ApiTags('participants')
@Controller('admin/registrations')
export class AdminRegistrationsController {
  constructor(
    private readonly participants: ParticipantsService,
    private readonly registrations: RegistrationService,
  ) {}

  @Get(':id')
  @ApiOperation({
    summary: 'One registration in full',
    description:
      'Everything the table shows plus the event it belongs to. Answers even ' +
      'after the event went back to being a draft: the registration is an ' +
      'obligation towards a person, not a property of a published page.',
  })
  @ApiOkResponse({ type: ParticipantDetailDto })
  @ApiUnauthorizedResponse({ description: 'No administrative session.' })
  @ApiNotFoundResponse({ description: 'No registration with that id.' })
  get(@Param('id', ParseUUIDPipe) id: string): Promise<ParticipantDetailDto> {
    return this.participants.get(id) as Promise<ParticipantDetailDto>;
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Cancel a registration, or reinstate a cancelled one',
    description:
      '`cancelled` is allowed from any state and keeps the record, so the seat ' +
      'is demonstrably free without the consent record disappearing (E14). ' +
      '`confirmed` is only accepted for a registration that was confirmed at ' +
      'some point — an organizer cannot confirm an address on the ' +
      "participant's behalf, because nothing would tell that apart from a real " +
      'double opt-in afterwards.',
  })
  @ApiOkResponse({ type: ParticipantRowDto })
  @ApiUnauthorizedResponse({ description: 'No administrative session.' })
  @ApiNotFoundResponse({ description: 'No registration with that id.' })
  @ApiConflictResponse({
    description: 'That status change is not one an organizer may make.',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateRegistrationDto,
  ): Promise<ParticipantRowDto> {
    return this.participants.setStatus(
      id,
      body.status,
      // The organizer is acting, so a cancellation is news to the participant
      // and a notice goes out (F59).
      'organizer',
    ) as Promise<ParticipantRowDto>;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a registration for good',
    description:
      "Allowed whatever the registration's status — unlike deleting an event " +
      'or a series, which a confirmed registration blocks (E14). This is how an ' +
      'organization answers a request for erasure; cancelling without deleting ' +
      'is the PATCH above.',
  })
  @ApiNoContentResponse({ description: 'Deleted.' })
  @ApiUnauthorizedResponse({ description: 'No administrative session.' })
  @ApiNotFoundResponse({ description: 'No registration with that id.' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.registrations.remove(id);
  }
}

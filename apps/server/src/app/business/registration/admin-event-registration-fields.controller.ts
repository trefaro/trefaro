import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  CreateRegistrationFieldDto,
  ReorderRegistrationFieldsDto,
} from './dto/create-registration-field.dto';
import { RegistrationFieldDto } from './dto/registration-field.dto';
import { RegistrationFieldsService } from './registration-fields.service';

/**
 * The registration form of one event, as the organizer builds it (F12, FR 3.5).
 *
 * Nested under the event, because a field belongs to exactly one form and the
 * order is a property of that form rather than of any single field. Changing or
 * removing one field is addressed by its own id instead — see
 * {@link AdminRegistrationFieldsController}.
 *
 * Behind the administrative guard by virtue of its path (E16).
 */
@ApiTags('registration fields')
@Controller('admin/events/:eventId/registration-fields')
export class AdminEventRegistrationFieldsController {
  constructor(private readonly fields: RegistrationFieldsService) {}

  @Get()
  @ApiOperation({
    summary: 'The extra fields of this registration form, in form order',
  })
  @ApiOkResponse({ type: [RegistrationFieldDto] })
  @ApiUnauthorizedResponse({ description: 'No administrative session.' })
  @ApiNotFoundResponse({ description: 'No event with that id.' })
  list(
    @Param('eventId', ParseUUIDPipe) eventId: string,
  ): Promise<RegistrationFieldDto[]> {
    return this.fields.listForOrganizer(eventId) as Promise<
      RegistrationFieldDto[]
    >;
  }

  @Post()
  @ApiOperation({
    summary: 'Add a field to the registration form',
    description:
      'Appended to the end of the form. The key an answer is stored under is ' +
      'derived from the label unless one is given, and is fixed from then on.',
  })
  @ApiCreatedResponse({ type: RegistrationFieldDto })
  @ApiBadRequestResponse({
    description:
      'A selection field without choices, or another type with them.',
  })
  @ApiUnauthorizedResponse({ description: 'No administrative session.' })
  @ApiNotFoundResponse({ description: 'No event with that id.' })
  @ApiConflictResponse({
    description: 'The form is full, or the key is one the registration owns.',
  })
  create(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() body: CreateRegistrationFieldDto,
  ): Promise<RegistrationFieldDto> {
    return this.fields.create(eventId, body) as Promise<RegistrationFieldDto>;
  }

  @Put('order')
  @ApiOperation({
    summary: 'Reorder the whole form',
    description:
      'Takes every field id of this event exactly once. A partial list is ' +
      'refused: it would renumber some fields and leave the others at ' +
      'positions that no longer mean anything.',
  })
  @ApiOkResponse({ type: [RegistrationFieldDto] })
  @ApiBadRequestResponse({
    description: 'The list is not exactly this event’s fields.',
  })
  @ApiUnauthorizedResponse({ description: 'No administrative session.' })
  @ApiNotFoundResponse({ description: 'No event with that id.' })
  reorder(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() body: ReorderRegistrationFieldsDto,
  ): Promise<RegistrationFieldDto[]> {
    return this.fields.reorder(eventId, body.ids) as Promise<
      RegistrationFieldDto[]
    >;
  }
}

import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UpdateRegistrationFieldDto } from './dto/create-registration-field.dto';
import { RegistrationFieldDto } from './dto/registration-field.dto';
import { RegistrationFieldsService } from './registration-fields.service';

/**
 * One field of a registration form (F12, FR 3.5).
 *
 * Addressed by id rather than nested under its event: a field does not move
 * between forms, and the list the organizer is looking at already holds the id.
 *
 * Behind the administrative guard by virtue of its path (E16).
 */
@ApiTags('registration fields')
@Controller('admin/registration-fields')
export class AdminRegistrationFieldsController {
  constructor(private readonly fields: RegistrationFieldsService) {}

  @Patch(':id')
  @ApiOperation({
    summary: 'Reword a field, or change whether it is required',
    description:
      'Neither the type nor the key can be changed: both are what the answers ' +
      'already given depend on. The label can — correcting the wording of a ' +
      'question is the most ordinary change there is, and the key does not ' +
      'follow it.',
  })
  @ApiOkResponse({ type: RegistrationFieldDto })
  @ApiBadRequestResponse({
    description: 'Choices offered for a field that is not a selection.',
  })
  @ApiUnauthorizedResponse({ description: 'No administrative session.' })
  @ApiNotFoundResponse({ description: 'No field with that id.' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateRegistrationFieldDto,
  ): Promise<RegistrationFieldDto> {
    return this.fields.update(id, body) as Promise<RegistrationFieldDto>;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Remove a field from the form',
    description:
      'Allowed whatever has already been answered — the alternative would ' +
      'leave an organizer who added a field by mistake with no way out. The ' +
      'answers stay with the registrations that hold them (F34); the ' +
      'participant overview shows them as no longer asked for.',
  })
  @ApiNoContentResponse({ description: 'Removed.' })
  @ApiUnauthorizedResponse({ description: 'No administrative session.' })
  @ApiNotFoundResponse({ description: 'No field with that id.' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.fields.delete(id);
  }
}

import { Controller, Delete, HttpCode, HttpStatus, Param, ParseUUIDPipe } from '@nestjs/common';
import {
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { RegistrationService } from './registration.service';

/**
 * What an organizer does to a single registration (FR 3.3, E14).
 *
 * Only deletion so far. It belongs in AP 4 rather than in AP 5 with the rest of
 * the participant overview for two reasons: this is the first work package that
 * creates rows nothing can remove, and E14 names deleting a single registration
 * explicitly — it is how an organization answers a request for erasure, and the
 * groundwork for the data protection functions of phase 5.
 *
 * Behind the administrative guard by virtue of its path (E16).
 */
@ApiTags('administration')
@Controller('admin/registrations')
export class AdminRegistrationsController {
  constructor(private readonly registrations: RegistrationService) {}

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a registration for good',
    description:
      'Allowed whatever the registration\'s status — unlike deleting an event ' +
      'or a series, which a confirmed registration blocks (E14). Cancelling ' +
      'without deleting arrives with the participant overview in AP 5.',
  })
  @ApiNoContentResponse({ description: 'Deleted.' })
  @ApiUnauthorizedResponse({ description: 'No administrative session.' })
  @ApiNotFoundResponse({ description: 'No registration with that id.' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.registrations.remove(id);
  }
}

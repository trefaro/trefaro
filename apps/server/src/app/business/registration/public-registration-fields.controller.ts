import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { RegistrationFieldPublicDto } from './dto/registration-field.dto';
import { RegistrationFieldsService } from './registration-fields.service';

/**
 * The fields the public registration form has to render (F12, FR 3.5).
 *
 * Its own request rather than part of the event: the landing page does not need
 * the form definition, and only the registration page does. Under the event's
 * public address, which is unique per series rather than per instance (E7, F28).
 *
 * No ids and no sort numbers: what a form needs is the questions in order.
 */
@ApiTags('registrations')
@Controller('user/series/:seriesSlug/events/:eventSlug/registration-fields')
export class PublicRegistrationFieldsController {
  constructor(private readonly fields: RegistrationFieldsService) {}

  @Get()
  @ApiOperation({
    summary: 'The extra questions of this event’s registration form',
    description:
      'In form order. Answers to them are posted as `customFields` with the ' +
      'registration, and are validated against these definitions.',
  })
  @ApiOkResponse({ type: [RegistrationFieldPublicDto] })
  @ApiNotFoundResponse({ description: 'No published event at that address.' })
  list(
    @Param('seriesSlug') seriesSlug: string,
    @Param('eventSlug') eventSlug: string,
  ): Promise<RegistrationFieldPublicDto[]> {
    return this.fields.listPublic(seriesSlug, eventSlug) as Promise<
      RegistrationFieldPublicDto[]
    >;
  }
}

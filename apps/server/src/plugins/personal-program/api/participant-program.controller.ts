import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  ApiLocaleQuery,
  CurrentPluginParticipant,
  LocaleQueryPipe,
  PluginController,
  PluginEnabledGuard,
  type PluginParticipant,
} from '../../../app/business/plugin-api';
import { PersonalProgramService } from '../business/personal-program.service';
import { PERSONAL_PROGRAM_PLUGIN_KEY } from '../personal-program.plugin-key';
import { PersonalProgramItemDto } from './personal-program.dto';

/**
 * A participant's own programme (FR 3.17).
 *
 * Under `participant/`, not `user/` (E58, E57): a plan is a list of what one
 * person means to attend, which is exactly the kind of participant information
 * the product rule keeps behind the login. The element on the event page is
 * still mounted for everybody and shows an invitation to log in; a section that
 * appeared only to those already logged in would be a feature nobody hears
 * about.
 *
 * Three things hang on the path and the decorators rather than on code below:
 *
 * 1. **The session is the credential.** Everything under `participant/` is
 *    behind the host's participant guard by virtue of its declared path (E33),
 *    and a plug-in has no way to declare or withdraw one (E57).
 * 2. **The plug-in switch answers before the handler.** While the organization
 *    has the plug-in off, every line here is a 404 and `/api/config` does not
 *    mention it — a disabled plug-in looks absent rather than forbidden.
 * 3. **No throttle of its own.** The rule of `/api/participant/**`: behind a
 *    session the global limit applies, and the per-route budgets exist for
 *    routes a stranger can reach (E4).
 *
 * **Not paginated**, unlike every other list of this phase: a programme is one
 * event's sessions, the core reads it whole, and a plan that arrived in pages
 * could not be grouped by day without asking for all of them anyway.
 */
@ApiTags('plugin: personal programme')
@ApiNotFoundResponse({
  description:
    'The personal programme plug-in is not enabled on this instance.',
})
@PluginController(PERSONAL_PROGRAM_PLUGIN_KEY)
@UseGuards(PluginEnabledGuard)
@Controller('participant/plugins/personal-program')
export class ParticipantProgramController {
  constructor(private readonly personal: PersonalProgramService) {}

  @Get('events/:eventId/plan')
  @ApiOperation({
    summary: 'One event’s programme with “in my plan” on every session',
    description:
      'The whole programme in the order it happens (F40), each session marked ' +
      'with whether the reader put it in their plan. Titles come in the ' +
      'language asked for where a translation exists (E56, F95). An event ' +
      'without sessions — or an id nothing has — is an empty list. What is ' +
      'deliberately absent is the sign-up count: how full a session is belongs ' +
      'to the programme itself, not to a personal plan.',
  })
  @ApiLocaleQuery()
  @ApiOkResponse({ type: [PersonalProgramItemDto] })
  @ApiUnauthorizedResponse({ description: 'No valid session.' })
  plan(
    @CurrentPluginParticipant() me: PluginParticipant,
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Query('locale', LocaleQueryPipe) locale?: string,
  ): Promise<PersonalProgramItemDto[]> {
    return this.personal.forEvent(eventId, me.id, locale) as Promise<
      PersonalProgramItemDto[]
    >;
  }

  @Put('program-items/:programItemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Put a session in my plan (FR 3.17)',
    description:
      '`PUT` because it states a fact rather than adding to a collection: ' +
      'doing it twice leaves one row, and the second call is not an error. ' +
      '**It books no seat** (E55) — a session that asks who is coming says so ' +
      'in the answer above, and the seat is taken in the event’s programme.',
  })
  @ApiNoContentResponse({ description: 'In the plan — or already was.' })
  @ApiNotFoundResponse({ description: 'No session with that id.' })
  @ApiUnauthorizedResponse({ description: 'No valid session.' })
  add(
    @CurrentPluginParticipant() me: PluginParticipant,
    @Param('programItemId', ParseUUIDPipe) programItemId: string,
  ): Promise<void> {
    return this.personal.add(me.id, programItemId);
  }

  @Delete('program-items/:programItemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Take a session out of my plan (FR 3.17)',
    description:
      'Idempotent the other way round: a session that is not in the plan is ' +
      'the state the caller asked for, so this answers 204 rather than 404. ' +
      'It cancels nothing — a seat booked in the programme stays booked, and ' +
      'is given up there.',
  })
  @ApiNoContentResponse({
    description: 'Out of the plan — or never was in it.',
  })
  @ApiUnauthorizedResponse({ description: 'No valid session.' })
  remove(
    @CurrentPluginParticipant() me: PluginParticipant,
    @Param('programItemId', ParseUUIDPipe) programItemId: string,
  ): Promise<void> {
    return this.personal.remove(me.id, programItemId);
  }
}

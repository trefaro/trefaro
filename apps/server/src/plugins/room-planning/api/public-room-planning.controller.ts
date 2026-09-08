import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  ApiLocaleQuery,
  LocaleQueryPipe,
  PluginController,
  PluginEnabledGuard,
} from '../../../app/business/plugin-api';
import { RoomPlanningService } from '../business/room-planning.service';
import { ROOM_PLANNING_PLUGIN_KEY } from '../room-planning.plugin-key';
import { PublicRoomDto } from './room.dto';

/**
 * The room plan a participant reads (FR 3.6) — AP 6 of phase 4.
 *
 * Under `user/plugins/<key>/…`, which is the anonymous level (E57): the plan is
 * part of what somebody needs at the event, and a room name is not a person.
 * That makes this the reasoned counter-example to the proposals and the forum,
 * which sit behind the login because a post carries a name (E58, F192).
 *
 * What it does not check is whether the event is published: the contract
 * publishes no port for an event's state, and inventing the rule inside a
 * plug-in would be a product decision taken in the wrong place. What a visitor
 * who guesses an id learns is a list of room names.
 *
 * Read by the event's id rather than its public address: the element that
 * asks is mounted with the id, and the plug-in has no port to resolve a slug.
 */
@ApiTags('plugin: room planning')
@ApiNotFoundResponse({
  description: 'The room planning plug-in is not enabled on this instance.',
})
@PluginController(ROOM_PLANNING_PLUGIN_KEY)
@UseGuards(PluginEnabledGuard)
@Controller('user/plugins/room-planning')
export class PublicRoomPlanningController {
  constructor(private readonly roomPlanning: RoomPlanningService) {}

  @Get('events/:eventId/rooms')
  @ApiOperation({
    summary: 'The rooms of an event with what happens in them, for everybody',
    description:
      'Rooms by name, each with its sessions in clock order. Titles come in the ' +
      'language asked for where a translation exists (E56, F95). No sign-up ' +
      'counts and no warnings: those are the organizer’s (E50).',
  })
  @ApiLocaleQuery()
  @ApiOkResponse({ type: [PublicRoomDto] })
  rooms(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Query('locale', LocaleQueryPipe) locale?: string,
  ): Promise<PublicRoomDto[]> {
    return this.roomPlanning.publicPlan(eventId, locale) as Promise<
      PublicRoomDto[]
    >;
  }
}

import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiNotFoundResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  PluginController,
  PluginEnabledGuard,
} from '../../../app/business/plugin-manager';
import { RoomPlanningService } from '../business/room-planning.service';
import { ROOM_PLANNING_PLUGIN_KEY } from '../room-planning.plugin-key';
import { CreateRoomDto, RoomDto } from './room.dto';

/**
 * The plug-in's API implementation.
 *
 * `@PluginController` plus `PluginEnabledGuard` is the contract every plug-in
 * controller follows: while the organization has the plug-in switched off, these
 * routes answer 404 — the plug-in looks absent rather than forbidden, matching
 * what the clients see, since a disabled plug-in never appears in `/api/config`.
 */
@ApiTags('plugin: room planning')
@ApiNotFoundResponse({
  description: 'The room planning plug-in is not enabled on this instance.',
})
@PluginController(ROOM_PLANNING_PLUGIN_KEY)
@UseGuards(PluginEnabledGuard)
@Controller('admin/plugins/room-planning')
export class RoomPlanningController {
  constructor(private readonly roomPlanning: RoomPlanningService) {}

  @Get('events/:eventId/rooms')
  @ApiOperation({ summary: "List an event's rooms" })
  async listRooms(
    @Param('eventId', ParseUUIDPipe) eventId: string,
  ): Promise<RoomDto[]> {
    return [...(await this.roomPlanning.listRooms(eventId))];
  }

  @Post('events/:eventId/rooms')
  @ApiOperation({ summary: 'Add a room to an event' })
  createRoom(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() body: CreateRoomDto,
  ): Promise<RoomDto> {
    return this.roomPlanning.createRoom({
      eventId,
      name: body.name,
      capacity: body.capacity,
      floor: body.floor ?? null,
      description: body.description ?? null,
    });
  }
}

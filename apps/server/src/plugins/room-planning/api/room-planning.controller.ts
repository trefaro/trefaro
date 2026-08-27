import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  PluginController,
  PluginEnabledGuard,
} from '../../../app/business/plugin-manager';
import { RoomPlanningService } from '../business/room-planning.service';
import { ROOM_PLANNING_PLUGIN_KEY } from '../room-planning.plugin-key';
import { CreateRoomDto, RoomDto, RoomScheduleDto } from './room.dto';

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
  @ApiNotFoundResponse({
    description:
      'No such event — since AP 9 the database says so (F21), and an unknown ' +
      'event is answered as absent rather than as a failed constraint.',
  })
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

  @Get('rooms/:roomId/schedule')
  @ApiOperation({
    summary: 'What one room is used for, with the sign-up numbers (F21)',
    description:
      'The sessions assigned to this room, each with its sign-ups — read through ' +
      'the versioned plug-in port (E12), never from a core table. The comparison ' +
      'against the room’s capacity is the overbooking check of phase 4.',
  })
  @ApiNotFoundResponse({ description: 'No room with that id.' })
  roomSchedule(
    @Param('roomId', ParseUUIDPipe) roomId: string,
  ): Promise<RoomScheduleDto> {
    return this.roomPlanning.roomSchedule(roomId) as Promise<RoomScheduleDto>;
  }

  @Put('program-items/:programItemId/rooms/:roomId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Put a session in a room (F21)',
    description:
      'Idempotent: the pair is the primary key of the plug-in’s own join table. ' +
      'A session may use more than one room, and a room hosts many sessions.',
  })
  @ApiNoContentResponse({ description: 'Assigned.' })
  @ApiNotFoundResponse({ description: 'No such room, or no such session.' })
  @ApiConflictResponse({
    description: 'The room and the session belong to different events.',
  })
  assignRoom(
    @Param('programItemId', ParseUUIDPipe) programItemId: string,
    @Param('roomId', ParseUUIDPipe) roomId: string,
  ): Promise<void> {
    return this.roomPlanning.assignRoom(programItemId, roomId);
  }

  @Delete('program-items/:programItemId/rooms/:roomId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Take a session out of a room',
    description:
      'Idempotent as well. Deleting the session does the same thing on its own, ' +
      'through the cascade on the join table.',
  })
  @ApiNoContentResponse({ description: 'Removed, or was not assigned.' })
  @ApiNotFoundResponse({ description: 'No room with that id.' })
  unassignRoom(
    @Param('programItemId', ParseUUIDPipe) programItemId: string,
    @Param('roomId', ParseUUIDPipe) roomId: string,
  ): Promise<void> {
    return this.roomPlanning.unassignRoom(programItemId, roomId);
  }
}

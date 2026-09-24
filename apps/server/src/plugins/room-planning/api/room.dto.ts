import { ApiProperty } from '@nestjs/swagger';
import {
  MAX_ROOM_CAPACITY,
  MAX_ROOM_DESCRIPTION_LENGTH,
  MAX_ROOM_FLOOR_LENGTH,
  MAX_ROOM_NAME_LENGTH,
  ROOM_WARNINGS,
  type NewRoom,
  type PlannedRoom,
  type PlannedSession,
  type PublicRoom,
  type Room,
  type RoomBooking,
  type RoomChanges,
  type RoomPlan,
  type RoomWarning,
} from '@trefaro/shared-models';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';

/**
 * The plug-in's payloads, each implementing the interface both clients share
 * from `shared-models` — so a field that drifts is a build error, not a failed
 * request.
 */

export class CreateRoomDto implements NewRoom {
  @ApiProperty({ example: 'Room A — Ground floor' })
  @IsString()
  @Length(1, MAX_ROOM_NAME_LENGTH)
  name!: string;

  @ApiProperty({ description: 'Seats available.', example: 40 })
  @IsInt()
  @Min(1)
  // An upper bound keeps a typo from turning into an overbooking check that
  // never triggers.
  @Max(MAX_ROOM_CAPACITY)
  capacity!: number;

  @ApiProperty({ required: false, nullable: true, example: '2nd floor' })
  @IsOptional()
  @IsString()
  @Length(1, MAX_ROOM_FLOOR_LENGTH)
  floor?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, MAX_ROOM_DESCRIPTION_LENGTH)
  description?: string | null;
}

/**
 * A change: every field optional, and `null` clears the two that may be empty.
 *
 * `IsOptional` lets `null` through untouched, which is what makes clearing a
 * floor a `PATCH` with `"floor": null` rather than a route of its own.
 */
export class UpdateRoomDto implements RoomChanges {
  @ApiProperty({ required: false, example: 'Saal A' })
  @IsOptional()
  @IsString()
  @Length(1, MAX_ROOM_NAME_LENGTH)
  name?: string;

  @ApiProperty({ required: false, example: 35 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_ROOM_CAPACITY)
  capacity?: number;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, MAX_ROOM_FLOOR_LENGTH)
  floor?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, MAX_ROOM_DESCRIPTION_LENGTH)
  description?: string | null;
}

export class RoomDto implements Room {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  id!: string;

  @ApiProperty({ format: 'uuid' })
  eventId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  capacity!: number;

  @ApiProperty({ nullable: true, type: String })
  floor!: string | null;

  @ApiProperty({ nullable: true, type: String })
  description!: string | null;
}

/** A session as the plan names it: five fields through the host's port (E56, E69). */
export class PlannedSessionDto implements PlannedSession {
  @ApiProperty({ format: 'uuid' })
  programItemId!: string;

  @ApiProperty({
    description:
      'The original for an organizer; for a participant the translation into ' +
      'the language asked for, where one exists (E56, F95).',
  })
  title!: string;

  @ApiProperty({ format: 'date-time' })
  startsAt!: string;

  @ApiProperty({ format: 'date-time' })
  endsAt!: string;

  @ApiProperty({
    description:
      'IANA zone the two instants are read in — the event’s, never the ' +
      'reader’s (E8, E69).',
    example: 'Europe/Berlin',
  })
  timezone!: string;
}

/** One session in a room, with the numbers behind its warnings (E50). */
export class RoomBookingDto extends PlannedSessionDto implements RoomBooking {
  @ApiProperty({
    required: false,
    nullable: true,
    type: Number,
    description: 'The session’s own limit, if it set one — not the room’s.',
  })
  itemCapacity!: number | null;

  @ApiProperty({
    description:
      'Sign-ups, read through the versioned plug-in port (E12) rather than from ' +
      'the core table.',
  })
  signupCount!: number;

  @ApiProperty({
    enum: ROOM_WARNINGS,
    isArray: true,
    description:
      '`overbooked`: more sign-ups than the chairs of every room this session ' +
      'uses. `double-booked`: another session in this room at the same time. ' +
      'Computed when read, stored nowhere, and nothing is refused because of ' +
      'them (E50).',
  })
  warnings!: RoomWarning[];
}

/**
 * One room with what happens in it (F21, E50).
 *
 * Also the answer of `GET rooms/:id/schedule`, which phase 1 created to hand
 * the numbers over side by side; since AP 6 of phase 4 it carries the same
 * warnings the whole plan does.
 */
export class RoomScheduleDto implements PlannedRoom {
  @ApiProperty({ type: RoomDto })
  room!: RoomDto;

  @ApiProperty({ type: [RoomBookingDto] })
  bookings!: RoomBookingDto[];

  @ApiProperty({
    enum: ROOM_WARNINGS,
    isArray: true,
    description: 'Each warning once, whichever of its sessions carry it.',
  })
  warnings!: RoomWarning[];
}

/** The whole plan of one event, as the editor reads it (FR 3.11). */
export class RoomPlanDto implements RoomPlan {
  @ApiProperty({ type: [RoomScheduleDto] })
  rooms!: RoomScheduleDto[];

  @ApiProperty({
    type: [PlannedSessionDto],
    description:
      'Every session of the event, placed or not, so the editor can offer the ' +
      'ones without a room.',
  })
  sessions!: PlannedSessionDto[];
}

/** A room as a participant reads it — no count of people, no warning (E58). */
export class PublicRoomDto implements PublicRoom {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  capacity!: number;

  @ApiProperty({ nullable: true, type: String })
  floor!: string | null;

  @ApiProperty({ nullable: true, type: String })
  description!: string | null;

  @ApiProperty({ type: [PlannedSessionDto] })
  bookings!: PlannedSessionDto[];
}

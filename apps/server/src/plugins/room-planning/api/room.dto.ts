import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';

export class CreateRoomDto {
  @ApiProperty({ example: 'Room A — Ground floor' })
  @IsString()
  @Length(1, 128)
  name!: string;

  @ApiProperty({ description: 'Seats available.', example: 40 })
  @IsInt()
  @Min(1)
  // An upper bound keeps a typo from turning into an overbooking check that
  // never triggers.
  @Max(100_000)
  capacity!: number;

  @ApiProperty({ required: false, nullable: true, example: '2nd floor' })
  @IsOptional()
  @IsString()
  @Length(1, 64)
  floor?: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 2000)
  description?: string;
}

export class RoomDto {
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

/** One session in a room, with the numbers the phase 4 check will compare. */
export class RoomBookingDto {
  @ApiProperty({ format: 'uuid' })
  programItemId!: string;

  @ApiProperty({ format: 'date-time' })
  startsAt!: string;

  @ApiProperty({ format: 'date-time' })
  endsAt!: string;

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
}

/**
 * What a room is used for (F21).
 *
 * Reports the numbers side by side and judges none of them: whether more
 * sign-ups than chairs is a problem, and what an organizer should be told about
 * it, is the overbooking check of phase 4.
 */
export class RoomScheduleDto {
  @ApiProperty({ type: RoomDto })
  room!: RoomDto;

  @ApiProperty({ type: [RoomBookingDto] })
  bookings!: RoomBookingDto[];
}

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

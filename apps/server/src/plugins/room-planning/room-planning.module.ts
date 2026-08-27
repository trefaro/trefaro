import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoomPlanningController } from './api/room-planning.controller';
import { PROGRAM_ITEM_ROOM_REPOSITORY } from './business/ports/program-item-room.repository';
import { ROOM_REPOSITORY } from './business/ports/room.repository';
import { RoomPlanningService } from './business/room-planning.service';
import { ProgramItemRoomEntity } from './data-access/entities/program-item-room.entity';
import { RoomEntity } from './data-access/entities/room.entity';
import { TypeormProgramItemRoomRepository } from './data-access/typeorm-program-item-room.repository';
import { TypeormRoomRepository } from './data-access/typeorm-room.repository';

/**
 * The room planning plug-in as one NestJS module.
 *
 * It wires its own three parts together — API controller, business service and
 * data access repositories — and binds its own ports to its own implementations.
 * The core learns nothing about rooms beyond what the plug-in descriptor
 * declares.
 *
 * What it does *not* import is a core module. The one thing it needs from the
 * host — session times and sign-up counts (E12) — arrives through a token from
 * `plugin-api`, provided by the global plug-in host module.
 */
@Module({
  imports: [TypeOrmModule.forFeature([RoomEntity, ProgramItemRoomEntity])],
  controllers: [RoomPlanningController],
  providers: [
    RoomPlanningService,
    TypeormRoomRepository,
    TypeormProgramItemRoomRepository,
    { provide: ROOM_REPOSITORY, useExisting: TypeormRoomRepository },
    {
      provide: PROGRAM_ITEM_ROOM_REPOSITORY,
      useExisting: TypeormProgramItemRoomRepository,
    },
  ],
})
export class RoomPlanningModule {}

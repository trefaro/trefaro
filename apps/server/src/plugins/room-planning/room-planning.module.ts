import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoomPlanningController } from './api/room-planning.controller';
import { ROOM_REPOSITORY } from './business/ports/room.repository';
import { RoomPlanningService } from './business/room-planning.service';
import { RoomEntity } from './data-access/entities/room.entity';
import { TypeormRoomRepository } from './data-access/typeorm-room.repository';

/**
 * The room planning plug-in as one NestJS module.
 *
 * It wires its own three parts together — API controller, business service and
 * data access repository — and binds its own port to its own implementation. The
 * core learns nothing about rooms beyond what the plug-in descriptor declares.
 */
@Module({
  imports: [TypeOrmModule.forFeature([RoomEntity])],
  controllers: [RoomPlanningController],
  providers: [
    RoomPlanningService,
    TypeormRoomRepository,
    { provide: ROOM_REPOSITORY, useExisting: TypeormRoomRepository },
  ],
})
export class RoomPlanningModule {}

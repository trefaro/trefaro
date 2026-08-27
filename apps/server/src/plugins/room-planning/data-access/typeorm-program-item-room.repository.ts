import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  ProgramItemRoomRecord,
  ProgramItemRoomRepository,
} from '../business/ports/program-item-room.repository';
import { ProgramItemRoomEntity } from './entities/program-item-room.entity';

/** The plug-in's data access implementation for the room assignment (F21). */
@Injectable()
export class TypeormProgramItemRoomRepository implements ProgramItemRoomRepository {
  constructor(
    @InjectRepository(ProgramItemRoomEntity)
    private readonly repository: Repository<ProgramItemRoomEntity>,
  ) {}

  async findByRoom(roomId: string): Promise<readonly ProgramItemRoomRecord[]> {
    return this.repository.find({
      where: { roomId },
      order: { createdAt: 'ASC', programItemId: 'ASC' },
    });
  }

  async findByProgramItem(
    programItemId: string,
  ): Promise<readonly ProgramItemRoomRecord[]> {
    return this.repository.find({
      where: { programItemId },
      order: { createdAt: 'ASC', roomId: 'ASC' },
    });
  }

  async assign(programItemId: string, roomId: string): Promise<void> {
    // `orIgnore` rather than a read followed by a write: the primary key is the
    // rule, and letting the database state it keeps two simultaneous clicks from
    // becoming an error somebody has to explain.
    await this.repository
      .createQueryBuilder()
      .insert()
      .values({ programItemId, roomId })
      .orIgnore()
      .execute();
  }

  async unassign(programItemId: string, roomId: string): Promise<boolean> {
    const result = await this.repository.delete({ programItemId, roomId });
    return (result.affected ?? 0) > 0;
  }
}

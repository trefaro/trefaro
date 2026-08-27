import { Inject, Injectable } from '@nestjs/common';
import type {
  PluginProgramItem,
  PluginProgramReads,
} from '../plugin-api/program-reads';
import {
  PROGRAM_ITEM_SIGNUP_REPOSITORY,
  type ProgramItemSignupRepository,
} from './ports/program-item-signup.repository';
import {
  PROGRAM_ITEM_REPOSITORY,
  type ProgramItemRepository,
} from './ports/program-item.repository';

/**
 * The core's side of the plug-in read port (E12).
 *
 * An adapter and nothing more: it translates the programme's records into the
 * five fields the contract promises, and it is the only place that knows both
 * shapes. Two consequences worth spelling out:
 *
 * - A plug-in never reaches `program_item` or `program_item_signup`. It asks
 *   here, through a token, and the tables stay the core's business (F21).
 * - Changing the programme's internals does not touch a plug-in. Changing *this*
 *   does, which is exactly why it is versioned.
 *
 * Provided by the plug-in host module rather than by `ProgramModule`: the host
 * module is the seam where core capabilities are published, and this adapter has
 * no other consumer.
 */
@Injectable()
export class ProgramPluginReads implements PluginProgramReads {
  constructor(
    @Inject(PROGRAM_ITEM_REPOSITORY)
    private readonly items: ProgramItemRepository,
    @Inject(PROGRAM_ITEM_SIGNUP_REPOSITORY)
    private readonly signups: ProgramItemSignupRepository,
  ) {}

  async findItem(itemId: string): Promise<PluginProgramItem | null> {
    const item = await this.items.findById(itemId);
    if (!item) return null;
    return {
      id: item.id,
      eventId: item.eventId,
      startsAt: item.startsAt.toISOString(),
      endsAt: item.endsAt.toISOString(),
      capacity: item.capacity,
    };
  }

  countSignups(
    itemIds: readonly string[],
  ): Promise<ReadonlyMap<string, number>> {
    return this.signups.countByItems(itemIds);
  }
}

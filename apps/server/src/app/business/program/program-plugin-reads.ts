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
  PROGRAM_ITEM_TRANSLATION_REPOSITORY,
  type ProgramItemTranslationReader,
} from './ports/program-item-translation.repository';
import {
  PROGRAM_ITEM_REPOSITORY,
  type ProgramItemRecord,
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
 * The list of an event reads the translations through the same port the
 * programme service does, and applies the same fallback — the translated title
 * where somebody translated, the original where nobody has (F95). That rule is
 * one line, and it stands here a second time on purpose: the first attempt
 * reached `ProgramService` instead, and the module import that took closed a
 * cycle the server did not boot through. A host module publishes ports; it
 * does not import the features behind them (F138 counts this as the second
 * copy, and the third is where it moves).
 *
 * No visibility check of its own — right for a plug-in, which has the event's
 * id from a route that already established the caller may see it.
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
    // Reading only: what a session is called in another language (FR 3.12).
    @Inject(PROGRAM_ITEM_TRANSLATION_REPOSITORY)
    private readonly translations: ProgramItemTranslationReader,
  ) {}

  async findItem(itemId: string): Promise<PluginProgramItem | null> {
    const item = await this.items.findById(itemId);
    return item ? toPluginItem(item, item.title) : null;
  }

  async listForEvent(
    eventId: string,
    locale?: string,
  ): Promise<readonly PluginProgramItem[]> {
    const items = await this.items.findByEvent(eventId);
    // Without a language, nobody is asked: the originals are free (F94).
    const translations =
      locale === undefined
        ? new Map<string, { title: string | null }>()
        : await this.translations.findForParents(
            items.map((item) => item.id),
            locale,
          );
    return items.map((item) =>
      toPluginItem(item, translations.get(item.id)?.title ?? item.title),
    );
  }

  countSignups(
    itemIds: readonly string[],
  ): Promise<ReadonlyMap<string, number>> {
    return this.signups.countByItems(itemIds);
  }
}

/**
 * Picked field by field rather than spread: the record carries the abstract,
 * the speaker and two timestamps, and none of them is promised by the
 * contract. What the contract does not name, a plug-in must not receive.
 */
function toPluginItem(
  item: ProgramItemRecord,
  title: string,
): PluginProgramItem {
  return {
    id: item.id,
    eventId: item.eventId,
    title,
    startsAt: item.startsAt.toISOString(),
    endsAt: item.endsAt.toISOString(),
    capacity: item.capacity,
  };
}

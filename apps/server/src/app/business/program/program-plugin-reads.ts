import { Inject, Injectable } from '@nestjs/common';
import { EVENT_ZONES, type EventZones } from '../common/ports/event-zone.port';
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
 * Since 1.3.0 it also stamps the **event's zone** on every session (E69). That
 * is a second read, and it is one read per call rather than one per session:
 * the zone belongs to the event, and a list of forty sessions asks for it once.
 * Where the event cannot be read, nothing is handed over — see
 * {@link EventZones}.
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
    // Reading only, and one field: which clock this event's times are meant
    // to be read on (E8, E69).
    @Inject(EVENT_ZONES) private readonly zones: EventZones,
  ) {}

  async findItem(itemId: string): Promise<PluginProgramItem | null> {
    const item = await this.items.findById(itemId);
    if (!item) return null;
    const timezone = await this.zones.zoneOf(item.eventId);
    return timezone ? toPluginItem(item, item.title, timezone) : null;
  }

  async listForEvent(
    eventId: string,
    locale?: string,
  ): Promise<readonly PluginProgramItem[]> {
    const [items, timezone] = await Promise.all([
      this.items.findByEvent(eventId),
      this.zones.zoneOf(eventId),
    ]);
    if (!timezone) return [];
    // Without a language, nobody is asked: the originals are free (F94).
    const translations =
      locale === undefined
        ? new Map<string, { title: string | null }>()
        : await this.translations.findForParents(
            items.map((item) => item.id),
            locale,
          );
    return items.map((item) =>
      toPluginItem(
        item,
        translations.get(item.id)?.title ?? item.title,
        timezone,
      ),
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
 *
 * `registrationEnabled` joined the list in AP 9 of phase 4, and it is about the
 * session rather than about anybody who signed up for it: whether a seat is
 * booked here at all (E55, F42). `timezone` joined it in AP 11 of phase 5 and
 * comes from the event rather than from the row — which is why it is a
 * parameter here and not a field of the record.
 */
function toPluginItem(
  item: ProgramItemRecord,
  title: string,
  timezone: string,
): PluginProgramItem {
  return {
    id: item.id,
    eventId: item.eventId,
    title,
    startsAt: item.startsAt.toISOString(),
    endsAt: item.endsAt.toISOString(),
    timezone,
    registrationEnabled: item.registrationEnabled,
    capacity: item.capacity,
  };
}

import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type {
  EventSeriesTranslation,
  EventSeriesTranslations,
  EventTranslation,
  EventTranslations,
  ProgramItemTranslation,
  ProgramItemTranslations,
  TranslationsByLocale,
} from '@trefaro/shared-models';
import {
  canonicalLocaleTag,
  isEmptyTranslation,
  translatedText,
} from '@trefaro/shared-models';
import type {
  ContentTranslationRecord,
  ContentTranslationRepository,
} from '../common/ports/content-translation.port';
import { EventSeriesService } from '../event-series/event-series.service';
import {
  EVENT_SERIES_TRANSLATION_REPOSITORY,
  type EventSeriesTranslationRepository,
} from '../event-series/ports/event-series-translation.repository';
import { EventsService } from '../events';
import {
  EVENT_TRANSLATION_REPOSITORY,
  type EventTranslationRepository,
} from '../events/ports/event-translation.repository';
import {
  PROGRAM_ITEM_TRANSLATION_REPOSITORY,
  type ProgramItemTranslationRepository,
} from '../program/ports/program-item-translation.repository';
import { ProgramService } from '../program/program.service';

/**
 * Translating what an organization writes (FR 3.12, UC 12, E25).
 *
 * A composition, and therefore above its parts (F49): it needs the series, the
 * events and the programme in order to answer 404 the way each of them does,
 * and putting it inside any one of them would have closed a circle. The three
 * modules below know nothing about this one — each reads only its own
 * translation port, and only the reading half of it.
 *
 * Two rules run through everything here:
 *
 * 1. **An emptied box is not a translation** (F74, applied to content). Every
 *    field is trimmed and a blank one becomes `null`; a translation whose every
 *    field is `null` is deleted rather than stored. Otherwise "I cleared this"
 *    and "I never filled this in" would be two states with one visible result,
 *    and every list that counts languages would count a row that says nothing.
 * 2. **Translating a language and offering it are two decisions** (E30). A
 *    translation may be written for any well-formed tag, whether or not the
 *    instance currently offers it — exactly as the interface catalogue works,
 *    and for the same reason: otherwise a language would have to be shown to
 *    visitors before the first word of it could be written. What is *offered*
 *    lives in `app_config.active_locales`, and taking a language out of that
 *    list deletes nothing.
 */
@Injectable()
export class ContentTranslationsService {
  constructor(
    private readonly series: EventSeriesService,
    private readonly events: EventsService,
    private readonly program: ProgramService,
    @Inject(EVENT_SERIES_TRANSLATION_REPOSITORY)
    private readonly seriesTranslations: EventSeriesTranslationRepository,
    @Inject(EVENT_TRANSLATION_REPOSITORY)
    private readonly eventTranslations: EventTranslationRepository,
    @Inject(PROGRAM_ITEM_TRANSLATION_REPOSITORY)
    private readonly itemTranslations: ProgramItemTranslationRepository,
  ) {}

  /** One series, what it says, and what it says in every other language. */
  async forSeries(id: string): Promise<EventSeriesTranslations> {
    const series = await this.series.getForOrganizer(id);
    const rows = await this.seriesTranslations.findAllForParent(id);
    return {
      id: series.id,
      source: { name: series.name, description: series.description },
      translations: byLocale(rows),
    };
  }

  /**
   * One event, its programme, and every language either has been given.
   *
   * One request for one screen (F49). An organizer translating an event does the
   * header and the sessions in one sitting, and a request per session would be a
   * request per row of a list.
   */
  async forEvent(id: string): Promise<EventTranslations> {
    const event = await this.events.getForOrganizer(id);
    const items = await this.program.listForOrganizer(id);

    const [eventRows, itemRows] = await Promise.all([
      this.eventTranslations.findAllForParent(id),
      this.itemTranslations.findAllForParents(items.map((item) => item.id)),
    ]);

    return {
      id: event.id,
      // The zone of the event, so the screen can say which session is which
      // without inventing one (E8).
      timezone: event.timezone,
      source: {
        name: event.name,
        description: event.description,
        venueName: event.venueName ?? null,
        followUpBody: event.followUpBody ?? null,
      },
      translations: byLocale(eventRows),
      programItems: items.map((item): ProgramItemTranslations => ({
        id: item.id,
        startsAt: item.startsAt,
        source: { title: item.title, description: item.description },
        translations: byLocale(itemRows.get(item.id) ?? []),
      })),
    };
  }

  /** Every language one session has been translated into. */
  async forProgramItem(id: string): Promise<ProgramItemTranslations> {
    const item = await this.program.getForOrganizer(id);
    const rows = await this.itemTranslations.findAllForParent(id);
    return {
      id: item.id,
      startsAt: item.startsAt,
      source: { title: item.title, description: item.description },
      translations: byLocale(rows),
    };
  }

  async writeSeries(
    id: string,
    locale: string,
    input: Partial<EventSeriesTranslation>,
  ): Promise<EventSeriesTranslation> {
    await this.series.getForOrganizer(id);
    return this.store(this.seriesTranslations, id, locale, {
      name: translatedText(input.name),
      description: translatedText(input.description),
    });
  }

  async writeEvent(
    id: string,
    locale: string,
    input: Partial<EventTranslation>,
  ): Promise<EventTranslation> {
    await this.events.getForOrganizer(id);
    return this.store(this.eventTranslations, id, locale, {
      name: translatedText(input.name),
      description: translatedText(input.description),
      venueName: translatedText(input.venueName),
      followUpBody: translatedText(input.followUpBody),
    });
  }

  async writeProgramItem(
    id: string,
    locale: string,
    input: Partial<ProgramItemTranslation>,
  ): Promise<ProgramItemTranslation> {
    await this.program.getForOrganizer(id);
    return this.store(this.itemTranslations, id, locale, {
      title: translatedText(input.title),
      description: translatedText(input.description),
    });
  }

  async removeSeries(id: string, locale: string): Promise<void> {
    await this.series.getForOrganizer(id);
    await this.seriesTranslations.remove(id, this.canonical(locale));
  }

  async removeEvent(id: string, locale: string): Promise<void> {
    await this.events.getForOrganizer(id);
    await this.eventTranslations.remove(id, this.canonical(locale));
  }

  async removeProgramItem(id: string, locale: string): Promise<void> {
    await this.program.getForOrganizer(id);
    await this.itemTranslations.remove(id, this.canonical(locale));
  }

  /**
   * Stores one language of one thing, or removes it when there is nothing left.
   *
   * The answer is the normalised translation rather than a re-read: the caller
   * has just written it, and a second query would only be able to say the same
   * thing later.
   */
  private async store<T extends object>(
    repository: ContentTranslationRepository<T>,
    parentId: string,
    locale: string,
    value: T,
  ): Promise<T> {
    const tag = this.canonical(locale);
    if (isEmptyTranslation(value)) {
      await repository.remove(parentId, tag);
      return value;
    }
    await repository.save(parentId, tag, value);
    return value;
  }

  /**
   * Normalises a tag from a URL, or refuses it.
   *
   * The same rule and the same message as the interface catalogue's: `de-AT` and
   * `de-at` are one language, and two spellings would be two rows for one
   * translation and two tabs for one tab.
   */
  private canonical(locale: string): string {
    const tag = canonicalLocaleTag(locale);
    if (tag === null) {
      throw new BadRequestException(
        'locale must be a BCP 47 language tag such as de or de-AT',
      );
    }
    return tag;
  }
}

/** Rows to the map a screen reads: language tag in, translation out. */
function byLocale<T>(
  rows: readonly ContentTranslationRecord<T>[],
): TranslationsByLocale<T> {
  return Object.fromEntries(rows.map((row) => [row.locale, row.value]));
}

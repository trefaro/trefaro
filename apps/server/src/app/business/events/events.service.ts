import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  EventStatus,
  EventType,
  OrganizerEvent,
  PublicEvent,
} from '@trefaro/shared-models';
import { isTimeZone } from '@trefaro/shared-models';
import { isSlug, slugify } from '../common/slug';
import { EventSeriesService } from '../event-series/event-series.service';
import { toMediaUrl } from '../media/media-url';
import {
  EVENT_REPOSITORY,
  EventSlugTakenError,
  type EventRecord,
  type EventRepository,
} from './ports/event.repository';

/** Used when a name transliterates to nothing usable — see `slugify`. */
const FALLBACK_SLUG = 'event';

/** How many numbered variants of a slug to try before giving up. */
const MAX_SLUG_ATTEMPTS = 50;

/**
 * How each type reads in a sentence, article and hyphen included.
 *
 * The messages below end up in front of an organizer, and "A online event" is
 * the kind of detail that makes a tool feel unfinished.
 */
const TYPE_IN_PROSE: Readonly<Record<EventType, string>> = {
  onsite: 'An on-site event',
  online: 'An online event',
  hybrid: 'A hybrid event',
};

export interface CreateEventInput {
  readonly name: string;
  readonly description: string;
  readonly slug?: string;
  readonly eventType: EventType;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly timezone: string;
  readonly venueName?: string | null;
  readonly venueAddress?: string | null;
  readonly onlineUrl?: string | null;
  readonly languages: readonly string[];
  readonly status?: EventStatus;
}

export type UpdateEventInput = Partial<CreateEventInput>;

/**
 * Events within a series (UC 04, UC 05, FR 3.1, FR 3.2, FR 3.9).
 *
 * Two rules are worth naming, because both are easy to get subtly wrong:
 *
 * 1. **An event is public only if its series is.** Publishing an event inside a
 *    series nobody can see must not leak it, so every public read goes through
 *    the series first and inherits its 404.
 * 2. **Completeness is required to publish, not to draft.** An organizer books
 *    a date before the venue contract or the conference software is settled.
 *    Demanding the address up front would make them type a placeholder, which is
 *    worse than an empty field: it looks like an answer.
 */
@Injectable()
export class EventsService {
  constructor(
    @Inject(EVENT_REPOSITORY)
    private readonly events: EventRepository,
    private readonly series: EventSeriesService,
  ) {}

  /** Every event of a series, drafts included (FR 2.3, organizer side). */
  async listForOrganizer(seriesId: string): Promise<readonly OrganizerEvent[]> {
    // Resolving the series first turns an unknown id into a 404 instead of an
    // empty list, which would read as "this series has no events".
    await this.series.getForOrganizer(seriesId);
    return (await this.events.findBySeries(seriesId)).map(toOrganizerEvent);
  }

  async getForOrganizer(id: string): Promise<OrganizerEvent> {
    return toOrganizerEvent(await this.require(id));
  }

  /** Published events of a published series (FR 2.3, participant side). */
  async listPublic(seriesSlug: string): Promise<readonly PublicEvent[]> {
    const series = await this.series.getPublicBySlug(seriesSlug);
    return (await this.events.findPublishedBySeries(series.id)).map(
      toPublicEvent,
    );
  }

  /** 404 for a draft event, and for any event of a series that is not public. */
  async getPublic(seriesSlug: string, eventSlug: string): Promise<PublicEvent> {
    const series = await this.series.getPublicBySlug(seriesSlug);
    const found = await this.events.findBySlug(series.id, eventSlug);
    if (!found || found.status !== 'published') {
      throw new NotFoundException(`No event at "${seriesSlug}/${eventSlug}"`);
    }
    return toPublicEvent(found);
  }

  async create(
    seriesId: string,
    input: CreateEventInput,
  ): Promise<OrganizerEvent> {
    await this.series.getForOrganizer(seriesId);

    const name = input.name.trim();
    const status = input.status ?? 'draft';
    const period = this.period(input.startsAt, input.endsAt);
    const languages = this.languages(input.languages);

    const candidate = {
      eventType: input.eventType,
      venueName: normalizeOptional(input.venueName),
      venueAddress: normalizeOptional(input.venueAddress),
      onlineUrl: normalizeOptional(input.onlineUrl),
    };
    this.assertReachable(status, candidate);

    const slug = await this.availableSlug(
      seriesId,
      this.requestedSlug(input.slug, name),
    );

    try {
      return toOrganizerEvent(
        await this.events.create({
          seriesId,
          slug,
          name,
          description: input.description.trim(),
          timezone: this.timezone(input.timezone),
          languages,
          status,
          ...period,
          ...candidate,
        }),
      );
    } catch (error: unknown) {
      throw this.translate(error);
    }
  }

  async update(id: string, input: UpdateEventInput): Promise<OrganizerEvent> {
    const existing = await this.require(id);

    const name = input.name?.trim();
    // The address is only recomputed when asked for: a link that is already out
    // there must survive a fixed typo in the title.
    const slug =
      input.slug === undefined
        ? undefined
        : await this.availableSlug(
            existing.seriesId,
            this.requestedSlug(input.slug, name ?? existing.name),
            id,
          );

    const period =
      input.startsAt === undefined && input.endsAt === undefined
        ? {}
        : this.period(
            input.startsAt ?? existing.startsAt.toISOString(),
            input.endsAt ?? existing.endsAt.toISOString(),
          );

    const place = {
      eventType: input.eventType ?? existing.eventType,
      venueName:
        input.venueName === undefined
          ? existing.venueName
          : normalizeOptional(input.venueName),
      venueAddress:
        input.venueAddress === undefined
          ? existing.venueAddress
          : normalizeOptional(input.venueAddress),
      onlineUrl:
        input.onlineUrl === undefined
          ? existing.onlineUrl
          : normalizeOptional(input.onlineUrl),
    };
    // Validated against the merged event, not against the patch: switching an
    // event to hybrid and adding the link in one request has to be accepted,
    // and publishing one that is missing the link has to be refused.
    this.assertReachable(input.status ?? existing.status, place);

    try {
      const updated = await this.events.update(id, {
        ...(slug === undefined ? {} : { slug }),
        ...(name === undefined ? {} : { name }),
        ...(input.description === undefined
          ? {}
          : { description: input.description.trim() }),
        ...(input.timezone === undefined
          ? {}
          : { timezone: this.timezone(input.timezone) }),
        ...(input.languages === undefined
          ? {}
          : { languages: this.languages(input.languages) }),
        ...(input.status === undefined ? {} : { status: input.status }),
        ...period,
        ...place,
      });
      if (!updated) throw new NotFoundException(`No event with id "${id}"`);
      return toOrganizerEvent(updated);
    } catch (error: unknown) {
      throw this.translate(error);
    }
  }

  async delete(id: string): Promise<void> {
    if (!(await this.events.delete(id))) {
      throw new NotFoundException(`No event with id "${id}"`);
    }
  }

  private async require(id: string): Promise<EventRecord> {
    const found = await this.events.findById(id);
    if (!found) throw new NotFoundException(`No event with id "${id}"`);
    return found;
  }

  /** An event has to be findable once it is public — in whichever way applies. */
  private assertReachable(
    status: EventStatus,
    place: {
      eventType: EventType;
      venueName: string | null;
      onlineUrl: string | null;
    },
  ): void {
    if (status !== 'published') return;

    const needsVenue = place.eventType !== 'online';
    const needsLink = place.eventType !== 'onsite';

    if (needsVenue && !place.venueName) {
      throw new BadRequestException(
        `${TYPE_IN_PROSE[place.eventType]} needs a venue before it can be published`,
      );
    }
    if (needsLink && !place.onlineUrl) {
      throw new BadRequestException(
        `${TYPE_IN_PROSE[place.eventType]} needs a link before it can be published`,
      );
    }
  }

  private period(
    startsAt: string,
    endsAt: string,
  ): {
    startsAt: Date;
    endsAt: Date;
  } {
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('Start and end have to be valid dates');
    }
    if (end.getTime() < start.getTime()) {
      throw new BadRequestException('An event cannot end before it starts');
    }
    return { startsAt: start, endsAt: end };
  }

  private timezone(value: string): string {
    const timezone = value.trim();
    if (!isTimeZone(timezone)) {
      throw new BadRequestException(
        `"${value}" is not a time zone — use an IANA name such as Europe/Berlin`,
      );
    }
    return timezone;
  }

  private languages(values: readonly string[]): readonly string[] {
    const languages = [
      ...new Set(values.map((value) => value.trim()).filter(Boolean)),
    ];
    if (languages.length === 0) {
      throw new BadRequestException(
        'Name at least one language the event is held in',
      );
    }
    return languages;
  }

  /** An explicit address is honoured as given; otherwise the name decides. */
  private requestedSlug(requested: string | undefined, name: string): string {
    if (requested === undefined) return slugify(name);

    const cleaned = slugify(requested);
    if (!isSlug(cleaned)) {
      throw new ConflictException(
        'The address must contain letters or digits — try one made of words and hyphens',
      );
    }
    return cleaned;
  }

  /**
   * First free variant within the series: `kickoff`, then `kickoff-2`, …
   *
   * Scoped to the series, so two series may each hold a `kickoff` (E7).
   */
  private async availableSlug(
    seriesId: string,
    base: string,
    exceptId?: string,
  ): Promise<string> {
    const root = base || FALLBACK_SLUG;

    for (let attempt = 1; attempt <= MAX_SLUG_ATTEMPTS; attempt += 1) {
      const candidate = attempt === 1 ? root : `${root}-${attempt}`;
      const taken = await this.events.findBySlug(seriesId, candidate);
      if (!taken || taken.id === exceptId) return candidate;
    }

    throw new ConflictException(
      `Could not derive a free address from "${root}" — please choose one`,
    );
  }

  private translate(error: unknown): unknown {
    return error instanceof EventSlugTakenError
      ? new ConflictException(
          `${error.message} — please choose another address`,
        )
      : error;
  }
}

/** An emptied form field means "no value", not the empty string. */
function normalizeOptional(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toPublicEvent(record: EventRecord): PublicEvent {
  return {
    id: record.id,
    slug: record.slug,
    name: record.name,
    description: record.description,
    logoUrl: toMediaUrl(record.logoPath),
    eventType: record.eventType,
    startsAt: record.startsAt.toISOString(),
    endsAt: record.endsAt.toISOString(),
    timezone: record.timezone,
    venueName: record.venueName,
    venueAddress: record.venueAddress,
    onlineUrl: record.onlineUrl,
    languages: record.languages,
  };
}

function toOrganizerEvent(record: EventRecord): OrganizerEvent {
  return {
    ...toPublicEvent(record),
    seriesId: record.seriesId,
    status: record.status,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

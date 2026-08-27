import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  EventSeries,
  EventSeriesStatus,
  PublicEventSeries,
} from '@trefaro/shared-models';
import { isSlug, slugify } from '../common/slug';
import { toMediaUrl } from '../media/media-url';
import {
  EVENT_SERIES_REPOSITORY,
  EventSeriesSlugTakenError,
  type EventSeriesRecord,
  type EventSeriesRepository,
} from './ports/event-series.repository';

/** Used when a name transliterates to nothing usable — see {@link slugify}. */
const FALLBACK_SLUG = 'series';

/** How many numbered variants of a slug to try before giving up. */
const MAX_SLUG_ATTEMPTS = 50;

export interface CreateEventSeriesInput {
  readonly name: string;
  readonly description: string;
  readonly slug?: string;
  readonly websiteUrl?: string | null;
  readonly contactEmail?: string | null;
  readonly status?: EventSeriesStatus;
}

export type UpdateEventSeriesInput = Partial<CreateEventSeriesInput>;

/**
 * Event series (UC 02, UC 03, FR 2.1, FR 2.2).
 *
 * Two views of the same data, deliberately separate methods rather than one with
 * a flag: an organizer sees every series including drafts, a participant sees
 * only what has been published. A draft answering 404 rather than 403 on the
 * public side keeps an unannounced series unannounced.
 *
 * Deleting is possible while a series has no events. The rule that a series
 * carrying registrations may only be archived (E14) is enforced from AP 3, when
 * there are events to check for — a check against a table that does not exist
 * yet would be a comment pretending to be code.
 */
@Injectable()
export class EventSeriesService {
  constructor(
    @Inject(EVENT_SERIES_REPOSITORY)
    private readonly series: EventSeriesRepository,
  ) {}

  async listForOrganizer(): Promise<readonly EventSeries[]> {
    return (await this.series.findAll()).map(toEventSeries);
  }

  async listPublic(): Promise<readonly PublicEventSeries[]> {
    return (await this.series.findPublished()).map(toPublicEventSeries);
  }

  async getForOrganizer(id: string): Promise<EventSeries> {
    const found = await this.series.findById(id);
    if (!found) throw new NotFoundException(`No event series with id "${id}"`);
    return toEventSeries(found);
  }

  /** 404 for a series that is not published — it must look absent, not hidden. */
  async getPublicBySlug(slug: string): Promise<PublicEventSeries> {
    const found = await this.series.findBySlug(slug);
    if (!found || found.status !== 'published') {
      throw new NotFoundException(`No event series at "${slug}"`);
    }
    return toPublicEventSeries(found);
  }

  async create(input: CreateEventSeriesInput): Promise<EventSeries> {
    const name = input.name.trim();
    const description = input.description.trim();

    const slug = await this.availableSlug(this.requestedSlug(input.slug, name));

    try {
      return toEventSeries(
        await this.series.create({
          slug,
          name,
          description,
          websiteUrl: normalizeOptional(input.websiteUrl),
          contactEmail: normalizeOptional(input.contactEmail),
          // New series start as drafts: an organizer should be able to prepare
          // one before anyone sees it (UC 02).
          status: input.status ?? 'draft',
        }),
      );
    } catch (error: unknown) {
      throw this.translate(error);
    }
  }

  async update(
    id: string,
    input: UpdateEventSeriesInput,
  ): Promise<EventSeries> {
    const existing = await this.series.findById(id);
    if (!existing)
      throw new NotFoundException(`No event series with id "${id}"`);

    const name = input.name?.trim();
    // A slug is only recomputed when asked for: an existing public link must not
    // break because someone fixed a typo in the title.
    const slug =
      input.slug === undefined
        ? undefined
        : await this.availableSlug(
            this.requestedSlug(input.slug, name ?? existing.name),
            id,
          );

    try {
      const updated = await this.series.update(id, {
        ...(slug === undefined ? {} : { slug }),
        ...(name === undefined ? {} : { name }),
        ...(input.description === undefined
          ? {}
          : { description: input.description.trim() }),
        ...(input.websiteUrl === undefined
          ? {}
          : { websiteUrl: normalizeOptional(input.websiteUrl) }),
        ...(input.contactEmail === undefined
          ? {}
          : { contactEmail: normalizeOptional(input.contactEmail) }),
        ...(input.status === undefined ? {} : { status: input.status }),
      });
      if (!updated) {
        throw new NotFoundException(`No event series with id "${id}"`);
      }
      return toEventSeries(updated);
    } catch (error: unknown) {
      throw this.translate(error);
    }
  }

  async delete(id: string): Promise<void> {
    if (!(await this.series.delete(id))) {
      throw new NotFoundException(`No event series with id "${id}"`);
    }
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
   * First free variant of a slug: `climate-2027`, then `climate-2027-2`, …
   *
   * `exceptId` is the series being updated, so keeping its own address is not a
   * collision with itself.
   */
  private async availableSlug(
    base: string,
    exceptId?: string,
  ): Promise<string> {
    const root = base || FALLBACK_SLUG;

    for (let attempt = 1; attempt <= MAX_SLUG_ATTEMPTS; attempt += 1) {
      const candidate = attempt === 1 ? root : `${root}-${attempt}`;
      const taken = await this.series.findBySlug(candidate);
      if (!taken || taken.id === exceptId) return candidate;
    }

    throw new ConflictException(
      `Could not derive a free address from "${root}" — please choose one`,
    );
  }

  private translate(error: unknown): unknown {
    // Two organizers creating the same series at the same moment: the unique
    // index decides, and the loser gets a message they can act on.
    return error instanceof EventSeriesSlugTakenError
      ? new ConflictException(
          `${error.message} — please choose another address`,
        )
      : error;
  }
}

/**
 * An emptied form field means "no value", not the empty string.
 *
 * Without this, clearing the website field would store `''` and the client
 * would render an empty link.
 */
function normalizeOptional(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toPublicEventSeries(record: EventSeriesRecord): PublicEventSeries {
  return {
    id: record.id,
    slug: record.slug,
    name: record.name,
    description: record.description,
    logoUrl: toMediaUrl(record.logoPath),
    websiteUrl: record.websiteUrl,
    contactEmail: record.contactEmail,
  };
}

function toEventSeries(record: EventSeriesRecord): EventSeries {
  return {
    ...toPublicEventSeries(record),
    status: record.status,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

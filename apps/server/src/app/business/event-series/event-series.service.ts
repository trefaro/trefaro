import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  EventSeries,
  EventSeriesStatus,
  EventSeriesTranslation,
  PublicEventSeries,
} from '@trefaro/shared-models';
import { AttachmentsService } from '../attachments';
import { isSlug, slugify } from '../common/slug';
import {
  LogoImageService,
  seriesLogoUrl,
  type LogoBytes,
  type LogoUpload,
} from '../logo-files';
import {
  REGISTRATION_TALLY,
  type RegistrationTally,
} from '../registration/ports/registration-tally';
import {
  EVENT_SERIES_TRANSLATION_REPOSITORY,
  type EventSeriesTranslationReader,
} from './ports/event-series-translation.repository';
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
 * Deleting takes the series' events with it, and is refused once anybody has
 * confirmed a registration for one of them (E14) — archiving is the way to take
 * a finished series off the public pages.
 */
@Injectable()
export class EventSeriesService {
  constructor(
    @Inject(EVENT_SERIES_REPOSITORY)
    private readonly series: EventSeriesRepository,
    // Counts only, across every event of the series — see the same injection in
    // `EventsService` for why it is a narrow port rather than the repository.
    @Inject(REGISTRATION_TALLY)
    private readonly registrations: RegistrationTally,
    // Deleting a series cascades all the way to its registrations, and a
    // cascade removes rows but no files (E9).
    private readonly attachments: AttachmentsService,
    // Reading only: what this series says in another language (FR 3.12). The
    // write half of the same port belongs to the translation module, which sits
    // above this one — a service that renders a page cannot translate one.
    @Inject(EVENT_SERIES_TRANSLATION_REPOSITORY)
    private readonly translations: EventSeriesTranslationReader,
    // The bytes of this series' logo (FR 2.1). Below this service, not beside
    // it: what may be uploaded and where it is kept has nothing to do with
    // series, and this service keeps the half that does — which row it belongs
    // to and what a missing one answers.
    private readonly logos: LogoImageService,
  ) {}

  async listForOrganizer(): Promise<readonly EventSeries[]> {
    return (await this.series.findAll()).map(toEventSeries);
  }

  /**
   * The participant start page, in the language they are reading (E25).
   *
   * Sorted here rather than in SQL as soon as a language is involved: the
   * database orders by the name the organizer typed, and a list of German names
   * ordered by their English originals is a list in no order at all. `undefined`
   * keeps the database's order, which is the same answer for an instance that
   * has never translated anything.
   */
  async listPublic(locale?: string): Promise<readonly PublicEventSeries[]> {
    const found = await this.series.findPublished();
    const translations = await this.translationsFor(
      found.map((record) => record.id),
      locale,
    );

    const listed = found.map((record) =>
      toPublicEventSeries(record, translations.get(record.id)),
    );
    return locale === undefined ? listed : sortByName(listed, locale);
  }

  async getForOrganizer(id: string): Promise<EventSeries> {
    const found = await this.series.findById(id);
    if (!found) throw new NotFoundException(`No event series with id "${id}"`);
    return toEventSeries(found);
  }

  /** 404 for a series that is not published — it must look absent, not hidden. */
  async getPublicBySlug(
    slug: string,
    locale?: string,
  ): Promise<PublicEventSeries> {
    const found = await this.series.findBySlug(slug);
    if (!found || found.status !== 'published') {
      throw new NotFoundException(`No event series at "${slug}"`);
    }
    const translations = await this.translationsFor([found.id], locale);
    return toPublicEventSeries(found, translations.get(found.id));
  }

  /**
   * The translations of a set of series, or nothing at all.
   *
   * `undefined` short-circuits before the query: most instances serve one
   * language, and a page that is not asking for a translation should not pay for
   * a lookup that can only come back empty.
   */
  private async translationsFor(
    ids: readonly string[],
    locale: string | undefined,
  ): Promise<ReadonlyMap<string, EventSeriesTranslation>> {
    if (locale === undefined) return new Map();
    return this.translations.findForParents(ids, locale);
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

  /**
   * Deletes a series — unless one of its events has confirmed registrations.
   *
   * The foreign key would happily cascade through events and registrations
   * alike. That is exactly why the rule lives here: nothing in the schema knows
   * the difference between tidying up a series that never happened and throwing
   * away the record of one that did (E14).
   */
  async delete(id: string): Promise<void> {
    const confirmed = await this.registrations.confirmedForSeries(id);
    if (confirmed > 0) {
      throw new ConflictException(
        `This series has ${confirmed} confirmed registration${confirmed === 1 ? '' : 's'} across its events — archive it instead of deleting it.`,
      );
    }
    // Resolves the series, so a mistyped id changes nothing.
    await this.getForOrganizer(id);
    // The cascade reaches events and registrations; the files it would leave
    // behind are removed here first (E9). Both kinds: the attachments of every
    // registration, and the logo of the series and of each of its events.
    await this.attachments.purgeForSeries(id);
    await this.logos.purgeUnderSeries(id);
    if (!(await this.series.delete(id))) {
      throw new NotFoundException(`No event series with id "${id}"`);
    }
  }

  /**
   * Replaces this series' logo (FR 2.1).
   *
   * Written the moment it arrives, not on the next save of the form: an image is
   * bytes in a volume, and holding them in a draft would mean holding them
   * somewhere. The organizer client makes that visible by asking twice — choose,
   * then upload.
   *
   * The order is the branding order, and the reason is the same: the file
   * exists before any column points at it, so a failed row write leaves an
   * unreferenced file (removed right here) rather than a row pointing at
   * nothing. A failure after the row write would leave the *old* file behind,
   * which is a wasted byte range rather than a broken logo — compensation in the
   * direction that keeps the pages rendering.
   */
  async setLogo(id: string, upload: LogoUpload): Promise<string | null> {
    // Resolves the series first, so a mistyped id costs no bytes.
    const existing = await this.series.findById(id);
    if (!existing)
      throw new NotFoundException(`No event series with id "${id}"`);

    const stored = await this.logos.store(upload);

    let updated: EventSeriesRecord | null;
    try {
      updated = await this.series.setLogoPath(id, stored);
    } catch (error: unknown) {
      await this.logos.discard([stored]);
      throw error;
    }

    if (!updated) {
      // Deleted between the two reads. The file is the only trace left, so it
      // goes — and the answer is the same 404 the first read would have given.
      await this.logos.discard([stored]);
      throw new NotFoundException(`No event series with id "${id}"`);
    }

    await this.logos.discard([existing.logoPath]);
    return seriesLogoUrl(updated.id, updated.logoPath, updated.updatedAt);
  }

  /**
   * Takes the logo away again.
   *
   * Clearing the column first: a series that shows no logo is the state that was
   * asked for, whereas a column pointing at a file that is already gone would
   * render a broken image on a public page.
   */
  async removeLogo(id: string): Promise<null> {
    // Which file to unlink has to be read *before* the write: `setLogoPath`
    // answers with the row as it now stands, and by then the path is `null`.
    const existing = await this.series.findById(id);
    if (!existing)
      throw new NotFoundException(`No event series with id "${id}"`);

    if (!(await this.series.setLogoPath(id, null))) {
      throw new NotFoundException(`No event series with id "${id}"`);
    }

    await this.logos.discard([existing.logoPath]);
    return null;
  }

  /**
   * The bytes behind `GET /api/media/series/:id/logo`.
   *
   * No status check, deliberately, and it is worth being explicit about: the
   * logo of an unpublished series is served. Reaching it needs the row's uuid,
   * which is not derivable from anything public, and the bytes are a brand
   * rather than participant data (the argument E9 makes about attachments does
   * not apply). The alternative — 404 while a series is a draft — would break
   * the organizer's own form in exactly the state they are working in.
   */
  async readLogo(id: string): Promise<LogoBytes | null> {
    const found = await this.series.findById(id);
    if (!found) return null;
    return this.logos.read(found.logoPath);
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

/**
 * The participant's view, in one language.
 *
 * A translation is field by field and additive (E25): every field that has no
 * translation falls back to what the organizer wrote, so a half-translated
 * series reads as half-translated rather than half-empty. The slug is never
 * translated — it is the address, and an address that changes with a language is
 * a link that breaks when somebody switches.
 */
function toPublicEventSeries(
  record: EventSeriesRecord,
  translation?: EventSeriesTranslation,
): PublicEventSeries {
  return {
    id: record.id,
    slug: record.slug,
    name: translation?.name ?? record.name,
    description: translation?.description ?? record.description,
    // Resolved through the row, never as a stored path (E19) — and `null` while
    // no logo is uploaded, which is the normal state.
    logoUrl: seriesLogoUrl(record.id, record.logoPath, record.updatedAt),
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

/**
 * By name, in the reader's language.
 *
 * `localeCompare` and not `<`: German sorts „Ärztetag" beside „Arzt" and a code
 * point comparison puts it after „Zukunft". The tie-break on the slug keeps two
 * series of the same name in a stable order — the same reason every paginated
 * list in this application ends its sort on the id.
 */
function sortByName(
  series: readonly PublicEventSeries[],
  locale: string,
): readonly PublicEventSeries[] {
  const collator = new Intl.Collator(locale);
  return [...series].sort(
    (left, right) =>
      collator.compare(left.name, right.name) ||
      left.slug.localeCompare(right.slug),
  );
}

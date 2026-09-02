import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type {
  ParticipantDetail,
  ParticipantPage,
  ParticipantQuery,
  ParticipantRow,
  ParticipantSort,
  RegistrationStatistics,
  RegistrationStatus,
  RegistrationWeek,
  SortDirection,
} from '@trefaro/shared-models';
import {
  DEFAULT_PARTICIPANT_PAGE_SIZE,
  DEFAULT_PARTICIPANT_SORT,
  DEFAULT_SORT_DIRECTION,
  MAX_PARTICIPANT_PAGE_SIZE,
  PARTICIPANT_SORTS,
} from '@trefaro/shared-models';
import { AttachmentsService } from '../attachments';
import { searchTerms } from '../common/search-terms';
import {
  PROFILE_DIRECTORY,
  type ProfileDirectory,
} from '../common/ports/profile-directory.port';
import { EventsService } from '../events';
import { MailDeliveryError, MailService, PublicLinks } from '../mail';
import {
  REGISTRATION_REPOSITORY,
  type RegistrationRecord,
  type RegistrationRepository,
} from './ports/registration.repository';

/** A week in milliseconds — the step between two bars of the graph. */
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** More than this many empty weeks are not drawn; see `fillGaps`. */
const MAX_WEEKS = 260;

/**
 * Who is changing a registration's status.
 *
 * Not an authorization — both may cancel, and the rules are the same for both
 * (E14). It decides one thing: whether the participant is told, because
 * somebody who cancelled on their own page does not need a mail about it (F59).
 */
export type StatusChangeActor = 'organizer' | 'participant';

/**
 * The participant overview, as the organizer reads it (UC 08, FR 3.3).
 *
 * Separate from {@link RegistrationService}, which owns the participant's own
 * double opt-in flow. The two look at the same table from opposite ends: one is
 * public, unauthenticated and says as little as possible (E10); this one is
 * behind the administrative guard and says everything.
 *
 * The survey rated this screen highest of all functions (3,86/4), and the phase
 * plan names it as the one that will fail first at volume. Hence: every read is
 * one page, every filter is a `WHERE`, and no list is ever fetched whole to be
 * sliced afterwards.
 */
@Injectable()
export class ParticipantsService {
  private readonly logger = new Logger(ParticipantsService.name);

  constructor(
    @Inject(REGISTRATION_REPOSITORY)
    private readonly registrations: RegistrationRepository,
    private readonly events: EventsService,
    // Read for the detail panel only: a page of the table must not turn into
    // one query per row (E9, and the load rule of FR 3.3).
    private readonly attachments: AttachmentsService,
    // For the one message this service sends: the cancellation notice (F59).
    private readonly mail: MailService,
    private readonly links: PublicLinks,
    // Whether an address has an account (FR 3.3, E31) — a narrow port rather
    // than the accounts module, because a table showing a yes/no must not be
    // able to read a profile (F124).
    @Inject(PROFILE_DIRECTORY)
    private readonly directory: ProfileDirectory,
  ) {}

  /**
   * One page of one event's registrations (FR 3.3).
   *
   * Resolving the event first turns an unknown id into a 404 rather than an
   * empty table, which an organizer would read as "nobody has registered".
   */
  async list(
    eventId: string,
    query: ParticipantQuery,
  ): Promise<ParticipantPage> {
    await this.events.getForOrganizer(eventId);

    const page = positiveInteger(query.page, 1);
    const pageSize = clamp(
      positiveInteger(query.pageSize, DEFAULT_PARTICIPANT_PAGE_SIZE),
      1,
      MAX_PARTICIPANT_PAGE_SIZE,
    );

    const [slice, counts] = await Promise.all([
      this.registrations.search({
        eventId,
        terms: searchTerms(query.search),
        status: query.status ?? null,
        sort: sortColumn(query.sort),
        direction: sortDirection(query.direction),
        offset: (page - 1) * pageSize,
        limit: pageSize,
      }),
      this.registrations.countByStatus(eventId),
    ]);

    // After the page, not beside it: what is asked for is exactly the
    // addresses on this page, in one query (E31).
    const accounts = await this.accountsOf(slice.rows);

    return {
      rows: slice.rows.map((row) => toRow(row, accounts.has(row.email))),
      total: slice.total,
      page,
      pageSize,
      counts,
    };
  }

  /**
   * Registrations per week, as the graph in the mockups draws them (FR 3.8).
   *
   * The weeks come out of the database already cut in the event's zone (E8);
   * what happens here is filling the gaps, because a graph that silently leaves
   * out the weeks in which nobody registered turns a lull into a plateau.
   */
  async statistics(eventId: string): Promise<RegistrationStatistics> {
    const event = await this.events.getForOrganizer(eventId);

    const [weeks, counts] = await Promise.all([
      this.registrations.weeklyTotals(eventId, event.timezone),
      this.registrations.countByStatus(eventId),
    ]);

    return { weeks: fillGaps(weeks), counts, timezone: event.timezone };
  }

  /**
   * One registration with the event it belongs to.
   *
   * Through {@link EventsService.locate}, so the detail view of a registration
   * still opens after its event was unpublished — the registration is the
   * organizer's obligation towards a person, and it does not become invisible
   * because the event went back to being a draft.
   */
  async get(id: string): Promise<ParticipantDetail> {
    const registration = await this.require(id);
    const [{ event }, attachments, accounts] = await Promise.all([
      this.events.locate(registration.eventId),
      this.attachments.summariesFor(registration.id),
      this.accountsOf([registration]),
    ]);
    return {
      ...toRow(registration, accounts.has(registration.email)),
      eventId: registration.eventId,
      eventName: event.name,
      attachments,
    };
  }

  /**
   * Cancels a registration, or reinstates a cancelled one (E14).
   *
   * The rules, and why they are this narrow:
   *
   * - **To `cancelled`: always allowed.** Somebody wrote that they cannot come.
   *   The row stays, so the seat is demonstrably free without the record — and
   *   the evidence of the opt-in — disappearing.
   * - **To `confirmed`: only if the address was confirmed at some point.**
   *   Restoring a confirmation the participant themselves gave is fine; creating
   *   one is not. There is no column that would tell a hand-set status from a
   *   real double opt-in afterwards, so allowing it would quietly devalue the
   *   one consent record this application has (F23, E5).
   * - **To `pending`: only back from `cancelled`, and only if it was never
   *   confirmed.** Un-confirming a confirmed registration is not an operation an
   *   organizer needs; it would only lose the fact that it happened.
   *
   * An organizer whose participant never received the mail does not need a
   * manual confirmation: submitting the registration form again re-sends it and
   * creates no second row (E10).
   */
  async setStatus(
    id: string,
    status: RegistrationStatus,
    actor: StatusChangeActor,
  ): Promise<ParticipantRow> {
    const registration = await this.require(id);
    if (registration.status === status) return this.rowOf(registration);

    this.assertAllowed(registration, status);

    const updated = await this.registrations.update(id, { status });
    if (!updated) throw new NotFoundException(GONE);

    if (
      actor === 'organizer' &&
      status === 'cancelled' &&
      registration.status === 'confirmed'
    ) {
      await this.notifyCancelled(updated);
    }

    return this.rowOf(updated);
  }

  /**
   * One row, with the answer to "does this address have an account?" fetched.
   *
   * For the two single-row answers. The client replaces its row with what comes
   * back, so leaving the mark out here would make a cancellation look like a
   * lost account.
   */
  private async rowOf(
    registration: RegistrationRecord,
  ): Promise<ParticipantRow> {
    const accounts = await this.accountsOf([registration]);
    return toRow(registration, accounts.has(registration.email));
  }

  /**
   * Which of these registrations' addresses have an account (E31).
   *
   * An empty page asks nothing. The port would answer an empty question
   * without a round trip as well, but a table filtered down to no rows is the
   * normal case here, and the cheapest query is the one nobody sends.
   */
  private async accountsOf(
    registrations: readonly RegistrationRecord[],
  ): Promise<ReadonlySet<string>> {
    if (registrations.length === 0) return new Set();
    return this.directory.withAccount(
      registrations.map((registration) => registration.email),
    );
  }

  /**
   * Tells the participant that their registration was cancelled (F59).
   *
   * Three conditions, each of them load-bearing:
   *
   * - **Only when somebody else did it.** A participant who just cancelled on
   *   their own page has read the answer already; a mail confirming what they
   *   did a second ago is noise. That is what `actor` distinguishes — not who
   *   is allowed to cancel, which is the same for both.
   * - **Only out of `confirmed`.** A pending registration's address has never
   *   been confirmed to belong to the person behind it (E5), so this
   *   application does not send it anything except the confirmation request.
   * - **Only on the way in.** Reinstating sends nothing: a second mail saying
   *   "you are registered after all" would contradict the first without saying
   *   which one is current, and an organizer who fixed a misclick within the
   *   minute would have written to somebody twice for nothing.
   *
   * A failure here does not fail the cancellation. The status change is the
   * organizer's decision and it has already been written; a mail server that is
   * down must not turn it into an error the organizer retries.
   */
  private async notifyCancelled(
    registration: RegistrationRecord,
  ): Promise<void> {
    try {
      await this.mail.sendRegistrationCancelled(
        registration.email,
        async (locale) => {
          // `locate` rather than the public lookup: the notice has to go out
          // even if the event has meanwhile gone back to being a draft (the
          // same reasoning as for the self-service links). With the letter's
          // language, so the title is the one its reader was written to in
          // (F125).
          const { event, seriesSlug } = await this.events.locate(
            registration.eventId,
            locale,
          );
          return {
            firstName: registration.firstName,
            event: {
              name: event.name,
              startsAt: event.startsAt,
              endsAt: event.endsAt,
              timezone: event.timezone,
              url: this.links.event(seriesSlug, event.slug),
            },
          };
        },
      );
    } catch (error: unknown) {
      if (!(error instanceof MailDeliveryError)) throw error;
      this.logger.warn(
        `Registration ${registration.id} was cancelled, but the notice could not be sent.`,
      );
    }
  }

  private assertAllowed(
    registration: RegistrationRecord,
    status: RegistrationStatus,
  ): void {
    if (status === 'cancelled') return;

    if (status === 'confirmed' && !registration.confirmedAt) {
      throw new ConflictException(
        'This address has never been confirmed, so the registration cannot be ' +
          'set to confirmed. Ask the participant to submit the form again — ' +
          'that re-sends the confirmation mail without creating a second entry.',
      );
    }
    if (
      status === 'pending' &&
      (registration.status !== 'cancelled' || registration.confirmedAt)
    ) {
      throw new ConflictException(
        'Only a cancelled registration that was never confirmed can go back to pending.',
      );
    }
  }

  private async require(id: string): Promise<RegistrationRecord> {
    const found = await this.registrations.findById(id);
    if (!found) throw new NotFoundException(GONE);
    return found;
  }
}

/** Said the same way wherever a registration cannot be found any more. */
const GONE = 'This registration no longer exists.';

function toRow(
  record: RegistrationRecord,
  hasProfile: boolean,
): ParticipantRow {
  return {
    id: record.id,
    firstName: record.firstName,
    lastName: record.lastName,
    email: record.email,
    phone: record.phone,
    origin: record.origin,
    status: record.status,
    newsletterOptIn: record.newsletterOptIn,
    contactOptOut: record.contactOptOut,
    hasProfile,
    registeredAt: record.createdAt.toISOString(),
    confirmedAt: record.confirmedAt?.toISOString() ?? null,
    customFields: record.customFields,
  };
}

function sortColumn(sort: ParticipantSort | undefined): ParticipantSort {
  return sort && PARTICIPANT_SORTS.includes(sort)
    ? sort
    : DEFAULT_PARTICIPANT_SORT;
}

function sortDirection(direction: SortDirection | undefined): SortDirection {
  return direction === 'asc' || direction === 'desc'
    ? direction
    : DEFAULT_SORT_DIRECTION;
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && (value as number) >= 1
    ? Math.floor(value as number)
    : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Inserts the weeks in which nobody registered.
 *
 * Bounded by {@link MAX_WEEKS}: a registration entered with a mistyped year
 * would otherwise produce thousands of empty bars. Beyond the bound the gap is
 * left as it is — a visible break is a better answer than a graph that takes a
 * second to draw.
 */
function fillGaps(
  weeks: readonly RegistrationWeek[],
): readonly RegistrationWeek[] {
  if (weeks.length < 2) return weeks;

  const filled: RegistrationWeek[] = [];
  for (const week of weeks) {
    const previous = filled[filled.length - 1];
    if (previous) {
      const gap =
        (dateValue(week.weekStart) - dateValue(previous.weekStart)) / WEEK_MS;
      if (gap > 1 && gap <= MAX_WEEKS) {
        for (let step = 1; step < gap; step += 1) {
          filled.push({
            weekStart: weekAfter(previous.weekStart, step),
            total: 0,
            confirmed: 0,
          });
        }
      }
    }
    filled.push(week);
  }
  return filled;
}

/** `YYYY-MM-DD` read as UTC midnight — a calendar date has no zone of its own. */
function dateValue(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}

function weekAfter(date: string, steps: number): string {
  return new Date(dateValue(date) + steps * WEEK_MS).toISOString().slice(0, 10);
}

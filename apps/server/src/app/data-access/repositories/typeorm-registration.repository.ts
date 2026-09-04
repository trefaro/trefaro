import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  ParticipantSort,
  RegistrationCounts,
  RegistrationWeek,
  SortDirection,
} from '@trefaro/shared-models';
import {
  RegistrationExistsError,
  type NewRegistration,
  type RegistrationChanges,
  type RegistrationRecord,
  type RegistrationRepository,
  type RegistrationSearch,
  type RegistrationsOfAddress,
  type RegistrationSlice,
  type SeriesContactRecord,
  type SeriesContactSearch,
  type SeriesContactSlice,
} from '../../business/registration/ports/registration.repository';
import type { RegistrationTally } from '../../business/registration/ports/registration-tally';
import { RegistrationEntity } from '../entities';
import { isUniqueViolation } from './unique-violation';

/**
 * PostgreSQL implementation of the two registration ports.
 *
 * One class for both because they read the same table; the split exists so the
 * events and series modules can be given the counts without the rows (E14).
 */
@Injectable()
export class TypeormRegistrationRepository
  implements RegistrationRepository, RegistrationTally
{
  constructor(
    @InjectRepository(RegistrationEntity)
    private readonly repository: Repository<RegistrationEntity>,
  ) {}

  async findById(id: string): Promise<RegistrationRecord | null> {
    const row = await this.repository.findOneBy({ id });
    return row ? toRecord(row) : null;
  }

  async findByEventAndEmail(
    eventId: string,
    email: string,
  ): Promise<RegistrationRecord | null> {
    // `lower(email)` on both sides, matching the unique index: the caller
    // normalizes too, and this way neither is the single point of failure.
    const row = await this.repository
      .createQueryBuilder('registration')
      .where('registration.event_id = :eventId', { eventId })
      .andWhere('lower(registration.email) = lower(:email)', { email })
      .getOne();
    return row ? toRecord(row) : null;
  }

  async create(registration: NewRegistration): Promise<RegistrationRecord> {
    try {
      return toRecord(
        await this.repository.save(this.repository.create(registration)),
      );
    } catch (error: unknown) {
      throw isUniqueViolation(error)
        ? new RegistrationExistsError(registration.eventId, registration.email)
        : error;
    }
  }

  async update(
    id: string,
    changes: RegistrationChanges,
  ): Promise<RegistrationRecord | null> {
    const result = await this.repository.update({ id }, changes);
    if ((result.affected ?? 0) === 0) return null;
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete({ id });
    return (result.affected ?? 0) > 0;
  }

  /**
   * One page of one event's registrations (FR 3.3).
   *
   * Everything the table offers happens in SQL: the filter, the sort, the count
   * and the window. The overview is the function the phase plan expects to fail
   * first at volume, and the way it would fail is a service that reads a whole
   * event and slices the array afterwards.
   */
  async search(query: RegistrationSearch): Promise<RegistrationSlice> {
    const builder = this.repository
      .createQueryBuilder('registration')
      .where('registration.event_id = :eventId', { eventId: query.eventId });

    if (query.status) {
      builder.andWhere('registration.status = :status', {
        status: query.status,
      });
    }

    // One condition per word, all of them required — see `RegistrationSearch`.
    query.terms.forEach((term, index) => {
      const key = `term${index}`;
      builder.andWhere(
        `(registration.first_name ILIKE :${key}` +
          ` OR registration.last_name ILIKE :${key}` +
          ` OR registration.email ILIKE :${key})`,
        { [key]: `%${escapeLike(term)}%` },
      );
    });

    for (const [expression, direction] of orderBy(
      query.sort,
      query.direction,
    )) {
      builder.addOrderBy(expression, direction);
    }
    // A unique tie-breaker, always last: without one, two rows that compare
    // equal can swap places between two pages and a participant disappears from
    // a list they are on.
    builder.addOrderBy('registration.id', 'ASC');

    const [rows, total] = await builder
      .offset(query.offset)
      .limit(query.limit)
      .getManyAndCount();

    return { rows: rows.map(toRecord), total };
  }

  /**
   * The registrations of one address, newest event first (FR 4.7, E31).
   *
   * Joined to `event` for the order and for nothing else: the sort key is the
   * event's start, and a service cannot sort by a column it never reads. The
   * join is by table rather than by entity, so this repository still answers
   * with registrations only — what a page needs about the events it names is
   * resolved by the module that owns them.
   */
  async searchByAddress(
    query: RegistrationsOfAddress,
  ): Promise<RegistrationSlice> {
    const [rows, total] = await this.repository
      .createQueryBuilder('registration')
      .innerJoin('event', 'event', 'event.id = registration.event_id')
      // The same comparison the unique index uses (E10): one address is one
      // person however it was typed.
      .where('lower(registration.email) = lower(:email)', {
        email: query.email,
      })
      .orderBy('event.starts_at', 'DESC')
      // A unique tie-breaker, always last: two events starting in the same
      // minute must not swap places between two pages.
      .addOrderBy('registration.id', 'ASC')
      .offset(query.offset)
      .limit(query.limit)
      .getManyAndCount();

    return { rows: rows.map(toRecord), total };
  }

  /**
   * All four numbers in one statement.
   *
   * `FILTER` rather than four queries: the overview shows the counts next to
   * every page it loads, so this runs as often as the table itself.
   */
  async countByStatus(eventId: string): Promise<RegistrationCounts> {
    const [row] = (await this.repository.query(
      `SELECT count(*) AS total,
              count(*) FILTER (WHERE status = 'pending') AS pending,
              count(*) FILTER (WHERE status = 'confirmed') AS confirmed,
              count(*) FILTER (WHERE status = 'cancelled') AS cancelled
         FROM registration
        WHERE event_id = $1`,
      [eventId],
    )) as CountRow[];

    return {
      total: count(row?.total),
      pending: count(row?.pending),
      confirmed: count(row?.confirmed),
      cancelled: count(row?.cancelled),
    };
  }

  /**
   * Registrations per calendar week, cut in the event's own zone (E8).
   *
   * `created_at AT TIME ZONE $2` turns the stored instant into the wall clock of
   * that zone, so `date_trunc('week', …)` yields the Monday people there would
   * name. The result is formatted as a date string in SQL on purpose: sending a
   * zone-less timestamp through the driver would invite it to be read as the
   * server's local time, which is the one thing this query is avoiding.
   */
  async weeklyTotals(
    eventId: string,
    timezone: string,
  ): Promise<readonly RegistrationWeek[]> {
    const rows = (await this.repository.query(
      `SELECT to_char(
                date_trunc('week', created_at AT TIME ZONE $2),
                'YYYY-MM-DD'
              ) AS week_start,
              count(*) AS total,
              count(*) FILTER (WHERE status = 'confirmed') AS confirmed
         FROM registration
        WHERE event_id = $1
        GROUP BY 1
        ORDER BY 1`,
      [eventId, timezone],
    )) as WeekRow[];

    return rows.map((row) => ({
      weekStart: row.week_start,
      total: count(row.total),
      confirmed: count(row.confirmed),
    }));
  }

  /**
   * The addresses a series may invite, folded by address (FR 2.4, F24).
   *
   * `DISTINCT ON (lower(email))` with the order below keeps the most recent
   * registration of each address; the window function counts the whole group
   * before that happens, which is why `events` is the number of the series'
   * events this person is confirmed for and not `1`.
   *
   * Two queries rather than a `count(*) OVER ()` in one: a page past the end of
   * the list returns no rows, and a total that came out of those rows would then
   * be zero — which the client would draw as "nobody to invite".
   */
  async searchSeriesContacts(
    query: SeriesContactSearch,
  ): Promise<SeriesContactSlice> {
    const parameters: unknown[] = [query.seriesId];
    const filter = contactFilter(query.terms, parameters);

    const totals = (await this.repository.query(
      `SELECT count(DISTINCT lower(registration.email)) AS total
         FROM registration
         JOIN event ON event.id = registration.event_id
        WHERE ${filter}`,
      parameters,
    )) as { total: string }[];

    const rows = (await this.repository.query(
      `WITH contacts AS (
         SELECT DISTINCT ON (lower(registration.email))
                registration.id AS registration_id,
                registration.email AS email,
                registration.first_name AS first_name,
                registration.last_name AS last_name,
                registration.created_at AS last_registered_at,
                count(*) OVER (
                  PARTITION BY lower(registration.email)
                ) AS events
           FROM registration
           JOIN event ON event.id = registration.event_id
          WHERE ${filter}
          ORDER BY lower(registration.email),
                   registration.created_at DESC,
                   registration.id DESC
       )
       SELECT * FROM contacts
        ORDER BY last_registered_at DESC, registration_id DESC
        LIMIT $${parameters.length + 1} OFFSET $${parameters.length + 2}`,
      [...parameters, query.limit, query.offset],
    )) as ContactRow[];

    return {
      rows: rows.map(toContact),
      total: count(totals[0]?.total),
    };
  }

  /**
   * The selectable contacts among a list of registration ids (F55).
   *
   * Same filter, no paging. `events` counts only the selected registrations of
   * an address here, which nothing reads — this answer exists to say *whether*
   * an id may be written to and with what address, not to be displayed.
   */
  async findSeriesContacts(
    seriesId: string,
    registrationIds: readonly string[],
  ): Promise<readonly SeriesContactRecord[]> {
    if (registrationIds.length === 0) return [];

    const parameters: unknown[] = [seriesId, [...registrationIds]];
    const filter = contactFilter([], parameters);

    const rows = (await this.repository.query(
      `SELECT DISTINCT ON (lower(registration.email))
              registration.id AS registration_id,
              registration.email AS email,
              registration.first_name AS first_name,
              registration.last_name AS last_name,
              registration.created_at AS last_registered_at,
              count(*) OVER (
                PARTITION BY lower(registration.email)
              ) AS events
         FROM registration
         JOIN event ON event.id = registration.event_id
        WHERE ${filter}
          AND registration.id = ANY($2::uuid[])
        ORDER BY lower(registration.email),
                 registration.created_at DESC,
                 registration.id DESC`,
      parameters,
    )) as ContactRow[];

    return rows.map(toContact);
  }

  /**
   * One statement for the whole objection (F57).
   *
   * Every row of that address, across every series — the objection belongs to
   * the person. `contact_opt_out = false` in the filter is what makes the answer
   * meaningful: zero rows changed means this address had already objected, which
   * is a different sentence for the page to say.
   */
  async optOutByEmail(email: string): Promise<number> {
    // The query builder rather than `query()`: for an UPDATE, TypeORM's raw
    // `query()` answers `[rows, rowCount]` — a two-element array whatever
    // happened, so counting its length would report "two rows changed" for
    // every call, including one that changed nothing. `affected` is the number.
    const result = await this.repository
      .createQueryBuilder()
      .update(RegistrationEntity)
      .set({ contactOptOut: true })
      .where('lower(email) = lower(:email)', { email })
      // Only the rows that had not objected yet, so the count means something:
      // zero is "this address had already objected" (E15, F57).
      .andWhere('contact_opt_out = false')
      .execute();
    return result.affected ?? 0;
  }

  confirmedForEvent(eventId: string): Promise<number> {
    return this.repository.countBy({ eventId, status: 'confirmed' });
  }

  confirmedForSeries(seriesId: string): Promise<number> {
    return this.repository
      .createQueryBuilder('registration')
      .innerJoin('event', 'event', 'event.id = registration.event_id')
      .where('event.series_id = :seriesId', { seriesId })
      .andWhere('registration.status = :status', { status: 'confirmed' })
      .getCount();
  }
}

/** Aggregates arrive as strings: PostgreSQL's `count` is a 64-bit integer. */
interface CountRow {
  total: string;
  pending: string;
  confirmed: string;
  cancelled: string;
}

interface ContactRow {
  registration_id: string;
  email: string;
  first_name: string;
  last_name: string;
  last_registered_at: Date;
  events: string;
}

function toContact(row: ContactRow): SeriesContactRecord {
  return {
    registrationId: row.registration_id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    events: count(row.events),
    lastRegisteredAt: new Date(row.last_registered_at),
  };
}

/**
 * The `WHERE` every audience query shares, and the rule it encodes (E15).
 *
 * Confirmed, this series, and never an address that has objected. Appended to
 * `parameters`, which starts with the series id — so the caller's own
 * placeholders continue after whatever the terms needed.
 */
function contactFilter(
  terms: readonly string[],
  parameters: unknown[],
): string {
  const clauses = [
    'event.series_id = $1',
    `registration.status = 'confirmed'`,
    'registration.contact_opt_out = false',
  ];

  for (const term of terms) {
    parameters.push(`%${escapeLike(term)}%`);
    const placeholder = `$${parameters.length}`;
    clauses.push(
      `(lower(registration.first_name) LIKE ${placeholder}
        OR lower(registration.last_name) LIKE ${placeholder}
        OR lower(registration.email) LIKE ${placeholder})`,
    );
  }

  return clauses.join(' AND ');
}

interface WeekRow {
  week_start: string;
  total: string;
  confirmed: string;
}

function count(value: string | undefined): number {
  return Number(value ?? 0);
}

/**
 * What each sort column means in SQL.
 *
 * Two of them are not the obvious column:
 *
 * - **Name** sorts by last name, then first name, and case-insensitively —
 *   otherwise "van Dijk" and "Van Dijk" end up in different halves of the list.
 * - **Status** sorts by urgency rather than alphabetically: ascending puts
 *   `pending` first, because that is the status an organizer has something to do
 *   about. Alphabetically it would be `cancelled`.
 */
function orderBy(
  sort: ParticipantSort,
  direction: SortDirection,
): readonly [string, 'ASC' | 'DESC'][] {
  const order = direction === 'asc' ? 'ASC' : 'DESC';

  switch (sort) {
    case 'name':
      return [
        ['lower(registration.last_name)', order],
        ['lower(registration.first_name)', order],
      ];
    case 'email':
      return [['lower(registration.email)', order]];
    case 'status':
      return [
        [
          `CASE registration.status
             WHEN 'pending' THEN 0
             WHEN 'confirmed' THEN 1
             ELSE 2
           END`,
          order,
        ],
        ['registration.created_at', 'DESC'],
      ];
    default:
      return [['registration.created_at', order]];
  }
}

/**
 * Makes a search term literal.
 *
 * Without this, searching for `%` matches every participant and searching for
 * `_` matches every one-character difference — a filter that quietly stops
 * filtering is worse than one that finds nothing.
 */
function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (character) => `\\${character}`);
}

function toRecord(row: RegistrationEntity): RegistrationRecord {
  return {
    id: row.id,
    eventId: row.eventId,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    phone: row.phone,
    origin: row.origin,
    status: row.status,
    newsletterOptIn: row.newsletterOptIn,
    contactOptOut: row.contactOptOut,
    customFields: row.customFields ?? {},
    confirmedAt: row.confirmedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

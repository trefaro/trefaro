import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  ContactOptOutResult,
  ContactQuery,
  SeriesContact,
  SeriesContactPage,
} from '@trefaro/shared-models';
import {
  DEFAULT_CONTACT_PAGE_SIZE,
  MAX_CONTACT_PAGE_SIZE,
} from '@trefaro/shared-models';
import {
  REGISTRATION_REPOSITORY,
  type RegistrationRepository,
  type SeriesContactRecord,
} from './ports/registration.repository';

/**
 * Who a series may write to, and how somebody says no (FR 2.4, E15).
 *
 * The third service on this table, and the one with the narrowest job. The
 * other two read registrations of one *event* — the public opt-in flow and the
 * organizer's overview. This one reads them across a *series*, folded by
 * address, and it is the only place `contact_opt_out` is ever written.
 *
 * It lives here rather than in the invitations module for one reason: this is
 * the module that owns the `registration` table's port, and the column is on
 * that table. What the invitations module owns is the message and the sending —
 * it asks this service who may receive it and never touches a registration row
 * itself.
 *
 * Three rules are structural rather than checked, and all three are E15:
 *
 * 1. **Confirmed, this series, not objected.** Encoded in the port's filter, not
 *    passed in — {@link SeriesContactSearch} has no way to express otherwise.
 * 2. **A selection names registrations, never addresses** (F55). Everything a
 *    caller sends is looked up again through the same filter, so this cannot
 *    become a way to mail an arbitrary address through the instance.
 * 3. **An objection is about the person, not the row** (F57). One address, every
 *    registration it has anywhere in this instance.
 */
@Injectable()
export class ContactsService {
  constructor(
    @Inject(REGISTRATION_REPOSITORY)
    private readonly registrations: RegistrationRepository,
  ) {}

  /**
   * One page of the addresses a series may invite.
   *
   * Always newest registration first, with no way to ask for another order:
   * "who has been with us most recently" is the question an organizer picking
   * an audience is asking, and a second sort would need a second index for a
   * choice nobody made in the mockups.
   */
  async list(
    seriesId: string,
    query: ContactQuery,
  ): Promise<SeriesContactPage> {
    const page = positiveInteger(query.page, 1);
    const pageSize = clamp(
      positiveInteger(query.pageSize, DEFAULT_CONTACT_PAGE_SIZE),
      1,
      MAX_CONTACT_PAGE_SIZE,
    );

    const slice = await this.registrations.searchSeriesContacts({
      seriesId,
      terms: searchTerms(query.search),
      offset: (page - 1) * pageSize,
      limit: pageSize,
    });

    return {
      rows: slice.rows.map(toContact),
      total: slice.total,
      page,
      pageSize,
    };
  }

  /**
   * The contacts behind a selection, or a 400 naming how many were refused.
   *
   * Refused rather than skipped: an organizer who selected eighty people and
   * whose invitation went to seventy-nine has no way to find out which one is
   * missing. The cases that get here are a stale list — somebody objected, or
   * their registration was cancelled, between loading the page and sending.
   *
   * Two selected registrations of the same address collapse into one contact:
   * one person receives one mail (F55).
   */
  async selection(
    seriesId: string,
    registrationIds: readonly string[],
  ): Promise<readonly SeriesContact[]> {
    const unique = [...new Set(registrationIds)];
    if (unique.length === 0) {
      throw new BadRequestException('Select at least one address to write to.');
    }

    const found = await this.registrations.findSeriesContacts(seriesId, unique);
    const addressed = new Set(found.map((contact) => contact.registrationId));
    const missing = unique.filter((id) => !addressed.has(id));

    if (missing.length > 0) {
      throw new BadRequestException(
        `${missing.length} of the selected addresses can no longer be written ` +
          'to — a registration was cancelled, or somebody objected to being ' +
          'contacted. Please reload the list and select again.',
      );
    }

    return found.map(toContact);
  }

  /**
   * Records that this address does not want to be invited again (E15, F57).
   *
   * Takes the registration the objection link speaks for and writes every row
   * of its address. Idempotent by design: a second click reports
   * `already-opted-out` rather than an error, because from the reader's side
   * nothing about their situation has changed.
   *
   * Deliberately not restricted to confirmed registrations, and deliberately
   * without a look at the event or its series: whoever holds this link asked to
   * be left alone, and the answer to that is never "your registration does not
   * qualify".
   */
  async optOut(registrationId: string): Promise<ContactOptOutResult> {
    const registration = await this.registrations.findById(registrationId);
    if (!registration) {
      throw new NotFoundException('This registration no longer exists.');
    }

    const changed = await this.registrations.optOutByEmail(registration.email);
    return { state: changed > 0 ? 'opted-out' : 'already-opted-out' };
  }
}

function toContact(record: SeriesContactRecord): SeriesContact {
  return {
    registrationId: record.registrationId,
    email: record.email,
    firstName: record.firstName,
    lastName: record.lastName,
    events: record.events,
    lastRegisteredAt: record.lastRegisteredAt.toISOString(),
  };
}

/** The same split the participant overview uses: all words have to match. */
function searchTerms(search: string | undefined): readonly string[] {
  return (search ?? '')
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 0)
    .slice(0, 5);
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return Number.isInteger(value) && (value as number) > 0
    ? (value as number)
    : fallback;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}

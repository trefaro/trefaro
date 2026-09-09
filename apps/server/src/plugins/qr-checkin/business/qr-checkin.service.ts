import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  DEFAULT_ADMISSION_PAGE_SIZE,
  DEFAULT_TICKET_PAGE_SIZE,
  MAX_ADMISSION_PAGE_SIZE,
  MAX_TICKET_PAGE_SIZE,
  type AdmissionPage,
  type AdmissionRow,
  type CheckinPageQuery,
  type CheckinResult,
  type CheckinTicket,
  type CheckinTicketPage,
} from '@trefaro/shared-models';
import {
  PLUGIN_REGISTRATION_READS,
  byPluginAccount,
  byPluginLink,
  pageWindow,
  type PageWindow,
  type PluginRegistration,
  type PluginRegistrationClaim,
  type PluginRegistrationReads,
  type PluginRegistrationSlice,
} from '../../../app/business/plugin-api';
import { newCheckinCode, normalizeCheckinCode } from './checkin-code';
import {
  TICKET_REPOSITORY,
  UnknownTicketRegistrationError,
  type TicketRecord,
  type TicketRepository,
} from './ports/ticket.repository';

/**
 * QR code check-in (FR 3.16).
 *
 * The fourth curated plug-in, and the first that is about a **door**. What it
 * uses of the contract is one port — `PluginRegistrationReads` — and what it
 * owns is one table: a code per registration, and the instant somebody was let
 * in. It contains no ORM import, no core entity and no knowledge of
 * `registration` beyond the five fields the contract promises.
 *
 * Five decisions worth naming:
 *
 * 1. **The code is the plug-in's own** (E53). The signed self-service token can
 *    cancel a registration (F44); a QR code is photographed, held up at a door
 *    and mirrored on screens. So this plug-in issues an opaque code of its own,
 *    one per registration, and it proves nothing but that the registration
 *    exists.
 * 2. **A code is created on first read.** Nobody is issued a ticket in advance:
 *    the row appears when somebody opens their ticket page, or when an organizer
 *    opens the admission list — because the button beside a row has to send the
 *    same code a camera would read (F199), and a row without one would be a row
 *    the door cannot use.
 * 3. **A second scan is not an error** (E53). It answers 200 with the **first**
 *    instant and says so. "Already here, since 09:12" is the sentence somebody
 *    at a door needs; an error would send them looking for a fault that is not
 *    there.
 * 4. **An unconfirmed registration gets no ticket**, and neither does a
 *    cancelled one. The rule is in the host adapter's statements rather than
 *    here (F152) — this service asks for confirmed registrations and has no way
 *    to ask for anything else.
 * 5. **The door reads names, never addresses.** The port hands over first and
 *    last name and nothing else; who somebody is beyond that is the participant
 *    overview's business (FR 3.3, F55).
 */
@Injectable()
export class QrCheckinService {
  constructor(
    @Inject(TICKET_REPOSITORY)
    private readonly tickets: TicketRepository,
    // The host's registration port (E53, E54, F148). The only way this plug-in
    // learns that registrations exist, and deliberately the narrowest one: a
    // claim, one event's list, and an id it already stored.
    @Inject(PLUGIN_REGISTRATION_READS)
    private readonly registrations: PluginRegistrationReads,
  ) {}

  /**
   * The ticket behind the link in a confirmation receipt (E11, E54).
   *
   * The anonymous half of F148: the token speaks for one registration, and
   * whoever holds it may see the code. Every way of failing is the same 404 —
   * forged, expired, pointing at a registration that was deleted, or at one
   * that is not confirmed. The difference is not the holder's to learn, and it
   * does not change what they can do about it.
   */
  ticketByLink(token: string): Promise<CheckinTicket> {
    return this.singleTicket(byPluginLink(token));
  }

  /**
   * Every ticket of the logged-in participant (F148).
   *
   * The session half of the same claim, and it is plural because a person is
   * not a registration: whoever attends three events of a series holds three
   * tickets, and the page shows them the way "my registrations" shows the rows
   * behind them.
   */
  async myTickets(
    participantId: string,
    query: CheckinPageQuery,
  ): Promise<CheckinTicketPage> {
    const window = pageWindow(
      query,
      DEFAULT_TICKET_PAGE_SIZE,
      MAX_TICKET_PAGE_SIZE,
    );
    const slice = await this.registrations.resolveClaim(
      byPluginAccount(participantId),
      rows(window),
    );
    const tickets = await this.issueFor(slice.rows);

    return {
      rows: slice.rows.flatMap((registration) => {
        const ticket = tickets.get(registration.id);
        // Cannot happen — the row was just issued — and left out rather than
        // faked if it ever does: a ticket without a code is not a ticket.
        return ticket ? [toTicket(registration, ticket)] : [];
      }),
      total: slice.total,
      page: window.page,
      pageSize: window.pageSize,
    };
  }

  /**
   * Who is expected at one event, and who has arrived (FR 3.16).
   *
   * One page of the event's confirmed registrations through the port, and one
   * lookup for the whole page's tickets — two statements per screen, never one
   * per row (F49). The plug-in does **not** query `registration`: it has no way
   * to, which is what the port is for.
   *
   * Every row carries its code, issued here if it did not exist yet: the button
   * beside a row sends exactly what the camera would have read, so the door has
   * one route whichever way the code got there (F199).
   */
  async admissionList(
    eventId: string,
    query: CheckinPageQuery,
  ): Promise<AdmissionPage> {
    const window = pageWindow(
      query,
      DEFAULT_ADMISSION_PAGE_SIZE,
      MAX_ADMISSION_PAGE_SIZE,
    );
    const slice = await this.registrations.findForEvent(eventId, rows(window));
    const tickets = await this.issueFor(slice.rows);

    return {
      rows: slice.rows.flatMap((registration) => {
        const ticket = tickets.get(registration.id);
        return ticket ? [toRow(registration, ticket)] : [];
      }),
      total: slice.total,
      page: window.page,
      pageSize: window.pageSize,
    };
  }

  /**
   * Reads a code at the door (FR 3.16).
   *
   * A `POST` with the code in the body, not a `GET`: it changes something, and
   * a code in a URL ends up in a log and in a browser's history — at a door
   * where the URL bar is on a shared screen.
   *
   * Answers 200 twice for the same code, with the same instant, and says which
   * of the two it was (E53). A 404 means no ticket carries that code, and it
   * says nothing about registrations: whoever is holding an unknown code learns
   * that it does not open this door, and nothing about who is expected behind
   * it.
   *
   * @throws NotFoundException — no ticket with that code, or the registration
   * behind it is not confirmed any more.
   */
  async checkIn(code: string, organizerId: string): Promise<CheckinResult> {
    const admission = await this.tickets.checkIn(
      normalizeCheckinCode(code),
      new Date(),
      organizerId,
    );
    if (!admission) throw new NotFoundException(UNKNOWN_CODE);

    const registration = await this.registrations.findRegistration(
      admission.ticket.registrationId,
    );
    // The ticket outlives a cancellation — only an erasure takes the row — so
    // the same 404 covers "this registration was given up". A door that opened
    // for it would be a door opened by a ticket somebody handed back.
    if (!registration) throw new NotFoundException(UNKNOWN_CODE);

    // Non-null: the statement wrote it where it was NULL and read the row back,
    // so either this scan set it or an earlier one did.
    const checkedInAt = admission.ticket.checkedInAt ?? new Date();
    return {
      registrationId: registration.id,
      eventId: registration.eventId,
      firstName: registration.firstName,
      lastName: registration.lastName,
      // The first admission, never the latest: "already here, since 09:12" is
      // the sentence the door needs, and 09:12 is when they walked in.
      checkedInAt: checkedInAt.toISOString(),
      alreadyCheckedIn: !admission.admitted,
    };
  }

  /** The one ticket a claim resolves to, or a 404 (E11, F148). */
  private async singleTicket(
    claim: PluginRegistrationClaim,
  ): Promise<CheckinTicket> {
    const slice: PluginRegistrationSlice =
      await this.registrations.resolveClaim(claim, { offset: 0, limit: 1 });
    const registration = slice.rows[0];
    if (!registration) throw new NotFoundException(NO_TICKET);

    const tickets = await this.issueFor([registration]);
    const ticket = tickets.get(registration.id);
    if (!ticket) throw new NotFoundException(NO_TICKET);
    return toTicket(registration, ticket);
  }

  /**
   * The tickets of these registrations, issuing the ones that do not exist yet.
   *
   * One statement for the whole page, and idempotent by the primary key: two
   * tabs opening the same page get one code, and the second one is not an
   * error. A registration deleted in between is a 404 rather than a failed
   * constraint.
   */
  private async issueFor(
    registrations: readonly PluginRegistration[],
  ): Promise<ReadonlyMap<string, TicketRecord>> {
    const issuedAt = new Date();
    try {
      return await this.tickets.issue(
        registrations.map((registration) => ({
          registrationId: registration.id,
          code: newCheckinCode(),
          issuedAt,
        })),
      );
    } catch (error: unknown) {
      if (!(error instanceof UnknownTicketRegistrationError)) throw error;
      throw new NotFoundException(NO_TICKET);
    }
  }
}

/**
 * Said the same way for a forged token, an expired one, a registration that is
 * gone and one that was never confirmed.
 *
 * "There is no ticket here" is true in all four cases and gives away none of
 * them — the same reading `SelfServiceService` gives its one message, and the
 * same reason: the difference does not change what the holder can do about it.
 */
const NO_TICKET =
  'There is no ticket for this link. Ask the organizer to send your ' +
  'registration details again.';

/** Says nothing about who is expected behind this door. */
const UNKNOWN_CODE = 'No ticket has that code.';

/**
 * The window in the terms a port uses.
 *
 * `PageWindow` carries the page number as well, because the answer reports what
 * was actually read; a read needs two of its three fields.
 */
function rows(window: PageWindow): { offset: number; limit: number } {
  return { offset: window.offset, limit: window.pageSize };
}

function toTicket(
  registration: PluginRegistration,
  ticket: TicketRecord,
): CheckinTicket {
  return {
    registrationId: registration.id,
    eventId: registration.eventId,
    firstName: registration.firstName,
    lastName: registration.lastName,
    code: ticket.code,
    issuedAt: ticket.issuedAt.toISOString(),
    checkedInAt: ticket.checkedInAt?.toISOString() ?? null,
  };
}

function toRow(
  registration: PluginRegistration,
  ticket: TicketRecord,
): AdmissionRow {
  return {
    registrationId: registration.id,
    firstName: registration.firstName,
    lastName: registration.lastName,
    code: ticket.code,
    checkedInAt: ticket.checkedInAt?.toISOString() ?? null,
  };
}

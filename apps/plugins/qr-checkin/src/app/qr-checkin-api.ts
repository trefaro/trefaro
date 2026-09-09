import { Injectable } from '@angular/core';
import {
  MAX_TICKET_PAGE_SIZE,
  QR_CHECKIN_MODULE_KEY,
  type AdmissionPage,
  type CheckinResult,
  type CheckinTicket,
  type CheckinTicketPage,
} from '@trefaro/shared-models';
import { readJson, sendJson } from '@trefaro/shared-plugin-kit';

/**
 * This plug-in's own routes (FR 3.16).
 *
 * The routes are this plug-in's; the request itself — `fetch`, same-origin,
 * every refusal with its status — is the kit's (F138). The models come from
 * `@trefaro/shared-models`, where the plug-in's server DTOs implement the same
 * interfaces.
 *
 * **Three prefixes for three audiences** (E57), which no other bundle needs:
 * `/api/user/…` for the ticket behind the link in a receipt, where a signed
 * token is the whole credential; `/api/participant/…` for the same ticket over
 * a session; `/api/admin/…` for the door. The access level of a plug-in **is**
 * its path — contract, not deployment — so the prefixes stand here rather than
 * being configured.
 */
@Injectable({ providedIn: 'root' })
export class QrCheckinApi {
  private readonly linkBase = `/api/user/plugins/${QR_CHECKIN_MODULE_KEY}`;
  private readonly sessionBase = `/api/participant/plugins/${QR_CHECKIN_MODULE_KEY}`;
  private readonly adminBase = `/api/admin/plugins/${QR_CHECKIN_MODULE_KEY}`;

  /** The ticket behind the personal link in a confirmation receipt (E11, E54). */
  ticketByLink(token: string): Promise<CheckinTicket> {
    return readJson<CheckinTicket>(
      `${this.linkBase}/ticket?token=${encodeURIComponent(token)}`,
    );
  }

  /**
   * The ticket for one registration, over a session — the other claim (F148).
   *
   * The route is plural because a person is not a registration: whoever attends
   * three events holds three tickets. The self-service page is about **one** of
   * them, so this walks the pages until it finds it, largest page first — one
   * request for everybody who is not a regular of a weekly series, and bounded
   * by the `total` the server reports rather than by a guess.
   *
   * A page that comes back short of what it promised ends the walk too: an
   * answer that says `total: 200` and hands over nothing must not turn into a
   * loop against somebody's own server.
   */
  async ticketOf(registrationId: string): Promise<CheckinTicket | null> {
    let page = 1;
    let read = 0;
    for (;;) {
      const answer = await this.myTickets(page);
      const found = answer.rows.find(
        (ticket) => ticket.registrationId === registrationId,
      );
      if (found) return found;
      read += answer.rows.length;
      if (answer.rows.length === 0 || read >= answer.total) return null;
      page += 1;
    }
  }

  /** One page of this account's tickets, newest event first. */
  myTickets(page: number): Promise<CheckinTicketPage> {
    return readJson<CheckinTicketPage>(
      `${this.sessionBase}/tickets?page=${page}&pageSize=${MAX_TICKET_PAGE_SIZE}`,
    );
  }

  /** Who is expected at one event, and who has arrived (FR 3.16). */
  admissions(eventId: string, page: number): Promise<AdmissionPage> {
    return readJson<AdmissionPage>(
      `${this.adminBase}/events/${eventId}/checkins?page=${page}`,
    );
  }

  /**
   * Reads a code at the door — scanned or typed, one route either way (F199).
   *
   * A `POST` with the code in the body: it changes something, and a code in a
   * URL ends up in a log and in the history of a browser standing open at a
   * door.
   */
  checkIn(code: string): Promise<CheckinResult> {
    return sendJson<CheckinResult>('POST', `${this.adminBase}/checkins`, {
      code,
    });
  }
}

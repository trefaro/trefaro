import { NotFoundException } from '@nestjs/common';
import type {
  PluginRegistration,
  PluginRegistrationClaim,
  PluginRegistrationReads,
  PluginRegistrationSlice,
  PluginRegistrationWindow,
} from '../../../app/business/plugin-api';
import { QrCheckinService } from './qr-checkin.service';
import {
  UnknownTicketRegistrationError,
  type AdmissionResult,
  type IssueTicketInput,
  type TicketRecord,
  type TicketRepository,
} from './ports/ticket.repository';

/**
 * QR code check-in (FR 3.16) — AP 7 of phase 4.
 *
 * The rules that live in a statement are deliberately **not** asserted here:
 * that only confirmed registrations resolve (the host adapter's `WHERE`), and
 * that the first admission is the one that counts (the repository's conditional
 * `UPDATE`). A fake could only prove that the fake obeys them; they are decided
 * against the real database in
 * `apps/server-e2e/src/api/plugin-qr-checkin.spec.ts`.
 *
 * What this level can decide is everything the service itself is responsible
 * for: that a claim which resolves to nothing is a 404 with one wording, that a
 * code is created on first read and not on the second, that a second scan is an
 * answer rather than an error, which window each list reads, and that a page of
 * an admission list costs two statements rather than one per row.
 */
class FakeTicketRepository implements TicketRepository {
  readonly rows = new Map<string, TicketRecord>();
  readonly issueCalls: (readonly IssueTicketInput[])[] = [];
  readonly findCalls: (readonly string[])[] = [];
  /** Set to make `issue` fail the way a deleted registration does. */
  unknownRegistration = false;

  async findMany(
    registrationIds: readonly string[],
  ): Promise<ReadonlyMap<string, TicketRecord>> {
    this.findCalls.push([...registrationIds]);
    const found = new Map<string, TicketRecord>();
    for (const id of registrationIds) {
      const row = this.rows.get(id);
      if (row) found.set(id, row);
    }
    return found;
  }

  async issue(
    inputs: readonly IssueTicketInput[],
  ): Promise<ReadonlyMap<string, TicketRecord>> {
    this.issueCalls.push([...inputs]);
    if (this.unknownRegistration && inputs.length > 0) {
      throw new UnknownTicketRegistrationError(inputs[0].registrationId);
    }
    // `ON CONFLICT DO NOTHING`: a registration that already has a ticket keeps
    // the one it has, and issuing again is not an error.
    for (const input of inputs) {
      if (this.rows.has(input.registrationId)) continue;
      this.rows.set(input.registrationId, {
        registrationId: input.registrationId,
        code: input.code,
        issuedAt: input.issuedAt,
        checkedInAt: null,
        checkedInBy: null,
      });
    }
    return this.findMany(inputs.map((input) => input.registrationId));
  }

  async findByCode(code: string): Promise<TicketRecord | null> {
    return [...this.rows.values()].find((row) => row.code === code) ?? null;
  }

  async checkIn(
    code: string,
    checkedInAt: Date,
    checkedInBy: string,
  ): Promise<AdmissionResult | null> {
    const ticket = await this.findByCode(code);
    if (!ticket) return null;
    // Only where nobody has been let in yet — the conditional `UPDATE`.
    if (ticket.checkedInAt) return { ticket, admitted: false };
    const admitted = { ...ticket, checkedInAt, checkedInBy };
    this.rows.set(ticket.registrationId, admitted);
    return { ticket: admitted, admitted: true };
  }
}

class FakeRegistrationReads implements PluginRegistrationReads {
  readonly claims: {
    claim: PluginRegistrationClaim;
    window: PluginRegistrationWindow;
  }[] = [];
  readonly eventCalls: {
    eventId: string;
    window: PluginRegistrationWindow;
  }[] = [];
  readonly resolved: string[] = [];

  /** What a claim resolves to; empty stands for every way of failing. */
  claimed: readonly PluginRegistration[] = [];
  claimedTotal = 0;
  expected: readonly PluginRegistration[] = [];
  expectedTotal = 0;
  /** Ids this port still answers for — a cancelled one is simply absent. */
  readonly known = new Map<string, PluginRegistration>();

  async resolveClaim(
    claim: PluginRegistrationClaim,
    window: PluginRegistrationWindow,
  ): Promise<PluginRegistrationSlice> {
    this.claims.push({ claim, window });
    return { rows: this.claimed, total: this.claimedTotal };
  }

  async findRegistration(id: string): Promise<PluginRegistration | null> {
    this.resolved.push(id);
    return this.known.get(id) ?? null;
  }

  async findForEvent(
    eventId: string,
    window: PluginRegistrationWindow,
  ): Promise<PluginRegistrationSlice> {
    this.eventCalls.push({ eventId, window });
    return { rows: this.expected, total: this.expectedTotal };
  }
}

function registration(
  overrides: Partial<PluginRegistration> = {},
): PluginRegistration {
  return {
    id: 'registration-1',
    eventId: 'event-1',
    firstName: 'Amina',
    lastName: 'Okonkwo',
    confirmedAt: '2099-06-01T09:00:00.000Z',
    ...overrides,
  };
}

describe('QrCheckinService', () => {
  let tickets: FakeTicketRepository;
  let registrations: FakeRegistrationReads;
  let service: QrCheckinService;

  beforeEach(() => {
    tickets = new FakeTicketRepository();
    registrations = new FakeRegistrationReads();
    service = new QrCheckinService(tickets, registrations);
  });

  /** Registers one person and remembers them the way the port would. */
  const expect1 = (overrides: Partial<PluginRegistration> = {}) => {
    const row = registration(overrides);
    registrations.known.set(row.id, row);
    return row;
  };

  describe('the ticket behind a mailed link (E11, E54)', () => {
    it('resolves the token as a claim and asks for one row', async () => {
      const row = expect1();
      registrations.claimed = [row];
      registrations.claimedTotal = 1;

      const ticket = await service.ticketByLink('a-signed-token');

      expect(registrations.claims).toEqual([
        {
          claim: { kind: 'link', token: 'a-signed-token' },
          // A token speaks for one registration: asking for more would be
          // asking a question the claim cannot have an answer to.
          window: { offset: 0, limit: 1 },
        },
      ]);
      expect(ticket.registrationId).toBe(row.id);
      expect(ticket.firstName).toBe('Amina');
      expect(ticket.checkedInAt).toBeNull();
    });

    it('creates the code on first read and keeps it afterwards (E53)', async () => {
      const row = expect1();
      registrations.claimed = [row];
      registrations.claimedTotal = 1;

      const first = await service.ticketByLink('a-signed-token');
      const second = await service.ticketByLink('a-signed-token');

      expect(second.code).toBe(first.code);
      // Two reads, two attempts to issue — and one row, because the primary key
      // decides. The second attempt is not an error.
      expect(tickets.issueCalls).toHaveLength(2);
      expect(tickets.rows.size).toBe(1);
    });

    it('is one 404 for every way a claim resolves to nothing', async () => {
      // Forged, expired, deleted, never confirmed: the port answers all four
      // the same way, and so does this.
      registrations.claimed = [];

      await expect(service.ticketByLink('nonsense')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(tickets.issueCalls).toHaveLength(0);
    });

    it('answers 404 when the registration goes between reading and issuing', async () => {
      registrations.claimed = [expect1()];
      registrations.claimedTotal = 1;
      tickets.unknownRegistration = true;

      await expect(
        service.ticketByLink('a-signed-token'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('never issues a code that looks like a token', async () => {
      registrations.claimed = [expect1()];
      registrations.claimedTotal = 1;

      const ticket = await service.ticketByLink('a-signed-token');

      // The one property E53 is about: the code is the plug-in's own, and the
      // token it was fetched with is nowhere in it.
      expect(ticket.code).not.toContain('a-signed-token');
      expect(ticket.code).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    });
  });

  describe('my tickets, over a session (F148)', () => {
    it('claims by account and reads the default window', async () => {
      registrations.claimed = [expect1(), expect1({ id: 'registration-2' })];
      registrations.claimedTotal = 2;

      const page = await service.myTickets('participant-1', {});

      expect(registrations.claims).toEqual([
        {
          claim: { kind: 'account', participantId: 'participant-1' },
          window: { offset: 0, limit: 10 },
        },
      ]);
      expect(page.rows).toHaveLength(2);
      expect(page.total).toBe(2);
      expect(page.page).toBe(1);
    });

    it('turns the page number into an offset and caps the size', async () => {
      await service.myTickets('participant-1', { page: 3, pageSize: 500 });

      expect(registrations.claims[0].window).toEqual({
        offset: 2 * 50,
        limit: 50,
      });
    });

    it('issues every missing code in one statement (F49)', async () => {
      registrations.claimed = [
        expect1(),
        expect1({ id: 'registration-2' }),
        expect1({ id: 'registration-3' }),
      ];
      registrations.claimedTotal = 3;

      const page = await service.myTickets('participant-1', {});

      expect(tickets.issueCalls).toHaveLength(1);
      expect(tickets.issueCalls[0]).toHaveLength(3);
      expect(new Set(page.rows.map((row) => row.code)).size).toBe(3);
    });

    it('is an empty page for an account with no confirmed registration', async () => {
      registrations.claimed = [];

      const page = await service.myTickets('participant-1', {});

      expect(page.rows).toEqual([]);
      expect(page.total).toBe(0);
      expect(tickets.issueCalls[0]).toEqual([]);
    });
  });

  describe('the admission list', () => {
    it('reads who is expected through the port, never a core table', async () => {
      registrations.expected = [expect1(), expect1({ id: 'registration-2' })];
      registrations.expectedTotal = 2;

      const page = await service.admissionList('event-1', { pageSize: 25 });

      expect(registrations.eventCalls).toEqual([
        { eventId: 'event-1', window: { offset: 0, limit: 25 } },
      ]);
      expect(page.rows.map((row) => row.registrationId)).toEqual([
        'registration-1',
        'registration-2',
      ]);
    });

    it('carries a code per row, so the button beside it can send one (F199)', async () => {
      registrations.expected = [expect1(), expect1({ id: 'registration-2' })];
      registrations.expectedTotal = 2;

      const page = await service.admissionList('event-1', {});

      for (const row of page.rows) expect(row.code).toHaveLength(26);
      // Two statements for a page, never one per row.
      expect(tickets.issueCalls).toHaveLength(1);
    });

    it('says who has arrived and who has not', async () => {
      registrations.expected = [expect1(), expect1({ id: 'registration-2' })];
      registrations.expectedTotal = 2;
      const before = await service.admissionList('event-1', {});
      await service.checkIn(before.rows[0].code, 'organizer-1');

      const after = await service.admissionList('event-1', {});

      expect(after.rows[0].checkedInAt).not.toBeNull();
      expect(after.rows[1].checkedInAt).toBeNull();
    });
  });

  describe('the door (E53, F199)', () => {
    const admit = async () => {
      const row = expect1();
      registrations.claimed = [row];
      registrations.claimedTotal = 1;
      return service.ticketByLink('a-signed-token');
    };

    it('records the admission and answers with the name', async () => {
      const ticket = await admit();

      const result = await service.checkIn(ticket.code, 'organizer-1');

      expect(result).toEqual({
        registrationId: 'registration-1',
        eventId: 'event-1',
        firstName: 'Amina',
        lastName: 'Okonkwo',
        checkedInAt: expect.any(String),
        alreadyCheckedIn: false,
      });
    });

    it('answers the second scan with the first instant, not an error', async () => {
      const ticket = await admit();
      const first = await service.checkIn(ticket.code, 'organizer-1');

      const second = await service.checkIn(ticket.code, 'organizer-2');

      expect(second.alreadyCheckedIn).toBe(true);
      // The instant somebody walked in, not the instant somebody looked again.
      expect(second.checkedInAt).toBe(first.checkedInAt);
    });

    it('reads a code that was typed with a space and the caps lock off', async () => {
      const ticket = await admit();

      const result = await service.checkIn(
        `  ${ticket.code.toLowerCase()} `,
        'organizer-1',
      );

      expect(result.alreadyCheckedIn).toBe(false);
    });

    it('is a 404 for a code that opens nothing', async () => {
      await expect(
        service.checkIn('NOTACODE', 'organizer-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('closes the door behind a cancellation', async () => {
      const ticket = await admit();
      // The row is only taken by an erasure, so the ticket outlives the
      // cancellation — the port stops answering for it, and that is the rule.
      registrations.known.delete('registration-1');

      await expect(
        service.checkIn(ticket.code, 'organizer-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});

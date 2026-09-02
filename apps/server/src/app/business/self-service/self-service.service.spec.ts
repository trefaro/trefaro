import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { PublicEvent, PublicProgramItem } from '@trefaro/shared-models';
import type { EventsService } from '../events';
import type { ProgramService, ProgramSignupsService } from '../program';
import type { ParticipantsService } from '../registration';
import type {
  RegistrationRecord,
  RegistrationRepository,
  RegistrationSlice,
  RegistrationsOfAddress,
} from '../registration/ports/registration.repository';
import { TokenSigner, selfServiceTokenTtlMs } from '../security';
import type { TrefaroEnv } from '../../core/config/env';
import { SelfServiceService, byAccount, byLink } from './self-service.service';

/**
 * "My registration" (E11) — the seam between a signed link and one registration.
 *
 * What is asserted here is only what this service decides itself: which links
 * are honoured, and what a cancellation does. The sign-up rules belong to
 * `ProgramSignupsService` and are tested there; a second set of assertions about
 * them here would be a second place to update when they change.
 */
const EVENT: PublicEvent = {
  id: 'event-1',
  slug: 'kickoff',
  name: 'Kickoff in Cologne',
  description: 'The event this registration is for.',
  logoUrl: null,
  eventType: 'onsite',
  startsAt: '2099-06-14T06:00:00.000Z',
  endsAt: '2099-06-14T16:00:00.000Z',
  timezone: 'Europe/Berlin',
  venueName: 'Bürgerhaus Kalk',
  venueAddress: null,
  onlineUrl: null,
  languages: ['de'],
  followUpBody: null,
};

const item = (id: string): PublicProgramItem => ({
  id,
  title: id,
  description: null,
  speaker: null,
  startsAt: '2099-06-14T07:00:00.000Z',
  endsAt: '2099-06-14T08:00:00.000Z',
  registrationEnabled: true,
  capacity: 12,
  signupCount: 1,
});

const CONFIRMED: RegistrationRecord = {
  id: 'registration-1',
  eventId: EVENT.id,
  email: 'amina@example.org',
  firstName: 'Amina',
  lastName: 'Okonkwo',
  phone: null,
  origin: null,
  status: 'confirmed',
  newsletterOptIn: false,
  contactOptOut: false,
  customFields: { meal: 'Vegan' },
  confirmedAt: new Date('2026-08-20T10:00:00.000Z'),
  createdAt: new Date('2026-08-20T09:00:00.000Z'),
  updatedAt: new Date('2026-08-20T10:00:00.000Z'),
};

describe('SelfServiceService', () => {
  let signer: TokenSigner;
  let rows: Map<string, RegistrationRecord>;
  let registrations: jest.Mocked<
    Pick<RegistrationRepository, 'findById' | 'searchByAddress'>
  >;
  /** What `listFor` asked the database, and what it was answered with. */
  let addressQueries: RegistrationsOfAddress[];
  let addressSlice: RegistrationSlice;
  let seats: Set<string>;
  let signups: {
    seatsOf: jest.Mock;
    signUp: jest.Mock;
    signOff: jest.Mock;
  };
  let participants: { setStatus: jest.Mock };
  /** Which event ids `listFor` resolved, per call — one call per page (F49). */
  const locatedIds: string[][] = [];
  let service: SelfServiceService;

  /** The claim a mailed link makes, for a registration that exists (E11). */
  const linkFor = (id = CONFIRMED.id) =>
    byLink(
      signer.sign(
        'registration-self-service',
        id,
        selfServiceTokenTtlMs(EVENT.endsAt),
      ),
    );

  /** The claim a session makes, for the address the registration carries (E31). */
  const accountFor = (email = CONFIRMED.email, id = CONFIRMED.id) =>
    byAccount(email, id);

  beforeEach(() => {
    signer = new TokenSigner({
      authSecret: 'a-test-secret-of-at-least-32-characters',
    } as TrefaroEnv);

    rows = new Map([[CONFIRMED.id, CONFIRMED]]);
    addressQueries = [];
    registrations = {
      findById: jest.fn(async (id: string) => rows.get(id) ?? null),
      searchByAddress: jest.fn(async (query: RegistrationsOfAddress) => {
        addressQueries.push(query);
        return addressSlice;
      }),
    };

    addressSlice = { rows: [], total: 0 };
    seats = new Set(['item-1']);
    signups = {
      seatsOf: jest.fn(async () => seats),
      signUp: jest.fn(async () => undefined),
      signOff: jest.fn(async (itemId: string) => {
        seats.delete(itemId);
      }),
    };

    locatedIds.length = 0;
    participants = {
      setStatus: jest.fn(async (id: string) => {
        const row = rows.get(id);
        if (row) rows.set(id, { ...row, status: 'cancelled' });
        return {};
      }),
    };

    service = new SelfServiceService(
      registrations as unknown as RegistrationRepository,
      {
        locate: jest.fn(async () => ({ event: EVENT, seriesSlug: 'series' })),
        locateMany: jest.fn(async (ids: readonly string[]) => {
          locatedIds.push([...ids]);
          return new Map(
            ids
              .filter((id) => id === EVENT.id)
              .map((id) => [id, { event: EVENT, seriesSlug: 'series' }]),
          );
        }),
      } as unknown as EventsService,
      {
        listForEvent: jest.fn(async () => [item('item-1'), item('item-2')]),
      } as unknown as ProgramService,
      signups as unknown as ProgramSignupsService,
      participants as unknown as ParticipantsService,
      signer,
    );
  });

  describe('view', () => {
    it('shows the registration, the event and the programme with their seats', async () => {
      const view = await service.view(linkFor());

      expect(view.email).toBe('amina@example.org');
      expect(view.customFields).toEqual({ meal: 'Vegan' });
      expect(view.seriesSlug).toBe('series');
      expect(view.event.name).toBe('Kickoff in Cologne');
      expect(view.program.map((entry) => entry.signedUp)).toEqual([
        true,
        false,
      ]);
    });

    it('reads the programme by event id, so an unpublished event still opens', async () => {
      // An organizer who takes an event back to draft while confirmations are in
      // people's inboxes must not turn those links into errors.
      await service.view(linkFor());

      expect(
        (service as unknown as { program: { listForEvent: jest.Mock } }).program
          .listForEvent,
      ).toHaveBeenCalledWith(EVENT.id, undefined);
    });

    it('carries the reader’s language into both lookups (FR 3.12)', async () => {
      await service.view(linkFor(), 'de');

      const inner = service as unknown as {
        program: { listForEvent: jest.Mock };
        events: { locate: jest.Mock };
      };
      expect(inner.program.listForEvent).toHaveBeenCalledWith(EVENT.id, 'de');
      expect(inner.events.locate).toHaveBeenCalledWith(EVENT.id, 'de');
    });

    it('refuses a token signed for confirming rather than for self-service', async () => {
      const confirmation = signer.sign(
        'registration-confirmation',
        CONFIRMED.id,
        60_000,
      );

      await expect(service.view(byLink(confirmation))).rejects.toThrow(
        BadRequestException,
      );
    });

    it('refuses an expired token', async () => {
      const expired = signer.sign(
        'registration-self-service',
        CONFIRMED.id,
        -1,
      );

      await expect(service.view(byLink(expired))).rejects.toThrow(
        BadRequestException,
      );
    });

    it('refuses garbage without saying which part was wrong', async () => {
      for (const token of ['', 'nonsense', 'a.b']) {
        await expect(service.view(byLink(token))).rejects.toThrow(
          BadRequestException,
        );
      }
    });

    it('answers a link whose registration has since been deleted the same way', async () => {
      // The same message as for a forged token: the difference is not the
      // holder's to learn, and it does not change what they can do about it.
      const link = linkFor('registration-gone');

      await expect(service.view(link)).rejects.toThrow(BadRequestException);
    });

    it('says a cancelled registration was cancelled', async () => {
      rows.set(CONFIRMED.id, { ...CONFIRMED, status: 'cancelled' });

      await expect(service.view(linkFor())).rejects.toThrow(/was cancelled/);
    });

    it('sends an unconfirmed registration back to the confirmation mail', async () => {
      rows.set(CONFIRMED.id, {
        ...CONFIRMED,
        status: 'pending',
        confirmedAt: null,
      });

      await expect(service.view(linkFor())).rejects.toThrow(ConflictException);
    });
  });

  describe('signUp and signOff', () => {
    it('passes the registration and its event to the programme rules', async () => {
      await service.signUp('item-2', linkFor());

      expect(signups.signUp).toHaveBeenCalledWith('item-2', {
        registrationId: CONFIRMED.id,
        eventId: EVENT.id,
      });
    });

    it('answers with the whole view, because a seat may have gone meanwhile', async () => {
      const view = await service.signOff('item-1', linkFor());

      expect(view.program.map((entry) => entry.signedUp)).toEqual([
        false,
        false,
      ]);
    });
  });

  describe('cancel', () => {
    it('cancels through the organizer’s own status rules (E14)', async () => {
      const view = await service.cancel(linkFor());

      // With `participant` as the actor, so no cancellation notice goes out:
      // the person is cancelling on their own page and reads the answer there
      // (F59).
      expect(participants.setStatus).toHaveBeenCalledWith(
        CONFIRMED.id,
        'cancelled',
        'participant',
      );
      expect(view.status).toBe('cancelled');
    });

    it('gives up every seat it held', async () => {
      // Somebody who is not coming is not coming to the workshop either, and
      // leaving those rows would keep a session full for a person who cancelled.
      await service.cancel(linkFor());

      expect(signups.signOff).toHaveBeenCalledWith('item-1', {
        registrationId: CONFIRMED.id,
        eventId: EVENT.id,
      });
    });
  });

  describe('view, by session (FR 4.7, E31)', () => {
    it('opens the same registration without a link', async () => {
      const view = await service.view(accountFor());

      // The whole point of AP 4: a logged-in participant needs no token, and
      // what they see is the same page.
      expect(view.email).toBe('amina@example.org');
      expect(view.program.map((entry) => entry.signedUp)).toEqual([
        true,
        false,
      ]);
    });

    it('compares the address without regard to case (E31)', async () => {
      const view = await service.view(accountFor('Amina@Example.ORG'));

      expect(view.email).toBe('amina@example.org');
    });

    it('answers 404 for a registration of somebody else', async () => {
      await expect(service.view(accountFor('ben@example.org'))).rejects.toThrow(
        NotFoundException,
      );
    });

    it('says the same thing for an id nothing matches', async () => {
      // Worded identically, so a logged-in participant cannot discover which
      // registrations exist by watching the difference.
      const foreign = service.view(accountFor('ben@example.org'));
      const unknown = service.view(
        accountFor(CONFIRMED.email, 'registration-404'),
      );

      await expect(foreign).rejects.toThrow(/no registration with that id/i);
      await expect(unknown).rejects.toThrow(/no registration with that id/i);
    });

    it('applies the same status rules as the link does', async () => {
      rows.set(CONFIRMED.id, { ...CONFIRMED, status: 'cancelled' });

      // One rule set for both claims: a second one would be a second place for
      // them to drift.
      await expect(service.view(accountFor())).rejects.toThrow(
        ConflictException,
      );
    });

    it('lets a session claim and give up a seat as well (FR 3.10)', async () => {
      await service.signUp('item-2', accountFor());
      const view = await service.signOff('item-1', accountFor());

      expect(signups.signUp).toHaveBeenCalledWith('item-2', {
        registrationId: CONFIRMED.id,
        eventId: EVENT.id,
      });
      expect(view.program.map((entry) => entry.signedUp)).toEqual([
        false,
        false,
      ]);
    });
  });

  describe('listFor', () => {
    const row = (
      id: string,
      overrides: Partial<RegistrationRecord> = {},
    ): RegistrationRecord => ({ ...CONFIRMED, id, ...overrides });

    it('asks for the address, the first page and the default size', async () => {
      await service.listFor('Amina@Example.org', {});

      expect(addressQueries).toEqual([
        { email: 'amina@example.org', offset: 0, limit: 10 },
      ]);
    });

    it('turns the page number into an offset and caps the size', async () => {
      await service.listFor(CONFIRMED.email, { page: 3, pageSize: 500 });

      expect(addressQueries[0].offset).toBe(2 * 50);
      expect(addressQueries[0].limit).toBe(50);
    });

    it('falls back to the first page for a page number that is not one', async () => {
      await service.listFor(CONFIRMED.email, { page: 0 });
      await service.listFor(CONFIRMED.email, { page: -2 });

      expect(addressQueries.map((query) => query.offset)).toEqual([0, 0]);
    });

    it('names every registration’s event in one lookup (F49)', async () => {
      addressSlice = {
        rows: [row('registration-1'), row('registration-2')],
        total: 2,
      };

      const page = await service.listFor(CONFIRMED.email, {});

      expect(locatedIds).toEqual([[EVENT.id, EVENT.id]]);
      expect(page.rows.map((entry) => entry.event.name)).toEqual([
        'Kickoff in Cologne',
        'Kickoff in Cologne',
      ]);
      expect(page.rows[0].seriesSlug).toBe('series');
    });

    it('lists every state, pending and cancelled included', async () => {
      addressSlice = {
        rows: [
          row('registration-1', { status: 'pending', confirmedAt: null }),
          row('registration-2', { status: 'cancelled' }),
        ],
        total: 2,
      };

      const page = await service.listFor(CONFIRMED.email, {});

      // Those two are exactly the states that make somebody ask "am I
      // registered?"; leaving them out would leave out the answer.
      expect(page.rows.map((entry) => entry.status)).toEqual([
        'pending',
        'cancelled',
      ]);
      expect(page.rows[0].confirmedAt).toBeNull();
    });

    it('reports the total the pages divide, not the size of this page', async () => {
      addressSlice = { rows: [row('registration-1')], total: 7 };

      const page = await service.listFor(CONFIRMED.email, { pageSize: 1 });

      expect(page).toMatchObject({ total: 7, page: 1, pageSize: 1 });
    });

    it('carries the reader’s language into the lookup (FR 3.12)', async () => {
      addressSlice = { rows: [row('registration-1')], total: 1 };

      await service.listFor(CONFIRMED.email, {}, 'de');

      const inner = service as unknown as {
        events: { locateMany: jest.Mock };
      };
      expect(inner.events.locateMany).toHaveBeenCalledWith([EVENT.id], 'de');
    });

    it('leaves out a row whose event is gone rather than refusing the page', async () => {
      addressSlice = {
        rows: [row('registration-1', { eventId: 'event-gone' })],
        total: 1,
      };

      const page = await service.listFor(CONFIRMED.email, {});

      expect(page.rows).toEqual([]);
      expect(page.total).toBe(1);
    });
  });
});

import { BadRequestException, ConflictException } from '@nestjs/common';
import type { PublicEvent, PublicProgramItem } from '@trefaro/shared-models';
import type { EventsService } from '../events';
import type { ProgramService, ProgramSignupsService } from '../program';
import type { ParticipantsService } from '../registration';
import type {
  RegistrationRecord,
  RegistrationRepository,
} from '../registration/ports/registration.repository';
import { TokenSigner, selfServiceTokenTtlMs } from '../security';
import type { TrefaroEnv } from '../../core/config/env';
import { SelfServiceService } from './self-service.service';

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
  let registrations: jest.Mocked<Pick<RegistrationRepository, 'findById'>>;
  let seats: Set<string>;
  let signups: {
    seatsOf: jest.Mock;
    signUp: jest.Mock;
    signOff: jest.Mock;
  };
  let participants: { setStatus: jest.Mock };
  let service: SelfServiceService;

  /** A link for a registration that exists and is confirmed. */
  const linkFor = (id = CONFIRMED.id): string =>
    signer.sign(
      'registration-self-service',
      id,
      selfServiceTokenTtlMs(EVENT.endsAt),
    );

  beforeEach(() => {
    signer = new TokenSigner({
      authSecret: 'a-test-secret-of-at-least-32-characters',
    } as TrefaroEnv);

    rows = new Map([[CONFIRMED.id, CONFIRMED]]);
    registrations = {
      findById: jest.fn(async (id: string) => rows.get(id) ?? null),
    };

    seats = new Set(['item-1']);
    signups = {
      seatsOf: jest.fn(async () => seats),
      signUp: jest.fn(async () => undefined),
      signOff: jest.fn(async (itemId: string) => {
        seats.delete(itemId);
      }),
    };

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
      ).toHaveBeenCalledWith(EVENT.id);
    });

    it('refuses a token signed for confirming rather than for self-service', async () => {
      const confirmation = signer.sign(
        'registration-confirmation',
        CONFIRMED.id,
        60_000,
      );

      await expect(service.view(confirmation)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('refuses an expired token', async () => {
      const expired = signer.sign(
        'registration-self-service',
        CONFIRMED.id,
        -1,
      );

      await expect(service.view(expired)).rejects.toThrow(BadRequestException);
    });

    it('refuses garbage without saying which part was wrong', async () => {
      for (const token of ['', 'nonsense', 'a.b']) {
        await expect(service.view(token)).rejects.toThrow(BadRequestException);
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
});

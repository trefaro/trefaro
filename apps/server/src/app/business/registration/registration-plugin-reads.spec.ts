import type { TrefaroEnv } from '../../core/config/env';
import type { ProfileDirectory } from '../common/ports/profile-directory.port';
import { TokenSigner } from '../security';
import type {
  RegistrationRecord,
  RegistrationRepository,
  RegistrationSearch,
  RegistrationSlice,
  RegistrationsOfAddress,
} from './ports/registration.repository';
import { RegistrationPluginReads } from './registration-plugin-reads';

/**
 * The core's side of the plug-in registration port (E53, E54, F148).
 *
 * Three things this adapter is responsible for, and each has a way of going
 * wrong that nothing else would catch:
 *
 * - **Only confirmed registrations leave.** A ticket for an unconfirmed one
 *   would be an admission granted by an unverified address; one for a cancelled
 *   one would open a door somebody gave up.
 * - **The two claims share one stretch of track** (F148), and neither is
 *   reachable with the other's input: a plug-in hands over a claim, not an
 *   address and not a token purpose.
 * - **No address leaves.** The account claim resolves one inside the adapter
 *   and hands out names, which is what keeps a plug-in from becoming a way
 *   around F55.
 */
const EVENT = '11111111-1111-4111-8111-111111111111';

function record(over: Partial<RegistrationRecord> = {}): RegistrationRecord {
  return {
    id: 'registration-1',
    eventId: EVENT,
    email: 'Amina@Example.org',
    firstName: 'Amina',
    lastName: 'Okonkwo',
    phone: '+49 221 1234',
    origin: 'Cologne',
    status: 'confirmed',
    newsletterOptIn: true,
    contactOptOut: false,
    customFields: { visa: 'X-4711' },
    confirmedAt: new Date('2099-06-01T09:00:00.000Z'),
    createdAt: new Date('2099-05-30T09:00:00.000Z'),
    updatedAt: new Date('2099-06-01T09:00:00.000Z'),
    ...over,
  };
}

class FakeRegistrations implements Pick<
  RegistrationRepository,
  'findById' | 'search' | 'searchByAddress'
> {
  rows: RegistrationRecord[] = [];
  readonly searches: RegistrationSearch[] = [];
  readonly addressQueries: RegistrationsOfAddress[] = [];

  async findById(id: string): Promise<RegistrationRecord | null> {
    return this.rows.find((row) => row.id === id) ?? null;
  }

  async search(query: RegistrationSearch): Promise<RegistrationSlice> {
    this.searches.push(query);
    const rows = this.rows.filter(
      (row) =>
        row.eventId === query.eventId &&
        (!query.status || row.status === query.status),
    );
    return { rows, total: rows.length };
  }

  async searchByAddress(
    query: RegistrationsOfAddress,
  ): Promise<RegistrationSlice> {
    this.addressQueries.push(query);
    const rows = this.rows.filter(
      (row) =>
        row.email.toLowerCase() === query.email &&
        (!query.status || row.status === query.status),
    );
    return { rows, total: rows.length };
  }
}

class FakeDirectory implements Pick<ProfileDirectory, 'addressOf'> {
  addresses = new Map<string, string>();
  readonly asked: string[] = [];

  async addressOf(participantId: string): Promise<string | null> {
    this.asked.push(participantId);
    return this.addresses.get(participantId) ?? null;
  }
}

describe('RegistrationPluginReads', () => {
  let registrations: FakeRegistrations;
  let directory: FakeDirectory;
  let signer: TokenSigner;
  let reads: RegistrationPluginReads;

  const FIRST_PAGE = { offset: 0, limit: 10 };

  beforeEach(() => {
    registrations = new FakeRegistrations();
    directory = new FakeDirectory();
    signer = new TokenSigner({
      authSecret: 'a-test-secret-of-at-least-32-characters',
    } as TrefaroEnv);
    reads = new RegistrationPluginReads(
      registrations as unknown as RegistrationRepository,
      directory as unknown as ProfileDirectory,
      signer,
    );
  });

  const linkTo = (id: string) =>
    signer.sign('registration-self-service', id, 60_000);

  describe('the link claim (E11, F44)', () => {
    it('resolves the registration the token speaks for', async () => {
      registrations.rows = [record()];

      const slice = await reads.resolveClaim(
        { kind: 'link', token: linkTo('registration-1') },
        FIRST_PAGE,
      );

      expect(slice).toEqual({
        rows: [
          {
            id: 'registration-1',
            eventId: EVENT,
            firstName: 'Amina',
            lastName: 'Okonkwo',
            confirmedAt: '2099-06-01T09:00:00.000Z',
          },
        ],
        total: 1,
      });
    });

    it('hands out no address, no telephone number and no form answers', async () => {
      registrations.rows = [record()];

      const slice = await reads.resolveClaim(
        { kind: 'link', token: linkTo('registration-1') },
        FIRST_PAGE,
      );

      // What the contract does not name, a plug-in must not receive (F55, F12).
      expect(Object.keys(slice.rows[0]).sort()).toEqual([
        'confirmedAt',
        'eventId',
        'firstName',
        'id',
        'lastName',
      ]);
    });

    it('is empty for a forged token, and never reaches the database', async () => {
      const slice = await reads.resolveClaim(
        { kind: 'link', token: 'not-a-token' },
        FIRST_PAGE,
      );

      expect(slice).toEqual({ rows: [], total: 0 });
    });

    it('is empty for a token of another purpose', async () => {
      registrations.rows = [record()];
      // A confirmation link cannot be replayed as a ticket lookup: the purpose
      // is inside the signature.
      const confirmation = signer.sign(
        'registration-confirmation',
        'registration-1',
        60_000,
      );

      const slice = await reads.resolveClaim(
        { kind: 'link', token: confirmation },
        FIRST_PAGE,
      );

      expect(slice.rows).toEqual([]);
    });

    it('is empty for a registration that is not confirmed', async () => {
      registrations.rows = [record({ status: 'pending', confirmedAt: null })];

      const slice = await reads.resolveClaim(
        { kind: 'link', token: linkTo('registration-1') },
        FIRST_PAGE,
      );

      expect(slice.rows).toEqual([]);
    });

    it('is empty for one that was cancelled', async () => {
      registrations.rows = [record({ status: 'cancelled' })];

      const slice = await reads.resolveClaim(
        { kind: 'link', token: linkTo('registration-1') },
        FIRST_PAGE,
      );

      expect(slice.rows).toEqual([]);
    });

    it('has nothing on the second page: a token speaks for one row', async () => {
      registrations.rows = [record()];

      const slice = await reads.resolveClaim(
        { kind: 'link', token: linkTo('registration-1') },
        { offset: 10, limit: 10 },
      );

      expect(slice).toEqual({ rows: [], total: 1 });
    });
  });

  describe('the account claim (E31, F148)', () => {
    it('resolves the address inside and asks for the confirmed rows', async () => {
      directory.addresses.set('participant-1', 'Amina@Example.org');
      registrations.rows = [
        record(),
        record({ id: 'registration-2', status: 'cancelled' }),
      ];

      const slice = await reads.resolveClaim(
        { kind: 'account', participantId: 'participant-1' },
        FIRST_PAGE,
      );

      expect(directory.asked).toEqual(['participant-1']);
      expect(registrations.addressQueries).toEqual([
        {
          email: 'amina@example.org',
          status: 'confirmed',
          offset: 0,
          limit: 10,
        },
      ]);
      expect(slice.rows.map((row) => row.id)).toEqual(['registration-1']);
    });

    it('is empty for an account the directory does not answer for', async () => {
      // Unknown, or confirmed nowhere: the directory's statement decides, and
      // this adapter asks nothing further.
      const slice = await reads.resolveClaim(
        { kind: 'account', participantId: 'nobody' },
        FIRST_PAGE,
      );

      expect(slice).toEqual({ rows: [], total: 0 });
      expect(registrations.addressQueries).toEqual([]);
    });
  });

  describe('one event, at the door', () => {
    it('asks for the confirmed registrations by name, with no search', async () => {
      registrations.rows = [
        record(),
        record({ id: 'registration-2', status: 'pending', confirmedAt: null }),
      ];

      const slice = await reads.findForEvent(EVENT, { offset: 25, limit: 25 });

      expect(registrations.searches).toEqual([
        {
          eventId: EVENT,
          terms: [],
          status: 'confirmed',
          sort: 'name',
          direction: 'asc',
          offset: 25,
          limit: 25,
        },
      ]);
      expect(slice.rows.map((row) => row.id)).toEqual(['registration-1']);
    });
  });

  describe('one id the plug-in already stored', () => {
    it('resolves it while the registration stands', async () => {
      registrations.rows = [record()];

      await expect(reads.findRegistration('registration-1')).resolves.toEqual(
        expect.objectContaining({ firstName: 'Amina', eventId: EVENT }),
      );
    });

    it('stops resolving it once the registration is cancelled', async () => {
      registrations.rows = [record({ status: 'cancelled' })];

      await expect(
        reads.findRegistration('registration-1'),
      ).resolves.toBeNull();
    });

    it('is null for an id nothing matches', async () => {
      await expect(reads.findRegistration('nowhere')).resolves.toBeNull();
    });
  });
});

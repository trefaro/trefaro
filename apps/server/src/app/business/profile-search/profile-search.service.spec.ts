import { NotFoundException } from '@nestjs/common';
import { ProfileSearchService } from './profile-search.service';
import type {
  SearchableProfileRecord,
  SearchableProfileRepository,
  SearchableProfileSearch,
  SearchableProfileSlice,
} from '../common/ports/searchable-profile.repository';

/**
 * The participant search (FR 4.4) — AP 5.
 *
 * Four claims, and the first one is the one the thesis cares about: a profile
 * that did not opt in appears nowhere, not in the list and not under its own id
 * (E37, F13). That rule lives in the repository's SQL, so what this level can
 * assert is the half above it — that a hidden profile is a 404 with the **same**
 * wording an unknown id gets, because anything else tells a logged-in reader
 * which ids exist (F124).
 *
 * The other three:
 *
 * - **Every word has to match** (F32, F126). What the service does is split the
 *   two boxes; that the words are `AND`-joined is the repository's business, and
 *   the contract suite proves it against PostgreSQL.
 * - **The reader is not in their own results.** Searching for oneself is noise,
 *   and it is excluded in the query rather than filtered afterwards — otherwise
 *   a page of twenty would sometimes be nineteen and the total would be wrong.
 * - **A row is not a profile.** The list carries no answers to the profile
 *   questions; twenty rows would otherwise carry four hundred of them to draw a
 *   list of names.
 */
const UPDATED = new Date('2026-09-02T10:00:00.000Z');

function record(
  overrides: Partial<SearchableProfileRecord> = {},
): SearchableProfileRecord {
  return {
    id: 'a1',
    firstName: 'Amina',
    lastName: 'Okonkwo',
    avatarPath: 'avatars/a1.png',
    activityAreas: 'Citizens’ assemblies',
    customFields: { 'local-group': 'Cologne', newsletter: true },
    updatedAt: UPDATED,
    ...overrides,
  };
}

interface Harness {
  service: ProfileSearchService;
  asked: SearchableProfileSearch[];
  visible: Map<string, SearchableProfileRecord>;
}

function harness(
  options: {
    slice?: SearchableProfileSlice;
    visible?: readonly SearchableProfileRecord[];
  } = {},
): Harness {
  const asked: SearchableProfileSearch[] = [];
  const visible = new Map(
    (options.visible ?? []).map((profile) => [profile.id, profile]),
  );

  const repository: SearchableProfileRepository = {
    async search(query) {
      asked.push(query);
      return options.slice ?? { rows: [], total: 0 };
    },
    async findVisible(id) {
      return visible.get(id) ?? null;
    },
  };

  return { service: new ProfileSearchService(repository), asked, visible };
}

describe('ProfileSearchService', () => {
  describe('the list', () => {
    it('splits both boxes into words and leaves the reader out', async () => {
      const { service, asked } = harness();

      await service.search('me', {
        search: '  Amina   OKONKWO ',
        activityAreas: 'Election Observation',
      });

      expect(asked).toEqual([
        {
          terms: ['amina', 'okonkwo'],
          activityTerms: ['election', 'observation'],
          excludeId: 'me',
          offset: 0,
          limit: 20,
        },
      ]);
    });

    it('asks for everything findable when both boxes are empty', async () => {
      const { service, asked } = harness();

      await service.search('me', {});

      // A directory that only answers a query is a directory nobody browses.
      expect(asked[0]).toMatchObject({ terms: [], activityTerms: [] });
    });

    it('turns a page into an offset and caps what a client may ask for', async () => {
      const { service, asked } = harness();

      await service.search('me', { page: 3, pageSize: 5 });
      await service.search('me', { page: 1, pageSize: 5000 });
      // Nonsense rather than a page: a zeroth page and a page of no rows are
      // the two values a hand-written URL produces, and neither is a smaller
      // request — so both fall back to the default.
      await service.search('me', { page: 0, pageSize: 0 });

      expect(asked.map((query) => [query.offset, query.limit])).toEqual([
        [10, 5],
        [0, 50],
        [0, 20],
      ]);
    });

    it('reports the page it actually used, not the one that was asked for', async () => {
      const { service } = harness({ slice: { rows: [record()], total: 41 } });

      const page = await service.search('me', { page: 2, pageSize: 100 });

      expect(page).toMatchObject({ total: 41, page: 2, pageSize: 50 });
    });

    it('builds the avatar URL and carries no stored path', async () => {
      const { service } = harness({ slice: { rows: [record()], total: 1 } });

      const [row] = (await service.search('me', {})).rows;

      expect(row.avatarUrl).toBe(
        `/api/media/profiles/a1/avatar?v=${UPDATED.getTime()}`,
      );
      expect(JSON.stringify(row)).not.toContain('avatars/');
    });

    it('says a profile has no picture rather than inventing a URL', async () => {
      const { service } = harness({
        slice: { rows: [record({ avatarPath: null })], total: 1 },
      });

      expect((await service.search('me', {})).rows[0].avatarUrl).toBeNull();
    });

    it('leaves the answers out of a row', async () => {
      const { service } = harness({ slice: { rows: [record()], total: 1 } });

      const [row] = (await service.search('me', {})).rows;

      expect(row).not.toHaveProperty('customFields');
      // Nor the address: a community search that handed out mailboxes would be
      // an export of the community (F55).
      expect(row).not.toHaveProperty('email');
      expect(Object.keys(row).sort()).toEqual([
        'activityAreas',
        'avatarUrl',
        'firstName',
        'id',
        'lastName',
      ]);
    });
  });

  describe('one profile', () => {
    it('answers with the answers as well — that is what makes it a profile', async () => {
      const { service } = harness({ visible: [record()] });

      const profile = await service.get('a1');

      expect(profile).toEqual({
        id: 'a1',
        firstName: 'Amina',
        lastName: 'Okonkwo',
        avatarUrl: `/api/media/profiles/a1/avatar?v=${UPDATED.getTime()}`,
        activityAreas: 'Citizens’ assemblies',
        customFields: { 'local-group': 'Cologne', newsletter: true },
      });
    });

    it('is a 404 for a profile that does not show itself', async () => {
      // The repository answers `null` for an unknown id, an unconfirmed account
      // and a profile without the opt-in alike, and this level must not tell
      // them apart either.
      const { service } = harness({ visible: [] });

      await expect(service.get('hidden')).rejects.toThrow(NotFoundException);
    });

    it('says the same thing about a hidden profile and an unknown id', async () => {
      const { service } = harness({ visible: [record({ id: 'shown' })] });
      // Both well-formed: a malformed id never reaches this service (the route
      // has a `ParseUUIDPipe` in front of it, and a 400 there says nothing
      // about who exists). What has to be indistinguishable is a real id that
      // is hidden from a real id that is nobody's.

      const message = async (id: string): Promise<string> => {
        try {
          await service.get(id);
          return 'no error at all';
        } catch (error: unknown) {
          return (error as Error).message;
        }
      };

      // Word for word: a different sentence for "exists but hidden" would let
      // a logged-in reader enumerate the accounts of the instance.
      expect(await message('hidden')).toBe(await message('nobodys-id'));
      expect(await message('hidden')).not.toBe('no error at all');
    });

    it('does not make an exception for the reader themselves', async () => {
      // The rule is about the profile, not about who is reading: somebody who
      // opted in can open their own entry, and somebody who did not gets the
      // same 404 as everybody else. The list is where the reader is skipped —
      // searching for oneself is noise, being unable to open oneself is a bug.
      const { service } = harness({ visible: [record({ id: 'me' })] });

      expect((await service.get('me')).id).toBe('me');
    });
  });
});

import type {
  ProfileNameRecord,
  ProfileNameRepository,
} from './ports/profile-name.repository';
import { ProfilePluginReads } from './profile-plugin-reads';

/**
 * The core's side of the plug-in participant port (E58, F55).
 *
 * Three things are worth a test here, and all three are about what a plug-in
 * does **not** get: no address, a picture as a URL rather than a stored path,
 * and an absent id rather than an invented author.
 */
describe('ProfilePluginReads', () => {
  const row = (over: Partial<ProfileNameRecord> = {}): ProfileNameRecord => ({
    id: 'profile-1',
    firstName: 'Amina',
    lastName: 'Okonkwo',
    avatarPath: null,
    updatedAt: new Date('2026-09-07T10:00:00.000Z'),
    ...over,
  });

  function reads(...rows: readonly ProfileNameRecord[]): ProfilePluginReads {
    const profiles: ProfileNameRepository = {
      findNames: (ids) =>
        Promise.resolve(
          new Map(
            rows
              .filter((one) => ids.includes(one.id))
              .map((one) => [one.id, one]),
          ),
        ),
    };
    return new ProfilePluginReads(profiles);
  }

  it('answers a name a plug-in can print, and nothing else about the person', async () => {
    const authors = await reads(row()).findAuthors(['profile-1']);

    expect([...authors.values()]).toEqual([
      { id: 'profile-1', name: 'Amina Okonkwo', avatarUrl: null },
    ]);
  });

  it('hands out the picture as an address, never as a stored path (F124)', async () => {
    const authors = await reads(
      row({ avatarPath: 'avatars/pr/profile-1.png' }),
    ).findAuthors(['profile-1']);

    // The media route plus the row's `updatedAt` as the cache key — the same
    // URL the profile endpoints answer with, built by the same function.
    expect(authors.get('profile-1')?.avatarUrl).toBe(
      '/api/media/profiles/profile-1/avatar?v=1788775200000',
    );
  });

  it('leaves an id it cannot resolve out of the answer', async () => {
    const authors = await reads(row()).findAuthors(['profile-1', 'gone']);

    // Absent rather than a placeholder author: a caller that skips the row is
    // doing the honest thing, and there is nothing truthful to invent.
    expect([...authors.keys()]).toEqual(['profile-1']);
  });

  it('asks once for a whole list (F49)', async () => {
    const asked: string[][] = [];
    const profiles: ProfileNameRepository = {
      findNames: (ids) => {
        asked.push([...ids]);
        return Promise.resolve(new Map());
      },
    };

    await new ProfilePluginReads(profiles).findAuthors(['a', 'b', 'c']);

    expect(asked).toEqual([['a', 'b', 'c']]);
  });
});

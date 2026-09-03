import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type {
  SearchableProfileRecord,
  SearchableProfileRepository,
} from '../common/ports/searchable-profile.repository';
import { ChatRealtimeService } from './chat-realtime.service';
import {
  ConversationsService,
  NO_SUCH_CONVERSATION,
} from './conversations.service';
import type {
  ConversationMemberRef,
  ConversationMembershipRecord,
  ConversationOverviewRecord,
  ConversationRecord,
  ConversationRepository,
  ConversationSlice,
} from './ports/conversation.repository';

/**
 * Conversations (FR 4.5) — AP 6.
 *
 * Four claims, and the first two are the access rule of the whole chat:
 *
 * - **A profile that cannot be found cannot be written to** (E37, F13), and
 *   every refusal says the same thing — an unknown id, an unconfirmed account
 *   and a withdrawn opt-in are one 403. Whoever could tell them apart could
 *   enumerate the accounts of an instance (F124).
 * - **Afterwards only membership counts.** A conversation somebody is not in
 *   answers 404 with the wording an unknown id gets, and nothing here asks
 *   about `searchable` a second time: a running conversation stays readable
 *   after its other side withdraws (E14).
 * - **Two people have one conversation.** Pressing the button twice is one
 *   conversation, and the answer is read back the way the overview reads it
 *   rather than assembled from what happens to be at hand — an existing
 *   conversation may have unread messages in it.
 * - **Unread is a number that arrives, not one that is computed here** (E38):
 *   what this level can assert is that the service passes it through and never
 *   invents a zero.
 * - **A read receipt goes out after the write and carries the same instant**
 *   (E41). A receipt for a timestamp the database refused would clear a badge
 *   that comes back on the next reload.
 */
const LAST = new Date('2026-09-02T09:00:00.000Z');
const UPDATED = new Date('2026-09-01T08:00:00.000Z');

const ME = 'me-0000';
const OTHER = 'other-111';

function conversation(
  overrides: Partial<ConversationRecord> = {},
): ConversationRecord {
  return {
    id: 'c1',
    type: 'direct',
    eventId: null,
    topic: null,
    guestEmail: null,
    guestName: null,
    lastMessageAt: LAST,
    ...overrides,
  };
}

function overview(
  overrides: Partial<ConversationOverviewRecord> = {},
): ConversationOverviewRecord {
  return {
    conversation: conversation(),
    counterparts: [
      {
        id: OTHER,
        firstName: 'Amina',
        lastName: 'Okonkwo',
        avatarPath: 'avatars/other.png',
        updatedAt: UPDATED,
      },
    ],
    unread: 3,
    ...overrides,
  };
}

function profile(
  overrides: Partial<SearchableProfileRecord> = {},
): SearchableProfileRecord {
  return {
    id: OTHER,
    firstName: 'Amina',
    lastName: 'Okonkwo',
    avatarPath: null,
    activityAreas: null,
    customFields: {},
    updatedAt: UPDATED,
    ...overrides,
  };
}

interface Harness {
  service: ConversationsService;
  /** Every pair `findOrCreateDirect` was asked for, in order. */
  created: readonly [string, string][];
  listed: { member: ConversationMemberRef; offset: number; limit: number }[];
  /** Every single-conversation read, with who asked for it. */
  viewed: { conversationId: string; member: ConversationMemberRef }[];
  marked: { conversationId: string; at: Date }[];
  /** Every read receipt that went out (E41). */
  published: { conversationId: string; memberId: string; at: Date }[];
}

function harness(
  options: {
    visible?: readonly SearchableProfileRecord[];
    overviews?: readonly ConversationOverviewRecord[];
    membership?: ConversationMembershipRecord | null;
    slice?: ConversationSlice;
    marks?: boolean;
  } = {},
): Harness {
  const created: [string, string][] = [];
  const listed: Harness['listed'] = [];
  const viewed: Harness['viewed'] = [];
  const marked: Harness['marked'] = [];
  const overviews = options.overviews ?? [overview()];

  const conversations: ConversationRepository = {
    async findOrCreateDirect(first, second) {
      created.push([first, second]);
      return conversation();
    },
    // Not this service's method: a contact request has no viewer, so it is
    // `OrganizerContactService` that calls it (AP 9). Present because the port
    // is one interface, and left throwing so a call from here is a failure
    // rather than a silent success.
    async createOrganizerContact() {
      throw new Error('A conversation of a guest is not opened from here.');
    },
    async listFor(member, offset, limit) {
      listed.push({ member, offset, limit });
      return options.slice ?? { rows: overviews, total: overviews.length };
    },
    async overviewFor(conversationId, member) {
      viewed.push({ conversationId, member });
      return (
        overviews.find((row) => row.conversation.id === conversationId) ?? null
      );
    },
    async findMembership() {
      return options.membership === undefined
        ? { conversation: conversation(), lastReadAt: null }
        : options.membership;
    },
    async markRead(conversationId, _member, at) {
      marked.push({ conversationId, at });
      return options.marks ?? true;
    },
  };

  const profiles: SearchableProfileRepository = {
    async search() {
      throw new Error('the chat does not search');
    },
    async findVisible(id) {
      return (
        (options.visible ?? [profile()]).find((row) => row.id === id) ?? null
      );
    },
  };

  const published: Harness['published'] = [];
  const realtime = {
    publishRead(
      conversationId: string,
      member: ConversationMemberRef,
      at: Date,
    ) {
      published.push({ conversationId, memberId: member.memberId, at });
    },
  } as unknown as ChatRealtimeService;

  return {
    service: new ConversationsService(conversations, profiles, realtime),
    created,
    listed,
    viewed,
    marked,
    published,
  };
}

/** The message of whatever the call threw, without asserting on a class twice. */
async function refusal(call: Promise<unknown>): Promise<string> {
  try {
    await call;
    return 'nothing was thrown';
  } catch (error: unknown) {
    return (error as Error).message;
  }
}

describe('ConversationsService', () => {
  describe('opening a conversation (E37)', () => {
    it('opens one with a profile the search shows', async () => {
      const { service, created } = harness();

      const summary = await service.start(ME, OTHER);

      expect(created).toEqual([[ME, OTHER]]);
      expect(summary).toMatchObject({
        id: 'c1',
        type: 'direct',
        unread: 3,
      });
      expect(summary.counterparts).toEqual([
        {
          profileId: OTHER,
          name: 'Amina Okonkwo',
          // The media route built from the id and the row's timestamp (F124),
          // never the stored path.
          avatarUrl: `/api/media/profiles/${OTHER}/avatar?v=${UPDATED.getTime()}`,
        },
      ]);
    });

    it('refuses a profile that is not in the search', async () => {
      const { service, created } = harness({ visible: [] });

      await expect(service.start(ME, OTHER)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      // And nothing was written: a refused request leaves no conversation
      // behind for the other person to find.
      expect(created).toEqual([]);
    });

    it('says the same thing for a hidden profile and an unknown id (F124)', async () => {
      const hidden = harness({ visible: [] });
      const unknown = harness({ visible: [profile({ id: 'somebody-else' })] });

      expect(await refusal(hidden.service.start(ME, OTHER))).toBe(
        await refusal(unknown.service.start(ME, OTHER)),
      );
    });

    it('refuses one’s own id, and says why', async () => {
      const { service } = harness();

      // A 400 rather than the 403: the asker knows their own id, so there is
      // nothing to hide, and a client sending it has a bug worth naming.
      await expect(service.start(ME, ME)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(await refusal(service.start(ME, ME))).toContain('two sides');
    });

    it('answers with the conversation’s real unread count, not a zero', async () => {
      // Pressing "write to this person" on somebody who already wrote must not
      // report an empty conversation just because this request created nothing.
      const { service } = harness({
        overviews: [overview({ unread: 7 })],
      });

      expect((await service.start(ME, OTHER)).unread).toBe(7);
    });
  });

  describe('one conversation (AP 8)', () => {
    it('answers with the row the overview draws', async () => {
      const { service } = harness({ overviews: [overview({ unread: 4 })] });

      // The same shape as a row of the list, for one id: a thread screen has
      // to be able to say whose conversation it is showing.
      await expect(service.get(ME, 'c1')).resolves.toMatchObject({
        id: 'c1',
        unread: 4,
      });
    });

    it('asks the port as the reader, not for the row alone', async () => {
      const { service, viewed } = harness();

      await service.get(ME, 'c1');

      // The membership is part of the question at the port already, so there
      // is no "read this conversation" that a caller could ask without one.
      expect(viewed.at(-1)).toEqual({
        conversationId: 'c1',
        member: { memberType: 'user', memberId: ME },
      });
    });

    it('says the same thing for a conversation that is not the reader’s as for an unknown id', async () => {
      const { service } = harness({ overviews: [] });

      await expect(service.get(ME, 'somebody-elses')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      // Word for word what `require` says (F157): a reader who could tell the
      // two apart could confirm that somebody else's conversation exists.
      expect(await refusal(service.get(ME, 'somebody-elses'))).toBe(
        NO_SUCH_CONVERSATION,
      );
    });
  });

  describe('the overview (E38)', () => {
    it('asks for the reader’s own window and reports what it used', async () => {
      const { service, listed } = harness();

      const page = await service.list(ME, { page: 3, pageSize: 5 });

      expect(listed).toEqual([
        {
          member: { memberType: 'user', memberId: ME },
          offset: 10,
          limit: 5,
        },
      ]);
      expect(page).toMatchObject({ page: 3, pageSize: 5, total: 1 });
    });

    it('caps the page size', async () => {
      const { service, listed } = harness();

      const page = await service.list(ME, { pageSize: 1000 });

      expect(listed[0].limit).toBe(50);
      expect(page.pageSize).toBe(50);
    });

    it('carries a conversation nobody has written in yet', async () => {
      const { service } = harness({
        overviews: [
          overview({
            conversation: conversation({ lastMessageAt: null }),
            unread: 0,
          }),
        ],
      });

      expect((await service.list(ME, {})).rows[0]).toMatchObject({
        lastMessageAt: null,
        unread: 0,
      });
    });

    it('formats the last message as an instant', async () => {
      const { service } = harness();

      expect((await service.list(ME, {})).rows[0].lastMessageAt).toBe(
        LAST.toISOString(),
      );
    });
  });

  describe('membership', () => {
    it('hands back the membership of a conversation that is the reader’s', async () => {
      const { service } = harness();

      await expect(service.require(ME, 'c1')).resolves.toMatchObject({
        lastReadAt: null,
      });
    });

    it('answers 404 for a conversation that is not', async () => {
      const { service } = harness({ membership: null });

      await expect(service.require(ME, 'c1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('does not throw where a caller has its own wording', async () => {
      // The route that serves a message's picture says "no such picture" for
      // all three of its failures, so it asks without the exception.
      const { service } = harness({ membership: null });

      await expect(service.membershipOf(ME, 'c1')).resolves.toBeNull();
    });
  });

  describe('marking as read (E38)', () => {
    it('moves the reader’s own timestamp to now', async () => {
      const { service, marked } = harness();
      const before = Date.now();

      await service.markRead(ME, 'c1');

      expect(marked).toHaveLength(1);
      expect(marked[0].conversationId).toBe('c1');
      expect(marked[0].at.getTime()).toBeGreaterThanOrEqual(before);
    });

    it('answers 404 when there was no membership to move', async () => {
      const { service } = harness({ marks: false });

      await expect(service.markRead(ME, 'c1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('tells the conversation about it, with the timestamp it wrote', async () => {
      const { service, marked, published } = harness();

      await service.markRead(ME, 'c1');

      // The same instant, not a second `new Date()`: a receipt for a moment
      // that was not stored would put the badge back on the next reload (E41).
      expect(published).toEqual([
        { conversationId: 'c1', memberId: ME, at: marked[0].at },
      ]);
    });

    it('says nothing when there was nothing to move', async () => {
      const { service, published } = harness({ marks: false });

      await expect(service.markRead(ME, 'c1')).rejects.toThrow();

      expect(published).toEqual([]);
    });
  });
});

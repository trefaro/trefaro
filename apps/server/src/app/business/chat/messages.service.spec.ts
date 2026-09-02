import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MAX_MESSAGE_LENGTH } from '@trefaro/shared-models';
import type {
  ImageArea,
  ImageBytes,
  ImageFileService,
  ImageUpload,
} from '../common/image-file.service';
import type { ConversationsService } from './conversations.service';
import { MessagesService, type MessageImageUpload } from './messages.service';
import type {
  MessageImageRecord,
  MessageRecord,
  MessageRepository,
  NewMessage,
} from './ports/message.repository';

/**
 * Messages (FR 4.5, E40) — AP 6.
 *
 * Five claims:
 *
 * - **Text, picture or both — never nothing.** Refused with a sentence before
 *   the `CHECK` has to, and a body of spaces is nothing.
 * - **A non-member gets neither the history nor the picture**, and the picture
 *   route says the same thing for three different failures: no such message, a
 *   message without one, and a message in somebody else's conversation.
 * - **The bytes go away again when the row fails.** There is no transaction
 *   across PostgreSQL and a filesystem, so a failed append must not leave a
 *   file the volume will hold forever.
 * - **The window reads one row more than it hands out**, which is what turns
 *   "is there anything older" into an answer without a second query.
 * - **The picture is addressed by the message**, and a message without one has
 *   no address at all.
 */
const CREATED = new Date('2026-09-02T10:15:00.000Z');
const ME = 'me-0000';

function record(overrides: Partial<MessageRecord> = {}): MessageRecord {
  return {
    id: 'm1',
    conversationId: 'c1',
    senderType: 'user',
    senderId: ME,
    body: 'Hello',
    hasImage: false,
    createdAt: CREATED,
    ...overrides,
  };
}

const upload = (bytes = 'png-bytes'): MessageImageUpload => ({
  mimeType: 'image/png',
  bytes: Buffer.from(bytes),
  fileName: 'assembly.png',
});

interface Harness {
  service: MessagesService;
  appended: NewMessage[];
  stored: { area: ImageArea; upload: ImageUpload }[];
  discarded: readonly (string | null)[][];
  asked: { conversationId: string; before: string | null; limit: number }[];
}

function harness(
  options: {
    /** `null` makes every membership check fail — the non-member's view. */
    member?: boolean;
    history?: readonly MessageRecord[];
    image?: MessageImageRecord | null;
    bytes?: ImageBytes | null;
    appendFails?: boolean;
  } = {},
): Harness {
  const appended: NewMessage[] = [];
  const stored: Harness['stored'] = [];
  const discarded: (string | null)[][] = [];
  const asked: Harness['asked'] = [];
  const isMember = options.member ?? true;

  const conversations = {
    async require(_viewerId: string, conversationId: string) {
      if (!isMember)
        throw new NotFoundException('No conversation of that id is yours.');
      return { conversation: { id: conversationId }, lastReadAt: null };
    },
    async membershipOf(_viewerId: string, conversationId: string) {
      return isMember
        ? { conversation: { id: conversationId }, lastReadAt: null }
        : null;
    },
  } as unknown as ConversationsService;

  const images = {
    async store(area: ImageArea, image: ImageUpload) {
      stored.push({ area, upload: image });
      return `${area}/ab/stored-file`;
    },
    async discard(paths: readonly (string | null)[]) {
      discarded.push([...paths]);
    },
    async read() {
      return options.bytes === undefined
        ? { mimeType: 'image/png', bytes: Buffer.from('png-bytes') }
        : options.bytes;
    },
  } as unknown as ImageFileService;

  const messages: MessageRepository = {
    async append(message) {
      appended.push(message);
      if (options.appendFails) throw new Error('the conversation is gone');
      return record({
        body: message.body,
        hasImage: message.image !== null,
      });
    },
    async history(conversationId, before, limit) {
      asked.push({ conversationId, before, limit });
      return (options.history ?? [record()]).slice(0, limit);
    },
    async findImage() {
      return options.image === undefined
        ? { conversationId: 'c1', path: 'messages/ab/stored-file' }
        : options.image;
    },
  };

  return {
    service: new MessagesService(conversations, images, messages),
    appended,
    stored,
    discarded,
    asked,
  };
}

async function refusal(call: Promise<unknown>): Promise<string> {
  try {
    await call;
    return 'nothing was thrown';
  } catch (error: unknown) {
    return (error as Error).message;
  }
}

describe('MessagesService', () => {
  describe('sending (E40)', () => {
    it('writes a message of text alone', async () => {
      const { service, appended, stored } = harness();

      const message = await service.send(ME, 'c1', { body: '  Hello  ' }, null);

      expect(appended).toEqual([
        {
          conversationId: 'c1',
          senderType: 'user',
          senderId: ME,
          body: 'Hello',
          image: null,
        },
      ]);
      expect(stored).toEqual([]);
      expect(message).toMatchObject({ body: 'Hello', imageUrl: null });
    });

    it('writes a message of a picture alone, with no body at all', async () => {
      const { service, appended, stored } = harness();

      const message = await service.send(ME, 'c1', {}, upload());

      // `null`, never an empty string: the column says NULL or something.
      expect(appended[0].body).toBeNull();
      expect(appended[0].image).toEqual({
        path: 'messages/ab/stored-file',
        fileName: 'assembly.png',
        mimeType: 'image/png',
        sizeBytes: 9,
      });
      // Its own subtree, never `attachments/` (E19, E40).
      expect(stored[0].area).toBe('messages');
      expect(message.imageUrl).toBe('/api/media/messages/m1/attachment');
    });

    it('refuses a message that is neither', async () => {
      const { service, appended } = harness();

      await expect(service.send(ME, 'c1', {}, null)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      // And a body of spaces is nothing.
      expect(
        await refusal(service.send(ME, 'c1', { body: '   ' }, null)),
      ).toContain('needs text');
      expect(appended).toEqual([]);
    });

    it('refuses a body past the maximum', async () => {
      const { service, appended } = harness();

      const long = 'x'.repeat(MAX_MESSAGE_LENGTH + 1);

      await expect(
        service.send(ME, 'c1', { body: long }, null),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(appended).toEqual([]);
    });

    it('refuses to write into a conversation that is not the sender’s', async () => {
      const { service, appended, stored } = harness({ member: false });

      await expect(
        service.send(ME, 'c1', { body: 'Hello' }, upload()),
      ).rejects.toBeInstanceOf(NotFoundException);
      // Membership first, so a refused message stores no bytes either.
      expect(stored).toEqual([]);
      expect(appended).toEqual([]);
    });

    it('removes the stored bytes when the row fails', async () => {
      const { service, discarded } = harness({ appendFails: true });

      await expect(service.send(ME, 'c1', {}, upload())).rejects.toBeInstanceOf(
        Error,
      );

      // Compensation, not a rollback: what this request wrote goes away again.
      expect(discarded).toEqual([['messages/ab/stored-file']]);
    });
  });

  describe('the history', () => {
    it('reads one row more than it hands out and reports nothing older', async () => {
      const { service, asked } = harness({ history: [record()] });

      const window = await service.history(ME, 'c1', { pageSize: 2 });

      expect(asked).toEqual([{ conversationId: 'c1', before: null, limit: 3 }]);
      expect(window.rows).toHaveLength(1);
      expect(window.hasMore).toBe(false);
    });

    it('reports that something older exists, and hands out only the window', async () => {
      const { service } = harness({
        history: [
          record({ id: 'm3' }),
          record({ id: 'm2' }),
          record({ id: 'm1' }),
        ],
      });

      const window = await service.history(ME, 'c1', { pageSize: 2 });

      expect(window.rows.map((row) => row.id)).toEqual(['m3', 'm2']);
      expect(window.hasMore).toBe(true);
    });

    it('passes the cursor through', async () => {
      const { service, asked } = harness();

      await service.history(ME, 'c1', { before: 'm9' });

      expect(asked[0].before).toBe('m9');
      // The default window, and the cap is the helper's business.
      expect(asked[0].limit).toBe(31);
    });

    it('refuses a conversation that is not the reader’s', async () => {
      const { service, asked } = harness({ member: false });

      await expect(service.history(ME, 'c1', {})).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(asked).toEqual([]);
    });
  });

  describe('the picture of a message', () => {
    it('hands the bytes to a member', async () => {
      const { service } = harness();

      await expect(service.readImage(ME, 'm1')).resolves.toMatchObject({
        mimeType: 'image/png',
      });
    });

    it('says the same thing for an unknown message, one without a picture, and somebody else’s', async () => {
      const unknown = harness({ image: null });
      const outsider = harness({ member: false });
      const gone = harness({ bytes: null });

      const said = await refusal(unknown.service.readImage(ME, 'm1'));

      expect(said).toBe(await refusal(outsider.service.readImage(ME, 'm1')));
      // And a volume that no longer holds what the row names looks the same
      // from outside — it is an operator's problem, not the caller's.
      expect(said).toBe(await refusal(gone.service.readImage(ME, 'm1')));
    });

    it('answers 404 rather than the conversation’s own wording', async () => {
      // The two must not be distinguishable: "that conversation is not yours"
      // on a picture route would be a way to ask whether a message exists.
      const outsider = harness({ member: false });

      await expect(outsider.service.readImage(ME, 'm1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(await refusal(outsider.service.readImage(ME, 'm1'))).not.toContain(
        'conversation',
      );
    });
  });
});

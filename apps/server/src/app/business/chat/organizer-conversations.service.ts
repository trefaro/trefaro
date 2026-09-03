import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  DEFAULT_MESSAGE_PAGE_SIZE,
  DEFAULT_ORGANIZER_CONVERSATION_PAGE_SIZE,
  MAX_GROUP_MEMBERS,
  MAX_GROUP_TOPIC_LENGTH,
  MAX_MESSAGE_LENGTH,
  MAX_MESSAGE_PAGE_SIZE,
  MAX_ORGANIZER_CONVERSATION_PAGE_SIZE,
  invitationParagraphs,
  type ChatMessage,
  type ConversationCounterpart,
  type ConversationEventRef,
  type GroupCandidate,
  type MessageHistory,
  type MessageHistoryQuery,
  type NewGroupRequest,
  type OrganizerConversationDetail,
  type OrganizerConversationPage,
  type OrganizerConversationQuery,
  type OrganizerConversationSummary,
  type OrganizerReply,
  type ReplyDelivery,
  type SendMessageInput,
} from '@trefaro/shared-models';
import type { ImageBytes } from '../common/image-file.service';
import { ImageFileService } from '../common/image-file.service';
import { pageWindow } from '../common/page-window';
import { EventsService, type EventLocation } from '../events';
import { MailDeliveryError, MailService, PublicLinks } from '../mail';
import type { ContactAnswerMailContext, MailEvent } from '../mail';
import { avatarUrl } from '../profiles';
import { ChatNotificationsService } from './chat-notifications.service';
import { ChatRealtimeService } from './chat-realtime.service';
import { messageImageUrl } from './message-image-url';
import {
  MESSAGE_REPOSITORY,
  type MessageRecord,
  type MessageRepository,
} from './ports/message.repository';
import {
  ORGANIZER_CONVERSATION_REPOSITORY,
  type OrganizerConversationRecord,
  type OrganizerConversationRepository,
} from './ports/organizer-conversation.repository';
import type { ConversationCounterpartRecord } from './ports/conversation.repository';

/**
 * What every conversation the organization is not part of says.
 *
 * One sentence for two states — no such id, and two participants' private
 * conversation — because the second must not be distinguishable from the
 * first. An organizer administers the instance; they do not read what
 * participants write to each other (E37, F173), and an id they may not read is
 * an id they must not be able to confirm.
 */
export const NOT_THE_ORGANIZATION_S =
  'No conversation of that id belongs to the organization.';

/** Said the same way wherever a message's picture cannot be served. */
const NO_SUCH_IMAGE = 'No picture of that message exists here.';

/**
 * The organization's message overview (FR 3.4, UC 14 — E39, F133).
 *
 * The mail-program-like screen FR 3.4 asks for, from the server's side. Four
 * decisions carry it:
 *
 * 1. **Whose it is, is the kind of the conversation.** There is no membership
 *    row for the organization (F133), so nothing here asks "is the caller a
 *    member" — the port's statements are scoped to the two kinds the
 *    organization is part of, and a `direct` conversation cannot come out of
 *    them (F173). The administrative guard has already decided *who* may ask;
 *    what remains is *what* may be asked about.
 * 2. **An answer to somebody without an account goes out as mail, and stays in
 *    the conversation** (F11). Both, not either: the mail is how a person with
 *    no login hears back, and the line in the history is how the next
 *    organizer sees that it was answered.
 * 3. **The message is stored first, and the mail's fate is part of the
 *    answer** (F174). The opposite of the notification in AP 9, where a
 *    failure had to stay invisible (F172, E10): there the form must not report
 *    anything an address could be distinguished by, here the organizer must
 *    learn that the person they answered never heard from them.
 * 4. **A group is assembled from an event's confirmed registrations** (E39),
 *    and who is eligible is decided by the insert itself rather than checked
 *    here — see {@link OrganizerConversationRepository.createGroup}.
 *
 * What it deliberately does not do: send a picture. A participant may
 * (E40), and the organizer sees theirs; an answer, though, has to work as a
 * mail too, and a mail with an attachment is a second delivery mechanism for
 * something FR 3.4 does not ask for.
 */
@Injectable()
export class OrganizerConversationsService {
  private readonly logger = new Logger(OrganizerConversationsService.name);

  constructor(
    @Inject(ORGANIZER_CONVERSATION_REPOSITORY)
    private readonly conversations: OrganizerConversationRepository,
    @Inject(MESSAGE_REPOSITORY)
    private readonly messages: MessageRepository,
    // For the event a row names, and for the block in the answer's mail. Read
    // by id, which is what `locate` and `locateMany` are for.
    private readonly events: EventsService,
    private readonly mail: MailService,
    private readonly links: PublicLinks,
    private readonly images: ImageFileService,
    private readonly realtime: ChatRealtimeService,
    // A group's members hear about an answer even with no screen open (E44).
    private readonly notifications: ChatNotificationsService,
  ) {}

  /** One page of the organization's conversations, newest activity first. */
  async list(
    query: OrganizerConversationQuery,
  ): Promise<OrganizerConversationPage> {
    const { page, pageSize, offset } = pageWindow(
      query,
      DEFAULT_ORGANIZER_CONVERSATION_PAGE_SIZE,
      MAX_ORGANIZER_CONVERSATION_PAGE_SIZE,
    );

    const slice = await this.conversations.list(offset, pageSize);
    const events = await this.eventsOf(slice.rows);

    return {
      rows: slice.rows.map((row) => toSummary(row, events)),
      total: slice.total,
      page,
      pageSize,
    };
  }

  /**
   * One conversation, with the names of the accounts in it.
   *
   * @throws NotFoundException — an unknown id, or a `direct` conversation,
   * said the same way (F173).
   */
  async get(conversationId: string): Promise<OrganizerConversationDetail> {
    const conversation = await this.require(conversationId);
    const [events, members] = await Promise.all([
      this.eventsOf([conversation]),
      this.conversations.membersOf(conversationId),
    ]);

    return {
      ...toSummary(conversation, events),
      members: members.map(toCounterpart),
    };
  }

  /**
   * One window of a conversation's history, newest first.
   *
   * The same cursor paging the participant's thread uses (F154), through the
   * same port — only the gate above it differs, which is the whole difference
   * between the two sides of this module.
   */
  async history(
    conversationId: string,
    query: MessageHistoryQuery,
  ): Promise<MessageHistory> {
    await this.require(conversationId);

    const { pageSize } = pageWindow(
      query,
      DEFAULT_MESSAGE_PAGE_SIZE,
      MAX_MESSAGE_PAGE_SIZE,
    );

    const rows = await this.messages.history(
      conversationId,
      query.before ?? null,
      pageSize + 1,
    );

    return {
      rows: rows.slice(0, pageSize).map(toMessage),
      hasMore: rows.length > pageSize,
    };
  }

  /**
   * Answers a conversation, and — for a guest — sends that answer as mail.
   *
   * Order matters and is the decision: **stored, then sent.** The record is
   * the conversation, so a mail server that is down costs a delivery and not
   * an answer; the organizer is told through {@link OrganizerReply.delivery}
   * and can try again by writing again, which is a second line rather than a
   * second endpoint.
   *
   * @throws NotFoundException — not the organization's conversation.
   * @throws BadRequestException — an empty message, or one past
   * {@link MAX_MESSAGE_LENGTH}.
   */
  async reply(
    adminId: string,
    conversationId: string,
    input: SendMessageInput,
  ): Promise<OrganizerReply> {
    const conversation = await this.require(conversationId);

    const body = (input.body ?? '').trim();
    if (body.length === 0) {
      throw new BadRequestException(
        'An answer needs words. An empty one is not an answer.',
      );
    }
    if (body.length > MAX_MESSAGE_LENGTH) {
      throw new BadRequestException(
        `A message may be up to ${MAX_MESSAGE_LENGTH} characters.`,
      );
    }

    const appended = await this.messages.append({
      conversationId,
      // The organizer's own account, so the history says which person of the
      // organization answered — `sender_type` alone would only say "somebody
      // here" (E39, CHK_message_sender_id).
      senderType: 'admin',
      senderId: adminId,
      body,
      image: null,
    });

    const message = toMessage(appended.record);
    // To the members, which is everybody in a group and nobody in a contact
    // request. Nothing is awaited: the members were read in the same
    // transaction as the line (F163).
    this.realtime.publishMessage(message, appended.members);
    // And whoever has no socket in this conversation is notified instead
    // (E44) — the same call the participants' own send makes, so an answer
    // from the organization reaches a group the same way any other line does.
    // A contact request has no membership row for the guest (F133), so this
    // finds nobody there and the mail below is the whole delivery.
    void this.notifications.notifyAbsent(message, appended.members);

    return { message, delivery: await this.deliver(conversation, body) };
  }

  /**
   * Who may be put into a group for this event (E39).
   *
   * @throws NotFoundException — no event with that id.
   */
  async candidates(eventId: string): Promise<readonly GroupCandidate[]> {
    // Resolved first, so an unknown id is a 404 rather than an empty list: an
    // empty list means "nobody has confirmed yet", which is a different
    // answer and a different thing to show.
    await this.events.getForOrganizer(eventId);

    const rows = await this.conversations.groupCandidatesOf(eventId);
    return rows.map((row) => ({
      profileId: row.profileId,
      name: `${row.firstName} ${row.lastName}`.trim(),
      email: row.email,
    }));
  }

  /**
   * Assembles a group around an event (E39).
   *
   * Nobody is written into the group who is not a confirmed registrant of the
   * event with an account, and that is not this method's doing: the insert
   * derives the eligible set, and a request naming anybody else creates
   * nothing at all. What is checked here is what a person typed — a subject,
   * and at least one member.
   *
   * The group starts **empty**, without an opening message: the organizer
   * writes the first line in the thread the client goes to, which is one flow
   * rather than a form with a subject and a body that mean different things.
   *
   * @throws NotFoundException — no event with that id.
   * @throws BadRequestException — no subject, nobody in it, or somebody who
   * did not confirm a registration for this event.
   */
  async createGroup(
    input: NewGroupRequest,
  ): Promise<OrganizerConversationDetail> {
    await this.events.getForOrganizer(input.eventId);

    const topic = input.topic.trim();
    if (topic.length === 0) {
      throw new BadRequestException('A group needs a subject.');
    }
    if (topic.length > MAX_GROUP_TOPIC_LENGTH) {
      throw new BadRequestException(
        `A subject may be up to ${MAX_GROUP_TOPIC_LENGTH} characters.`,
      );
    }

    const profileIds = [...new Set(input.profileIds)];
    if (profileIds.length === 0) {
      throw new BadRequestException(
        'A group needs somebody in it. Pick the participants it is for.',
      );
    }
    if (profileIds.length > MAX_GROUP_MEMBERS) {
      throw new BadRequestException(
        `A group may hold up to ${MAX_GROUP_MEMBERS} participants. For more ` +
          'than that, an invitation reaches everybody at once (FR 2.4).',
      );
    }

    const created = await this.conversations.createGroup({
      eventId: input.eventId,
      topic,
      profileIds,
    });
    if (!created) {
      throw new BadRequestException(
        'A group holds the people the event confirmed. At least one of the ' +
          'participants you picked has no confirmed registration for it, or ' +
          'no account any more — nothing was created.',
      );
    }

    // Read back the way the overview reads it, rather than assembled from what
    // is at hand: the member count and the (absent) preview come from the same
    // statement that answers every other row.
    return this.get(created.id);
  }

  /**
   * The picture of one message in one of the organization's conversations.
   *
   * A route of its own rather than the media route the participants use
   * (F156), and the reason is F133: that one decides access by **membership**,
   * and the organization has none. Fetched by the client with its
   * administrative session and shown from a blob, the way a registration's
   * attachment already is (E9) — the upload volume is never served
   * statically.
   *
   * @throws NotFoundException — one sentence for four states: no such
   * message, no picture on it, a picture in another conversation, and a
   * conversation that is not the organization's.
   */
  async readImage(
    conversationId: string,
    messageId: string,
  ): Promise<ImageBytes> {
    await this.require(conversationId);

    const image = await this.messages.findImage(messageId);
    // The id has to be a message **of this conversation**: without that check
    // the id of any message anywhere would be readable through a conversation
    // the organizer may see.
    if (!image || image.conversationId !== conversationId) {
      throw new NotFoundException(NO_SUCH_IMAGE);
    }

    const bytes = await this.images.read('messages', image.path);
    if (!bytes) throw new NotFoundException(NO_SUCH_IMAGE);
    return bytes;
  }

  /**
   * The conversation, or the one 404.
   *
   * The gate every route of this service goes through, so a new one cannot
   * invent a second wording — or a second status code, which is what would
   * turn a uuid into an oracle.
   */
  private async require(
    conversationId: string,
  ): Promise<OrganizerConversationRecord> {
    const conversation = await this.conversations.find(conversationId);
    if (!conversation) throw new NotFoundException(NOT_THE_ORGANIZATION_S);
    return conversation;
  }

  /**
   * Sends the answer to a guest, and says what became of it (F174).
   *
   * `none` for a group: its members read it in the app, and a mail per line
   * would turn a conversation into a mailing list. `failed` is logged and
   * reported — the line is already written, so the organizer's choice is to
   * write again, not to wonder.
   */
  private async deliver(
    conversation: OrganizerConversationRecord,
    body: string,
  ): Promise<ReplyDelivery> {
    if (conversation.type !== 'organizer_contact') return 'none';

    const to = conversation.guestEmail;
    const eventId = conversation.eventId;
    if (!to || !eventId) {
      // Neither can happen for a request the contact form wrote
      // (`CHK_conversation_shape` requires the address, F133 stores the
      // event), so this is a row nothing in this application creates.
      this.logger.error(
        `Conversation ${conversation.id} is a contact request without ` +
          'an address or without an event, so the answer could not be sent.',
      );
      return 'failed';
    }

    try {
      await this.mail.sendContactAnswer(
        to,
        async (locale): Promise<ContactAnswerMailContext> => ({
          // The name they typed, or the address when the row has none: a
          // greeting without a name would read as a form letter, and the
          // address is what the person recognises.
          guestName: conversation.guestName ?? to,
          // Fetched inside the callback, in the language the letter turned out
          // to be written in (F125).
          event: await this.mailEvent(eventId, locale),
          // The same split the invitation preview uses, so what the organizer
          // typed is cut the same way in both places.
          paragraphs: invitationParagraphs(body),
        }),
      );
      return 'sent';
    } catch (error: unknown) {
      if (!(error instanceof MailDeliveryError)) throw error;
      // Described, not addressed (F55): what failed belongs in the log, who it
      // was for does not.
      this.logger.error(
        `The answer in conversation ${conversation.id} was stored, but could ` +
          'not be sent to the person who asked.',
      );
      return 'failed';
    }
  }

  private async mailEvent(eventId: string, locale: string): Promise<MailEvent> {
    const { event, seriesSlug } = await this.events.locate(eventId, locale);
    return {
      name: event.name,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      timezone: event.timezone,
      url: this.links.event(seriesSlug, event.slug),
    };
  }

  /**
   * The events a page of rows names, in one read (F49).
   *
   * `locateMany` rather than one lookup per row, and without a locale: an
   * organizer's screen shows what is stored, the way every other
   * administrative screen does — a translated name here would differ from the
   * name on the event's own page in this same client.
   */
  private async eventsOf(
    rows: readonly OrganizerConversationRecord[],
  ): Promise<ReadonlyMap<string, EventLocation>> {
    const ids = [
      ...new Set(
        rows
          .map((row) => row.eventId)
          .filter((id): id is string => id !== null),
      ),
    ];
    return this.events.locateMany(ids);
  }
}

function toSummary(
  row: OrganizerConversationRecord,
  events: ReadonlyMap<string, EventLocation>,
): OrganizerConversationSummary {
  const located = row.eventId ? events.get(row.eventId) : undefined;

  return {
    id: row.id,
    type: row.type,
    topic: row.topic,
    event: located ? toEventRef(located) : null,
    // A group has no guest, and a contact request always has an address —
    // `CHK_conversation_shape` says so for the kind.
    guest:
      row.type === 'organizer_contact' && row.guestEmail
        ? { name: row.guestName, email: row.guestEmail }
        : null,
    memberCount: row.memberCount,
    lastMessageAt: row.lastMessageAt?.toISOString() ?? null,
    preview: row.preview,
  };
}

function toEventRef(located: EventLocation): ConversationEventRef {
  return {
    id: located.event.id,
    name: located.event.name,
    slug: located.event.slug,
    seriesSlug: located.seriesSlug,
  };
}

function toCounterpart(
  member: ConversationCounterpartRecord,
): ConversationCounterpart {
  return {
    profileId: member.id,
    name: `${member.firstName} ${member.lastName}`.trim(),
    // The media route built from the id and the row's timestamp (F124) — the
    // one construction of that URL, imported rather than repeated (F113).
    avatarUrl: avatarUrl(member.id, member.avatarPath, member.updatedAt),
  };
}

function toMessage(record: MessageRecord): ChatMessage {
  return {
    id: record.id,
    conversationId: record.conversationId,
    senderType: record.senderType,
    senderId: record.senderId,
    body: record.body,
    // The participant's address for the picture. The organizer client does not
    // follow it — it has a route of its own, because its permission is a
    // different question (F133) — but the field is part of the message, and a
    // message that lied about having a picture would be worse than one whose
    // URL one audience ignores.
    imageUrl: messageImageUrl(record.id, record.hasImage),
    createdAt: record.createdAt.toISOString(),
  };
}

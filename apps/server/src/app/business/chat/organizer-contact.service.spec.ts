import { BadRequestException, NotFoundException } from '@nestjs/common';
import type {
  PublicEvent,
  PublicEventSeries,
  ContactRequestInput,
} from '@trefaro/shared-models';
import { MAX_MESSAGE_LENGTH } from '@trefaro/shared-models';
import type { TrefaroEnv } from '../../core/config/env';
import type { EventSeriesService } from '../event-series';
import type { EventsService } from '../events';
import { MailDeliveryError, MailService, PublicLinks } from '../mail';
import type { ContactRequestMailContext, MailContent } from '../mail';
import { OrganizerContactService } from './organizer-contact.service';
import type {
  ConversationRecord,
  ConversationRepository,
  NewOrganizerContact,
} from './ports/conversation.repository';

const ENV = {
  publicUserClientUrl: 'https://events.example.org/',
  publicAdminClientUrl: 'https://admin.events.example.org',
  smtp: { from: 'Example NGO <office@example.org>' },
} as TrefaroEnv;

const EVENT: PublicEvent = {
  id: 'event-1',
  slug: 'kickoff',
  name: 'Kickoff in Köln',
  description: 'The opening weekend.',
  logoUrl: null,
  eventType: 'onsite',
  startsAt: '2099-03-28T08:00:00.000Z',
  endsAt: '2099-03-28T15:00:00.000Z',
  timezone: 'Europe/Berlin',
  venueName: 'Bürgerhaus Kalk',
  venueAddress: null,
  onlineUrl: null,
  languages: ['de'],
  followUpBody: null,
};

const SERIES: PublicEventSeries = {
  id: 'series-1',
  slug: 'buergerraete',
  name: 'Bürgerräte',
  description: 'A series.',
  logoUrl: null,
  websiteUrl: null,
  contactEmail: 'team@example.org',
};

const INPUT: ContactRequestInput = {
  name: '  Amina Okonkwo  ',
  email: '  Amina@Example.ORG ',
  body: '  is the venue accessible?\n\nThanks.  ',
};

/**
 * The event, in whichever language it was asked for.
 *
 * The translated name is what proves F125 from this side: the mail's content
 * is fetched **inside** the callback, so a letter that E24 pushed into English
 * carries the English title.
 */
class FakeEventsService {
  readonly asked: (string | undefined)[] = [];
  missing = false;

  async getPublic(
    seriesSlug: string,
    eventSlug: string,
    locale?: string,
  ): Promise<PublicEvent> {
    if (this.missing) {
      throw new NotFoundException(`No event at "${seriesSlug}/${eventSlug}"`);
    }
    this.asked.push(locale);
    return locale === 'de' ? EVENT : { ...EVENT, name: 'Kickoff in Cologne' };
  }
}

class FakeEventSeriesService {
  contactEmail: string | null = SERIES.contactEmail;

  async getPublicBySlug(): Promise<PublicEventSeries> {
    return { ...SERIES, contactEmail: this.contactEmail };
  }
}

/** Plays `MailService`'s part in resolving the content (F125). */
class RecordingMailService {
  readonly sent: { to: string; context: ContactRequestMailContext }[] = [];
  failing = false;
  /** The language `MailCatalogue` would have settled on for this letter. */
  locale = 'de';

  async sendContactRequest(
    to: string,
    content: MailContent<ContactRequestMailContext>,
  ): Promise<void> {
    if (this.failing) throw new MailDeliveryError(new Error('ECONNREFUSED'));
    this.sent.push({ to, context: await this.resolve(content) });
  }

  private async resolve<Context>(
    content: MailContent<Context>,
  ): Promise<Context> {
    return typeof content === 'function'
      ? await (content as (locale: string) => Promise<Context>)(this.locale)
      : content;
  }
}

class FakeConversationRepository {
  readonly created: NewOrganizerContact[] = [];

  async createOrganizerContact(
    contact: NewOrganizerContact,
  ): Promise<ConversationRecord> {
    this.created.push(contact);
    return {
      id: `conversation-${this.created.length}`,
      type: 'organizer_contact',
      eventId: contact.eventId,
      topic: null,
      guestEmail: contact.guestEmail,
      guestName: contact.guestName,
      lastMessageAt: new Date('2026-09-03T09:00:00Z'),
    };
  }
}

/**
 * Contacting the organizer without an account (FR 3.4, UC 14 — E10, E39, F11).
 *
 * The acceptance criterion of AP 9 is decided in three places, and this file
 * holds the part that is a rule rather than a round trip: **the form gives
 * nothing away.** There is no branch here that could tell a known address from
 * an unknown one, and the one that could have — a mail server that is down —
 * is asserted not to change the answer either.
 */
describe('OrganizerContactService', () => {
  let conversations: FakeConversationRepository;
  let events: FakeEventsService;
  let series: FakeEventSeriesService;
  let mail: RecordingMailService;
  let service: OrganizerContactService;

  beforeEach(() => {
    conversations = new FakeConversationRepository();
    events = new FakeEventsService();
    series = new FakeEventSeriesService();
    mail = new RecordingMailService();
    service = new OrganizerContactService(
      conversations as unknown as ConversationRepository,
      events as unknown as EventsService,
      series as unknown as EventSeriesService,
      mail as unknown as MailService,
      new PublicLinks(ENV),
      ENV,
    );
  });

  const submit = (overrides: Partial<ContactRequestInput> = {}) =>
    service.submit('buergerraete', 'kickoff', { ...INPUT, ...overrides });

  it('opens an organizer_contact conversation carrying the guest’s words', async () => {
    const answer = await submit();

    expect(answer).toEqual({ email: 'amina@example.org' });
    expect(conversations.created).toEqual([
      {
        eventId: 'event-1',
        // Lower-cased and trimmed, like every address in this application
        // (E10): the same person writing twice is the same address.
        guestEmail: 'amina@example.org',
        guestName: 'Amina Okonkwo',
        body: 'is the venue accessible?\n\nThanks.',
      },
    ]);
  });

  it('tells the mailbox the series advertises', async () => {
    await submit();

    // The address the series page already shows to the public: a form that
    // delivered somewhere else would answer from an address nobody named.
    expect(mail.sent.map((letter) => letter.to)).toEqual(['team@example.org']);
  });

  it('falls back to the instance’s own sender, without its display name', async () => {
    series.contactEmail = null;

    await submit();

    expect(mail.sent[0].to).toBe('office@example.org');
  });

  it('writes the letter’s content in the letter’s own language (F125)', async () => {
    mail.locale = 'en';

    await submit();

    // The event's name was fetched inside the callback, so an English letter
    // carries the English title — the mixture E24 exists to prevent.
    expect(events.asked).toContain('en');
    expect(mail.sent[0].context.event.name).toBe('Kickoff in Cologne');
  });

  it('puts the guest’s address and paragraphs into the letter (F11)', async () => {
    await submit();

    const { context } = mail.sent[0];
    expect(context.guestEmail).toBe('amina@example.org');
    expect(context.guestName).toBe('Amina Okonkwo');
    // Split where the blank line was, by the one function that decides what a
    // blank line means.
    expect(context.paragraphs).toEqual(['is the venue accessible?', 'Thanks.']);
    // The organizer client, not a deep link into a screen that arrives with
    // AP 10.
    expect(context.answerUrl).toBe('https://admin.events.example.org/');
    expect(context.event.url).toBe(
      'https://events.example.org/series/buergerraete/events/kickoff',
    );
  });

  it('answers the same when the notification cannot be sent (E10)', async () => {
    mail.failing = true;

    const answer = await submit();

    // The record is the conversation, and it is already written: a 503 here
    // would be a form that answers differently depending on the mail server,
    // and re-submitting would create a second request.
    expect(answer).toEqual({ email: 'amina@example.org' });
    expect(conversations.created).toHaveLength(1);
  });

  it('stores nothing for an event that is not published', async () => {
    events.missing = true;

    await expect(submit()).rejects.toBeInstanceOf(NotFoundException);
    expect(conversations.created).toEqual([]);
    expect(mail.sent).toEqual([]);
  });

  it('refuses a message that is only whitespace', async () => {
    // The column would refuse it too (`CHK_message_body`), and a constraint
    // violation is not a sentence somebody can act on.
    await expect(submit({ body: '   \n  ' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(conversations.created).toEqual([]);
  });

  it('refuses a name that is only whitespace', async () => {
    await expect(submit({ name: '  ' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(conversations.created).toEqual([]);
  });

  it('refuses a message longer than a message may be', async () => {
    await expect(
      submit({ body: 'x'.repeat(MAX_MESSAGE_LENGTH + 1) }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(conversations.created).toEqual([]);
  });

  it('takes no interest in whether the address is known', async () => {
    // Not a mocked-away lookup — there is none to mock. The two calls differ
    // only in the address, and everything about their answers is identical
    // (E10), which is what the contract suite then asserts from outside.
    const first = await submit({ email: 'stranger@example.org' });
    const second = await submit({ email: 'member@example.org' });

    expect(Object.keys(first)).toEqual(Object.keys(second));
    expect(conversations.created).toHaveLength(2);
    // Two requests, two conversations: nothing authenticates the address, so
    // folding them into one thread would assert they came from one person.
    expect(
      new Set(conversations.created.map((row) => row.guestEmail)).size,
    ).toBe(2);
  });
});

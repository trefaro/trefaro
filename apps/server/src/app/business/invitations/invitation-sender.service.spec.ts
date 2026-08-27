import type { EventSeries, PublicEvent } from '@trefaro/shared-models';
import type { TrefaroEnv } from '../../core/config/env';
import type { EventSeriesService } from '../event-series';
import type { EventLocation, EventsService } from '../events';
import {
  MailDeliveryError,
  MailService,
  PublicLinks,
  type InvitationMailContext,
} from '../mail';
import { TokenSigner } from '../security';
import { InvitationSenderService } from './invitation-sender.service';
import type {
  InvitationRecord,
  InvitationRepository,
  PendingRecipient,
} from './ports/invitation.repository';

const ENV = {
  authSecret: 'a-test-secret-of-at-least-32-characters',
  publicUserClientUrl: 'https://events.example.org/',
} as TrefaroEnv;

const SERIES = {
  id: 'series-1',
  slug: 'democracy-days',
  name: 'Democracy Days',
} as EventSeries;

const EVENT = {
  id: 'event-1',
  slug: 'kickoff',
  name: 'Kickoff in Köln',
  startsAt: '2099-03-28T08:00:00.000Z',
  endsAt: '2099-03-28T15:00:00.000Z',
  timezone: 'Europe/Berlin',
} as PublicEvent;

function record(overrides: Partial<InvitationRecord> = {}): InvitationRecord {
  return {
    id: 'invitation-1',
    seriesId: 'series-1',
    eventId: null,
    subject: 'You are invited',
    body: 'we would love to see you again.\n\nRegistration is open.',
    createdAt: new Date('2026-08-27T10:00:00Z'),
    finishedAt: null,
    ...overrides,
  };
}

function recipient(index: number): PendingRecipient {
  return {
    id: `recipient-${index}`,
    registrationId: `registration-${index}`,
    email: `person${index}@example.org`,
    firstName: `Person${index}`,
  };
}

/** The send queue, in memory, behaving the way the SQL does. */
class FakeInvitationRepository {
  invitation: InvitationRecord | null = record();
  pending: PendingRecipient[] = [];
  sent: string[] = [];
  failed: { id: string; failure: string }[] = [];
  finished: string[] = [];
  unfinishedIds: readonly string[] = [];
  /** Set to keep answering the same row, as a stuck update would. */
  sticky = false;

  async findById(): Promise<InvitationRecord | null> {
    return this.invitation;
  }

  async nextPending(): Promise<PendingRecipient | null> {
    return this.pending[0] ?? null;
  }

  async markSent(recipientId: string): Promise<void> {
    this.sent.push(recipientId);
    if (!this.sticky) this.pending.shift();
  }

  async markFailed(recipientId: string, failure: string): Promise<void> {
    this.failed.push({ id: recipientId, failure });
    if (!this.sticky) this.pending.shift();
  }

  async finish(invitationId: string): Promise<void> {
    this.finished.push(invitationId);
  }

  async unfinished(): Promise<readonly string[]> {
    return this.unfinishedIds;
  }
}

class RecordingMailService {
  readonly sent: { to: string; context: InvitationMailContext }[] = [];
  failFor = new Set<string>();

  async sendInvitation(
    to: string,
    context: InvitationMailContext,
  ): Promise<void> {
    if (this.failFor.has(to)) {
      throw new MailDeliveryError(new Error('Mailbox unavailable'));
    }
    this.sent.push({ to, context });
  }
}

class FakeSeriesService {
  async getForOrganizer(): Promise<EventSeries> {
    return SERIES;
  }
}

class FakeEventsService {
  missing = false;
  readonly asked: string[] = [];

  async locate(id: string): Promise<EventLocation> {
    this.asked.push(id);
    if (this.missing) throw new Error('No such event');
    return { event: EVENT, seriesSlug: 'democracy-days' };
  }
}

describe('InvitationSenderService', () => {
  let repository: FakeInvitationRepository;
  let mail: RecordingMailService;
  let events: FakeEventsService;
  let sender: InvitationSenderService;

  /** `start` returns immediately by design, so the tests await the work. */
  const drain = () => new Promise((resolve) => setTimeout(resolve, 0));

  beforeEach(() => {
    repository = new FakeInvitationRepository();
    mail = new RecordingMailService();
    events = new FakeEventsService();
    sender = new InvitationSenderService(
      repository as unknown as InvitationRepository,
      new FakeSeriesService() as unknown as EventSeriesService,
      events as unknown as EventsService,
      mail as unknown as MailService,
      new PublicLinks(ENV),
      new TokenSigner(ENV),
    );
  });

  it('writes to every recipient once, one mail each', async () => {
    repository.pending = [recipient(1), recipient(2), recipient(3)];

    sender.start('invitation-1');
    await drain();

    expect(mail.sent.map((message) => message.to)).toEqual([
      'person1@example.org',
      'person2@example.org',
      'person3@example.org',
    ]);
    // Never a shared To or CC: that would show every invited person who else
    // was invited.
    expect(new Set(mail.sent.map((message) => message.to)).size).toBe(3);
  });

  it('returns before the mails are sent (F56)', async () => {
    repository.pending = [recipient(1)];

    sender.start('invitation-1');

    // The whole reason this class exists: the HTTP request has already answered.
    expect(mail.sent).toHaveLength(0);
    await drain();
    expect(mail.sent).toHaveLength(1);
  });

  it('greets each recipient by their own name', async () => {
    repository.pending = [recipient(1), recipient(2)];

    sender.start('invitation-1');
    await drain();

    expect(mail.sent[0].context.firstName).toBe('Person1');
    expect(mail.sent[1].context.firstName).toBe('Person2');
  });

  it('gives each recipient their own objection link (F58)', async () => {
    repository.pending = [recipient(1), recipient(2)];

    sender.start('invitation-1');
    await drain();

    const [first, second] = mail.sent.map(
      (message) => message.context.optOutUrl,
    );
    expect(first).toContain(
      'https://events.example.org/invitations/unsubscribe?token=',
    );
    expect(first).not.toBe(second);
  });

  it('splits the organizer’s text into paragraphs once, in shared-models', async () => {
    repository.pending = [recipient(1)];

    sender.start('invitation-1');
    await drain();

    expect(mail.sent[0].context.paragraphs).toEqual([
      'we would love to see you again.',
      'Registration is open.',
    ]);
  });

  it('names the series, so the footer can say why this mail arrived', async () => {
    repository.pending = [recipient(1)];

    sender.start('invitation-1');
    await drain();

    expect(mail.sent[0].context.seriesName).toBe('Democracy Days');
  });

  it('resolves the event once for the whole send', async () => {
    repository.invitation = record({ eventId: 'event-1' });
    repository.pending = [recipient(1), recipient(2), recipient(3)];

    sender.start('invitation-1');
    await drain();

    // Not once per recipient: two hundred mails must not be two hundred lookups.
    expect(events.asked).toEqual(['event-1']);
    expect(mail.sent[0].context.event?.url).toBe(
      'https://events.example.org/series/democracy-days/events/kickoff',
    );
  });

  it('sends the message even if the event was deleted meanwhile', async () => {
    repository.invitation = record({ eventId: 'event-1' });
    repository.pending = [recipient(1)];
    events.missing = true;

    sender.start('invitation-1');
    await drain();

    // The organizer's words are the invitation; the event block was decoration.
    expect(mail.sent).toHaveLength(1);
    expect(mail.sent[0].context.event).toBeNull();
  });

  it('records a refused address and carries on with the rest', async () => {
    repository.pending = [recipient(1), recipient(2), recipient(3)];
    mail.failFor.add('person2@example.org');

    sender.start('invitation-1');
    await drain();

    expect(repository.failed).toEqual([
      { id: 'recipient-2', failure: 'Mailbox unavailable' },
    ]);
    // One mistyped address must not cost the other hundred and ninety-nine.
    expect(repository.sent).toEqual(['recipient-1', 'recipient-3']);
  });

  it('stamps the invitation as finished when nothing is pending', async () => {
    repository.pending = [recipient(1)];

    sender.start('invitation-1');
    await drain();

    expect(repository.finished).toEqual(['invitation-1']);
  });

  it('stops rather than writing to the same person forever', async () => {
    repository.pending = [recipient(1)];
    repository.sticky = true;

    sender.start('invitation-1');
    await drain();

    // A row that stays pending after an attempt would otherwise be returned
    // again and again — an unbounded number of mails to one address.
    expect(mail.sent).toHaveLength(1);
    expect(repository.finished).toHaveLength(0);
  });

  it('does nothing for an invitation that no longer exists', async () => {
    repository.invitation = null;
    repository.pending = [recipient(1)];

    sender.start('invitation-1');
    await drain();

    expect(mail.sent).toHaveLength(0);
  });

  it('continues a send that a restart interrupted', async () => {
    repository.unfinishedIds = ['invitation-1'];
    repository.pending = [recipient(1), recipient(2)];

    sender.onApplicationBootstrap();
    await drain();

    expect(repository.sent).toEqual(['recipient-1', 'recipient-2']);
    expect(repository.finished).toEqual(['invitation-1']);
  });

  it('starts nothing on boot when no send was interrupted', async () => {
    sender.onApplicationBootstrap();
    await drain();

    expect(mail.sent).toHaveLength(0);
  });
});

import type { EventSeries, PublicEvent } from '@trefaro/shared-models';
import type { TrefaroEnv } from '../../core/config/env';
import type { EventSeriesService } from '../event-series';
import type { EventLocation, EventsService } from '../events';
import {
  MailDeliveryError,
  MailService,
  PublicLinks,
  TemporaryMailFailure,
  type InvitationMailContext,
  type MailContent,
} from '../mail';
import { TokenSigner } from '../security';
import { InvitationSenderService } from './invitation-sender.service';
import type {
  InvitationRecord,
  InvitationRepository,
  PendingRecipient,
} from './ports/invitation.repository';

/** The shipped pause, run under fake timers so it costs nothing to keep. */
const PAUSE = 1000;

const ENV = {
  authSecret: 'a-test-secret-of-at-least-32-characters',
  publicUserClientUrl: 'https://events.example.org/',
  smtp: { pauseBetweenMailsMs: PAUSE },
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

/**
 * The mail service, which since AP 4 asks the sender for its content (F125).
 *
 * {@link localeOf} plays the part `MailCatalogue` plays for real: it decides
 * which language each recipient's letter turns out to be in, and the sender is
 * called back with it. That is what lets these tests state the property that
 * matters for a batch — the same language is resolved once, not once per
 * recipient.
 */
class RecordingMailService {
  readonly sent: { to: string; context: InvitationMailContext }[] = [];
  /** Every attempt, including the ones that failed — a retry shows up here. */
  readonly attempts: string[] = [];
  failFor = new Set<string>();
  /** How many attempts an address answers "not now" to before giving in. */
  refuseOnce = new Map<string, number>();
  /** Per address, because a batch is exactly where two languages meet. */
  locales = new Map<string, string>();

  async sendInvitation(
    to: string,
    content: MailContent<InvitationMailContext>,
  ): Promise<void> {
    this.attempts.push(to);
    const refusals = this.refuseOnce.get(to) ?? 0;
    if (refusals > 0) {
      this.refuseOnce.set(to, refusals - 1);
      throw new MailDeliveryError(
        new TemporaryMailFailure(new Error('451 mailbox busy, try again')),
      );
    }
    if (this.failFor.has(to)) {
      throw new MailDeliveryError(new Error('Mailbox unavailable'));
    }
    const context =
      typeof content === 'function'
        ? await (content as (locale: string) => Promise<InvitationMailContext>)(
            this.locales.get(to) ?? 'en',
          )
        : content;
    this.sent.push({ to, context });
  }
}

class FakeSeriesService {
  readonly asked: (string | undefined)[] = [];
  /** What the series is called in another language (FR 3.12). */
  translated = new Map<string, string>();

  async nameOf(_id: string, locale?: string): Promise<string> {
    this.asked.push(locale);
    return (locale ? this.translated.get(locale) : undefined) ?? SERIES.name;
  }
}

class FakeEventsService {
  missing = false;
  readonly asked: string[] = [];
  readonly locales: (string | undefined)[] = [];
  translated = new Map<string, string>();

  async locate(id: string, locale?: string): Promise<EventLocation> {
    this.asked.push(id);
    this.locales.push(locale);
    if (this.missing) throw new Error('No such event');
    const name = locale ? this.translated.get(locale) : undefined;
    return {
      event: name ? { ...EVENT, name } : EVENT,
      seriesSlug: 'democracy-days',
    };
  }
}

describe('InvitationSenderService', () => {
  let repository: FakeInvitationRepository;
  let mail: RecordingMailService;
  let events: FakeEventsService;
  let series: FakeSeriesService;
  let sender: InvitationSenderService;

  /**
   * `start` returns immediately by design, so the tests await the work.
   *
   * On fake timers since phase 5: the sender waits between two mails now, and
   * a test that waited with it would either sleep for real or measure a
   * stopwatch. Advancing time instead makes the pause something the tests can
   * *state* — see "waits between two mails" below, which asserts what has and
   * has not happened at a given moment.
   */
  const drain = () => jest.advanceTimersByTimeAsync(600_000);

  beforeEach(() => {
    jest.useFakeTimers();
    repository = new FakeInvitationRepository();
    mail = new RecordingMailService();
    events = new FakeEventsService();
    series = new FakeSeriesService();
    sender = new InvitationSenderService(
      repository as unknown as InvitationRepository,
      series as unknown as EventSeriesService,
      events as unknown as EventsService,
      mail as unknown as MailService,
      new PublicLinks(ENV),
      new TokenSigner(ENV),
      ENV,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
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
    expect(series.asked).toEqual(['en']);
    expect(mail.sent[0].context.event?.url).toBe(
      'https://events.example.org/series/democracy-days/events/kickoff',
    );
  });

  it('resolves once per language, not once per recipient (F125)', async () => {
    repository.invitation = record({ eventId: 'event-1' });
    repository.pending = [recipient(1), recipient(2), recipient(3)];
    mail.locales.set('person1@example.org', 'de');
    mail.locales.set('person2@example.org', 'de');
    mail.locales.set('person3@example.org', 'en');
    events.translated.set('de', 'Auftakt in Köln');
    series.translated.set('de', 'Tage der Demokratie');

    sender.start('invitation-1');
    await drain();

    // Two hundred addresses share a handful of languages: what is resolved per
    // language is the series name and the event block, and nothing else.
    expect(events.locales).toEqual(['de', 'en']);
    expect(series.asked).toEqual(['de', 'en']);
    expect(mail.sent[0].context.event?.name).toBe('Auftakt in Köln');
    expect(mail.sent[0].context.seriesName).toBe('Tage der Demokratie');
    expect(mail.sent[2].context.event?.name).toBe('Kickoff in Köln');
  });

  it('leaves the organizer’s own words untranslated', async () => {
    repository.pending = [recipient(1)];
    mail.locales.set('person1@example.org', 'de');

    sender.start('invitation-1');
    await drain();

    // The invitation *is* what the organizer typed. A letter that translated
    // half of itself would be worse than one that translated none of it.
    expect(mail.sent[0].context.subject).toBe(record().subject);
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

  /*
   * The pause, stated rather than measured (E62's neighbour in this package).
   * Two hundred invitations arriving at a small mail server in twenty seconds
   * is how an instance gets itself throttled — so the sender waits, and the
   * wait is configuration (`SMTP_PAUSE_BETWEEN_MAILS_MS`) because only the
   * organization knows what its mail server tolerates.
   */
  it('waits between two mails, so two hundred do not arrive as a burst', async () => {
    repository.pending = [recipient(1), recipient(2), recipient(3)];

    sender.start('invitation-1');
    await jest.advanceTimersByTimeAsync(0);
    expect(mail.sent).toHaveLength(1);

    await jest.advanceTimersByTimeAsync(PAUSE);
    expect(mail.sent).toHaveLength(2);

    await jest.advanceTimersByTimeAsync(PAUSE);
    expect(mail.sent).toHaveLength(3);
  });

  it('gives a temporarily refused address a second attempt', async () => {
    repository.pending = [recipient(1), recipient(2)];
    mail.refuseOnce.set('person1@example.org', 1);

    sender.start('invitation-1');
    await jest.advanceTimersByTimeAsync(0);

    // Not straight away: a server that just said "slow down" is not helped by
    // being asked again in the same second.
    expect(mail.attempts).toEqual(['person1@example.org']);

    await drain();

    // "Not now" is not "never": a mailbox that was briefly full used to stay
    // failed for good, which is what this second attempt ends.
    expect(mail.attempts).toEqual([
      'person1@example.org',
      'person1@example.org',
      'person2@example.org',
    ]);
    expect(repository.sent).toEqual(['recipient-1', 'recipient-2']);
    expect(repository.failed).toEqual([]);
  });

  it('writes an address off when the second attempt is refused as well', async () => {
    repository.pending = [recipient(1)];
    mail.refuseOnce.set('person1@example.org', 2);

    sender.start('invitation-1');
    await drain();

    // A second attempt, not an unbounded one: the counters an organizer reads
    // have to settle, and a third try is a second invitation.
    expect(mail.attempts).toHaveLength(2);
    expect(repository.failed).toEqual([
      { id: 'recipient-1', failure: '451 mailbox busy, try again' },
    ]);
  });

  it('does not try again when the mail server said never', async () => {
    repository.pending = [recipient(1)];
    mail.failFor.add('person1@example.org');

    sender.start('invitation-1');
    await drain();

    // A refused recipient — a mistyped address, a mailbox that is gone — is a
    // permanent answer, and asking again would only annoy the mail server.
    expect(mail.attempts).toEqual(['person1@example.org']);
    expect(repository.failed).toHaveLength(1);
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

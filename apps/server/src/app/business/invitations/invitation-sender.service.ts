import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import {
  INVITATION_OPT_OUT_PATH,
  invitationParagraphs,
} from '@trefaro/shared-models';
import { EventsService } from '../events';
import { EventSeriesService } from '../event-series';
import {
  MailDeliveryError,
  MailService,
  PublicLinks,
  type InvitationMailContext,
  type MailEvent,
} from '../mail';
import { INVITATION_OPT_OUT_TTL_MS, TokenSigner } from '../security';
import {
  INVITATION_REPOSITORY,
  type InvitationRecord,
  type InvitationRepository,
} from './ports/invitation.repository';

/** Everything an invitation's mails share, resolved once per send. */
type SharedContext = Omit<InvitationMailContext, 'firstName' | 'optOutUrl'>;

/**
 * Sends one invitation's mails, one recipient at a time (FR 2.4, F56).
 *
 * This exists because of a number in the acceptance criteria: two hundred
 * addresses. Two hundred SMTP conversations do not fit in an HTTP request, and
 * an organizer who watches a browser spinner for four minutes will reload the
 * page — which, with the sending inside the request, would either send
 * everything twice or nothing at all. So the request writes the rows and
 * returns; this service works through them afterwards and the client watches
 * the counts.
 *
 * Four properties are deliberate:
 *
 * 1. **One mail per recipient.** Never a shared `To` or `CC`: that would show
 *    every invited person who else was invited, which for an organization
 *    running political events is a data breach in one click.
 * 2. **Sequential.** Small NGOs run small mail servers; twenty parallel SMTP
 *    connections is how an instance gets itself rate-limited or blacklisted.
 * 3. **The queue is in the database, not in this object.** `nextPending` is
 *    asked again after every single mail, so a restart in the middle of a send
 *    loses at most the one mail that was in flight — and {@link resume} picks
 *    the rest up on the next boot.
 * 4. **A refused address does not stop the send.** It is recorded as failed
 *    with what the mail server said, and the next recipient follows. One
 *    mistyped address must not cost the other hundred and ninety-nine.
 */
@Injectable()
export class InvitationSenderService implements OnApplicationBootstrap {
  private readonly logger = new Logger(InvitationSenderService.name);

  /** Ids waiting to be worked through; `pump` drains it one invitation at a time. */
  private readonly queue = new Set<string>();
  private running = false;

  constructor(
    @Inject(INVITATION_REPOSITORY)
    private readonly invitations: InvitationRepository,
    private readonly series: EventSeriesService,
    private readonly events: EventsService,
    private readonly mail: MailService,
    private readonly links: PublicLinks,
    private readonly tokens: TokenSigner,
  ) {}

  onApplicationBootstrap(): void {
    void this.resume();
  }

  /**
   * Takes over an invitation that has just been written. Returns immediately.
   *
   * Nothing is awaited here: the caller is an HTTP request that has already
   * answered with `202` and must not wait for a single mail, let alone all of
   * them.
   */
  start(invitationId: string): void {
    this.queue.add(invitationId);
    void this.pump();
  }

  /** Continues everything a restart interrupted. */
  private async resume(): Promise<void> {
    try {
      const pending = await this.invitations.unfinished();
      if (pending.length === 0) return;

      this.logger.log(
        `Resuming ${pending.length} invitation(s) that were still being sent.`,
      );
      for (const id of pending) this.queue.add(id);
      await this.pump();
    } catch (error: unknown) {
      this.logger.error(`Could not resume invitations: ${reason(error)}`);
    }
  }

  /**
   * Works through the queue, one invitation after another.
   *
   * Takes the first element rather than iterating: an invitation added while
   * this loop is running has to be picked up, and iterating a set that is being
   * added to while the last element is in flight would leave it stranded.
   */
  private async pump(): Promise<void> {
    if (this.running) return;
    this.running = true;

    try {
      for (;;) {
        const next = this.queue.values().next();
        if (next.done) return;
        this.queue.delete(next.value);

        try {
          await this.send(next.value);
        } catch (error: unknown) {
          // One invitation that cannot be sent must not stop the others. Its
          // recipients stay pending and are retried on the next boot.
          this.logger.error(
            `Invitation ${next.value} could not be finished: ${reason(error)}`,
          );
        }
      }
    } finally {
      this.running = false;
    }
  }

  private async send(invitationId: string): Promise<void> {
    const invitation = await this.invitations.findById(invitationId);
    if (!invitation) return;

    // One resolution per language, not per recipient (F125). Two hundred
    // addresses share a handful of languages at most, and the series name and
    // the event block are the same for everybody reading in one of them.
    const shared = new Map<string, Promise<SharedContext>>();
    const sharedFor = (locale: string): Promise<SharedContext> => {
      const known = shared.get(locale);
      if (known) return known;
      const resolving = this.shared(invitation, locale);
      shared.set(locale, resolving);
      return resolving;
    };

    let previous: string | null = null;

    for (;;) {
      const recipient = await this.invitations.nextPending(invitationId);
      if (!recipient) break;

      // Never twice in a row: if a row could not be marked, asking again would
      // return it forever and send the same person an unbounded number of mails.
      if (recipient.id === previous) {
        this.logger.error(
          `Recipient ${recipient.id} stayed pending after an attempt; stopping ` +
            `invitation ${invitationId} to avoid sending it again.`,
        );
        return;
      }
      previous = recipient.id;

      try {
        await this.mail.sendInvitation(recipient.email, async (locale) => ({
          ...(await sharedFor(locale)),
          firstName: recipient.firstName,
          // Signed per recipient and per registration: the link speaks for the
          // person who received this mail and for nobody else (F58).
          optOutUrl: this.links.token(
            INVITATION_OPT_OUT_PATH,
            this.tokens.sign(
              'invitation-opt-out',
              recipient.registrationId,
              INVITATION_OPT_OUT_TTL_MS,
            ),
          ),
        }));
        await this.invitations.markSent(recipient.id);
      } catch (error: unknown) {
        // Only a delivery failure is recorded and skipped. Anything else — the
        // database, a bug — leaves the row pending and ends the send, because
        // marking two hundred recipients as failed over a broken connection
        // would destroy the very list that lets it be finished later.
        if (!(error instanceof MailDeliveryError)) throw error;
        await this.invitations.markFailed(recipient.id, reason(error.cause));
      }
    }

    await this.invitations.finish(invitationId);
  }

  /**
   * What every mail of this invitation in one language has in common.
   *
   * The series' name and, if the invitation names one, the event with its
   * public address — both in the language the letter is written in (F125).
   * Through {@link EventsService.locate}, so an invitation to an event that is
   * still a draft — which is the normal case, because an organizer invites
   * before publishing — has a working link.
   *
   * The organizer's own words are not translated and never will be: `subject`
   * and `paragraphs` are what they typed, and a letter that translated half of
   * itself would be worse than one that translated none of it.
   */
  private async shared(
    invitation: InvitationRecord,
    locale: string,
  ): Promise<SharedContext> {
    return {
      seriesName: await this.series.nameOf(invitation.seriesId, locale),
      subject: invitation.subject,
      paragraphs: invitationParagraphs(invitation.body),
      event: invitation.eventId
        ? await this.mailEvent(invitation.eventId, locale)
        : null,
    };
  }

  private async mailEvent(
    eventId: string,
    locale: string,
  ): Promise<MailEvent | null> {
    try {
      const { event, seriesSlug } = await this.events.locate(eventId, locale);
      return {
        name: event.name,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        timezone: event.timezone,
        url: this.links.event(seriesSlug, event.slug),
      };
    } catch {
      // Deleted between writing the invitation and sending it. The message
      // still goes out — the organizer's words are the invitation, the event
      // block was the decoration.
      return null;
    }
  }
}

function reason(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

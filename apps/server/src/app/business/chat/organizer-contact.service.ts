import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import type {
  ContactRequestAcknowledgement,
  ContactRequestInput,
  PublicEvent,
} from '@trefaro/shared-models';
import {
  MAX_MESSAGE_LENGTH,
  invitationParagraphs,
  organizerConversationPath,
} from '@trefaro/shared-models';
import type { TrefaroEnv } from '../../core/config/env';
import { ENV } from '../../core/config/env.module';
import { EventSeriesService } from '../event-series';
import { EventsService } from '../events';
import { MailDeliveryError, MailService, PublicLinks } from '../mail';
import type { ContactRequestMailContext, MailEvent } from '../mail';
import {
  CONVERSATION_REPOSITORY,
  type ConversationRepository,
} from './ports/conversation.repository';

/**
 * Reaching the organizer without an account (FR 3.4, UC 14 — E39, F11).
 *
 * The one way into a conversation that needs no login. Somebody reads an event
 * landing page, has a question, and writes — the thesis's lowest possible
 * entry barrier, and the reason the `organizer_contact` kind exists.
 *
 * Five decisions carry it, and the first two are the ones to keep:
 *
 * 1. **The form gives no information away** (E10). Nothing here is looked up
 *    against the accounts or the registrations, so a known address and an
 *    unknown one do not merely *answer* the same — there is no branch that
 *    could tell them apart. That includes the failure: a mail server that is
 *    down does not change the answer either, because the request is already
 *    stored and a 503 for one address and a 202 for another would be exactly
 *    the disclosure this rule exists to prevent.
 * 2. **This is not part of the chat's module switch.** FR 3.4 is a P1
 *    requirement and the chat (FR 4.5) is an optional P2 module that requires
 *    `profiles` (E42) — so putting the contact form behind that switch would
 *    make an organization that runs no participant accounts unreachable. The
 *    switch decides whether the people *in* an instance may write to each
 *    other; it cannot decide whether the organization can be written to. What
 *    the two share is the table, which is why this service lives in the module
 *    that owns conversations.
 * 3. **Text only.** No picture, unlike every other message (E40): a public
 *    endpoint accepting bytes from somebody with no account behind them would
 *    be a second upload surface for no gain.
 * 4. **A past event can still be asked about.** Deliberately no `hasEnded`
 *    check, unlike the registration (E10's neighbour): "where is the
 *    recording" is a question about an event that is over. What is checked is
 *    the same visibility the landing page has — through
 *    {@link EventsService.getPublic}, so a draft answers 404 (F26).
 * 5. **The address is stored, never written to** (F55). The guest's address
 *    goes onto the conversation and into the notification's text, where the
 *    organizer reads it. The only mail this endpoint sends goes to the
 *    organization's own mailbox — so it cannot be used to send mail to a
 *    stranger, which is the one thing a public form with an address field
 *    would otherwise be good for.
 */
@Injectable()
export class OrganizerContactService {
  private readonly logger = new Logger(OrganizerContactService.name);

  constructor(
    @Inject(CONVERSATION_REPOSITORY)
    private readonly conversations: ConversationRepository,
    private readonly events: EventsService,
    // For the series' contact address: a request about an event of this series
    // belongs in the mailbox that series already advertises.
    private readonly series: EventSeriesService,
    private readonly mail: MailService,
    private readonly links: PublicLinks,
    @Inject(ENV) private readonly env: TrefaroEnv,
  ) {}

  /**
   * Stores the question and tells the organization about it.
   *
   * @throws NotFoundException — no published event at that address (F26).
   * @throws BadRequestException — a name or a message that is only
   * whitespace. The DTO bounds the lengths; what it cannot see is that
   * `"   "` has a length. The database would refuse it too
   * (`CHK_message_body`), and a constraint violation is not a sentence.
   */
  async submit(
    seriesSlug: string,
    eventSlug: string,
    input: ContactRequestInput,
  ): Promise<ContactRequestAcknowledgement> {
    const event = await this.events.getPublic(seriesSlug, eventSlug);

    const email = input.email.trim().toLowerCase();
    const name = input.name.trim();
    const body = input.body.trim();

    if (name.length === 0) {
      throw new BadRequestException('Please say who is writing.');
    }
    if (body.length === 0) {
      throw new BadRequestException(
        'A message needs words. An empty one is not a message.',
      );
    }
    if (body.length > MAX_MESSAGE_LENGTH) {
      throw new BadRequestException(
        `A message may be up to ${MAX_MESSAGE_LENGTH} characters.`,
      );
    }

    // The conversation and its first line in one transaction: an
    // `organizer_contact` row without a message says that somebody pressed a
    // button, which is nothing anybody could act on.
    const conversation = await this.conversations.createOrganizerContact({
      eventId: event.id,
      guestEmail: email,
      guestName: name,
      body,
    });

    await this.notify(seriesSlug, eventSlug, event, conversation.id, {
      name,
      email,
      body,
    });
    return { email };
  }

  /**
   * Tells the organization, and never fails the request for it.
   *
   * The notification is what spares the organization from polling the message
   * overview — it is not the record. The record is the conversation, which is
   * already written by the time this runs, so a mail server that is
   * unreachable costs a notification and nothing else. Resubmitting would
   * create a second request, which is the opposite of what somebody who did
   * not hear back should be pushed into.
   */
  private async notify(
    seriesSlug: string,
    eventSlug: string,
    event: PublicEvent,
    conversationId: string,
    guest: { name: string; email: string; body: string },
  ): Promise<void> {
    const recipient = await this.recipient(seriesSlug);

    try {
      await this.mail.sendContactRequest(
        recipient,
        async (locale): Promise<ContactRequestMailContext> => ({
          // Fetched again inside the callback, in the language the letter
          // turned out to be written in (F125): the event's name is content
          // the organization may have translated.
          event: await this.mailEvent(seriesSlug, eventSlug, locale),
          guestName: guest.name,
          guestEmail: guest.email,
          // One place decides what a blank line means. Named after where that
          // question came up first; a second definition of it is how two
          // renderings of one text start disagreeing.
          paragraphs: invitationParagraphs(guest.body),
          // The question itself, not the organizer client's front door: since
          // AP 10 there is a screen for one conversation, and the address of
          // it is spelled once, in `shared-models` (F172).
          answerUrl: this.links.adminUrl(
            organizerConversationPath(conversationId),
          ),
        }),
      );
    } catch (error: unknown) {
      if (!(error instanceof MailDeliveryError)) throw error;
      // Described, not addressed (F55): what failed belongs in the log, who
      // wrote does not.
      this.logger.error(
        `A contact request for ${seriesSlug}/${eventSlug} was stored, but the ` +
          'notification to the organization could not be sent. It is in the ' +
          'message overview.',
      );
    }
  }

  /**
   * The mailbox a contact request lands in.
   *
   * The series' own contact address first, because that is the address the
   * series page already shows to the public: a form that quietly delivered
   * somewhere else would answer from an address nobody advertised. When the
   * series has none, the instance's configured sender is the organization's
   * own mailbox — the one address every instance has, and the one replies to
   * its mails already arrive at.
   */
  private async recipient(seriesSlug: string): Promise<string> {
    const series = await this.series.getPublicBySlug(seriesSlug);
    const own = series.contactEmail?.trim();
    if (own) return own;

    this.logger.warn(
      `The series "${seriesSlug}" has no contact address, so a contact ` +
        'request was announced to the instance’s own sender address. Setting ' +
        'one on the series is what puts it in front of the right people.',
    );
    return mailboxOf(this.env.smtp.from);
  }

  private async mailEvent(
    seriesSlug: string,
    eventSlug: string,
    locale: string,
  ): Promise<MailEvent> {
    const event = await this.events.getPublic(seriesSlug, eventSlug, locale);
    return {
      name: event.name,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      timezone: event.timezone,
      url: this.links.event(seriesSlug, event.slug),
    };
  }
}

/**
 * The bare address out of a configured sender.
 *
 * `SMTP_FROM` is written for people — `Example NGO <events@example.org>` — and
 * a display name in a `To` header is noise in a mailbox that is talking to
 * itself. Anything that is not in that shape is passed through: it is then
 * already a bare address, or it is a misconfiguration the mail server should
 * report rather than this function.
 */
function mailboxOf(sender: string): string {
  return /<([^>]+)>/.exec(sender)?.[1].trim() ?? sender.trim();
}

import { Inject, Injectable, Logger } from '@nestjs/common';
import { MailCatalogue } from './mail-catalogue.service';
import { MAILER, type Mailer } from './ports/mailer';
import { MAIL_TEMPLATES } from './templates';
import type {
  ConfirmationMailContext,
  ContactRequestMailContext,
  InvitationMailContext,
  MailTemplate,
  ProfileConfirmationMailContext,
  ProfileExistsMailContext,
  ReceiptMailContext,
  RegistrationMailContext,
} from './templates';

/**
 * A mail's content, or how to build it once the language is known (F125).
 *
 * Four of the six mails name an event, and an event's name is content the
 * organization may have translated (FR 3.12). Which language a letter is
 * written in is decided one line below the caller — by the recipient's
 * preference and E24's whole-mail fallback together — so a caller that needs
 * its content in that same language cannot know it beforehand. It passes a
 * function instead and is called back with the answer.
 *
 * The other two mails name nothing translatable and pass a plain value: a
 * lambda that ignores its argument would be ceremony, not information.
 */
export type MailContent<Context> =
  Context | ((locale: string) => Context | Promise<Context>);

/** Raised when a message could not be handed to the mail server. */
export class MailDeliveryError extends Error {
  constructor(readonly cause: unknown) {
    super('The message could not be handed to the mail server');
    this.name = 'MailDeliveryError';
  }
}

/**
 * Composes and sends the instance's mail (FR 3.5, F8).
 *
 * Since AP 10 of phase 2 this class does not know a word of any language: the
 * text comes from {@link MailCatalogue}, which resolves it out of the catalogue
 * the organization maintains and decides — per mail, as E24 requires — which
 * language the letter can actually be written in. What is left here is the part
 * that has nothing to do with words: pick the template, hand it its strings, and
 * give the result to the mail server.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    @Inject(MAILER) private readonly mailer: Mailer,
    private readonly catalogue: MailCatalogue,
  ) {}

  /** The double opt-in request. @throws MailDeliveryError */
  async sendRegistrationConfirmation(
    to: string,
    content: MailContent<ConfirmationMailContext>,
  ): Promise<void> {
    await this.send(MAIL_TEMPLATES.registrationConfirmation, to, content);
  }

  /**
   * The receipt after a successful confirmation. @throws MailDeliveryError
   *
   * Also the message that carries the self-service link (E11), which is why it
   * is sent again when somebody re-submits the form for an address that is
   * already confirmed: "I lost my link" needs an answer that does not involve
   * the organizer.
   */
  async sendRegistrationConfirmed(
    to: string,
    content: MailContent<ReceiptMailContext>,
  ): Promise<void> {
    await this.send(MAIL_TEMPLATES.registrationConfirmed, to, content);
  }

  /**
   * Tells a participant that their registration was cancelled (F59).
   *
   * Transactional: it goes out whether or not the address has objected to being
   * invited (`contact_opt_out`), because it is not an invitation. Somebody who
   * asked not to be invited again still has to learn that they are no longer
   * expected at the door.
   *
   * @throws MailDeliveryError
   */
  async sendRegistrationCancelled(
    to: string,
    content: MailContent<RegistrationMailContext>,
  ): Promise<void> {
    await this.send(MAIL_TEMPLATES.registrationCancelled, to, content);
  }

  /**
   * One invitation to one former participant (FR 2.4). @throws MailDeliveryError
   *
   * One recipient per call, deliberately: a shared `To` or `CC` would show every
   * invited person who else was invited, which for an organization running
   * political events is a data breach with a single click. The sender loops.
   */
  async sendInvitation(
    to: string,
    content: MailContent<InvitationMailContext>,
  ): Promise<void> {
    await this.send(MAIL_TEMPLATES.invitation, to, content);
  }

  /**
   * The double opt-in for a new participant account (FR 4.1, E32).
   * @throws MailDeliveryError
   */
  async sendProfileConfirmation(
    to: string,
    content: MailContent<ProfileConfirmationMailContext>,
  ): Promise<void> {
    await this.send(MAIL_TEMPLATES.profileConfirmation, to, content);
  }

  /**
   * Tells somebody that the address they registered already has an account.
   *
   * Transactional and harmless: it carries no token and changes nothing, which
   * is what makes it safe to send on every repeated attempt. Not affected by
   * `contact_opt_out` (F59) — it is not an invitation, it is the answer the
   * registration form is not allowed to give (E32).
   *
   * @throws MailDeliveryError
   */
  async sendProfileExists(
    to: string,
    content: MailContent<ProfileExistsMailContext>,
  ): Promise<void> {
    await this.send(MAIL_TEMPLATES.profileExists, to, content);
  }

  /**
   * Tells the organization that somebody without an account wrote (F11).
   *
   * The only sender here whose recipient is the organization itself, which is
   * why the address is a parameter like everywhere else and yet means
   * something different: it is the mailbox the instance was configured with,
   * never an address a request supplied. F55 is untouched — the guest's own
   * address travels **inside** the letter, to be read by the organizer, and
   * nothing is sent to it.
   *
   * Its language is therefore the organization's default: the recipient has no
   * account, so {@link MailCatalogue} falls through to the instance's setting
   * (F125), which is the right answer for a letter to the organization about
   * its own event.
   *
   * @throws MailDeliveryError — and the caller answers 202 all the same: the
   * request is already stored, and a failure here must not turn into a form
   * that answers differently depending on the mail server (E10).
   */
  async sendContactRequest(
    to: string,
    content: MailContent<ContactRequestMailContext>,
  ): Promise<void> {
    await this.send(MAIL_TEMPLATES.contactRequest, to, content);
  }

  private async send<Context>(
    template: MailTemplate<Context>,
    to: string,
    content: MailContent<Context>,
  ): Promise<void> {
    // The address travels along to be read, not to be written to (F55): it
    // decides which language this letter is in (F125).
    const strings = await this.catalogue.strings(template.keys, to);
    const mail = template.render(
      strings,
      await resolve(content, strings.locale),
    );
    try {
      await this.mailer.send({ to, ...mail });
    } catch (error: unknown) {
      // Described, not addressed: what failed belongs in the log, who it was for
      // does not.
      this.logger.error(
        `Could not send ${template.name} (${strings.locale}): ` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
      throw new MailDeliveryError(error);
    }
  }
}

/**
 * The content, built in the language the letter is actually in.
 *
 * A context is never itself a function in this application, so the test is
 * unambiguous — and it is made in one place rather than in six senders.
 */
async function resolve<Context>(
  content: MailContent<Context>,
  locale: string,
): Promise<Context> {
  return typeof content === 'function'
    ? await (content as (locale: string) => Context | Promise<Context>)(locale)
    : content;
}

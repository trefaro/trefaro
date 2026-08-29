import { Inject, Injectable, Logger } from '@nestjs/common';
import { MailCatalogue } from './mail-catalogue.service';
import { MAILER, type Mailer } from './ports/mailer';
import { MAIL_TEMPLATES } from './templates';
import type {
  ConfirmationMailContext,
  InvitationMailContext,
  MailTemplate,
  ReceiptMailContext,
  RegistrationMailContext,
} from './templates';

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
    context: ConfirmationMailContext,
  ): Promise<void> {
    await this.send(MAIL_TEMPLATES.registrationConfirmation, to, context);
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
    context: ReceiptMailContext,
  ): Promise<void> {
    await this.send(MAIL_TEMPLATES.registrationConfirmed, to, context);
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
    context: RegistrationMailContext,
  ): Promise<void> {
    await this.send(MAIL_TEMPLATES.registrationCancelled, to, context);
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
    context: InvitationMailContext,
  ): Promise<void> {
    await this.send(MAIL_TEMPLATES.invitation, to, context);
  }

  private async send<Context>(
    template: MailTemplate<Context>,
    to: string,
    context: Context,
  ): Promise<void> {
    const strings = await this.catalogue.strings(template.keys);
    const mail = template.render(strings, context);
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

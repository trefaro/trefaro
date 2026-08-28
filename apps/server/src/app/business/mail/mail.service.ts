import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  APP_CONFIG_REPOSITORY,
  type AppConfigReader,
} from '../config/ports/app-config.repository';
import { MAILER, type Mailer } from './ports/mailer';
import { mailTemplates } from './templates';
import type {
  ConfirmationMailContext,
  InvitationMailContext,
  ReceiptMailContext,
  RegistrationMailContext,
  RenderedMail,
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
 * The language is the one the organization configured, not one guessed from the
 * request: an instance run in German writes German, and phase 1 has no place to
 * ask a participant for a preference. Once profiles exist (phase 3) the choice
 * moves to the person; nothing here has to change for that but the lookup.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    @Inject(MAILER) private readonly mailer: Mailer,
    @Inject(APP_CONFIG_REPOSITORY)
    private readonly appConfig: AppConfigReader,
  ) {}

  /** The double opt-in request. @throws MailDeliveryError */
  async sendRegistrationConfirmation(
    to: string,
    context: ConfirmationMailContext,
  ): Promise<void> {
    const templates = await this.templates();
    await this.deliver(
      to,
      templates.registrationConfirmation(context),
      `registration confirmation (${templates.locale})`,
    );
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
    const templates = await this.templates();
    await this.deliver(
      to,
      templates.registrationConfirmed(context),
      `registration receipt (${templates.locale})`,
    );
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
    const templates = await this.templates();
    await this.deliver(
      to,
      templates.registrationCancelled(context),
      `cancellation notice (${templates.locale})`,
    );
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
    const templates = await this.templates();
    await this.deliver(
      to,
      templates.invitation(context),
      `invitation (${templates.locale})`,
    );
  }

  private async templates() {
    const config = await this.appConfig.load();
    return mailTemplates(config.defaultLocale);
  }

  private async deliver(
    to: string,
    mail: RenderedMail,
    description: string,
  ): Promise<void> {
    try {
      await this.mailer.send({ to, ...mail });
    } catch (error: unknown) {
      // Described, not addressed: what failed belongs in the log, who it was for
      // does not.
      this.logger.error(
        `Could not send ${description}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new MailDeliveryError(error);
    }
  }
}

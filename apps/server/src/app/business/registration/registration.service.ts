import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type {
  PublicEvent,
  RegistrationAcknowledgement,
  RegistrationConfirmation,
  RegistrationInput,
} from '@trefaro/shared-models';
import { hasEnded } from '@trefaro/shared-models';
import type { TrefaroEnv } from '../../core/config/env';
import { ENV } from '../../core/config/env.module';
import { EventsService } from '../events';
import { MailDeliveryError, MailService } from '../mail';
import type { MailEvent, RegistrationMailContext } from '../mail';
import { CONFIRMATION_TOKEN_TTL_MS, TokenSigner } from '../security';
import {
  REGISTRATION_REPOSITORY,
  type RegistrationRecord,
  type RegistrationRepository,
} from './ports/registration.repository';

/** Where the confirmation link points — a page in the participant client (E5b). */
const CONFIRMATION_PATH = '/registrations/confirm';

/**
 * Registering for an event, with double opt-in (UC 07, FR 3.5).
 *
 * Three properties of this flow are load-bearing and easy to lose:
 *
 * 1. **The answer never varies.** Whether the address was unknown, already
 *    pending or long confirmed, the caller gets the same acknowledgement (E10).
 *    Anything else turns a public form into a query against the participant
 *    list, which for an organization running political events is a real risk.
 * 2. **Confirmation is a state change, so it happens on POST.** The mail links
 *    to a page; the page asks. A mail scanner that prefetches links therefore
 *    confirms nothing, and the participant gets an actual answer (E5b).
 * 3. **A second registration attempt never creates a second row.** The unique
 *    index decides that (E10); this service reacts by sending the mail that
 *    fits the state the registration is already in.
 */
@Injectable()
export class RegistrationService {
  private readonly logger = new Logger(RegistrationService.name);

  constructor(
    @Inject(REGISTRATION_REPOSITORY)
    private readonly registrations: RegistrationRepository,
    private readonly events: EventsService,
    private readonly mail: MailService,
    private readonly tokens: TokenSigner,
    @Inject(ENV) private readonly env: TrefaroEnv,
  ) {}

  async register(
    seriesSlug: string,
    eventSlug: string,
    input: RegistrationInput,
  ): Promise<RegistrationAcknowledgement> {
    // Through the public lookup, so a draft event — and any event of a series
    // that is not public — cannot be registered for at all (F26).
    const event = await this.events.getPublic(seriesSlug, eventSlug);
    if (hasEnded(event)) {
      throw new ConflictException('This event has already taken place.');
    }

    const email = normalizeEmail(input.email);
    const existing = await this.registrations.findByEventAndEmail(
      event.id,
      email,
    );
    const registration = existing
      ? await this.reuse(existing, input)
      : await this.add(event.id, email, input);

    await this.notify(registration, event, seriesSlug);
    return { email };
  }

  /**
   * Turns a pending registration into a confirmed one — and nothing else.
   *
   * Idempotent by design: people click a link twice, and forwarded mail gets
   * opened by a colleague. Only `pending → confirmed` is a transition; a second
   * click reports what is already true instead of failing (E5b).
   */
  async confirm(token: string): Promise<RegistrationConfirmation> {
    const id = this.tokens.verify('registration-confirmation', token);
    if (!id) {
      throw new BadRequestException(
        'This confirmation link is not valid any more. Please register again to receive a new one.',
      );
    }

    const registration = await this.require(id);
    const { event, seriesSlug } = await this.events.locate(
      registration.eventId,
    );
    const about = {
      eventName: event.name,
      seriesSlug,
      eventSlug: event.slug,
    };

    if (registration.status === 'confirmed') {
      return { state: 'already-confirmed', ...about };
    }
    if (registration.status === 'cancelled') {
      throw new ConflictException(
        'This registration was cancelled. Please register again if you would like to take part.',
      );
    }

    const confirmed = await this.registrations.update(registration.id, {
      status: 'confirmed',
      confirmedAt: new Date(),
    });
    if (!confirmed) throw new NotFoundException(GONE);

    // The receipt is a courtesy. The confirmation has already happened, and
    // failing the request now would leave the participant believing it did not.
    await this.sendReceipt(confirmed, event, seriesSlug);
    return { state: 'confirmed', ...about };
  }

  /**
   * Removes a registration for good (E14).
   *
   * Always allowed, whatever its status: this is the answer to "please delete my
   * data", and the groundwork for the erasure functions of phase 5. Cancelling
   * instead — which keeps the record and frees the seat — arrives with the
   * participant overview in AP 5, together with everything else an organizer
   * does to a single registration. From AP 7 this also removes the files that
   * were uploaded with it, which is why it is a service method and not a plain
   * repository call.
   */
  async remove(id: string): Promise<void> {
    if (!(await this.registrations.delete(id))) {
      throw new NotFoundException(GONE);
    }
  }

  private async add(
    eventId: string,
    email: string,
    input: RegistrationInput,
  ): Promise<RegistrationRecord> {
    return this.registrations.create({
      eventId,
      email,
      status: 'pending',
      ...personalDetails(input),
    });
  }

  /**
   * A repeated attempt on an address that is already registered.
   *
   * A registration that is not confirmed yet is still being written, so a
   * corrected name or a phone number added on the second try is applied — and a
   * cancelled one comes back as pending, because someone submitting the form
   * again is saying they changed their mind.
   *
   * A **confirmed** registration is left untouched. This endpoint is public and
   * unauthenticated: anyone who knows a participant's address could otherwise
   * rewrite their name, and there is nothing here to authorize that.
   */
  private async reuse(
    existing: RegistrationRecord,
    input: RegistrationInput,
  ): Promise<RegistrationRecord> {
    if (existing.status === 'confirmed') return existing;

    return (
      (await this.registrations.update(existing.id, {
        status: 'pending',
        ...personalDetails(input),
      })) ?? existing
    );
  }

  private async notify(
    registration: RegistrationRecord,
    event: PublicEvent,
    seriesSlug: string,
  ): Promise<void> {
    if (registration.status === 'confirmed') {
      // Carries no link that grants anything, so sending it again on request is
      // harmless — and it is the answer to "I never got a confirmation".
      await this.sendReceipt(registration, event, seriesSlug);
      return;
    }

    const token = this.tokens.sign(
      'registration-confirmation',
      registration.id,
      CONFIRMATION_TOKEN_TTL_MS,
    );

    try {
      await this.mail.sendRegistrationConfirmation(registration.email, {
        ...this.context(registration, event, seriesSlug),
        confirmUrl: `${this.clientUrl(CONFIRMATION_PATH)}?token=${encodeURIComponent(token)}`,
      });
    } catch (error: unknown) {
      if (!(error instanceof MailDeliveryError)) throw error;
      // Without this mail the registration cannot be completed, so the
      // participant has to know it did not go out. The row stays pending;
      // submitting the form again sends it once more.
      throw new ServiceUnavailableException(
        'The confirmation e-mail could not be sent. Please try again in a moment.',
      );
    }
  }

  private async sendReceipt(
    registration: RegistrationRecord,
    event: PublicEvent,
    seriesSlug: string,
  ): Promise<void> {
    try {
      await this.mail.sendRegistrationConfirmed(
        registration.email,
        this.context(registration, event, seriesSlug),
      );
    } catch (error: unknown) {
      if (!(error instanceof MailDeliveryError)) throw error;
      this.logger.warn(
        `Registration ${registration.id} is confirmed, but the receipt could not be sent.`,
      );
    }
  }

  private context(
    registration: RegistrationRecord,
    event: PublicEvent,
    seriesSlug: string,
  ): RegistrationMailContext {
    const mailEvent: MailEvent = {
      name: event.name,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      timezone: event.timezone,
      url: this.clientUrl(`/series/${seriesSlug}/events/${event.slug}`),
    };
    return { firstName: registration.firstName, event: mailEvent };
  }

  private async require(id: string): Promise<RegistrationRecord> {
    const found = await this.registrations.findById(id);
    if (!found) throw new NotFoundException(GONE);
    return found;
  }

  /** Absolute, because it is read in a mail client and not in the app. */
  private clientUrl(path: string): string {
    return `${this.env.publicUserClientUrl.replace(/\/+$/, '')}${path}`;
  }
}

/** Said the same way wherever a registration cannot be found any more. */
const GONE = 'This registration no longer exists.';

/** Addresses are compared and stored in one form; see `NewRegistration.email`. */
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function personalDetails(input: RegistrationInput) {
  return {
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    phone: optional(input.phone),
    origin: optional(input.origin),
    newsletterOptIn: input.newsletterOptIn ?? false,
  };
}

/** An empty form field means "not given", not the empty string. */
function optional(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

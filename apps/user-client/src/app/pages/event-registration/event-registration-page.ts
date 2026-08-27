import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AppConfigService } from '@trefaro/shared-config';
import type { ApiError } from '@trefaro/shared-http';
import type { PublicEvent } from '@trefaro/shared-models';
import { formatEventPeriod } from '@trefaro/shared-models';
import { PublicEventsService } from '../../features/events/public-events.service';
import { RegistrationsService } from '../../features/registrations/registration.service';

/**
 * The registration form (FR 3.5, mockups 5.4) — the survey's second highest
 * rated function (3,69).
 *
 * Mandatory: first name, last name, e-mail. Phone and origin are asked for
 * because organizers need them for travel and visa letters, but they are
 * optional: an event that does not need them must not turn them into a barrier.
 * The newsletter box is never pre-checked — consent that was not given is not
 * consent (E15).
 *
 * Nothing is registered when this form is submitted. The confirmation mail is,
 * which is why the page then says so in as many words instead of congratulating
 * anybody.
 */
@Component({
  selector: 'trefaro-event-registration-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    @if (sentTo(); as address) {
      <section class="done">
        <h1>Almost done</h1>
        <p>
          We have sent a confirmation link to <strong>{{ address }}</strong>.
          Open it to complete your registration — until then nothing is
          reserved.
        </p>
        <p class="hint">
          No mail after a few minutes? Check the spam folder, or submit the form
          again to have the link sent once more.
        </p>
        <p>
          <a [routerLink]="['/series', seriesSlug(), 'events', eventSlug()]">
            Back to the event
          </a>
        </p>
      </section>
    } @else {
      <h1>Register</h1>
      @if (event(); as item) {
        <p class="event">
          <strong>{{ item.name }}</strong>
          <span>{{ when() }}</span>
        </p>
      }

      @if (error()) {
        <p class="notice" role="alert">{{ error() }}</p>
      }

      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <label>
          <span>First name *</span>
          <input formControlName="firstName" autocomplete="given-name" />
        </label>
        <label>
          <span>Last name *</span>
          <input formControlName="lastName" autocomplete="family-name" />
        </label>
        <label>
          <span>E-mail *</span>
          <input
            formControlName="email"
            type="email"
            inputmode="email"
            autocomplete="email"
          />
        </label>
        <label>
          <span>Phone</span>
          <input formControlName="phone" type="tel" autocomplete="tel" />
        </label>
        <label>
          <span>Where are you coming from?</span>
          <input formControlName="origin" autocomplete="organization" />
        </label>

        <label class="check">
          <input formControlName="newsletterOptIn" type="checkbox" />
          <span>
            Tell me about later events of this series. You can object at any
            time.
          </span>
        </label>

        <button type="submit" [disabled]="busy()">
          {{ busy() ? 'Sending…' : 'Register' }}
        </button>
        <p class="hint">
          We will send you a confirmation link. Your registration counts once you
          have opened it.
        </p>
      </form>
    }
  `,
  styles: `
    :host {
      display: block;
      max-inline-size: 34rem;
    }

    .event {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
      margin-block-end: 1.5rem;
    }

    form {
      display: flex;
      flex-direction: column;
      gap: 0.9rem;
    }

    label {
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
    }

    label > span {
      font-weight: 600;
    }

    input {
      padding: 0.6rem;
      border: 1px solid color-mix(in oklab, currentColor 35%, transparent);
      border-radius: 0.4rem;
      font: inherit;
    }

    .check {
      flex-direction: row;
      align-items: start;
      gap: 0.6rem;
    }

    .check > span {
      font-weight: 400;
    }

    .check input {
      inline-size: 1.1rem;
      block-size: 1.1rem;
      margin-block-start: 0.15rem;
    }

    button {
      align-self: start;
      padding: 0.7rem 1.3rem;
      border: 0;
      border-radius: 0.4rem;
      background: var(--trefaro-color-primary);
      color: var(--trefaro-color-on-primary);
      font: inherit;
      font-weight: 600;
    }

    button:disabled {
      opacity: 0.55;
    }

    .hint {
      color: color-mix(in oklab, currentColor 70%, transparent);
      font-size: 0.9rem;
    }

    .notice {
      color: var(--trefaro-color-primary-strong);
    }

    .done h1 {
      margin-block-end: 0.5rem;
    }
  `,
})
export class EventRegistrationPage {
  /** Both bound from the route by `withComponentInputBinding()`. */
  readonly seriesSlug = input.required<string>();
  readonly eventSlug = input.required<string>();

  private readonly events = inject(PublicEventsService);
  private readonly registrations = inject(RegistrationsService);
  private readonly config = inject(AppConfigService);

  protected readonly event = signal<PublicEvent | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);
  /** Set once the form went through; the address the link was sent to. */
  protected readonly sentTo = signal<string | null>(null);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    origin: [''],
    newsletterOptIn: [false],
  });

  protected readonly when = computed(() => {
    const event = this.event();
    return event
      ? formatEventPeriod(event, this.config.config()?.defaultLocale ?? 'en')
      : '';
  });

  constructor() {
    // The event is shown for reassurance, not needed to submit: someone who
    // followed a link should see which event they are registering for.
    effect(() => {
      void this.load(this.seriesSlug(), this.eventSlug());
    });
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.busy()) {
      this.form.markAllAsTouched();
      return;
    }

    this.busy.set(true);
    this.error.set(null);

    const raw = this.form.getRawValue();
    try {
      const answer = await this.registrations.register(
        this.seriesSlug(),
        this.eventSlug(),
        {
          firstName: raw.firstName,
          lastName: raw.lastName,
          email: raw.email,
          phone: raw.phone.trim() || null,
          origin: raw.origin.trim() || null,
          newsletterOptIn: raw.newsletterOptIn,
        },
      );
      this.sentTo.set(answer.email);
    } catch (error: unknown) {
      this.error.set(
        (error as ApiError)?.message ??
          'The registration could not be sent. Please try again.',
      );
    } finally {
      this.busy.set(false);
    }
  }

  private async load(seriesSlug: string, eventSlug: string): Promise<void> {
    try {
      this.event.set(await this.events.get(seriesSlug, eventSlug));
    } catch {
      // Deliberately quiet: the form still works, and the server decides
      // whether this event can be registered for at all.
      this.event.set(null);
    }
  }
}

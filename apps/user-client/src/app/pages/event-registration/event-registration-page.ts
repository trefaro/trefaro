import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import {
  FormControl,
  FormBuilder,
  FormRecord,
  ReactiveFormsModule,
  Validators,
  type ValidatorFn,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AppConfigService } from '@trefaro/shared-config';
import type { ApiError } from '@trefaro/shared-http';
import type {
  PublicEvent,
  RegistrationFieldPublic,
} from '@trefaro/shared-models';
import {
  MAX_CUSTOM_TEXT_LENGTH,
  formatEventPeriod,
} from '@trefaro/shared-models';
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
 * Everything below those five is built from the event's own field definitions
 * (F12): the form is read from the server on every visit, so a question an
 * organizer added a minute ago is asked now. The client validates against the
 * same definitions, which is a courtesy — the server validates again, and it is
 * the server that decides.
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
          We have sent a confirmation link to <strong>{{ address }}</strong
          >. Open it to complete your registration — until then nothing is
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

        @if (fields().length > 0) {
          <div class="custom" formGroupName="customFields">
            @for (field of fields(); track field.key) {
              <div class="custom__field">
                @if (field.type === 'checkbox') {
                  <label class="check">
                    <input
                      type="checkbox"
                      [formControlName]="field.key"
                      [attr.aria-describedby]="describedBy(field)"
                    />
                    <span>{{ labelOf(field) }}</span>
                  </label>
                } @else if (field.type === 'select') {
                  <label>
                    <span>{{ labelOf(field) }}</span>
                    <select
                      [formControlName]="field.key"
                      [attr.aria-describedby]="describedBy(field)"
                    >
                      <!-- An empty first option, so nothing is answered by
                           accident for somebody who scrolled past. -->
                      <option value="">Please choose…</option>
                      @for (option of field.options; track option) {
                        <option [value]="option">{{ option }}</option>
                      }
                    </select>
                  </label>
                } @else {
                  <label>
                    <span>{{ labelOf(field) }}</span>
                    <input
                      [formControlName]="field.key"
                      [attr.maxlength]="maxTextLength"
                      [attr.aria-describedby]="describedBy(field)"
                    />
                  </label>
                }
                @if (field.helpText) {
                  <small class="hint" [id]="hintId(field)">
                    {{ field.helpText }}
                  </small>
                }
              </div>
            }
          </div>
        }

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
          We will send you a confirmation link. Your registration counts once
          you have opened it.
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

    input,
    select {
      padding: 0.6rem;
      border: 1px solid color-mix(in oklab, currentColor 35%, transparent);
      border-radius: 0.4rem;
      font: inherit;
    }

    .custom,
    .custom__field {
      display: flex;
      flex-direction: column;
      gap: 0.9rem;
    }

    .custom__field {
      gap: 0.3rem;
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
  /** The extra questions this event asks (F12), in form order. */
  protected readonly fields = signal<readonly RegistrationFieldPublic[]>([]);

  protected readonly maxTextLength = MAX_CUSTOM_TEXT_LENGTH;

  /**
   * The answers, one control per defined field.
   *
   * A `FormRecord` rather than a second typed group: the control names are not
   * known until the definitions are read, which is exactly the case it exists
   * for.
   */
  private readonly answers = new FormRecord<FormControl<string | boolean>>({});

  protected readonly form = inject(FormBuilder).nonNullable.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    origin: [''],
    newsletterOptIn: [false],
    customFields: this.answers,
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

    effect(() => {
      void this.loadFields(this.seriesSlug(), this.eventSlug());
    });
  }

  /** The label as it is read, with the asterisk the mandatory fields carry. */
  protected labelOf(field: RegistrationFieldPublic): string {
    return field.required ? `${field.label} *` : field.label;
  }

  protected hintId(field: RegistrationFieldPublic): string {
    return `hint-${field.key}`;
  }

  protected describedBy(field: RegistrationFieldPublic): string | null {
    return field.helpText ? this.hintId(field) : null;
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
          customFields: raw.customFields,
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

  /**
   * Reads the form definition and builds the controls for it.
   *
   * On failure the extra fields are left out rather than the page: the five
   * fields FR 3.5 names always work, and a registration that is missing a
   * required answer is refused by the server with the reason.
   */
  private async loadFields(
    seriesSlug: string,
    eventSlug: string,
  ): Promise<void> {
    let fields: readonly RegistrationFieldPublic[] = [];
    try {
      fields = await this.registrations.fields(seriesSlug, eventSlug);
    } catch {
      fields = [];
    }
    this.fields.set(fields);
    this.syncAnswers(fields);
  }

  /**
   * Brings the controls in line with the definitions.
   *
   * Existing controls are kept: this runs again when the route parameters are
   * re-emitted, and rebuilding the record would throw away what somebody has
   * already typed.
   */
  private syncAnswers(fields: readonly RegistrationFieldPublic[]): void {
    const wanted = new Map(fields.map((field) => [field.key, field]));

    for (const key of Object.keys(this.answers.controls)) {
      if (!wanted.has(key)) this.answers.removeControl(key);
    }
    for (const [key, field] of wanted) {
      if (this.answers.contains(key)) continue;
      this.answers.addControl(
        key,
        new FormControl<string | boolean>(
          field.type === 'checkbox' ? false : '',
          {
            nonNullable: true,
            validators: validatorsFor(field),
          },
        ),
      );
    }
  }
}

/**
 * What the browser checks before the request goes out.
 *
 * A courtesy, not the rule: the server validates against the same definitions
 * and is what decides. `requiredTrue` for a checkbox, because a required
 * checkbox has to be ticked rather than merely answered.
 */
function validatorsFor(field: RegistrationFieldPublic): ValidatorFn[] {
  const validators: ValidatorFn[] = [];
  if (field.required) {
    validators.push(
      field.type === 'checkbox' ? Validators.requiredTrue : Validators.required,
    );
  }
  if (field.type === 'text') {
    validators.push(Validators.maxLength(MAX_CUSTOM_TEXT_LENGTH));
  }
  return validators;
}

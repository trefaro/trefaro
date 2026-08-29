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
import { TranslocoPipe } from '@jsverse/transloco';
import { problemOf, type Problem } from '@trefaro/shared-http';
import { TranslationService } from '@trefaro/shared-i18n';
import type {
  PublicEvent,
  RegistrationFieldPublic,
} from '@trefaro/shared-models';
import {
  MAX_CUSTOM_TEXT_LENGTH,
  acceptAttribute,
  formatBytes,
  formatEventPeriod,
  uploadTypeLabelKey,
} from '@trefaro/shared-models';
import { PublicEventsService } from '../../features/events/public-events.service';
import {
  RegistrationsService,
  type RegistrationFileAnswer,
} from '../../features/registrations/registration.service';

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
  imports: [ReactiveFormsModule, RouterLink, TranslocoPipe],
  template: `
    @if (sentTo(); as address) {
      <section class="done">
        <h1>{{ 'register.done.title' | transloco }}</h1>
        <!-- One key for the whole sentence, with the address in it: a sentence
             built around an element is three fragments to whoever translates it,
             and German would not put them in this order. The cost is the bold
             address, which is not worth a broken translation unit. -->
        <p>{{ 'register.done.sentTo' | transloco: { address } }}</p>
        <p class="hint">{{ 'register.done.noMail' | transloco }}</p>
        <p>
          <a [routerLink]="['/series', seriesSlug(), 'events', eventSlug()]">
            {{ 'register.backToEvent' | transloco }}
          </a>
        </p>
      </section>
    } @else {
      <h1>{{ 'register.title' | transloco }}</h1>
      @if (event(); as item) {
        <p class="event">
          <strong>{{ item.name }}</strong>
          <span>{{ when() }}</span>
        </p>
      }

      @if (error(); as problem) {
        <p class="notice" role="alert">
          {{ problem.key | transloco: problem.params }}
          @if (problem.detail; as detail) {
            <span class="notice__detail">{{ detail }}</span>
          }
        </p>
      }

      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <label>
          <span>{{ 'register.firstName' | transloco }} *</span>
          <input formControlName="firstName" autocomplete="given-name" />
        </label>
        <label>
          <span>{{ 'register.lastName' | transloco }} *</span>
          <input formControlName="lastName" autocomplete="family-name" />
        </label>
        <label>
          <span>{{ 'register.email' | transloco }} *</span>
          <input
            formControlName="email"
            type="email"
            inputmode="email"
            autocomplete="email"
          />
        </label>
        <label>
          <span>{{ 'register.phone' | transloco }}</span>
          <input formControlName="phone" type="tel" autocomplete="tel" />
        </label>
        <label>
          <span>{{ 'register.origin' | transloco }}</span>
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
                      <option value="">
                        {{ 'register.choose' | transloco }}
                      </option>
                      @for (option of field.options; track option) {
                        <option [value]="option">{{ option }}</option>
                      }
                    </select>
                  </label>
                } @else if (field.type === 'file') {
                  <label>
                    <span>{{ labelOf(field) }}</span>
                    <input
                      type="file"
                      [attr.accept]="acceptOf(field)"
                      [attr.aria-describedby]="describedBy(field)"
                      (change)="pick(field, $event)"
                    />
                  </label>
                  <small class="hint">{{ fileHint(field) }}</small>
                  @if (fileProblem(field); as problem) {
                    <small class="notice" role="alert">{{ problem }}</small>
                  }
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
          <span>{{ 'register.newsletter' | transloco }}</span>
        </label>

        <button type="submit" [disabled]="busy()">
          {{ (busy() ? 'register.sending' : 'register.submit') | transloco }}
        </button>
        <p class="hint">{{ 'register.hint' | transloco }}</p>
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
  private readonly i18n = inject(TranslationService);

  protected readonly event = signal<PublicEvent | null>(null);
  protected readonly error = signal<Problem | null>(null);
  protected readonly busy = signal(false);
  /** Set once the form went through; the address the link was sent to. */
  protected readonly sentTo = signal<string | null>(null);
  /** The extra questions this event asks (F12), in form order. */
  protected readonly fields = signal<readonly RegistrationFieldPublic[]>([]);

  protected readonly maxTextLength = MAX_CUSTOM_TEXT_LENGTH;

  /**
   * The files picked so far, by field key.
   *
   * Outside the form group on purpose: the value of a file input cannot be set
   * programmatically, so a form control for it would be a control the form
   * cannot own — and `customFields` must not carry a value for a file field,
   * which the server refuses (F37).
   */
  private readonly chosen = signal<Record<string, File>>({});
  /** What is wrong with a picked file, by field key — shown under the input. */
  private readonly problems = signal<Record<string, string>>({});

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
    // The reader's language, not the instance's: the zone stays the event's (E8).
    return event ? formatEventPeriod(event, this.i18n.locale()) : '';
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

  protected acceptOf(field: RegistrationFieldPublic): string | null {
    return field.accept.length > 0 ? acceptAttribute(field.accept) : null;
  }

  /** What a participant needs to know before opening the file picker. */
  protected fileHint(field: RegistrationFieldPublic): string {
    const types = this.typeList(field);
    const limit = field.maxSizeBytes;
    return limit
      ? this.i18n.translate('register.file.typesUpTo', {
          types,
          size: formatBytes(limit, this.i18n.locale()),
        })
      : types;
  }

  /**
   * The types a field accepts, each named in the reader's language.
   *
   * A type the catalogue does not name falls back to its MIME type: a field
   * written before a type left {@link UPLOAD_TYPES} still exists, and neither
   * the hint nor the picker should break over it.
   */
  private typeList(field: RegistrationFieldPublic): string {
    return field.accept
      .map((mimeType) => {
        const key = uploadTypeLabelKey(mimeType);
        return key ? this.i18n.translate(key) : mimeType;
      })
      .join(', ');
  }

  protected fileProblem(field: RegistrationFieldPublic): string | null {
    return this.problems()[field.key] ?? null;
  }

  /**
   * Takes the file the participant picked, or says why it cannot be sent.
   *
   * Checked here as a courtesy — the server checks the same things and more,
   * including whether the bytes are of the type they claim. The point of doing
   * it twice is that somebody on a slow connection learns about a file that is
   * too large before uploading it.
   */
  protected pick(field: RegistrationFieldPublic, event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    const problem = file ? this.reject(field, file) : null;

    this.problems.update((problems) => {
      const next = { ...problems };
      if (problem) next[field.key] = problem;
      else delete next[field.key];
      return next;
    });

    this.chosen.update((chosen) => {
      const next = { ...chosen };
      if (file && !problem) next[field.key] = file;
      else delete next[field.key];
      return next;
    });
  }

  private reject(field: RegistrationFieldPublic, file: File): string | null {
    const locale = this.i18n.locale();
    if (field.accept.length > 0 && !field.accept.includes(file.type)) {
      return this.i18n.translate('register.file.wrongType', {
        types: this.typeList(field),
      });
    }
    if (field.maxSizeBytes !== null && file.size > field.maxSizeBytes) {
      return this.i18n.translate('register.file.tooLarge', {
        size: formatBytes(file.size, locale),
        limit: formatBytes(field.maxSizeBytes, locale),
      });
    }
    if (file.size === 0) return this.i18n.translate('register.file.empty');
    return null;
  }

  /** Required file fields nothing has been picked for yet. */
  private missingFiles(): readonly RegistrationFieldPublic[] {
    const chosen = this.chosen();
    return this.fields().filter(
      (field) => field.type === 'file' && field.required && !chosen[field.key],
    );
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

    // A file input has no validator of its own, so the required ones are
    // checked here — and named, because "Register" doing nothing is worse than
    // any error message.
    const missing = this.missingFiles();
    if (missing.length > 0) {
      this.error.set({
        key: 'register.error.missingFiles',
        // The labels are the organizer's own words in the organizer's own
        // language; they are named, not translated.
        params: {
          fields: missing.map((field) => `"${field.label}"`).join(', '),
        },
        detail: null,
      });
      return;
    }

    this.busy.set(true);
    this.error.set(null);

    const raw = this.form.getRawValue();
    const files: readonly RegistrationFileAnswer[] = Object.entries(
      this.chosen(),
    ).map(([fieldKey, file]) => ({ fieldKey, file }));
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
        files,
      );
      this.sentTo.set(answer.email);
    } catch (error: unknown) {
      // The server's reason is kept beside this client's sentence (F77): it is
      // what names the field that was refused, and no key here can do that.
      this.error.set(problemOf(error, 'register.error.failed'));
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
    // File fields deliberately get no control: their answer is a part of the
    // request, not a value in `customFields`, and a value there is refused
    // (F37).
    const wanted = new Map(
      fields
        .filter((field) => field.type !== 'file')
        .map((field) => [field.key, field]),
    );

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

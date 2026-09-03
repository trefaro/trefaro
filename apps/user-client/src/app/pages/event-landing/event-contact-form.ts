import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  MAX_GUEST_EMAIL_LENGTH,
  MAX_GUEST_NAME_LENGTH,
  MAX_MESSAGE_LENGTH,
} from '@trefaro/shared-models';
import { ContactService } from '../../features/contact/contact.service';

/**
 * The contact form of an event landing page (FR 3.4, UC 14, F11) — AP 9.
 *
 * "Kontaktaufnahme mit dem Veranstalter ist auch ohne Registrierung möglich",
 * and this is where that happens: three fields on the page somebody arrived
 * at, no account, no login, and the answer comes by e-mail (F11) — which the
 * form says out loud, because a form that promises nothing is a form nobody
 * knows what to expect from.
 *
 * Its own component rather than another block in the landing page, for the
 * reason that page is already six hundred lines: this has a form, a request,
 * three states and a spec of its own, and the page's job is to place it.
 *
 * Four decisions:
 *
 * 1. **Shown for a past event too.** Unlike the registration button, which
 *    disappears once an event is over: "where is the recording" is a question
 *    about an event that has happened, and the server agrees (it checks
 *    visibility, not the date).
 * 2. **Not behind the `chat` switch, and not behind a session.** This is the
 *    P1 half of FR 3.4; the messaging of FR 4.5 is an optional module (E42).
 *    An instance with no participant accounts still has a contact form.
 * 3. **The form is closed while it is being sent** — `<fieldset [disabled]>` —
 *    so nobody types into a form that is about to be replaced.
 * 4. **The answer is a state, not a notice.** Sending replaces the form with
 *    what happens next and offers to write again, because the one thing
 *    somebody wants to know afterwards is where the answer will arrive.
 */
@Component({
  selector: 'trefaro-event-contact-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslocoPipe],
  template: `
    <section aria-labelledby="contact-heading">
      <h2 id="contact-heading">{{ 'contact.title' | transloco }}</h2>

      @if (sentTo(); as address) {
        <p>{{ 'contact.done.sentTo' | transloco: { address } }}</p>
        <p>
          <button type="button" (click)="again()">
            {{ 'contact.done.again' | transloco }}
          </button>
        </p>
      } @else {
        <p class="lead">{{ 'contact.lead' | transloco }}</p>

        @if (failed()) {
          <p class="notice" role="alert">{{ 'contact.error' | transloco }}</p>
        }

        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <fieldset [disabled]="busy()">
            <label>
              <span>{{ 'contact.name' | transloco }} *</span>
              <input
                formControlName="name"
                autocomplete="name"
                [maxlength]="maxName"
              />
            </label>
            <label>
              <span>{{ 'contact.email' | transloco }} *</span>
              <input
                formControlName="email"
                type="email"
                inputmode="email"
                autocomplete="email"
                [maxlength]="maxEmail"
              />
            </label>
            <label>
              <span>{{ 'contact.message' | transloco }} *</span>
              <textarea
                formControlName="body"
                rows="5"
                [maxlength]="maxBody"
              ></textarea>
            </label>

            <button type="submit">
              {{ (busy() ? 'contact.sending' : 'contact.submit') | transloco }}
            </button>
            <small class="hint">{{ 'contact.hint' | transloco }}</small>
          </fieldset>
        </form>
      }
    </section>
  `,
  styles: `
    :host {
      display: block;
      max-inline-size: 40rem;
      margin-block: 1.75rem;
    }

    h2 {
      margin-block: 0 0.3rem;
      font-size: 1rem;
    }

    .lead {
      margin-block: 0 1rem;
    }

    fieldset {
      display: flex;
      flex-direction: column;
      gap: 0.9rem;
      margin: 0;
      padding: 0;
      border: 0;
    }

    label {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    /* The same control as the registration form's: one client, one field. */
    input,
    textarea {
      padding: 0.6rem;
      border: 1px solid color-mix(in oklab, currentColor 35%, transparent);
      border-radius: 0.4rem;
      font: inherit;
    }

    textarea {
      resize: vertical;
    }

    button {
      align-self: start;
    }

    .hint,
    .notice {
      font-size: 0.9rem;
    }

    .notice {
      color: var(--trefaro-color-primary-strong);
    }
  `,
})
export class EventContactForm {
  /** The event this question is about — its public address (E7, F28). */
  readonly seriesSlug = input.required<string>();
  readonly eventSlug = input.required<string>();

  private readonly contacts = inject(ContactService);
  private readonly forms = inject(FormBuilder);

  /** The bounds the server enforces, so a form cannot be typed past them. */
  protected readonly maxName = MAX_GUEST_NAME_LENGTH;
  protected readonly maxEmail = MAX_GUEST_EMAIL_LENGTH;
  protected readonly maxBody = MAX_MESSAGE_LENGTH;

  /** Where the answer will arrive — set once the request was accepted. */
  protected readonly sentTo = signal<string | null>(null);
  protected readonly busy = signal(false);
  /**
   * That it did not go out, without a reason.
   *
   * One sentence for every failure on purpose: the endpoint answers the same
   * for a known and an unknown address (E10), and a client that reported the
   * server's own words per status code would be the difference the server
   * refuses to make.
   */
  protected readonly failed = signal(false);

  protected readonly form = this.forms.nonNullable.group({
    name: [
      '',
      [Validators.required, Validators.maxLength(MAX_GUEST_NAME_LENGTH)],
    ],
    email: [
      '',
      [
        Validators.required,
        Validators.email,
        Validators.maxLength(MAX_GUEST_EMAIL_LENGTH),
      ],
    ],
    body: ['', [Validators.required, Validators.maxLength(MAX_MESSAGE_LENGTH)]],
  });

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.busy()) {
      // Named rather than silent: a button that does nothing is worse than any
      // message, and the browser's own validation is what names the field.
      this.form.markAllAsTouched();
      return;
    }

    this.busy.set(true);
    this.failed.set(false);
    const { name, email, body } = this.form.getRawValue();

    try {
      const answer = await this.contacts.send(
        this.seriesSlug(),
        this.eventSlug(),
        { name, email, body },
      );
      this.sentTo.set(answer.email);
      // Emptied only after it went out: whoever has to write again starts from
      // a clean form, and whoever failed keeps what they typed.
      this.form.reset();
    } catch {
      this.failed.set(true);
    } finally {
      this.busy.set(false);
    }
  }

  /** Back to an empty form, for the second question. */
  protected again(): void {
    this.sentTo.set(null);
    this.failed.set(false);
  }
}

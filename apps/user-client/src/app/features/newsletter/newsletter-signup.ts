import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { problemOf, type Problem } from '@trefaro/shared-http';
import { NewsletterService } from './newsletter.service';

/**
 * The newsletter sign-up (FR 4.8, E45) — one component, two placements.
 *
 * On the start page it takes no series and signs an address up for the whole
 * instance; on a series' page it takes that series' slug and signs up for it.
 * That is why the column behind it is nullable, and why one component covers
 * both: the difference is one input and one sentence, and two components would
 * be two places for the wording of a consent to drift apart.
 *
 * Three things it deliberately does:
 *
 * - **It asks for an address and nothing else.** No name, no salutation: a
 *   newsletter address is an address (F42), and a form that collects more than
 *   it stores teaches people that forms take what they can.
 * - **It says the same sentence afterwards, always.** The server answers
 *   identically for a new address, for one that never confirmed and for one
 *   that has been on the list for a year (E45, E32) — so a screen that said
 *   "you are already subscribed" would be inventing an answer it was
 *   deliberately not given.
 * - **It says that the mail decides.** Somebody who does not open it is on no
 *   list, and the wording says so rather than thanking them for subscribing.
 *
 * It renders nothing at all while `newsletter-opt-in` is off (F53, F142): a
 * form nothing stores from is worse than an absent one.
 */
@Component({
  selector: 'trefaro-newsletter-signup',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslocoPipe],
  template: `
    @if (newsletter.offered()) {
      <section class="signup" aria-labelledby="newsletter-heading">
        <h2 id="newsletter-heading">{{ 'newsletter.title' | transloco }}</h2>

        @if (done()) {
          <p class="signup__done" role="status">
            {{ 'newsletter.done' | transloco }}
          </p>
        } @else {
          <p class="signup__lead">
            @if (seriesName(); as series) {
              {{ 'newsletter.leadSeries' | transloco: { series } }}
            } @else {
              {{ 'newsletter.lead' | transloco }}
            }
          </p>

          @if (error(); as problem) {
            <p class="signup__error" role="alert">
              {{ problem.key | transloco }}
            </p>
          }

          <form [formGroup]="form" (ngSubmit)="submit()">
            <label>
              <span>{{ 'newsletter.email' | transloco }}</span>
              <input
                formControlName="email"
                type="email"
                autocomplete="email"
                required
              />
            </label>
            <button type="submit" [disabled]="busy()">
              {{
                (busy() ? 'newsletter.working' : 'newsletter.submit')
                  | transloco
              }}
            </button>
          </form>
        }
      </section>
    }
  `,
  styles: `
    .signup {
      margin-block-start: 2rem;
      padding: 1rem;
      border: 1px solid
        color-mix(in oklab, var(--trefaro-color-primary) 30%, transparent);
      border-radius: 0.5rem;
      background: var(--trefaro-color-primary-muted);
    }

    h2 {
      margin: 0 0 0.4rem;
      font-size: 1.1rem;
    }

    .signup__lead,
    .signup__done {
      margin: 0 0 0.8rem;
      font-size: 0.95rem;
    }

    .signup__error {
      margin: 0 0 0.8rem;
      color: var(--trefaro-color-primary-strong);
    }

    form {
      display: flex;
      flex-wrap: wrap;
      align-items: end;
      gap: 0.6rem;
    }

    label {
      display: flex;
      flex: 1 1 14rem;
      flex-direction: column;
      gap: 0.25rem;
      font-size: 0.85rem;
    }

    input {
      padding: 0.55rem 0.7rem;
      border: 1px solid color-mix(in oklab, currentColor 25%, transparent);
      border-radius: 0.4rem;
      font: inherit;
    }

    button {
      padding: 0.6rem 1.1rem;
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
  `,
})
export class NewsletterSignup {
  /** The series this form is on, or nothing on the start page. */
  readonly seriesSlug = input<string>();
  /** Its name, for the sentence above the field — never sent anywhere. */
  readonly seriesName = input<string>();

  protected readonly newsletter = inject(NewsletterService);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  protected readonly busy = signal(false);
  protected readonly done = signal(false);
  protected readonly error = signal<Problem | null>(null);

  protected async submit(): Promise<void> {
    if (this.busy()) return;
    if (this.form.invalid) {
      // Said by the form rather than by the server: an address that is not one
      // is a form error, and the server's answer must not vary with the
      // address (E45).
      this.error.set({ key: 'newsletter.invalidEmail', detail: null });
      return;
    }

    this.busy.set(true);
    this.error.set(null);
    try {
      await this.newsletter.signUp(
        this.form.getRawValue().email.trim(),
        this.seriesSlug(),
      );
      this.done.set(true);
    } catch (failure: unknown) {
      this.error.set(problemOf(failure, 'newsletter.failed'));
    } finally {
      this.busy.set(false);
    }
  }
}

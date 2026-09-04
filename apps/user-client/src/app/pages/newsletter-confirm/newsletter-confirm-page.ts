import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { problemOf, type Problem } from '@trefaro/shared-http';
import type { NewsletterConfirmation } from '@trefaro/shared-models';
import { NewsletterService } from '../../features/newsletter/newsletter.service';

/**
 * The page the newsletter confirmation link opens (FR 4.8, E45, E5b).
 *
 * It does not confirm on its own — a button does, by POST. The same reasoning
 * as for confirming a registration and an account: a mail scanner that fetches
 * every URL in a message must not be able to give a consent on somebody's
 * behalf, and a consent given by a prefetch would be exactly the thing the
 * double opt-in exists to rule out.
 *
 * Not behind the module switch as a route: somebody may click a link from a
 * mail after an organization has switched the sign-up off, and what they then
 * get is the same message as for an expired link — the endpoint answers 404
 * (F53) and this page says the link is not valid any more, which is true.
 */
@Component({
  selector: 'trefaro-newsletter-confirm-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoPipe],
  template: `
    <section>
      <h1>{{ 'newsletter.confirm.title' | transloco }}</h1>

      @if (result(); as done) {
        <p role="status">
          {{
            (done.state === 'confirmed'
              ? 'newsletter.confirm.done'
              : 'newsletter.confirm.alreadyDone'
            ) | transloco
          }}
        </p>
        <p>
          <a routerLink="/">{{ 'newsletter.confirm.home' | transloco }}</a>
        </p>
      } @else if (!tokenValue()) {
        <p class="notice" role="alert">
          {{ 'newsletter.confirm.noToken' | transloco }}
        </p>
      } @else {
        @if (error(); as problem) {
          <p class="notice" role="alert">{{ problem.key | transloco }}</p>
        } @else {
          <p>{{ 'newsletter.confirm.lead' | transloco }}</p>
        }
        <button type="button" [disabled]="busy()" (click)="confirm()">
          {{
            (busy()
              ? 'newsletter.confirm.working'
              : 'newsletter.confirm.submit'
            ) | transloco
          }}
        </button>
      }
    </section>
  `,
  styles: `
    :host {
      display: block;
      max-inline-size: 34rem;
    }

    button {
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

    .notice {
      color: var(--trefaro-color-primary-strong);
    }
  `,
})
export class NewsletterConfirmPage {
  /** From the link's query string, bound by `withComponentInputBinding()`. */
  readonly token = input<string>();

  /** A query parameter that is not in the URL arrives as `undefined`. */
  protected readonly tokenValue = computed(() => this.token() ?? '');

  private readonly newsletter = inject(NewsletterService);

  protected readonly result = signal<NewsletterConfirmation | null>(null);
  protected readonly error = signal<Problem | null>(null);
  protected readonly busy = signal(false);

  protected async confirm(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);

    try {
      this.result.set(await this.newsletter.confirm(this.tokenValue()));
    } catch (failure: unknown) {
      this.error.set(problemOf(failure, 'newsletter.confirm.error'));
    } finally {
      this.busy.set(false);
    }
  }
}

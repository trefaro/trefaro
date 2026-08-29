import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { problemOf, type Problem } from '@trefaro/shared-http';
import type { ContactOptOutResult } from '@trefaro/shared-models';
import { InvitationOptOutService } from '../../features/invitations/invitation-opt-out.service';

/**
 * The page the objection link in an invitation opens (E15, F58).
 *
 * It does not object on its own: a button does, by POST — the same reasoning as
 * for confirming a registration (E5b). A link previewer that fetched every URL
 * in the mail would otherwise decide this for the reader, and although the
 * direction of that mistake is the harmless one, it would still not be their
 * decision.
 *
 * What the page says afterwards is deliberately short and mentions no series and
 * no organizer: somebody who asked to be left alone does not need to read a
 * summary of what this instance knows about them.
 */
@Component({
  selector: 'trefaro-invitation-opt-out-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe],
  template: `
    <section>
      @if (result(); as done) {
        <h1>
          {{
            (done.state === 'opted-out' ? 'optOut.done' : 'optOut.alreadyDone')
              | transloco
          }}
        </h1>
        <p>{{ 'optOut.explanation' | transloco }}</p>
      } @else if (!tokenValue()) {
        <h1>{{ 'optOut.title' | transloco }}</h1>
        <p class="notice" role="alert">{{ 'optOut.noToken' | transloco }}</p>
      } @else {
        <h1>{{ 'optOut.title' | transloco }}</h1>
        @if (error(); as problem) {
          <p class="notice" role="alert">
            {{ problem.key | transloco }}
            @if (problem.detail; as detail) {
              <span class="notice__detail">{{ detail }}</span>
            }
          </p>
        } @else {
          <p>{{ 'optOut.lead' | transloco }}</p>
        }
        <button type="button" [disabled]="busy()" (click)="optOut()">
          {{ (busy() ? 'optOut.working' : 'optOut.submit') | transloco }}
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
export class InvitationOptOutPage {
  /** From the link's query string, bound by `withComponentInputBinding()`. */
  readonly token = input<string>();

  /**
   * The token as a string, present or not.
   *
   * The router binds a query parameter that is not in the URL as `undefined`,
   * which overrides an `input()` default — so the default would look like a
   * guarantee it is not.
   */
  protected readonly tokenValue = computed(() => this.token() ?? '');

  private readonly invitations = inject(InvitationOptOutService);

  protected readonly result = signal<ContactOptOutResult | null>(null);
  protected readonly error = signal<Problem | null>(null);
  protected readonly busy = signal(false);

  protected async optOut(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);

    try {
      this.result.set(await this.invitations.optOut(this.tokenValue()));
    } catch (failure: unknown) {
      this.error.set(problemOf(failure, 'optOut.error'));
    } finally {
      this.busy.set(false);
    }
  }
}

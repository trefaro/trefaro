import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import type { ProgramProposal, ProposalSummary } from '@trefaro/shared-models';
import { word } from './plugin-words';
import { ProposalsApi } from './proposals-api';

/**
 * Moderating proposals, on the event dashboard (FR 3.14).
 *
 * Mounted at the `event-dashboard` hook point, which plug-in API 1.2.0 added
 * for exactly this (F47). Above it, in the dashboard's own grid, the host draws
 * a tile with this plug-in's label and icon that **jumps here** — it carries no
 * number, because a number on the tile would mean the host asking a plug-in a
 * question (E59). The numbers are here, in the section the plug-in draws, and
 * they come from `…/events/:id/summary`.
 *
 * Two decisions, and both are about what this screen does *not* do:
 *
 * 1. **Two buttons, and that is the whole of moderation** (E51). No comment on
 *    the decision, no second reviewer, no "request changes". The survey asked
 *    in as many words for the moderation effort to stay minimal, and FR 3.14
 *    asks for the status to be visible — not for it to be negotiable.
 * 2. **Approving does not create a session** (E52), and the note above the
 *    queue says so. Without that sentence an organizer would reasonably expect
 *    an approved proposal to appear in the programme, and the honest place to
 *    say otherwise is where the button is.
 *
 * The queue is what is waiting: `?status=pending`. The history is not drawn
 * here — the counts say how much of it there is, and a dashboard section is not
 * the place to page through everything an event was ever asked for.
 */
@Component({
  selector: 'trefaro-organizer-proposals',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel">
      <header class="panel__head">
        <h2 class="panel__title">{{ text().title }}</h2>
        @if (summary(); as counts) {
          <p class="counts">
            <span class="count">
              <b>{{ counts.pending }}</b> {{ text().pending }}
            </span>
            <span class="count">
              <b>{{ counts.approved }}</b> {{ text().approved }}
            </span>
            <span class="count">
              <b>{{ counts.rejected }}</b> {{ text().rejected }}
            </span>
          </p>
        }
      </header>

      @if (failed()) {
        <p class="note note--error" role="alert">{{ text().error }}</p>
      }

      @if (loading()) {
        <p class="note">{{ text().loading }}</p>
      } @else {
        <h3 class="queue__title">{{ text().moderation }}</h3>
        <p class="note">{{ text().approvalNote }}</p>

        @if (rows().length === 0) {
          <p class="note">{{ text().queueEmpty }}</p>
        } @else {
          <ol class="queue">
            @for (row of rows(); track row.id) {
              <li class="row">
                <p class="row__title">{{ row.title }}</p>
                <p class="row__body">{{ row.description }}</p>
                <p class="row__meta">
                  {{ text().proposedBy }} {{ author(row) }} ·
                  {{ when(row.createdAt) }}
                </p>
                <p class="row__actions">
                  <button
                    class="action action--approve"
                    type="button"
                    [disabled]="deciding() !== null"
                    (click)="approve(row)"
                  >
                    {{ text().approve }}
                  </button>
                  <button
                    class="action"
                    type="button"
                    [disabled]="deciding() !== null"
                    (click)="reject(row)"
                  >
                    {{ text().reject }}
                  </button>
                </p>
              </li>
            }
          </ol>
          @if (more()) {
            <button class="more" type="button" (click)="loadMore()">
              {{ text().more }}
            </button>
          }
        }
      }
    </section>
  `,
  styles: `
    :host {
      display: block;
      font-family: var(--trefaro-font-family, system-ui, sans-serif);
    }

    .panel {
      border: 1px solid color-mix(in oklab, currentColor 15%, transparent);
      border-radius: 0.6rem;
      padding: 1rem 1.1rem;
    }

    .panel__head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .panel__title {
      margin: 0;
      font-size: 1.05rem;
    }

    .counts {
      display: flex;
      gap: 0.9rem;
      flex-wrap: wrap;
      margin: 0;
      font-size: 0.9rem;
    }

    .count b {
      font-size: 1.1rem;
    }

    .queue__title {
      font-size: 0.95rem;
      margin: 1rem 0 0.3rem;
    }

    .note {
      margin: 0 0 0.8rem;
      font-size: 0.9rem;
      color: color-mix(in oklab, currentColor 70%, transparent);
    }

    .note--error {
      color: inherit;
      font-weight: 600;
    }

    .queue {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.9rem;
    }

    .row {
      padding-block-end: 0.9rem;
      border-block-end: 1px solid
        color-mix(in oklab, currentColor 12%, transparent);
    }

    .row:last-child {
      border-block-end: none;
      padding-block-end: 0;
    }

    .row__title {
      margin: 0 0 0.2rem;
      font-weight: 600;
    }

    .row__body {
      margin: 0 0 0.2rem;
      font-size: 0.9rem;
      white-space: pre-line;
    }

    .row__meta {
      margin: 0 0 0.5rem;
      font-size: 0.82rem;
      color: color-mix(in oklab, currentColor 70%, transparent);
    }

    .row__actions {
      display: flex;
      gap: 0.5rem;
      margin: 0;
    }

    .action {
      font: inherit;
      cursor: pointer;
      padding: 0.35rem 0.7rem;
      border: 1px solid color-mix(in oklab, currentColor 30%, transparent);
      border-radius: 0.4rem;
      background: transparent;
      color: inherit;
    }

    .action--approve {
      border-color: transparent;
      background: var(--trefaro-color-primary, #1f6f5c);
      color: var(--trefaro-color-on-primary, #fff);
    }

    .action[disabled] {
      cursor: progress;
      opacity: 0.6;
    }

    .more {
      font: inherit;
      cursor: pointer;
      margin-block-start: 0.8rem;
      padding: 0.35rem 0.7rem;
      border: 1px solid color-mix(in oklab, currentColor 30%, transparent);
      border-radius: 0.4rem;
      background: transparent;
      color: inherit;
    }
  `,
})
export class OrganizerProposals {
  readonly eventId = input<string | null>(null);
  readonly locale = input<string>('en');
  readonly strings = input<Readonly<Record<string, string>>>({});

  private readonly api = inject(ProposalsApi);

  private readonly queue = signal<readonly ProgramProposal[]>([]);
  private readonly total = signal(0);
  private readonly page = signal(1);

  protected readonly summary = signal<ProposalSummary | null>(null);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  /** The proposal a decision is in flight for, so no second click lands. */
  protected readonly deciding = signal<string | null>(null);

  protected readonly rows = this.queue.asReadonly();
  protected readonly more = computed(() => this.queue().length < this.total());

  protected readonly text = computed(() => {
    const strings = this.strings();
    const say = (key: string): string => word(strings, key);
    return {
      title: say('title'),
      moderation: say('moderation'),
      approvalNote: say('approvalNote'),
      queueEmpty: say('queueEmpty'),
      approve: say('approve'),
      reject: say('reject'),
      proposedBy: say('proposedBy'),
      unknownAuthor: say('unknownAuthor'),
      // The three status words do double duty as the units of the counts, the
      // way the dashboard's own tiles use `registration.status.confirmed`.
      pending: say('statusPending'),
      approved: say('statusApproved'),
      rejected: say('statusRejected'),
      loading: say('loading'),
      error: say('error'),
      more: say('more'),
    };
  });

  constructor() {
    effect(() => {
      const eventId = this.eventId();
      this.queue.set([]);
      this.total.set(0);
      this.page.set(1);
      this.summary.set(null);
      if (!eventId) return;
      void this.load(eventId, 1);
    });
  }

  protected author(row: ProgramProposal): string {
    return row.author?.name ?? this.text().unknownAuthor;
  }

  protected when(iso: string): string {
    try {
      return new Intl.DateTimeFormat(this.locale(), {
        dateStyle: 'medium',
      }).format(new Date(iso));
    } catch {
      return iso.slice(0, 10);
    }
  }

  protected approve(row: ProgramProposal): void {
    void this.decide(row, () => this.api.approve(row.id));
  }

  protected reject(row: ProgramProposal): void {
    void this.decide(row, () => this.api.reject(row.id));
  }

  protected loadMore(): void {
    const eventId = this.eventId();
    if (!eventId) return;
    void this.load(eventId, this.page() + 1);
  }

  /**
   * One decision, then the section reads itself again.
   *
   * Not an optimistic edit of the two lists: a decision changes the queue *and*
   * all three counts, and the honest way to show the state after a write is to
   * read it. It is one click by one organizer, so the round trip is affordable —
   * and a count that drifted from what the database says would be worse than a
   * moment's wait.
   */
  private async decide(
    row: ProgramProposal,
    write: () => Promise<ProgramProposal>,
  ): Promise<void> {
    if (this.deciding() !== null) return;
    const eventId = this.eventId();
    if (!eventId) return;

    this.deciding.set(row.id);
    this.failed.set(false);
    try {
      await write();
      await this.load(eventId, 1);
    } catch {
      this.failed.set(true);
    } finally {
      this.deciding.set(null);
    }
  }

  private async load(eventId: string, page: number): Promise<void> {
    try {
      // Both in parallel: the counts and the queue are one screen, and two
      // round trips in sequence would show the heading before the list twice.
      const [summary, answer] = await Promise.all([
        this.api.summary(eventId),
        this.api.listQueue(eventId, page),
      ]);
      this.summary.set(summary);
      this.queue.update((rows) =>
        page === 1 ? answer.rows : [...rows, ...answer.rows],
      );
      this.total.set(answer.total);
      this.page.set(answer.page);
      this.failed.set(false);
    } catch {
      // Including a 401: the organizer's session expired while the dashboard
      // stood open. This bundle has no interceptor of the host's to send them
      // to the login, and inventing a redirect inside a plug-in would be a
      // plug-in deciding what a client does with a session.
      this.failed.set(true);
    } finally {
      this.loading.set(false);
    }
  }
}

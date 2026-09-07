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
  MAX_PROPOSAL_DESCRIPTION_LENGTH,
  MAX_PROPOSAL_TITLE_LENGTH,
  type ProgramProposal,
} from '@trefaro/shared-models';
import { word, statusWord } from './plugin-words';
import { NotSignedInError, ProposalsApi } from './proposals-api';

/** What the panel is doing, so the template has one thing to switch on. */
type PanelState = 'loading' | 'signedOut' | 'ready' | 'failed';

/**
 * What a participant does with proposals, on the event page (FR 3.13).
 *
 * Mounted at the `event-detail` hook point — inside the page it belongs to,
 * with the tile above it as a jump link (F68). Three decisions are worth
 * naming, because none of them is visible in the markup:
 *
 * 1. **No session is a state, not an error** (E58). Proposals are interactions
 *    and sit behind the login, but the element is mounted for everybody: a
 *    section that appeared only to those already logged in would be a feature
 *    nobody hears about. So a 401 draws the invitation to log in, and nothing
 *    else about this panel changes.
 * 2. **One list, and the status is on the row.** There is deliberately no "mine"
 *    and "others" split, because there is no field that says which is which and
 *    there does not need to be: the visibility rule of E51 means every row here
 *    that is *not* approved is the reader's own — nobody else's pending or
 *    rejected proposal can reach this list. What FR 3.14 asks for is that the
 *    status stay visible to whoever submitted something, and a chip on the row
 *    is that.
 * 3. **A chip only where it says something.** Approved is what a published
 *    proposal *is*, so a chip on every row would be one repeated word down the
 *    page; the pending and rejected ones are the rows a reader is looking for.
 *
 * The date is formatted in the reader's language and their own zone. That is
 * not the exception to E8 it looks like: what E8 is about are an *event's*
 * times, which have a place; when somebody wrote something has none.
 */
@Component({
  selector: 'trefaro-participant-proposals',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel">
      <h2 class="panel__title">{{ text().title }}</h2>

      @switch (state()) {
        @case ('loading') {
          <p class="note">{{ text().loading }}</p>
        }
        @case ('signedOut') {
          <p class="note note--invite">{{ text().signIn }}</p>
        }
        @case ('failed') {
          <p class="note note--error" role="alert">{{ text().error }}</p>
        }
        @default {
          <p class="note">{{ text().intro }}</p>

          <form class="form" (submit)="submit($event)">
            <h3 class="form__title">{{ text().formTitle }}</h3>

            <label class="field">
              <span class="field__label">{{ text().titleLabel }}</span>
              <input
                name="title"
                type="text"
                required
                [maxLength]="maxTitle"
                [value]="draftTitle()"
                (input)="draftTitle.set(value($event))"
              />
            </label>

            <label class="field">
              <span class="field__label">{{ text().descriptionLabel }}</span>
              <textarea
                name="description"
                rows="4"
                required
                [maxLength]="maxDescription"
                [value]="draftDescription()"
                (input)="draftDescription.set(value($event))"
              ></textarea>
            </label>

            <button class="action" type="submit" [disabled]="sending()">
              {{ text().submit }}
            </button>

            @if (submitted()) {
              <p class="note note--done" role="status">
                {{ text().submitted }}
              </p>
            }
            @if (writeFailed()) {
              <p class="note note--error" role="alert">{{ text().error }}</p>
            }
          </form>

          <h3 class="list__title">{{ text().others }}</h3>
          @if (rows().length === 0) {
            <p class="note">{{ text().emptyOthers }}</p>
          } @else {
            @if (hasPending()) {
              <p class="note">{{ text().pendingNote }}</p>
            }
            <ol class="list">
              @for (row of rows(); track row.id) {
                <li class="row">
                  <p class="row__head">
                    <span class="row__title">{{ row.title }}</span>
                    @if (row.status !== 'approved') {
                      <span class="chip chip--{{ row.status }}">
                        {{ status(row) }}
                      </span>
                    }
                  </p>
                  <p class="row__body">{{ row.description }}</p>
                  <p class="row__meta">
                    {{ text().proposedBy }} {{ author(row) }} ·
                    {{ when(row.createdAt) }}
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
      }
    </section>
  `,
  styles: `
    :host {
      display: block;
      /* Fall back only if the host document defines nothing — a plug-in loaded
         into a page without the Trefaro theme still has to be readable. */
      font-family: var(--trefaro-font-family, system-ui, sans-serif);
    }

    .panel {
      border: 1px solid var(--trefaro-color-primary-muted, #cbd5d1);
      border-radius: 0.75rem;
      padding: 1rem 1.1rem;
      background: var(--trefaro-color-primary-soft, #f2f7f5);
      color: var(--trefaro-color-primary-strong, #14352c);
    }

    .panel__title {
      font-size: 1.05rem;
      font-weight: 600;
      margin: 0 0 0.6rem;
    }

    .note {
      font-size: 0.9rem;
      margin: 0 0 0.8rem;
      opacity: 0.85;
    }

    .note--error {
      opacity: 1;
      font-weight: 600;
    }

    .note--invite,
    .note--done {
      opacity: 1;
    }

    /* Mobile-first: one column everywhere, because this panel sits in a page a
       participant reads on a phone. */
    .form {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      margin-block-end: 1.2rem;
    }

    .form__title,
    .list__title {
      font-size: 0.95rem;
      font-weight: 600;
      margin: 0;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }

    .field__label {
      font-size: 0.85rem;
      font-weight: 600;
    }

    input,
    textarea {
      font: inherit;
      padding: 0.45rem 0.55rem;
      border: 1px solid var(--trefaro-color-primary-muted, #cbd5d1);
      border-radius: 0.4rem;
      background: var(--trefaro-color-surface, #fff);
      color: inherit;
      inline-size: 100%;
      box-sizing: border-box;
    }

    .action {
      font: inherit;
      cursor: pointer;
      align-self: start;
      border: none;
      border-radius: 0.5rem;
      padding: 0.5rem 0.9rem;
      background: var(--trefaro-color-primary, #1f6f5c);
      color: var(--trefaro-color-on-primary, #fff);
    }

    .action[disabled] {
      cursor: progress;
      opacity: 0.7;
    }

    .list {
      list-style: none;
      margin: 0.6rem 0 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.7rem;
    }

    .row {
      padding-block-end: 0.7rem;
      border-block-end: 1px solid
        color-mix(in oklab, currentColor 12%, transparent);
    }

    .row:last-child {
      border-block-end: none;
      padding-block-end: 0;
    }

    .row__head {
      display: flex;
      align-items: baseline;
      gap: 0.5rem;
      flex-wrap: wrap;
      margin: 0 0 0.2rem;
    }

    .row__title {
      font-weight: 600;
    }

    .row__body {
      margin: 0 0 0.2rem;
      font-size: 0.9rem;
      /* A proposal is an argument, and one somebody typed with line breaks. */
      white-space: pre-line;
    }

    .row__meta {
      margin: 0;
      font-size: 0.82rem;
      opacity: 0.75;
    }

    .chip {
      font-size: 0.78rem;
      padding: 0.1rem 0.5rem;
      border-radius: 1rem;
      background: color-mix(in oklab, currentColor 12%, transparent);
    }

    .more {
      font: inherit;
      cursor: pointer;
      margin-block-start: 0.7rem;
      padding: 0.35rem 0.7rem;
      border: 1px solid var(--trefaro-color-primary-muted, #cbd5d1);
      border-radius: 0.4rem;
      background: transparent;
      color: inherit;
    }
  `,
})
export class ParticipantProposals {
  /** The event this page is about, handed over by the hook point. */
  readonly eventId = input<string | null>(null);
  /** The reader's language, for the words and for the dates. */
  readonly locale = input<string>('en');
  /** This plug-in's words, keyed without the `plugins.programProposals.` prefix. */
  readonly strings = input<Readonly<Record<string, string>>>({});

  protected readonly maxTitle = MAX_PROPOSAL_TITLE_LENGTH;
  protected readonly maxDescription = MAX_PROPOSAL_DESCRIPTION_LENGTH;

  private readonly api = inject(ProposalsApi);

  private readonly loaded = signal<readonly ProgramProposal[]>([]);
  private readonly total = signal(0);
  private readonly page = signal(1);

  protected readonly state = signal<PanelState>('loading');
  protected readonly sending = signal(false);
  protected readonly submitted = signal(false);
  protected readonly writeFailed = signal(false);

  protected readonly draftTitle = signal('');
  protected readonly draftDescription = signal('');

  protected readonly rows = this.loaded.asReadonly();
  protected readonly more = computed(() => this.loaded().length < this.total());
  protected readonly hasPending = computed(() =>
    this.loaded().some((row) => row.status === 'pending'),
  );

  /**
   * Every word the template needs, resolved once.
   *
   * A `computed()` rather than a call per placeholder: one place to see what
   * this plug-in asks the catalogue for, and one place for the fallback.
   */
  protected readonly text = computed(() => {
    const strings = this.strings();
    const say = (key: string): string => word(strings, key);
    return {
      title: say('title'),
      intro: say('intro'),
      signIn: say('signIn'),
      formTitle: say('formTitle'),
      titleLabel: say('titleLabel'),
      descriptionLabel: say('descriptionLabel'),
      submit: say('submit'),
      submitted: say('submitted'),
      others: say('others'),
      emptyOthers: say('emptyOthers'),
      pendingNote: say('pendingNote'),
      proposedBy: say('proposedBy'),
      unknownAuthor: say('unknownAuthor'),
      loading: say('loading'),
      error: say('error'),
      more: say('more'),
    };
  });

  constructor() {
    // The event may arrive after the element is created — the slot assigns
    // properties, and the landing page knows the id only once it has loaded.
    effect(() => {
      const eventId = this.eventId();
      this.loaded.set([]);
      this.total.set(0);
      this.page.set(1);
      if (!eventId) return;
      void this.load(eventId, 1);
    });
  }

  protected status(row: ProgramProposal): string {
    return statusWord(this.strings(), row.status);
  }

  /**
   * Who proposed it, or the fact that the account is gone.
   *
   * `null` is not an anonymous proposal: it is a row whose author closed their
   * account, and inventing a name for it would invent a person (F55).
   */
  protected author(row: ProgramProposal): string {
    return row.author?.name ?? this.text().unknownAuthor;
  }

  protected when(iso: string): string {
    try {
      return new Intl.DateTimeFormat(this.locale(), {
        dateStyle: 'medium',
      }).format(new Date(iso));
    } catch {
      // An unknown language tag must not empty the row.
      return iso.slice(0, 10);
    }
  }

  protected value(event: Event): string {
    return (event.target as HTMLInputElement | HTMLTextAreaElement).value;
  }

  protected loadMore(): void {
    const eventId = this.eventId();
    if (!eventId) return;
    void this.load(eventId, this.page() + 1);
  }

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    const eventId = this.eventId();
    if (!eventId || this.sending()) return;

    this.sending.set(true);
    this.submitted.set(false);
    this.writeFailed.set(false);
    try {
      const created = await this.api.submit(eventId, {
        title: this.draftTitle(),
        description: this.draftDescription(),
      });
      // Prepended rather than refetched: the list is newest first, and a
      // reload would throw away the "show more" pages already open.
      this.loaded.update((rows) => [created, ...rows]);
      this.total.update((count) => count + 1);
      this.draftTitle.set('');
      this.draftDescription.set('');
      this.submitted.set(true);
    } catch (error: unknown) {
      if (error instanceof NotSignedInError) {
        // The session expired while the form stood open.
        this.state.set('signedOut');
        return;
      }
      this.writeFailed.set(true);
    } finally {
      this.sending.set(false);
    }
  }

  private async load(eventId: string, page: number): Promise<void> {
    try {
      const answer = await this.api.listForParticipant(eventId, page);
      this.loaded.update((rows) =>
        page === 1 ? answer.rows : [...rows, ...answer.rows],
      );
      this.total.set(answer.total);
      this.page.set(answer.page);
      this.state.set('ready');
    } catch (error: unknown) {
      this.state.set(
        error instanceof NotSignedInError ? 'signedOut' : 'failed',
      );
    }
  }
}

import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppConfigService } from '@trefaro/shared-config';
import { RealtimeClient, problemOf, type Problem } from '@trefaro/shared-http';
import { TranslationService } from '@trefaro/shared-i18n';
import {
  DEFAULT_CONVERSATION_PAGE_SIZE,
  MAX_CONVERSATION_PAGE_SIZE,
  PROFILE_SEARCH_MODULE_KEY,
  type ConversationSummary,
} from '@trefaro/shared-models';
import { ChatService } from '../../features/chat/chat.service';
import { LiveStatus } from '../../features/chat/live-status';
import { conversationTime } from '../../features/chat/message-time';
import { initialsOf } from '../../features/profiles/initials';

/**
 * My conversations (FR 4.5, UC 13).
 *
 * The list a participant lands on: who wrote, when, and how much of it they
 * have not read (E38). Everything on it is counted and sorted by the server,
 * so this screen adds three things and nothing else — a name for a
 * conversation, a time a reader can place, and the news that something moved.
 *
 * Four decisions worth naming:
 *
 * 1. **A move refreshes the window that is on screen, not the first page.**
 *    `chat:conversation` says "one of yours moved" and deliberately carries no
 *    row (F161), because the count of unread has to be recomputed anyway. So
 *    this asks again — for as many rows as are currently shown, in one
 *    request — and merges by id, which is what keeps a row that jumped to the
 *    top from also appearing where it used to be.
 * 2. **Nothing here marks anything as read.** Seeing that there are three
 *    unread messages is not reading them; the thread does that, and the
 *    counter is gone when a reader comes back.
 * 3. **A conversation cannot be started here.** One begins in the participant
 *    search (E37), so an empty list points there — and only where that switch
 *    is on, because the two modules are independent (E42).
 * 4. **"Show more" rather than a pager**, as everywhere else in this client:
 *    the answer is short for most instances.
 */
@Component({
  selector: 'trefaro-messages-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoPipe, LiveStatus],
  template: `
    <h1>{{ 'chat.title' | transloco }}</h1>
    <p class="lead">{{ 'chat.lead' | transloco }}</p>

    <trefaro-live-status />

    @if (error(); as problem) {
      <p class="notice" role="alert">
        {{ problem.key | transloco }}
        @if (problem.detail; as detail) {
          <span class="notice__detail">{{ detail }}</span>
        }
      </p>
    }

    @if (loaded()) {
      @if (rows().length === 0) {
        <p>{{ 'chat.empty' | transloco }}</p>
        @if (searchEnabled()) {
          <p>
            <a routerLink="/participants">{{ 'chat.emptyFind' | transloco }}</a>
          </p>
        }
      } @else {
        <ul class="threads">
          @for (row of rows(); track row.id) {
            <li class="thread" [class.thread--unread]="row.unread > 0">
              <a class="thread__link" [routerLink]="['/messages', row.id]">
                <!-- Decorative: the name is the link's own text. -->
                @if (picture(row); as url) {
                  <img class="thread__avatar" [src]="url" alt="" />
                } @else {
                  <span
                    class="thread__avatar thread__avatar--empty"
                    aria-hidden="true"
                    >{{ initials(row) }}</span
                  >
                }
                <span class="thread__body">
                  <span class="thread__name">{{ name(row) }}</span>
                  <span class="thread__meta">
                    @if (row.lastMessageAt; as at) {
                      <span class="thread__time">{{ time(at) }}</span>
                    } @else {
                      <span class="thread__time">{{
                        'chat.noMessages' | transloco
                      }}</span>
                    }
                  </span>
                </span>
                @if (row.unread > 0) {
                  <span
                    class="thread__unread"
                    [attr.aria-label]="
                      'chat.unread' | transloco: { count: row.unread }
                    "
                    >{{ row.unread }}</span
                  >
                }
              </a>
            </li>
          }
        </ul>

        @if (more()) {
          <button type="button" [disabled]="busy()" (click)="loadMore()">
            {{ 'chat.more' | transloco }}
          </button>
        }
      }
    } @else if (!error()) {
      <p class="notice">{{ 'common.loading' | transloco }}</p>
    }
  `,
  styles: `
    :host {
      display: block;
      max-inline-size: 34rem;
    }

    h1 {
      margin-block-end: 0.2rem;
      font-size: 1.4rem;
    }

    .lead {
      margin-block: 0 0.4rem;
    }

    .threads {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 0.5rem;
    }

    .thread {
      border: 1px solid var(--trefaro-color-border);
      border-radius: var(--trefaro-radius-sm, 0.4rem);
    }

    .thread--unread {
      border-color: var(--trefaro-color-primary);
    }

    .thread__link {
      display: flex;
      align-items: center;
      gap: 0.7rem;
      padding: 0.6rem 0.7rem;
      text-decoration: none;
      color: inherit;
    }

    .thread__avatar {
      display: grid;
      place-items: center;
      inline-size: 2.6rem;
      block-size: 2.6rem;
      border-radius: 50%;
      object-fit: cover;
      flex: none;
    }

    .thread__avatar--empty {
      background: var(--trefaro-color-primary-soft);
      color: var(--trefaro-color-primary-strong);
      font-weight: 600;
    }

    .thread__body {
      display: grid;
      flex: 1;
      min-inline-size: 0;
    }

    .thread__name {
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .thread__meta,
    .thread__time {
      font-size: 0.85rem;
      color: var(--trefaro-color-primary-muted);
    }

    .thread__unread {
      flex: none;
      min-inline-size: 1.6rem;
      padding: 0.1rem 0.4rem;
      border-radius: 999px;
      background: var(--trefaro-color-primary);
      color: var(--trefaro-color-on-primary);
      font-size: 0.85rem;
      font-weight: 700;
      text-align: center;
    }

    .notice {
      color: var(--trefaro-color-primary-strong);
    }

    .notice__detail {
      display: block;
      font-size: 0.9rem;
    }
  `,
})
export class MessagesPage {
  private readonly chat = inject(ChatService);
  private readonly realtime = inject(RealtimeClient);
  private readonly config = inject(AppConfigService);
  private readonly i18n = inject(TranslationService);

  protected readonly rows = signal<readonly ConversationSummary[]>([]);
  protected readonly error = signal<Problem | null>(null);
  protected readonly busy = signal(false);
  /** Whether an answer has arrived — an empty list is a result, not a wait. */
  protected readonly loaded = signal(false);
  private readonly total = signal(0);

  protected readonly more = computed(() => this.rows().length < this.total());

  /** Whether a conversation can be started at all on this instance (E42). */
  protected readonly searchEnabled = computed(() =>
    this.config.isModuleEnabled(PROFILE_SEARCH_MODULE_KEY),
  );

  constructor() {
    void this.load();

    const moved = this.realtime.conversations.subscribe(() => {
      void this.refresh();
    });
    inject(DestroyRef).onDestroy(() => moved.unsubscribe());
  }

  /**
   * What a conversation is called.
   *
   * A group has a topic, a one-to-one conversation is named by who it is with
   * — the server sends no title for one, because the title *is* the other
   * person (E39). A group without a topic falls back to the members' names,
   * and a conversation with nobody left in it to a word rather than a blank.
   */
  protected name(row: ConversationSummary): string {
    if (row.topic) return row.topic;

    const names = row.counterparts.map((one) => one.name).filter(Boolean);
    if (names.length > 0) return names.join(', ');

    // Read for the dependency: this string is chosen in TypeScript, so nothing
    // marks it for redrawing after a language switch on its own (F72).
    this.i18n.locale();
    return this.i18n.translate('chat.unnamed');
  }

  /** The first counterpart's picture — a group is drawn by whoever is first. */
  protected picture(row: ConversationSummary): string | null {
    return row.counterparts[0]?.avatarUrl ?? null;
  }

  protected initials(row: ConversationSummary): string {
    const name = row.topic ?? row.counterparts[0]?.name ?? '';
    return initialsOf(name.split(/\s+/), this.i18n.locale());
  }

  protected time(iso: string): string {
    return conversationTime(iso, this.i18n.locale());
  }

  private async load(): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      const page = await this.chat.list({ page: 1 });
      this.rows.set(page.rows);
      this.total.set(page.total);
      this.loaded.set(true);
    } catch (error: unknown) {
      this.error.set(problemOf(error, 'chat.error'));
    } finally {
      this.busy.set(false);
    }
  }

  protected async loadMore(): Promise<void> {
    const page =
      Math.floor(this.rows().length / DEFAULT_CONVERSATION_PAGE_SIZE) + 1;

    this.busy.set(true);
    this.error.set(null);
    try {
      const next = await this.chat.list({ page });
      this.rows.update((rows) => merge(rows, next.rows));
      this.total.set(next.total);
    } catch (error: unknown) {
      // The rows already on screen stay: a failed further page is no reason to
      // take the conversations somebody is looking at away.
      this.error.set(problemOf(error, 'chat.error'));
    } finally {
      this.busy.set(false);
    }
  }

  /**
   * Asks again for exactly what is on screen.
   *
   * One request rather than one per loaded page, and the size is what is
   * shown — capped at what the endpoint allows, which is the only case where a
   * refresh covers less than the screen: beyond fifty rows the tail keeps its
   * old order until somebody loads further pages. The merge is by id, so a row
   * the fresh window pulled to the top never also stands where it was.
   */
  private async refresh(): Promise<void> {
    const size = Math.min(
      Math.max(this.rows().length, DEFAULT_CONVERSATION_PAGE_SIZE),
      MAX_CONVERSATION_PAGE_SIZE,
    );

    try {
      const page = await this.chat.list({ page: 1, pageSize: size });
      this.rows.update((rows) => merge(page.rows, rows));
      this.total.set(page.total);
      this.loaded.set(true);
    } catch {
      // A refresh that fails says nothing: what is on screen is still what the
      // server last said, and a notice about a request nobody made would be
      // noise. The live status already says whether anything is arriving.
    }
  }
}

/** Both lists in order, each conversation once — the first mention wins. */
function merge(
  first: readonly ConversationSummary[],
  second: readonly ConversationSummary[],
): readonly ConversationSummary[] {
  const seen = new Set(first.map((row) => row.id));
  return [...first, ...second.filter((row) => !seen.has(row.id))];
}

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
  MAX_FORUM_POST_LENGTH,
  MAX_FORUM_THREAD_TITLE_LENGTH,
  type ForumPost,
  type ForumThread,
} from '@trefaro/shared-models';
import { ForumApi, NotSignedInError } from './forum-api';
import { statusWord, when, word } from './plugin-words';

/** What the panel is doing, so the template has one thing to switch on. */
type PanelState = 'loading' | 'signedOut' | 'ready' | 'failed';

/**
 * What a participant does in the forum, on the event page (FR 4.6).
 *
 * Mounted at the `event-detail` hook point — inside the page it belongs to,
 * with the tile above it as a jump link (F68). One element, two views: the
 * list of threads with the form to start one, and one thread with its posts
 * and the form to reply. The thread opens **inside the panel** rather than on
 * a route of its own, because a plug-in has no routes — it renders where it is
 * mounted — and the list stays behind it, so going back costs no request.
 *
 * Four decisions are worth naming, because none of them is visible in the
 * markup:
 *
 * 1. **No session is a state, not an error** (E58). Posts are interactions and
 *    sit behind the login, but the element is mounted for everybody: a
 *    section that appeared only to those already logged in would be a feature
 *    nobody hears about. So a 401 draws the invitation to log in, and nothing
 *    else about this panel changes.
 * 2. **The status is on the post, never on the thread** (F195). A thread in
 *    this list is either published or the reader's own; what a reader is told
 *    about is what became of what *they* wrote, and that is a chip on their
 *    post.
 * 3. **A chip only where it says something.** Approved is what a published
 *    post *is*, so a chip on every post would be one repeated word down the
 *    thread; and by the rule of E51 every post in this list that is *not*
 *    approved can only be the reader's own — nobody else's pending or
 *    rejected post can reach it. The note about who sees a pending post
 *    therefore appears exactly when such a post is on the screen.
 * 4. **What the reader writes appears without a second read.** A new thread
 *    goes to the top of the list it came from and opens at once; a reply is
 *    appended to the thread it was written in. A refetch would throw away the
 *    pages already open, and the server's answer is the row as it now is.
 */
@Component({
  selector: 'trefaro-participant-forum',
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
          @if (open(); as thread) {
            <article class="thread-view">
              <button class="back" type="button" (click)="close()">
                {{ text().back }}
              </button>
              <h3 class="thread-view__title">{{ thread.title }}</h3>
              <p class="thread-view__meta">
                {{ text().openedBy }} {{ name(thread.author) }} ·
                {{ at(thread.createdAt) }}
              </p>

              @if (hasPending()) {
                <p class="note">{{ text().pendingNote }}</p>
              }

              <ol class="posts">
                @for (post of posts(); track post.id) {
                  <li class="post">
                    <p class="post__body">{{ post.body }}</p>
                    <p class="post__meta">
                      {{ text().writtenBy }} {{ name(post.author) }} ·
                      {{ at(post.createdAt) }}
                      @if (post.status !== 'approved') {
                        <span class="chip chip--{{ post.status }}">
                          {{ status(post) }}
                        </span>
                      }
                    </p>
                  </li>
                }
              </ol>
              @if (morePosts()) {
                <button class="more" type="button" (click)="loadMorePosts()">
                  {{ text().more }}
                </button>
              }

              <form class="form" (submit)="reply($event)">
                <label class="field">
                  <span class="field__label">{{ text().replyLabel }}</span>
                  <textarea
                    name="body"
                    rows="3"
                    required
                    [attr.maxlength]="maxPost"
                    [value]="draftBody()"
                    (input)="draftBody.set(value($event))"
                  ></textarea>
                </label>
                <button class="action" type="submit" [disabled]="sending()">
                  {{ text().reply }}
                </button>
                @if (posted()) {
                  <p class="note note--done" role="status">
                    {{ text().posted }}
                  </p>
                }
                @if (writeFailed()) {
                  <p class="note note--error" role="alert">
                    {{ text().error }}
                  </p>
                }
              </form>
            </article>
          } @else {
            <p class="note">{{ text().intro }}</p>

            <form class="form" (submit)="start($event)">
              <h3 class="form__title">{{ text().newThread }}</h3>

              <label class="field">
                <span class="field__label">{{ text().titleLabel }}</span>
                <input
                  name="title"
                  type="text"
                  required
                  [attr.maxlength]="maxTitle"
                  [value]="draftTitle()"
                  (input)="draftTitle.set(value($event))"
                />
              </label>

              <label class="field">
                <span class="field__label">{{ text().bodyLabel }}</span>
                <textarea
                  name="body"
                  rows="4"
                  required
                  [attr.maxlength]="maxPost"
                  [value]="draftBody()"
                  (input)="draftBody.set(value($event))"
                ></textarea>
              </label>

              <button class="action" type="submit" [disabled]="sending()">
                {{ text().open }}
              </button>
              @if (writeFailed()) {
                <p class="note note--error" role="alert">
                  {{ text().error }}
                </p>
              }
            </form>

            <h3 class="list__title">{{ text().threads }}</h3>
            @if (openFailed()) {
              <p class="note note--error" role="alert">{{ text().error }}</p>
            }
            @if (threads().length === 0) {
              <p class="note">{{ text().emptyThreads }}</p>
            } @else {
              <ol class="list">
                @for (thread of threads(); track thread.id) {
                  <li>
                    <button class="thread" type="button" (click)="show(thread)">
                      <span class="thread__title">{{ thread.title }}</span>
                      <span class="thread__meta">
                        {{ text().openedBy }} {{ name(thread.author) }} ·
                        {{ text().lastActivity }} {{ at(thread.lastPostAt) }}
                      </span>
                    </button>
                  </li>
                }
              </ol>
              @if (moreThreads()) {
                <button class="more" type="button" (click)="loadMoreThreads()">
                  {{ text().more }}
                </button>
              }
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
      gap: 0.4rem;
    }

    /* The whole row opens the thread: on a phone a title alone is a small
       target, and a thread is the one thing one does with a row here. */
    .thread {
      font: inherit;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: start;
      gap: 0.15rem;
      inline-size: 100%;
      text-align: start;
      padding: 0.55rem 0.6rem;
      border: 1px solid transparent;
      border-radius: 0.5rem;
      background: var(--trefaro-color-surface, #fff);
      color: inherit;
    }

    .thread:hover,
    .thread:focus-visible {
      border-color: var(--trefaro-color-primary, #1f6f5c);
    }

    .thread__title {
      font-weight: 600;
    }

    .thread__meta,
    .thread-view__meta,
    .post__meta {
      font-size: 0.82rem;
      opacity: 0.75;
    }

    .back {
      font: inherit;
      cursor: pointer;
      padding: 0;
      border: none;
      background: transparent;
      color: var(--trefaro-color-primary, #1f6f5c);
      font-weight: 600;
    }

    .thread-view__title {
      font-size: 1rem;
      font-weight: 600;
      margin: 0.6rem 0 0.1rem;
    }

    .thread-view__meta {
      margin: 0 0 0.8rem;
    }

    .posts {
      list-style: none;
      margin: 0 0 1rem;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.7rem;
    }

    .post {
      padding: 0.6rem 0.7rem;
      border-radius: 0.5rem;
      background: var(--trefaro-color-surface, #fff);
    }

    .post__body {
      margin: 0 0 0.3rem;
      /* A post is what somebody typed, line breaks included. */
      white-space: pre-line;
    }

    .post__meta {
      margin: 0;
      display: flex;
      align-items: baseline;
      gap: 0.4rem;
      flex-wrap: wrap;
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
      margin-block: 0.4rem 0.8rem;
      padding: 0.35rem 0.7rem;
      border: 1px solid var(--trefaro-color-primary-muted, #cbd5d1);
      border-radius: 0.4rem;
      background: transparent;
      color: inherit;
    }
  `,
})
export class ParticipantForum {
  /** The event this page is about, handed over by the hook point. */
  readonly eventId = input<string | null>(null);
  /** The reader's language, for the words and for the dates. */
  readonly locale = input<string>('en');
  /** This plug-in's words, keyed without the `plugins.forum.` prefix. */
  readonly strings = input<Readonly<Record<string, string>>>({});

  protected readonly maxTitle = MAX_FORUM_THREAD_TITLE_LENGTH;
  protected readonly maxPost = MAX_FORUM_POST_LENGTH;

  private readonly api = inject(ForumApi);

  /** The list: what has been read of it so far, and how much there is. */
  private readonly loadedThreads = signal<readonly ForumThread[]>([]);
  private readonly threadTotal = signal(0);
  private readonly threadPage = signal(1);

  /** The open thread, if any, with what has been read of its posts. */
  protected readonly open = signal<ForumThread | null>(null);
  private readonly loadedPosts = signal<readonly ForumPost[]>([]);
  private readonly postTotal = signal(0);
  private readonly postPage = signal(1);

  protected readonly state = signal<PanelState>('loading');
  protected readonly sending = signal(false);
  protected readonly posted = signal(false);
  protected readonly writeFailed = signal(false);
  /** A thread that could not be opened — the list stays, with a sentence. */
  protected readonly openFailed = signal(false);

  protected readonly draftTitle = signal('');
  protected readonly draftBody = signal('');

  protected readonly threads = this.loadedThreads.asReadonly();
  protected readonly posts = this.loadedPosts.asReadonly();
  protected readonly moreThreads = computed(
    () => this.loadedThreads().length < this.threadTotal(),
  );
  protected readonly morePosts = computed(
    () => this.loadedPosts().length < this.postTotal(),
  );
  protected readonly hasPending = computed(() =>
    this.loadedPosts().some((post) => post.status === 'pending'),
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
      threads: say('threads'),
      emptyThreads: say('emptyThreads'),
      newThread: say('newThread'),
      titleLabel: say('titleLabel'),
      bodyLabel: say('bodyLabel'),
      open: say('open'),
      openedBy: say('openedBy'),
      lastActivity: say('lastActivity'),
      back: say('back'),
      writtenBy: say('writtenBy'),
      replyLabel: say('replyLabel'),
      reply: say('reply'),
      posted: say('posted'),
      pendingNote: say('pendingNote'),
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
      this.loadedThreads.set([]);
      this.threadTotal.set(0);
      this.threadPage.set(1);
      this.open.set(null);
      if (!eventId) return;
      void this.loadThreads(eventId, 1);
    });
  }

  protected status(post: ForumPost): string {
    return statusWord(this.strings(), post.status);
  }

  /**
   * Who wrote it, or the fact that the account is gone.
   *
   * `null` is not an anonymous post: it is a row whose author closed their
   * account, and inventing a name for it would invent a person (F55).
   */
  protected name(author: ForumThread['author']): string {
    return author?.name ?? this.text().unknownAuthor;
  }

  protected at(iso: string): string {
    return when(this.locale(), iso);
  }

  protected value(event: Event): string {
    return (event.target as HTMLInputElement | HTMLTextAreaElement).value;
  }

  /** Opens one thread of the list; the list stays behind it. */
  protected show(thread: ForumThread): void {
    this.openFailed.set(false);
    this.posted.set(false);
    this.writeFailed.set(false);
    this.draftBody.set('');
    void this.loadPosts(thread, 1);
  }

  /** Back to the list as it was read — no request, nothing forgotten. */
  protected close(): void {
    this.open.set(null);
    this.loadedPosts.set([]);
    this.postTotal.set(0);
    this.postPage.set(1);
    this.posted.set(false);
    this.writeFailed.set(false);
    this.draftBody.set('');
  }

  protected loadMoreThreads(): void {
    const eventId = this.eventId();
    if (!eventId) return;
    void this.loadThreads(eventId, this.threadPage() + 1);
  }

  protected loadMorePosts(): void {
    const thread = this.open();
    if (!thread) return;
    void this.loadPosts(thread, this.postPage() + 1);
  }

  /** Starts a thread; the screen after it is the thread itself (F49). */
  protected async start(event: Event): Promise<void> {
    event.preventDefault();
    const eventId = this.eventId();
    if (!eventId || this.sending()) return;

    await this.write(async () => {
      const opened = await this.api.openThread(eventId, {
        title: this.draftTitle(),
        body: this.draftBody(),
      });
      // Prepended rather than refetched: the list is latest first, and a
      // reload would throw away the "show more" pages already open.
      this.loadedThreads.update((rows) => [opened.thread, ...rows]);
      this.threadTotal.update((count) => count + 1);
      this.open.set(opened.thread);
      this.loadedPosts.set([opened.post]);
      this.postTotal.set(1);
      this.postPage.set(1);
      this.draftTitle.set('');
    });
  }

  protected async reply(event: Event): Promise<void> {
    event.preventDefault();
    const thread = this.open();
    if (!thread || this.sending()) return;

    await this.write(async () => {
      const created = await this.api.reply(thread.id, {
        body: this.draftBody(),
      });
      // Appended: a conversation reads top-down, and the reply is its latest
      // word — pending, with the chip that says so.
      this.loadedPosts.update((rows) => [...rows, created]);
      this.postTotal.update((count) => count + 1);
    });
  }

  /** One write, with the three flags every form here shares. */
  private async write(action: () => Promise<void>): Promise<void> {
    this.sending.set(true);
    this.posted.set(false);
    this.writeFailed.set(false);
    try {
      await action();
      this.draftBody.set('');
      this.posted.set(true);
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

  private async loadThreads(eventId: string, page: number): Promise<void> {
    try {
      const answer = await this.api.listThreads(eventId, page);
      this.loadedThreads.update((rows) =>
        page === 1 ? answer.rows : [...rows, ...answer.rows],
      );
      this.threadTotal.set(answer.total);
      this.threadPage.set(answer.page);
      this.state.set('ready');
    } catch (error: unknown) {
      this.state.set(
        error instanceof NotSignedInError ? 'signedOut' : 'failed',
      );
    }
  }

  private async loadPosts(thread: ForumThread, page: number): Promise<void> {
    try {
      const answer = await this.api.listPosts(thread.id, page);
      // The thread as the server has it now, not as the list remembered it:
      // its activity may have moved since the list was read.
      this.open.set(answer.thread);
      this.loadedPosts.update((rows) =>
        page === 1 ? answer.rows : [...rows, ...answer.rows],
      );
      this.postTotal.set(answer.total);
      this.postPage.set(answer.page);
    } catch (error: unknown) {
      if (error instanceof NotSignedInError) {
        this.state.set('signedOut');
        return;
      }
      // Gone, or no longer visible: the list is still the right screen, with a
      // sentence — a thread that vanished under a click is not a broken panel.
      if (page === 1) this.openFailed.set(true);
    }
  }
}

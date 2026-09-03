import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { problemOf, type Problem } from '@trefaro/shared-http';
import { TranslationService } from '@trefaro/shared-i18n';
import {
  MAX_MESSAGE_LENGTH,
  formatInstant,
  localTimeZone,
  type ChatMessage,
  type OrganizerConversationDetail,
  type ReplyDelivery,
} from '@trefaro/shared-models';
import { AuthService } from '../../features/auth/auth.service';
import { ConversationsAdminService } from '../../features/chat/conversations-admin.service';
import { PublicSite } from '../../features/public-site/public-site.service';

/** One line, as this screen draws it. */
interface Line {
  readonly message: ChatMessage;
  /** Who wrote it, already resolved to a name or a catalogue key. */
  readonly who: string;
  /** Whether {@link who} is a key to translate rather than a person's name. */
  readonly whoIsKey: boolean;
  /** The organization's own lines sit on the other side. */
  readonly ours: boolean;
}

/**
 * One conversation of the organization (FR 3.4 — AP 10).
 *
 * The history and the field to answer in. What makes this screen different
 * from the participant's thread is not the layout but who is answering, and
 * three things follow from it:
 *
 * 1. **An answer to somebody without an account leaves the application**
 *    (F11). The screen says so before the answer is written — the address it
 *    will go to is on the button's own label — and afterwards it says whether
 *    the mail actually went (F174). A stored line that never left would
 *    otherwise look exactly like an answered question.
 * 2. **A picture is fetched, not linked** (E9, F133): the URL in a message is
 *    served to *members* of a conversation, and the organization is not one.
 *    Each object URL is released when this screen goes.
 * 3. **The lines say who wrote them, and "you" means you.** The reply carries
 *    the account that wrote it (E39), so an organizer can tell their own
 *    answers from a colleague's — as far as this client can, which is: their
 *    own by id, everything else as the organization. Resolving a colleague's
 *    name would be a fourth read of the accounts, and `todo.md` says so.
 */
@Component({
  selector: 'trefaro-admin-conversation-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoPipe],
  template: `
    <p class="back">
      <a routerLink="/messages">{{
        'admin.messages.thread.back' | transloco
      }}</a>
    </p>

    @if (error(); as problem) {
      <p class="error" role="alert">
        {{ problem.key | transloco }}
        @if (problem.detail; as detail) {
          <span class="error__detail">{{ detail }}</span>
        }
      </p>
    }

    @if (missing()) {
      <p class="meta">{{ 'admin.messages.thread.notFound' | transloco }}</p>
    } @else if (conversation(); as row) {
      <header class="head">
        <h1>{{ title() }}</h1>
        <p class="meta">
          @if (row.guest; as guest) {
            {{
              'admin.messages.thread.guestIs'
                | transloco: { email: guest.email }
            }}
          } @else {
            {{ members() }}
          }
        </p>
        @if (row.event; as event) {
          <p class="meta">
            @if (site.known()) {
              <a
                [href]="site.event(event.seriesSlug, event.slug)"
                target="_blank"
                rel="noopener"
                >{{ event.name }}</a
              >
            } @else {
              {{ event.name }}
            }
          </p>
        }
      </header>

      @if (older()) {
        <button type="button" [disabled]="busy()" (click)="loadOlder()">
          {{ 'admin.messages.thread.older' | transloco }}
        </button>
      }

      @if (lines().length === 0) {
        <p class="meta">{{ 'admin.messages.thread.empty' | transloco }}</p>
      } @else {
        <ul
          class="history"
          [attr.aria-label]="'admin.messages.thread.history' | transloco"
        >
          @for (line of lines(); track line.message.id) {
            <li class="line" [class.line--ours]="line.ours">
              <!-- Two things, so two elements: who wrote it and when. A
                   label sharing an element with a timestamp is one a test — and
                   a screen reader — cannot address on its own. -->
              <p class="line__who">
                <span>{{
                  line.whoIsKey ? (line.who | transloco) : line.who
                }}</span>
                <span class="line__when">{{ when(line.message) }}</span>
              </p>
              @if (line.message.body; as body) {
                <p class="line__body">{{ body }}</p>
              }
              @if (line.message.imageUrl) {
                @if (picture(line.message.id); as url) {
                  <img
                    class="line__image"
                    [src]="url"
                    [alt]="'admin.messages.thread.image' | transloco"
                  />
                } @else {
                  <p class="meta">
                    {{ 'admin.messages.thread.imageLoading' | transloco }}
                  </p>
                }
              }
            </li>
          }
        </ul>
      }

      @if (notice(); as delivery) {
        <p class="notice" role="status">
          @if (delivery === 'failed') {
            {{
              'admin.messages.reply.mailFailed'
                | transloco: { email: row.guest?.email }
            }}
          } @else if (delivery === 'sent') {
            {{
              'admin.messages.reply.mailSent'
                | transloco: { email: row.guest?.email }
            }}
          } @else {
            {{ 'admin.messages.reply.posted' | transloco }}
          }
        </p>
      }

      <form class="reply" (submit)="send($event)">
        <label>
          <span>{{ 'admin.messages.reply.label' | transloco }}</span>
          <textarea
            rows="4"
            [value]="draft()"
            [attr.maxlength]="maxLength"
            [disabled]="sending()"
            (input)="typed($event)"
          ></textarea>
        </label>
        <p class="hint">
          @if (row.guest; as guest) {
            {{
              'admin.messages.reply.hintGuest'
                | transloco: { email: guest.email }
            }}
          } @else {
            {{ 'admin.messages.reply.hintGroup' | transloco }}
          }
        </p>
        <button type="submit" [disabled]="!answerable() || sending()">
          {{
            (sending()
              ? 'admin.messages.reply.sending'
              : 'admin.messages.reply.send'
            ) | transloco
          }}
        </button>
      </form>
    } @else if (!error()) {
      <p class="meta">{{ 'common.loading' | transloco }}</p>
    }
  `,
  styles: `
    :host {
      display: block;
      max-inline-size: 46rem;
    }

    .back {
      margin-block: 0 0.4rem;
    }

    h1 {
      margin-block: 0 0.2rem;
      font-size: 1.3rem;
    }

    .head .meta {
      margin-block: 0;
    }

    .hint,
    .meta {
      color: var(--trefaro-color-primary-muted);
      font-size: 0.9rem;
    }

    .error {
      color: var(--trefaro-color-danger, #b3261e);
    }

    .error__detail {
      display: block;
      font-size: 0.9rem;
    }

    .history {
      list-style: none;
      margin: 1rem 0;
      padding: 0;
      display: grid;
      gap: 0.6rem;
    }

    .line {
      max-inline-size: 34rem;
      padding: 0.5rem 0.7rem;
      border: 1px solid var(--trefaro-color-border);
      border-radius: var(--trefaro-radius-sm, 0.4rem);
    }

    .line--ours {
      margin-inline-start: auto;
      background: var(--trefaro-color-primary-soft);
      border-color: var(--trefaro-color-primary);
    }

    .line__who {
      display: flex;
      justify-content: space-between;
      gap: 0.7rem;
      margin-block: 0 0.2rem;
      font-size: 0.85rem;
      font-weight: 600;
    }

    .line__when {
      font-weight: 400;
      color: var(--trefaro-color-primary-muted);
    }

    .line__body {
      margin-block: 0;
      white-space: pre-wrap;
    }

    .line__image {
      display: block;
      margin-block-start: 0.4rem;
      max-inline-size: 100%;
      border-radius: var(--trefaro-radius-sm, 0.4rem);
    }

    .notice {
      padding: 0.4rem 0.6rem;
      border-radius: var(--trefaro-radius-sm, 0.4rem);
      background: var(--trefaro-color-primary-soft);
    }

    .reply label {
      display: grid;
      gap: 0.2rem;
    }

    .reply textarea {
      inline-size: 100%;
      font: inherit;
    }
  `,
})
export class AdminConversationPage {
  /** Bound from the route by `withComponentInputBinding()`. */
  readonly id = input.required<string>();

  private readonly conversations = inject(ConversationsAdminService);
  private readonly auth = inject(AuthService);
  private readonly i18n = inject(TranslationService);
  protected readonly site = inject(PublicSite);

  protected readonly maxLength = MAX_MESSAGE_LENGTH;

  protected readonly conversation = signal<OrganizerConversationDetail | null>(
    null,
  );
  protected readonly history = signal<readonly ChatMessage[]>([]);
  protected readonly older = signal(false);
  protected readonly error = signal<Problem | null>(null);
  protected readonly missing = signal(false);
  protected readonly busy = signal(false);
  protected readonly sending = signal(false);
  protected readonly draft = signal('');
  /** What became of the last answer's mail, until the next one (F174). */
  protected readonly notice = signal<ReplyDelivery | null>(null);
  /** Object URLs of the pictures already fetched, by message id. */
  private readonly pictures = signal<ReadonlyMap<string, string>>(new Map());

  protected readonly answerable = computed(
    () => this.draft().trim().length > 0,
  );

  /** Oldest first: a conversation is read downwards. */
  protected readonly lines = computed<readonly Line[]>(() => {
    const row = this.conversation();
    const mine = this.auth.admin()?.id ?? null;
    return [...this.history()].reverse().map((message) => {
      const ours = message.senderType === 'admin';
      return {
        message,
        ours,
        ...this.whoWrote(message, row, mine, ours),
      };
    });
  });

  constructor() {
    effect(() => {
      const id = this.id();
      this.reset();
      void this.load(id);
    });

    inject(DestroyRef).onDestroy(() => {
      // The bytes came through a request, so nothing releases them but this.
      for (const url of this.pictures().values()) URL.revokeObjectURL(url);
    });
  }

  protected title(): string {
    const row = this.conversation();
    if (!row) return '';
    if (row.guest) return row.guest.name ?? row.guest.email;
    if (row.topic) return row.topic;

    // Read for the dependency: this string is chosen in TypeScript (F72).
    this.i18n.locale();
    return this.i18n.translate('admin.messages.unnamed');
  }

  /** The people in a group, by name — a contact request has none. */
  protected members(): string {
    const row = this.conversation();
    if (!row || row.members.length === 0) {
      this.i18n.locale();
      return this.i18n.translate('admin.messages.thread.noMembers');
    }
    return row.members.map((member) => member.name).join(', ');
  }

  protected picture(messageId: string): string | null {
    return this.pictures().get(messageId) ?? null;
  }

  /**
   * When a line was written, in the reader's own zone.
   *
   * The exception E8 allows for a conversation, decided for the participant's
   * chat in F168 and true for the same reason here: "when did this arrive" is
   * a question about the reader's day, not about the venue's.
   */
  protected when(message: ChatMessage): string {
    return formatInstant(
      message.createdAt,
      localTimeZone(),
      this.i18n.locale(),
    );
  }

  protected typed(nativeEvent: Event): void {
    this.draft.set((nativeEvent.target as HTMLTextAreaElement).value);
  }

  protected async send(nativeEvent: Event): Promise<void> {
    nativeEvent.preventDefault();
    if (!this.answerable() || this.sending()) return;

    this.sending.set(true);
    this.error.set(null);
    this.notice.set(null);
    try {
      const reply = await this.conversations.reply(this.id(), this.draft());
      // Prepended, because the history is newest first until it is drawn.
      this.history.update((rows) => [reply.message, ...rows]);
      this.draft.set('');
      this.notice.set(reply.delivery);
    } catch (error: unknown) {
      this.error.set(problemOf(error, 'admin.messages.reply.failed'));
    } finally {
      this.sending.set(false);
    }
  }

  protected async loadOlder(): Promise<void> {
    const oldest = this.history().at(-1);
    if (!oldest) return;

    this.busy.set(true);
    try {
      const window = await this.conversations.history(this.id(), {
        before: oldest.id,
      });
      this.history.update((rows) => [...rows, ...window.rows]);
      this.older.set(window.hasMore);
      void this.fetchPictures(window.rows);
    } catch (error: unknown) {
      this.error.set(problemOf(error, 'admin.messages.thread.error'));
    } finally {
      this.busy.set(false);
    }
  }

  private reset(): void {
    this.conversation.set(null);
    this.history.set([]);
    this.older.set(false);
    this.error.set(null);
    this.missing.set(false);
    this.notice.set(null);
    this.draft.set('');
  }

  private async load(id: string): Promise<void> {
    this.busy.set(true);
    try {
      const [row, window] = await Promise.all([
        this.conversations.get(id),
        this.conversations.history(id, {}),
      ]);
      this.conversation.set(row);
      this.history.set(window.rows);
      this.older.set(window.hasMore);
      void this.fetchPictures(window.rows);
    } catch (error: unknown) {
      // A 404 is a sentence rather than an error: an id that is not the
      // organization's is said the same way an unknown one is (F173), and the
      // screen explains that rather than colouring it red.
      if (isMissing(error)) this.missing.set(true);
      else this.error.set(problemOf(error, 'admin.messages.thread.error'));
    } finally {
      this.busy.set(false);
    }
  }

  /**
   * Fetches the pictures of a window, one request each.
   *
   * After the lines are on screen rather than before: a conversation reads
   * without its images, and a request per picture must not hold the text back.
   * A picture that cannot be fetched leaves its line as it is — the message is
   * still there, which is more than a broken image would say.
   */
  private async fetchPictures(rows: readonly ChatMessage[]): Promise<void> {
    for (const message of rows) {
      if (!message.imageUrl || this.pictures().has(message.id)) continue;
      try {
        const url = await this.conversations.image(
          message.conversationId,
          message.id,
        );
        this.pictures.update((pictures) =>
          new Map(pictures).set(message.id, url),
        );
      } catch {
        // Said by the line itself, which keeps its "loading" word: a notice at
        // the top of the screen about one image nobody asked for would be
        // noise.
      }
    }
  }

  /** Who wrote a line: this organizer, the organization, a member, a guest. */
  private whoWrote(
    message: ChatMessage,
    row: OrganizerConversationDetail | null,
    mine: string | null,
    ours: boolean,
  ): { who: string; whoIsKey: boolean } {
    if (ours) {
      return {
        who:
          message.senderId && message.senderId === mine
            ? 'admin.messages.thread.you'
            : 'admin.messages.thread.us',
        whoIsKey: true,
      };
    }

    if (message.senderType === 'guest') {
      const guest = row?.guest;
      return guest
        ? { who: guest.name ?? guest.email, whoIsKey: false }
        : { who: 'admin.messages.guest', whoIsKey: true };
    }

    const member = row?.members.find(
      (one) => one.profileId !== null && one.profileId === message.senderId,
    );
    return member
      ? { who: member.name, whoIsKey: false }
      : { who: 'admin.messages.thread.participant', whoIsKey: true };
  }
}

/** The one status this screen reads: an id that is nothing of ours (F173). */
function isMissing(error: unknown): boolean {
  return (error as { status?: number } | null)?.status === 404;
}

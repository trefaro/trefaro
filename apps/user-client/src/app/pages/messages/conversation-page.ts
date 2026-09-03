import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { RealtimeClient, problemOf, type Problem } from '@trefaro/shared-http';
import { TranslationService } from '@trefaro/shared-i18n';
import {
  BRANDING_MIME_TYPES,
  DEFAULT_MESSAGE_PAGE_SIZE,
  MAX_MESSAGE_IMAGE_BYTES,
  MAX_MESSAGE_LENGTH,
  brandingTypeSummary,
  formatBytes,
  type ChatMessage,
  type ConversationSummary,
} from '@trefaro/shared-models';
import { ParticipantSessionService } from '../../features/auth/participant-session.service';
import { ChatService } from '../../features/chat/chat.service';
import { LiveStatus } from '../../features/chat/live-status';
import {
  messageClock,
  messageDay,
  sameDay,
} from '../../features/chat/message-time';
import { initialsOf } from '../../features/profiles/initials';

/** A chosen picture and the local address its preview is drawn from. */
interface PendingPicture {
  readonly file: File;
  readonly previewUrl: string;
}

/** One line as the template draws it: the message, whose it is, its day. */
interface Line {
  readonly message: ChatMessage;
  readonly mine: boolean;
  readonly clock: string;
  /** The day heading to draw above it, or `null` when it continues one. */
  readonly day: string | null;
}

/**
 * One conversation (FR 4.5, UC 13).
 *
 * The history, oldest at the top, and a box to write in. What arrives while
 * the screen is open arrives by itself — this is the only screen of the client
 * that joins a conversation's room (F161), and that is also what makes E44
 * mean what it says: "nobody is watching" is decided by this room, not by
 * whether the application is open.
 *
 * Five decisions worth naming:
 *
 * 1. **The window is turned around once, here.** The endpoint answers newest
 *    first, because that is the page a cursor pages backwards from (F154); a
 *    conversation reads downwards. So the rows are reversed on arrival and
 *    everything after that — appending, prepending, deduplicating — works on
 *    the order a reader sees.
 * 2. **A sent message arrives twice and is drawn once.** The POST answers with
 *    the line, and the socket delivers the same line to every member including
 *    its sender — so both paths go through one merge that is keyed on the id.
 *    Deduplicating rather than not listening: the answer is what makes sending
 *    feel immediate, and the socket is what makes it correct.
 * 3. **Opening marks as read, and so does a message that arrives while it is
 *    open** (E38). Somebody looking at a line has read it, and a counter that
 *    survived being looked at is a counter nobody trusts.
 * 4. **A picture is chosen, then sent** — never uploaded on choosing. The
 *    preview is the last chance to see what everybody in the conversation will
 *    see, and a message cannot be edited afterwards (E14).
 * 5. **Older messages are fetched, never guessed.** "Show earlier messages"
 *    asks with the id of the oldest line on screen, which is what a cursor is
 *    for: the list grows at the other end while it is being read.
 */
@Component({
  selector: 'trefaro-conversation-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, TranslocoPipe, LiveStatus],
  template: `
    <p class="back">
      <a routerLink="/messages">{{ 'chat.thread.back' | transloco }}</a>
    </p>

    <div class="head">
      @if (avatarUrl(); as url) {
        <!-- Decorative: the name is the heading right beside it. -->
        <img class="head__avatar" [src]="url" alt="" />
      } @else {
        <span class="head__avatar head__avatar--empty" aria-hidden="true">{{
          initials()
        }}</span>
      }
      <h1>{{ title() }}</h1>
    </div>

    <trefaro-live-status [following]="following()" />

    @if (notFound()) {
      <p class="notice" role="alert">
        {{ 'chat.thread.notFound' | transloco }}
      </p>
    } @else {
      @if (error(); as problem) {
        <p class="notice" role="alert">
          {{ problem.key | transloco: problem.params }}
          @if (problem.detail; as detail) {
            <span class="notice__detail">{{ detail }}</span>
          }
        </p>
      }

      @if (hasMore()) {
        <button type="button" [disabled]="busy()" (click)="older()">
          {{ 'chat.thread.older' | transloco }}
        </button>
      }

      @if (loaded()) {
        @if (lines().length === 0) {
          <p>{{ 'chat.thread.empty' | transloco }}</p>
        } @else {
          <!-- Named, because a section without an accessible name is not a
               region — and this one is the conversation itself. -->
          <ol
            class="lines"
            [attr.aria-label]="'chat.thread.history' | transloco"
          >
            @for (line of lines(); track line.message.id) {
              @if (line.day; as day) {
                <li class="day">{{ day }}</li>
              }
              <li class="line" [class.line--mine]="line.mine">
                <p class="line__who">
                  {{
                    line.mine
                      ? ('chat.thread.you' | transloco)
                      : senderName(line.message)
                  }}
                  <span class="line__clock">{{ line.clock }}</span>
                </p>
                @if (line.message.body; as body) {
                  <p class="line__body">{{ body }}</p>
                }
                @if (line.message.imageUrl; as url) {
                  <!-- The session cookie travels with this request because
                       it is issued for the /api path, which is where the media
                       route lives — the same reason the socket had to move
                       there (F156, F160). No backticks in here: they end the
                       template literal (see docs/rules/angular-clients.md). -->
                  <img
                    class="line__image"
                    [src]="url"
                    [alt]="'chat.thread.image' | transloco"
                  />
                }
              </li>
            }
          </ol>
        }
      } @else {
        <p class="notice">{{ 'common.loading' | transloco }}</p>
      }

      <form class="compose" [formGroup]="form" (ngSubmit)="send()" novalidate>
        <!-- Disabled while a message is in flight: the form empties itself on
             success, and anything typed in between would go with it. -->
        <fieldset [disabled]="sending()">
          <label for="message-body">
            {{ 'chat.compose.label' | transloco }}
          </label>
          <textarea
            id="message-body"
            formControlName="body"
            rows="3"
            [attr.maxlength]="maxLength"
          ></textarea>

          @if (picture(); as chosen) {
            <div class="chosen">
              <img
                class="chosen__preview"
                [src]="chosen.previewUrl"
                [alt]="'chat.compose.preview' | transloco"
              />
              <button type="button" class="danger" (click)="discard()">
                {{ 'chat.compose.remove' | transloco }}
              </button>
            </div>
          }

          <div class="file">
            <label for="message-image">
              {{ 'chat.compose.choose' | transloco }}
            </label>
            <input
              id="message-image"
              #picker
              type="file"
              [accept]="accept"
              (change)="choose($event)"
            />
            <p class="hint">{{ typeHint() }}</p>
          </div>

          <button type="submit" [disabled]="!canSend()">
            {{
              (sending() ? 'chat.compose.sending' : 'chat.compose.send')
                | transloco
            }}
          </button>
        </fieldset>
      </form>
    }
  `,
  styles: `
    :host {
      display: block;
      max-inline-size: 34rem;
    }

    .back {
      margin-block: 0 0.2rem;
    }

    .head {
      display: flex;
      align-items: center;
      gap: 0.7rem;
    }

    h1 {
      margin: 0;
      font-size: 1.2rem;
    }

    .head__avatar {
      display: grid;
      place-items: center;
      inline-size: 2.6rem;
      block-size: 2.6rem;
      border-radius: 50%;
      object-fit: cover;
      flex: none;
    }

    .head__avatar--empty {
      background: var(--trefaro-color-primary-soft);
      color: var(--trefaro-color-primary-strong);
      font-weight: 600;
    }

    .lines {
      list-style: none;
      margin: 0.6rem 0;
      padding: 0;
      display: grid;
      gap: 0.5rem;
    }

    .day {
      margin-block-start: 0.6rem;
      text-align: center;
      font-size: 0.8rem;
      color: var(--trefaro-color-primary-muted);
    }

    .line {
      padding: 0.5rem 0.7rem;
      border: 1px solid var(--trefaro-color-border);
      border-radius: var(--trefaro-radius-sm, 0.4rem);
      max-inline-size: 90%;
    }

    .line--mine {
      margin-inline-start: auto;
      background: var(--trefaro-color-primary-soft);
      border-color: var(--trefaro-color-primary-muted);
    }

    .line__who {
      margin: 0 0 0.2rem;
      font-size: 0.8rem;
      font-weight: 600;
      display: flex;
      gap: 0.5rem;
      justify-content: space-between;
    }

    .line__clock {
      font-weight: 400;
      color: var(--trefaro-color-primary-muted);
    }

    .line__body {
      margin: 0;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }

    .line__image {
      display: block;
      margin-block-start: 0.4rem;
      max-inline-size: 100%;
      border-radius: var(--trefaro-radius-sm, 0.4rem);
    }

    fieldset {
      border: 0;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 0.4rem;
    }

    label {
      font-weight: 600;
    }

    textarea {
      font: inherit;
      inline-size: 100%;
      box-sizing: border-box;
    }

    .chosen {
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }

    .chosen__preview {
      inline-size: 4rem;
      block-size: 4rem;
      object-fit: cover;
      border-radius: var(--trefaro-radius-sm, 0.4rem);
    }

    .file {
      display: grid;
      gap: 0.2rem;
    }

    button {
      padding: 0.5rem 0.9rem;
      border: 1px solid color-mix(in oklab, currentColor 30%, transparent);
      border-radius: 0.4rem;
      background: transparent;
      color: inherit;
      font: inherit;
      justify-self: start;
    }

    button:disabled {
      opacity: 0.55;
    }

    .danger {
      color: var(--trefaro-color-primary-strong);
    }

    .hint {
      margin: 0;
      color: color-mix(in oklab, currentColor 70%, transparent);
      font-size: 0.9rem;
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
export class ConversationPage {
  private readonly chat = inject(ChatService);
  private readonly realtime = inject(RealtimeClient);
  private readonly session = inject(ParticipantSessionService);
  private readonly i18n = inject(TranslationService);
  private readonly picker =
    viewChild.required<ElementRef<HTMLInputElement>>('picker');

  /** From the path, bound by `withComponentInputBinding()`. */
  readonly id = input<string>();

  protected readonly accept = BRANDING_MIME_TYPES.join(',');
  protected readonly maxLength = MAX_MESSAGE_LENGTH;

  protected readonly form = inject(FormBuilder).group({ body: '' });

  /** Who this conversation is with, for the heading and for the names. */
  private readonly conversation = signal<ConversationSummary | null>(null);
  /** Oldest first — the order this screen reads in, turned around on arrival. */
  private readonly messages = signal<readonly ChatMessage[]>([]);
  protected readonly hasMore = signal(false);
  protected readonly loaded = signal(false);
  protected readonly busy = signal(false);
  protected readonly sending = signal(false);
  protected readonly error = signal<Problem | null>(null);
  /** A conversation that is not this account's, said as an unknown id (F157). */
  protected readonly notFound = signal(false);
  protected readonly picture = signal<PendingPicture | null>(null);
  /** Whether the socket is in this conversation's room right now. */
  protected readonly following = signal<boolean | null>(null);

  /** The text box, as a signal, so the send button can watch it. */
  private readonly typed = signal('');

  protected readonly canSend = computed(
    () =>
      !this.sending() &&
      (this.typed().trim().length > 0 || this.picture() !== null),
  );

  /**
   * What this conversation is called.
   *
   * A group has a topic, a one-to-one conversation is named by who it is with
   * (E39) — and while the row has not arrived yet the heading says what the
   * screen is rather than staying blank, because the history below it may
   * already be readable.
   */
  protected readonly title = computed(() => {
    const row = this.conversation();
    if (!row) return this.i18n.translate('chat.thread.title');
    if (row.topic) return row.topic;

    const names = row.counterparts.map((one) => one.name).filter(Boolean);
    return names.length > 0
      ? names.join(', ')
      : this.i18n.translate('chat.unnamed');
  });

  protected readonly avatarUrl = computed(
    () => this.conversation()?.counterparts[0]?.avatarUrl ?? null,
  );

  protected readonly initials = computed(() =>
    initialsOf(this.title().split(/\s+/), this.i18n.locale()),
  );

  protected readonly lines = computed<readonly Line[]>(() => {
    const locale = this.i18n.locale();
    const mine = this.session.participant()?.id ?? null;
    let previous: Date | null = null;

    return this.messages().map((message) => {
      const at = new Date(message.createdAt);
      const day =
        previous && sameDay(previous, at)
          ? null
          : messageDay(message.createdAt, locale);
      previous = at;

      return {
        message,
        // The sender id of a participant is their profile id, which is what
        // lets a client tell its own lines from the other side's without
        // comparing names.
        mine: message.senderType === 'user' && message.senderId === mine,
        clock: messageClock(message.createdAt, locale),
        day,
      };
    });
  });

  constructor() {
    this.form.controls.body.valueChanges.subscribe((value) =>
      this.typed.set(value ?? ''),
    );

    effect(() => {
      const id = this.id();
      if (id) void this.open(id);
    });

    const arriving = this.realtime.messages.subscribe((message) => {
      if (message.conversationId !== this.id()) return;
      this.absorb(message);
      // Somebody looking at a line has read it (E38). Only for lines that are
      // not this reader's own: marking one's own message as read is a request
      // that changes nothing.
      if (!this.isMine(message))
        void this.chat.markRead(message.conversationId);
    });

    inject(DestroyRef).onDestroy(() => {
      arriving.unsubscribe();
      this.releasePreview();
      const id = this.id();
      if (id) this.realtime.leave(id);
    });
  }

  /**
   * Who wrote a line that is not this reader's own.
   *
   * Resolved against the conversation's counterparts rather than against
   * anything in the message: a message carries an id, and the names of the
   * people in a conversation are a property of the conversation (E39). The
   * organizer and a guest have no profile id at all, so they are named by the
   * one thing that is true of them — which side they wrote from.
   */
  protected senderName(message: ChatMessage): string {
    // Read for the dependency: the fallbacks below are chosen in TypeScript,
    // and `translate()` reads a plain map without one (F72).
    this.i18n.locale();

    const named = this.conversation()?.counterparts.find(
      (one) => one.profileId !== null && one.profileId === message.senderId,
    );
    if (named) return named.name;

    return this.i18n.translate(
      message.senderType === 'admin'
        ? 'chat.thread.organizer'
        : 'chat.thread.other',
    );
  }

  /** What may be sent as a picture, in one sentence — a method, so F72 holds. */
  protected typeHint(): string {
    return this.i18n.translate('chat.compose.types', {
      types: brandingTypeSummary(),
      size: formatBytes(MAX_MESSAGE_IMAGE_BYTES, this.i18n.locale()),
    });
  }

  protected async older(): Promise<void> {
    const oldest = this.messages()[0];
    const id = this.id();
    if (!oldest || !id || this.busy()) return;

    this.busy.set(true);
    this.error.set(null);
    try {
      const window = await this.chat.history(id, { before: oldest.id });
      this.messages.update((lines) => [...oldestFirst(window.rows), ...lines]);
      this.hasMore.set(window.hasMore);
    } catch (error: unknown) {
      this.error.set(problemOf(error, 'chat.thread.error'));
    } finally {
      this.busy.set(false);
    }
  }

  /**
   * Takes the picked picture, or says why it cannot be sent.
   *
   * The same courtesy as the profile picture: the server checks the type
   * against the file's own first bytes and would refuse the same file (F38).
   * Doing it here is what tells somebody on mobile data about a photograph
   * that is too heavy before it is uploaded.
   */
  protected choose(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    this.releasePreview();
    this.picture.set(null);
    this.error.set(null);
    if (!file) return;

    if (!BRANDING_MIME_TYPES.includes(file.type)) {
      this.error.set({
        key: 'chat.compose.wrongType',
        detail: null,
        params: { hint: this.typeHint() },
      });
      this.reset();
      return;
    }

    if (file.size > MAX_MESSAGE_IMAGE_BYTES) {
      this.error.set({
        key: 'chat.compose.tooLarge',
        detail: null,
        params: {
          size: formatBytes(file.size, this.i18n.locale()),
          hint: this.typeHint(),
        },
      });
      this.reset();
      return;
    }

    this.picture.set({ file, previewUrl: URL.createObjectURL(file) });
  }

  /** Drops the chosen picture again. */
  protected discard(): void {
    this.releasePreview();
    this.picture.set(null);
    this.reset();
  }

  protected async send(): Promise<void> {
    const id = this.id();
    if (!id || !this.canSend()) return;

    const body = this.typed().trim();
    const chosen = this.picture();

    this.sending.set(true);
    this.error.set(null);
    try {
      const message = await this.chat.send(id, {
        body,
        image: chosen?.file ?? null,
      });
      // Drawn from the answer straight away; the socket will deliver the same
      // line, and `absorb` is keyed on the id so it lands once.
      this.absorb(message);
      this.form.reset({ body: '' });
      this.typed.set('');
      this.discard();
    } catch (error: unknown) {
      this.error.set(problemOf(error, 'chat.compose.failed'));
    } finally {
      this.sending.set(false);
    }
  }

  /**
   * Opens one conversation: the newest window, the room, the read mark.
   *
   * In that order, and the order is the point. The history is what somebody
   * came for, so it is fetched first and shown even if the socket never
   * connects; joining decides whether it keeps growing; and marking read is
   * the consequence of having seen it.
   */
  private async open(id: string): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    this.notFound.set(false);
    this.loaded.set(false);
    this.messages.set([]);
    this.conversation.set(null);

    try {
      const window = await this.chat.history(id, {
        pageSize: DEFAULT_MESSAGE_PAGE_SIZE,
      });
      this.messages.set(oldestFirst(window.rows));
      this.hasMore.set(window.hasMore);
      this.loaded.set(true);
    } catch (error: unknown) {
      if (isMissing(error)) this.notFound.set(true);
      else this.error.set(problemOf(error, 'chat.thread.error'));
      return;
    } finally {
      this.busy.set(false);
    }

    // After the history, and its own failure: a name is worth less than the
    // lines, so a conversation whose row cannot be read still shows them.
    try {
      this.conversation.set(await this.chat.get(id));
    } catch {
      /* the heading falls back to the screen's own name */
    }

    this.following.set(await this.realtime.join(id));
    // Marking read is best effort: a counter that stayed is worth less than a
    // conversation that failed to open, and the reader is looking at the lines
    // either way.
    try {
      await this.chat.markRead(id);
    } catch {
      /* see above */
    }
  }

  /** One line into the list, in order, once. */
  private absorb(message: ChatMessage): void {
    this.messages.update((lines) =>
      lines.some((line) => line.id === message.id)
        ? lines
        : [...lines, message].sort(byTime),
    );
  }

  private isMine(message: ChatMessage): boolean {
    return (
      message.senderType === 'user' &&
      message.senderId === this.session.participant()?.id
    );
  }

  private releasePreview(): void {
    const chosen = this.picture();
    if (chosen) URL.revokeObjectURL(chosen.previewUrl);
  }

  /**
   * Empties the file input.
   *
   * Without it, choosing the same file again fires no `change` event — so a
   * refused picture could not be retried after being resized on the phone.
   */
  private reset(): void {
    this.picker().nativeElement.value = '';
  }
}

/** The window as a conversation reads: oldest at the top. */
function oldestFirst(rows: readonly ChatMessage[]): readonly ChatMessage[] {
  return [...rows].reverse();
}

/** By time, and by id where two lines share a millisecond (F154). */
function byTime(one: ChatMessage, other: ChatMessage): number {
  const difference = Date.parse(one.createdAt) - Date.parse(other.createdAt);
  return difference !== 0 ? difference : one.id.localeCompare(other.id);
}

/** Whether the server said "no such conversation" rather than something else. */
function isMissing(error: unknown): boolean {
  return (error as { status?: number } | null)?.status === 404;
}

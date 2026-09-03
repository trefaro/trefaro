import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppConfigService } from '@trefaro/shared-config';
import { problemOf, type Problem } from '@trefaro/shared-http';
import { TranslationService } from '@trefaro/shared-i18n';
import {
  CHAT_MODULE_KEY,
  DEFAULT_ORGANIZER_CONVERSATION_PAGE_SIZE,
  awaitsAnswer,
  formatInstant,
  localTimeZone,
  type OrganizerConversationSummary,
} from '@trefaro/shared-models';
import { ConversationsAdminService } from '../../features/chat/conversations-admin.service';
import { PublicSite } from '../../features/public-site/public-site.service';
import { GroupForm } from './group-form';

/**
 * The organization's messages (FR 3.4, UC 14 — AP 10).
 *
 * The mail-program-like overview FR 3.4 asks for: everything the organization
 * is part of, newest first, with the last line as a preview and a link to the
 * thread. Two kinds share it — a question from somebody without an account
 * (AP 9) and a group around an event — and that is the point of one screen
 * rather than two: an organizer opens their messages, not a filter.
 *
 * Four decisions worth naming:
 *
 * 1. **No unread badge, but a "waiting" one.** The organization has no
 *    membership row and therefore nowhere to keep a read marker (F133). What
 *    stands there instead is `awaitsAnswer` — whether the last line came from
 *    somebody else — and for a mailbox several people read, that is the more
 *    useful question anyway: "has anybody here answered this" rather than
 *    "have I looked at it".
 * 2. **The event is a link to the public page.** For a contact request that
 *    page *is* the context — somebody was reading it when they asked — and the
 *    organizer client can only offer the link where the deployment said where
 *    the participant client answers (F112).
 * 3. **A group is assembled here**, in a panel that opens on demand rather
 *    than on a page of its own: it is three fields, and a screen for them
 *    would put the list one click further away for the thing that happens far
 *    more often — reading what arrived.
 * 4. **Nothing is live.** The participant's chat is (AP 7); this is not, for
 *    the reasons the service states, and the mail about a contact request is
 *    what makes that acceptable (F172).
 */
@Component({
  selector: 'trefaro-messages-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoPipe, GroupForm],
  template: `
    @if (error(); as problem) {
      <p class="error" role="alert">
        {{ problem.key | transloco }}
        @if (problem.detail; as detail) {
          <span class="error__detail">{{ detail }}</span>
        }
      </p>
    }

    <header class="head">
      <div>
        <h1>{{ 'admin.messages.title' | transloco }}</h1>
        <p class="hint">{{ 'admin.messages.lead' | transloco }}</p>
      </div>
      @if (chatEnabled()) {
        <button type="button" (click)="toggleGroupForm()">
          {{
            (composing()
              ? 'admin.messages.group.cancel'
              : 'admin.messages.group.new'
            ) | transloco
          }}
        </button>
      }
    </header>

    @if (!chatEnabled()) {
      <p class="hint hint--off">{{ 'admin.messages.group.off' | transloco }}</p>
    }

    @if (composing()) {
      <trefaro-group-form (created)="groupCreated()" />
    }

    @if (loaded()) {
      @if (rows().length === 0) {
        <p class="meta">{{ 'admin.messages.empty' | transloco }}</p>
      } @else {
        <ul class="threads">
          @for (row of rows(); track row.id) {
            <li class="thread" [class.thread--waiting]="waiting(row)">
              <a class="thread__link" [routerLink]="['/messages', row.id]">
                <span class="thread__head">
                  <span class="thread__who">{{ who(row) }}</span>
                  <span class="thread__when">{{ when(row) }}</span>
                </span>
                <span class="thread__meta">
                  <span class="tag">{{ kind(row) | transloco }}</span>
                  @if (row.type === 'group') {
                    <span class="meta">{{
                      'admin.messages.members'
                        | transloco: { count: row.memberCount }
                    }}</span>
                  }
                  @if (waiting(row)) {
                    <span class="tag tag--waiting">{{
                      'admin.messages.awaiting' | transloco
                    }}</span>
                  }
                </span>
                <span class="thread__preview">{{ preview(row) }}</span>
              </a>
              @if (row.event; as event) {
                <p class="thread__event">
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
            </li>
          }
        </ul>

        @if (more()) {
          <button type="button" [disabled]="busy()" (click)="loadMore()">
            {{ 'admin.messages.more' | transloco }}
          </button>
        }
      }
    } @else if (!error()) {
      <p class="meta">{{ 'common.loading' | transloco }}</p>
    }
  `,
  styles: `
    :host {
      display: block;
      max-inline-size: 52rem;
    }

    .head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
    }

    h1 {
      margin-block-end: 0.2rem;
    }

    .hint,
    .meta {
      color: var(--trefaro-color-primary-muted);
    }

    .hint--off {
      margin-block: 0.4rem 0.8rem;
    }

    .error {
      color: var(--trefaro-color-danger, #b3261e);
    }

    .error__detail {
      display: block;
      font-size: 0.9rem;
    }

    .threads {
      list-style: none;
      margin: 1rem 0 0;
      padding: 0;
      display: grid;
      gap: 0.5rem;
    }

    .thread {
      border: 1px solid var(--trefaro-color-border);
      border-radius: var(--trefaro-radius-sm, 0.4rem);
      padding-block-end: 0.2rem;
    }

    .thread--waiting {
      border-color: var(--trefaro-color-primary);
    }

    .thread__link {
      display: grid;
      gap: 0.25rem;
      padding: 0.6rem 0.7rem 0.3rem;
      text-decoration: none;
      color: inherit;
    }

    .thread__head {
      display: flex;
      justify-content: space-between;
      gap: 0.7rem;
    }

    .thread__who {
      font-weight: 600;
    }

    .thread__when,
    .thread__event {
      font-size: 0.85rem;
      color: var(--trefaro-color-primary-muted);
    }

    .thread__meta {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.85rem;
    }

    .thread__preview {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .thread__event {
      margin: 0;
      padding-inline: 0.7rem;
    }

    .tag {
      padding: 0.05rem 0.4rem;
      border-radius: 999px;
      background: var(--trefaro-color-primary-soft);
      color: var(--trefaro-color-primary-strong);
    }

    .tag--waiting {
      background: var(--trefaro-color-primary);
      color: var(--trefaro-color-on-primary);
      font-weight: 600;
    }
  `,
})
export class MessagesPage {
  private readonly conversations = inject(ConversationsAdminService);
  private readonly config = inject(AppConfigService);
  private readonly i18n = inject(TranslationService);
  protected readonly site = inject(PublicSite);

  protected readonly rows = signal<readonly OrganizerConversationSummary[]>([]);
  protected readonly error = signal<Problem | null>(null);
  protected readonly busy = signal(false);
  /** Whether an answer has arrived — an empty list is a result, not a wait. */
  protected readonly loaded = signal(false);
  protected readonly composing = signal(false);
  private readonly total = signal(0);

  protected readonly more = computed(() => this.rows().length < this.total());

  /**
   * Whether a group can be assembled at all on this instance (F175).
   *
   * The list itself does not ask: contact requests are P1 and arrive whether
   * or not the chat is switched on, which is the whole reason the switch sits
   * on two routes rather than on the controller.
   */
  protected readonly chatEnabled = computed(() =>
    this.config.isModuleEnabled(CHAT_MODULE_KEY),
  );

  constructor() {
    void this.load();
  }

  /** What a row is called: the person who asked, or the group's subject. */
  protected who(row: OrganizerConversationSummary): string {
    if (row.guest) return row.guest.name ?? row.guest.email;
    if (row.topic) return row.topic;

    // Read for the dependency: this string is chosen in TypeScript, so nothing
    // marks it for redrawing after a language switch on its own (F72).
    this.i18n.locale();
    return this.i18n.translate('admin.messages.unnamed');
  }

  protected kind(row: OrganizerConversationSummary): string {
    return row.type === 'group'
      ? 'admin.messages.group.tag'
      : 'admin.messages.guest';
  }

  protected waiting(row: OrganizerConversationSummary): boolean {
    return awaitsAnswer(row);
  }

  /**
   * The last line, in one line.
   *
   * A message may be a picture alone (E40), which has no text to show — so the
   * word for it comes from the catalogue rather than from an empty preview.
   */
  protected preview(row: OrganizerConversationSummary): string {
    this.i18n.locale();
    if (!row.preview) return this.i18n.translate('admin.messages.noMessages');
    return row.preview.text ?? this.i18n.translate('admin.messages.picture');
  }

  /**
   * When something last happened, in the organizer's own zone.
   *
   * The one place in this client where a time is *not* rendered in an event's
   * zone (E8): a conversation is not an appointment, and "when did this
   * arrive" is a question about the reader's day (F168 decided the same for
   * the participant's chat).
   */
  protected when(row: OrganizerConversationSummary): string {
    if (!row.lastMessageAt) return '';
    return formatInstant(
      row.lastMessageAt,
      localTimeZone(),
      this.i18n.locale(),
    );
  }

  protected toggleGroupForm(): void {
    this.composing.update((open) => !open);
  }

  /** A new group closes the panel and shows up in the list. */
  protected groupCreated(): void {
    this.composing.set(false);
    void this.load();
  }

  private async load(): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      const page = await this.conversations.list({ page: 1 });
      this.rows.set(page.rows);
      this.total.set(page.total);
      this.loaded.set(true);
    } catch (error: unknown) {
      this.error.set(problemOf(error, 'admin.messages.error'));
    } finally {
      this.busy.set(false);
    }
  }

  protected async loadMore(): Promise<void> {
    const page =
      Math.floor(
        this.rows().length / DEFAULT_ORGANIZER_CONVERSATION_PAGE_SIZE,
      ) + 1;

    this.busy.set(true);
    this.error.set(null);
    try {
      const next = await this.conversations.list({ page });
      this.rows.update((rows) => [
        ...rows,
        ...next.rows.filter(
          (row) => !rows.some((shown) => shown.id === row.id),
        ),
      ]);
      this.total.set(next.total);
    } catch (error: unknown) {
      // The rows already on screen stay: a failed further page is no reason to
      // take away what somebody is reading.
      this.error.set(problemOf(error, 'admin.messages.error'));
    } finally {
      this.busy.set(false);
    }
  }
}

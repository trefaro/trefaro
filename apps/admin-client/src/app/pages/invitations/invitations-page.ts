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
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { ApiError } from '@trefaro/shared-http';
import type {
  EventSeries,
  Invitation,
  InvitationPage,
  OrganizerEvent,
  SeriesContact,
  SeriesContactPage,
} from '@trefaro/shared-models';
import {
  MAX_INVITATION_BODY_LENGTH,
  MAX_INVITATION_SUBJECT_LENGTH,
  formatEventPeriod,
  formatInstant,
} from '@trefaro/shared-models';
import { EventSeriesAdminService } from '../../features/event-series/event-series-admin.service';
import { EventsAdminService } from '../../features/events/events-admin.service';
import { InvitationsAdminService } from '../../features/invitations/invitations-admin.service';

/** How often the page asks how far a send has got, while one is running. */
const POLL_MS = 2000;

/**
 * Writing to former participants of a series (UC 03, FR 2.4).
 *
 * Three things on one page, in the order the work happens: who can be written
 * to, what to write, and what was written before. They belong together because
 * the middle one is meaningless without the first — an organizer picks people
 * and then writes to those people, and a two-step wizard would only add a place
 * for the selection to get lost.
 *
 * Two properties are load-bearing:
 *
 * - **The selection survives paging.** It is a set of registration ids in this
 *   component, not the checkboxes on screen, so somebody who selects twelve
 *   people on page one and three on page two writes to fifteen.
 * - **Sending is watched, not waited for.** The server answers as soon as the
 *   recipients are recorded (F56); this page then polls the invitation until
 *   nothing is pending. So an organizer sees "34 of 200" move instead of a
 *   spinner, and closing the tab does not stop the send.
 *
 * What this page cannot do, deliberately: type an address. Every recipient comes
 * from the list, which is the whole difference between this and a newsletter
 * (F55, F8).
 */
@Component({
  selector: 'trefaro-invitations-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    @if (error()) {
      <p class="error" role="alert">{{ error() }}</p>
    }

    <header class="head">
      <div>
        <h1>Invite former participants</h1>
        <p class="meta">
          @if (series(); as item) {
            <a [routerLink]="['/series', item.id]">{{ item.name }}</a>
          }
        </p>
      </div>
    </header>

    <p class="hint">
      These are the addresses that registered for an event of this series and
      confirmed. Every message carries a link to object, and an address that has
      objected is in no list here any more.
    </p>

    <!-- Named sections, so a reader — and a test — can tell the address list
         from the log of what was sent without counting tables. -->
    <section aria-label="Who">
      <h2>Who</h2>

      <form class="filter" (submit)="apply($event)">
        <label>
          <span>Search</span>
          <input
            type="search"
            name="search"
            [value]="search()"
            (input)="typed($event)"
            placeholder="Name or address"
          />
        </label>
        <button type="submit">Search</button>
      </form>

      @if (contacts(); as page) {
        @if (page.rows.length === 0) {
          <p class="meta">
            {{
              search()
                ? 'No address matches that search.'
                : 'Nobody has confirmed a registration for this series yet.'
            }}
          </p>
        } @else {
          <table>
            <thead>
              <tr>
                <th class="tick">
                  <button type="button" (click)="selectPage(page.rows)">
                    {{ allOnPage(page.rows) ? 'None' : 'All' }}
                  </button>
                </th>
                <th>Name</th>
                <th>E-mail</th>
                <th>Events</th>
                <th>Registered</th>
              </tr>
            </thead>
            <tbody>
              @for (contact of page.rows; track contact.registrationId) {
                <tr [class.row--picked]="isSelected(contact)">
                  <td class="tick">
                    <input
                      type="checkbox"
                      [attr.aria-label]="contact.email"
                      [checked]="isSelected(contact)"
                      (change)="toggle(contact)"
                    />
                  </td>
                  <td>{{ contact.lastName }}, {{ contact.firstName }}</td>
                  <!-- The address in the table, as in the participant overview (E13). -->
                  <td>{{ contact.email }}</td>
                  <td>{{ contact.events }}</td>
                  <td>{{ when(contact.lastRegisteredAt) }}</td>
                </tr>
              }
            </tbody>
          </table>

          <div class="pager">
            <button type="button" [disabled]="page.page <= 1" (click)="go(-1)">
              Previous
            </button>
            <span class="meta">
              {{ range(page) }} of {{ page.total }} addresses ·
              {{ selected().size }} selected
            </span>
            <button type="button" [disabled]="!hasMore(page)" (click)="go(1)">
              Next
            </button>
          </div>
        }
      } @else {
        <p class="meta">Loading…</p>
      }
    </section>

    <section aria-label="What">
      <h2>What</h2>
      <form [formGroup]="form" (submit)="send($event)">
        <fieldset [disabled]="busy()">
          <label>
            <span>Subject</span>
            <input
              type="text"
              formControlName="subject"
              [maxlength]="maxSubject"
            />
          </label>

          <label>
            <span>Message</span>
            <textarea
              formControlName="body"
              rows="8"
              [maxlength]="maxBody"
            ></textarea>
            <small class="meta">
              Plain text. A blank line starts a new paragraph. The greeting and
              the objection link are added for you.
            </small>
          </label>

          <label>
            <span>Invite to</span>
            <select formControlName="eventId">
              <option value="">No particular event</option>
              @for (event of events(); track event.id) {
                <option [value]="event.id">
                  {{ event.name }} — {{ period(event) }}
                </option>
              }
            </select>
          </label>

          <button type="submit" [disabled]="selected().size === 0">
            {{ sendLabel() }}
          </button>
        </fieldset>
      </form>
      @if (notice()) {
        <p class="notice" role="status">{{ notice() }}</p>
      }
    </section>

    <section aria-label="Sent before">
      <h2>Sent before</h2>
      @if (invitations(); as page) {
        @if (page.rows.length === 0) {
          <p class="meta">Nothing has been sent for this series yet.</p>
        } @else {
          <table>
            <thead>
              <tr>
                <th>Subject</th>
                <th>Sent</th>
                <th>Recipients</th>
                <th>Progress</th>
              </tr>
            </thead>
            <tbody>
              @for (invitation of page.rows; track invitation.id) {
                <tr>
                  <td>{{ invitation.subject }}</td>
                  <td>{{ when(invitation.createdAt) }}</td>
                  <td>{{ invitation.recipients }}</td>
                  <td>{{ progress(invitation) }}</td>
                </tr>
              }
            </tbody>
          </table>
        }
      } @else {
        <p class="meta">Loading…</p>
      }
    </section>
  `,
  styles: `
    :host {
      display: block;
    }

    .head {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      align-items: flex-start;
    }

    .hint {
      max-inline-size: 46rem;
      color: var(--trefaro-color-primary-strong);
    }

    section {
      margin-block-start: 2rem;
    }

    .filter {
      display: flex;
      gap: 0.6rem;
      align-items: flex-end;
      margin-block-end: 1rem;
    }

    label {
      display: block;
      margin-block-end: 1rem;
    }

    label > span {
      display: block;
      font-weight: 600;
      margin-block-end: 0.25rem;
    }

    input[type='text'],
    input[type='search'],
    textarea,
    select {
      inline-size: 100%;
      max-inline-size: 40rem;
      padding: 0.5rem;
      font: inherit;
    }

    fieldset {
      border: 0;
      padding: 0;
      margin: 0;
    }

    table {
      inline-size: 100%;
      border-collapse: collapse;
    }

    th,
    td {
      text-align: start;
      padding: 0.45rem 0.6rem;
      border-block-end: 1px solid var(--trefaro-color-border, #d8d8d8);
    }

    .tick {
      inline-size: 3rem;
    }

    .row--picked {
      background: var(--trefaro-color-surface-accent, #f4f0e6);
    }

    .pager {
      display: flex;
      gap: 1rem;
      align-items: center;
      margin-block-start: 0.75rem;
    }

    .meta {
      color: var(--trefaro-color-muted, #555);
    }

    .error,
    .notice {
      color: var(--trefaro-color-primary-strong);
    }
  `,
})
export class InvitationsPage {
  readonly seriesId = input.required<string>();

  private readonly invitationsApi = inject(InvitationsAdminService);
  private readonly seriesApi = inject(EventSeriesAdminService);
  private readonly eventsApi = inject(EventsAdminService);
  private readonly forms = inject(FormBuilder);

  protected readonly maxSubject = MAX_INVITATION_SUBJECT_LENGTH;
  protected readonly maxBody = MAX_INVITATION_BODY_LENGTH;

  protected readonly series = signal<EventSeries | null>(null);
  protected readonly events = signal<readonly OrganizerEvent[]>([]);
  protected readonly contacts = signal<SeriesContactPage | null>(null);
  protected readonly invitations = signal<InvitationPage | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly busy = signal(false);

  /**
   * The chosen registration ids.
   *
   * Kept here rather than read off the checkboxes, so a selection made on page
   * one is still a selection on page two.
   */
  protected readonly selected = signal<ReadonlySet<string>>(new Set());
  protected readonly search = signal('');
  private readonly page = signal(1);
  private typing = '';

  private timer: ReturnType<typeof setTimeout> | null = null;

  protected readonly form = this.forms.nonNullable.group({
    subject: ['', [Validators.required, Validators.maxLength(this.maxSubject)]],
    body: ['', [Validators.required, Validators.maxLength(this.maxBody)]],
    eventId: [''],
  });

  protected readonly sendLabel = computed(() => {
    if (this.busy()) return 'Sending…';
    const count = this.selected().size;
    return count === 0
      ? 'Select somebody first'
      : `Send to ${count} ${count === 1 ? 'address' : 'addresses'}`;
  });

  constructor() {
    // The route can change under the page (a second series from the list), so
    // everything is reloaded from the id rather than once in a constructor.
    effect(() => {
      const seriesId = this.seriesId();
      this.selected.set(new Set());
      void this.load(seriesId);
    });

    inject(DestroyRef).onDestroy(() => this.stopPolling());
  }

  protected isSelected(contact: SeriesContact): boolean {
    return this.selected().has(contact.registrationId);
  }

  protected allOnPage(rows: readonly SeriesContact[]): boolean {
    const chosen = this.selected();
    return rows.every((row) => chosen.has(row.registrationId));
  }

  protected toggle(contact: SeriesContact): void {
    const next = new Set(this.selected());
    if (!next.delete(contact.registrationId)) {
      next.add(contact.registrationId);
    }
    this.selected.set(next);
  }

  /** All of this page, or none of it if they are already all chosen. */
  protected selectPage(rows: readonly SeriesContact[]): void {
    const next = new Set(this.selected());
    const remove = this.allOnPage(rows);
    for (const row of rows) {
      if (remove) next.delete(row.registrationId);
      else next.add(row.registrationId);
    }
    this.selected.set(next);
  }

  protected typed(event: Event): void {
    this.typing = (event.target as HTMLInputElement).value;
  }

  protected apply(event: Event): void {
    event.preventDefault();
    this.search.set(this.typing.trim());
    this.page.set(1);
    void this.loadContacts();
  }

  protected go(step: number): void {
    this.page.update((current) => Math.max(1, current + step));
    void this.loadContacts();
  }

  protected hasMore(page: SeriesContactPage): boolean {
    return page.page * page.pageSize < page.total;
  }

  protected range(page: SeriesContactPage): string {
    const first = (page.page - 1) * page.pageSize + 1;
    return `${first}–${first + page.rows.length - 1}`;
  }

  protected when(iso: string): string {
    return formatInstant(iso, this.zone());
  }

  protected period(event: OrganizerEvent): string {
    return formatEventPeriod(event);
  }

  protected progress(invitation: Invitation): string {
    if (invitation.state === 'sending') {
      return `Sending… ${invitation.sent} of ${invitation.recipients}`;
    }
    return invitation.failed > 0
      ? `${invitation.sent} sent, ${invitation.failed} could not be delivered`
      : `${invitation.sent} sent`;
  }

  protected async send(event: Event): Promise<void> {
    event.preventDefault();
    if (this.busy() || this.form.invalid || this.selected().size === 0) return;

    this.busy.set(true);
    this.error.set(null);
    this.notice.set(null);

    const raw = this.form.getRawValue();
    try {
      const invitation = await this.invitationsApi.send(this.seriesId(), {
        subject: raw.subject.trim(),
        body: raw.body.trim(),
        eventId: raw.eventId || null,
        recipients: [...this.selected()],
      });

      this.notice.set(
        `${invitation.recipients} ${
          invitation.recipients === 1 ? 'message is' : 'messages are'
        } on their way. You can leave this page — sending continues.`,
      );
      this.form.reset({ subject: '', body: '', eventId: '' });
      this.selected.set(new Set());
      // The addresses may have changed: somebody could have objected between
      // loading the list and sending.
      await Promise.all([this.loadContacts(), this.loadInvitations()]);
    } catch (failure: unknown) {
      this.error.set(
        (failure as ApiError)?.message ??
          'The invitation could not be sent. Please try again.',
      );
    } finally {
      this.busy.set(false);
    }
  }

  private async load(seriesId: string): Promise<void> {
    this.stopPolling();
    this.contacts.set(null);
    this.invitations.set(null);

    try {
      const [series, events] = await Promise.all([
        this.seriesApi.get(seriesId),
        this.eventsApi.listBySeries(seriesId),
      ]);
      this.series.set(series);
      this.events.set(events);
    } catch (failure: unknown) {
      this.error.set(
        (failure as ApiError)?.message ?? 'This event series no longer exists.',
      );
      return;
    }

    await Promise.all([this.loadContacts(), this.loadInvitations()]);
  }

  private async loadContacts(): Promise<void> {
    try {
      this.contacts.set(
        await this.invitationsApi.contacts(this.seriesId(), {
          search: this.search() || undefined,
          page: this.page(),
        }),
      );
    } catch (failure: unknown) {
      this.error.set(
        (failure as ApiError)?.message ?? 'The address list could not be read.',
      );
    }
  }

  private async loadInvitations(): Promise<void> {
    try {
      const page = await this.invitationsApi.list(this.seriesId(), {});
      this.invitations.set(page);
      this.watch(page);
    } catch (failure: unknown) {
      this.error.set(
        (failure as ApiError)?.message ??
          'What has been sent could not be read.',
      );
    }
  }

  /**
   * Asks again in a moment while anything is still going out (F56).
   *
   * Polling rather than a socket: this is the one screen in the application
   * where something is in flight for minutes, and a WebSocket for it would be a
   * second transport to keep alive through NGINX for one progress bar.
   */
  private watch(page: InvitationPage): void {
    this.stopPolling();
    if (!page.rows.some((row) => row.state === 'sending')) return;

    this.timer = setTimeout(() => {
      this.timer = null;
      void this.loadInvitations();
    }, POLL_MS);
  }

  private stopPolling(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  /** The organizer's own zone: an invitation is not an event with a venue. */
  private zone(): string {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }
}

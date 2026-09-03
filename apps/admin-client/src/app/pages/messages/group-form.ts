import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { problemOf, type Problem } from '@trefaro/shared-http';
import { TranslationService } from '@trefaro/shared-i18n';
import {
  MAX_GROUP_TOPIC_LENGTH,
  formatEventPeriod,
  type GroupCandidate,
  type OrganizerEvent,
} from '@trefaro/shared-models';
import { ConversationsAdminService } from '../../features/chat/conversations-admin.service';
import { EventSeriesAdminService } from '../../features/event-series/event-series-admin.service';
import { EventsAdminService } from '../../features/events/events-admin.service';

/**
 * Assembling a group around an event (FR 4.5, E39 — AP 10).
 *
 * Three questions in the order the data requires them: which event, what the
 * group is about, and who is in it. The event comes first because it decides
 * the third — members are the people who confirmed a place — and it is picked
 * through its series, because an event's address is unique within one (E7) and
 * this client has no flat list of every event in the instance.
 *
 * Two properties are deliberate:
 *
 * - **Nobody can be typed in.** Every member comes from the candidate list,
 *   the same difference between this and a mailing that F55 draws for the
 *   invitation. The server derives the eligible set again when it writes the
 *   memberships, so this list is convenience rather than the rule.
 * - **Somebody without an account is absent, and the screen says why.** A
 *   membership points at a profile; a person who registered without creating
 *   an account is reached by mail instead (FR 2.4). An empty list that
 *   explained nothing would read as a bug at the very moment an organizer is
 *   wondering where their participants are.
 */
@Component({
  selector: 'trefaro-group-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe],
  template: `
    <section
      class="panel"
      [attr.aria-label]="'admin.messages.group.title' | transloco"
    >
      <h2>{{ 'admin.messages.group.title' | transloco }}</h2>
      <p class="hint">{{ 'admin.messages.group.lead' | transloco }}</p>

      @if (error(); as problem) {
        <p class="error" role="alert">
          {{ problem.key | transloco }}
          @if (problem.detail; as detail) {
            <span class="error__detail">{{ detail }}</span>
          }
        </p>
      }

      <div class="row">
        <label>
          <span>{{ 'admin.messages.group.series' | transloco }}</span>
          <select [value]="seriesId()" (change)="pickSeries($event)">
            <option value="">
              {{ 'admin.messages.group.pick' | transloco }}
            </option>
            @for (item of series(); track item.id) {
              <option [value]="item.id">{{ item.name }}</option>
            }
          </select>
        </label>

        <label>
          <span>{{ 'admin.messages.group.event' | transloco }}</span>
          <select
            [value]="eventId()"
            [disabled]="events().length === 0"
            (change)="pickEvent($event)"
          >
            <option value="">
              {{ 'admin.messages.group.pick' | transloco }}
            </option>
            @for (event of events(); track event.id) {
              <option [value]="event.id">{{ label(event) }}</option>
            }
          </select>
        </label>
      </div>

      <label class="topic">
        <span>{{ 'admin.messages.group.topic' | transloco }}</span>
        <input
          type="text"
          [value]="topic()"
          [attr.maxlength]="maxTopic"
          (input)="typedTopic($event)"
        />
      </label>

      @if (eventId()) {
        <fieldset>
          <legend>
            {{ 'admin.messages.group.members' | transloco }}
            <span class="meta">{{
              'admin.messages.group.selected'
                | transloco: { count: selected().size }
            }}</span>
          </legend>

          @if (candidates().length === 0) {
            <p class="meta">
              {{ 'admin.messages.group.noCandidates' | transloco }}
            </p>
          } @else {
            <p class="bulk">
              <button type="button" (click)="selectAll()">
                {{ 'admin.messages.group.all' | transloco }}
              </button>
              <button type="button" (click)="selectNone()">
                {{ 'admin.messages.group.none' | transloco }}
              </button>
            </p>
            <ul class="people">
              @for (person of candidates(); track person.profileId) {
                <li>
                  <label>
                    <input
                      type="checkbox"
                      [checked]="selected().has(person.profileId)"
                      (change)="toggle(person)"
                    />
                    <span>{{ person.name }}</span>
                    <!-- The address in the row, as everywhere an organizer
                         reads a list of people (E13): two people share a name. -->
                    <span class="meta">{{ person.email }}</span>
                  </label>
                </li>
              }
            </ul>
          }
        </fieldset>
      }

      <p class="actions">
        <button
          type="button"
          [disabled]="!ready() || busy()"
          (click)="create()"
        >
          {{
            (busy()
              ? 'admin.messages.group.creating'
              : 'admin.messages.group.create'
            ) | transloco
          }}
        </button>
      </p>
    </section>
  `,
  styles: `
    .panel {
      margin-block: 1rem;
      padding: 0.8rem 1rem;
      border: 1px solid var(--trefaro-color-border);
      border-radius: var(--trefaro-radius-sm, 0.4rem);
      background: var(--trefaro-color-primary-soft);
    }

    h2 {
      margin-block: 0 0.2rem;
      font-size: 1.1rem;
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

    .row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.8rem;
    }

    label {
      display: grid;
      gap: 0.2rem;
    }

    .topic input {
      inline-size: min(100%, 26rem);
    }

    fieldset {
      margin-block: 0.8rem 0;
      border: 1px solid var(--trefaro-color-border);
      border-radius: var(--trefaro-radius-sm, 0.4rem);
    }

    legend {
      font-weight: 600;
    }

    .bulk {
      display: flex;
      gap: 0.5rem;
      margin-block: 0.2rem 0.5rem;
    }

    .people {
      list-style: none;
      margin: 0;
      padding: 0;
      max-block-size: 14rem;
      overflow-y: auto;
    }

    .people label {
      display: flex;
      align-items: baseline;
      gap: 0.5rem;
    }

    .actions {
      margin-block-end: 0;
    }
  `,
})
export class GroupForm {
  private readonly conversations = inject(ConversationsAdminService);
  private readonly seriesAdmin = inject(EventSeriesAdminService);
  private readonly eventsAdmin = inject(EventsAdminService);
  private readonly router = inject(Router);
  private readonly i18n = inject(TranslationService);

  /** A group was created — the list reloads and this panel closes. */
  readonly created = output<void>();

  protected readonly maxTopic = MAX_GROUP_TOPIC_LENGTH;

  protected readonly series = this.seriesAdmin.series;
  protected readonly events = signal<readonly OrganizerEvent[]>([]);
  protected readonly candidates = signal<readonly GroupCandidate[]>([]);
  protected readonly seriesId = signal('');
  protected readonly eventId = signal('');
  protected readonly topic = signal('');
  protected readonly selected = signal<ReadonlySet<string>>(new Set());
  protected readonly error = signal<Problem | null>(null);
  protected readonly busy = signal(false);

  protected readonly ready = computed(
    () =>
      this.eventId() !== '' &&
      this.topic().trim().length > 0 &&
      this.selected().size > 0,
  );

  constructor() {
    void this.seriesAdmin.reload();
  }

  protected label(event: OrganizerEvent): string {
    return `${event.name} — ${formatEventPeriod(event, this.i18n.locale())}`;
  }

  protected async pickSeries(nativeEvent: Event): Promise<void> {
    const id = (nativeEvent.target as HTMLSelectElement).value;
    this.seriesId.set(id);
    // Everything below the series is about the old one, so it goes: an event
    // list from another series with a selection made in it is the state this
    // form must never be able to submit.
    this.eventId.set('');
    this.events.set([]);
    this.candidates.set([]);
    this.selected.set(new Set());
    if (!id) return;

    try {
      this.events.set(await this.eventsAdmin.listBySeries(id));
    } catch (error: unknown) {
      this.error.set(problemOf(error, 'admin.messages.group.eventsFailed'));
    }
  }

  protected async pickEvent(nativeEvent: Event): Promise<void> {
    const id = (nativeEvent.target as HTMLSelectElement).value;
    this.eventId.set(id);
    this.selected.set(new Set());
    this.candidates.set([]);
    if (!id) return;

    try {
      this.candidates.set(await this.conversations.candidates(id));
    } catch (error: unknown) {
      this.error.set(problemOf(error, 'admin.messages.group.candidatesFailed'));
    }
  }

  protected typedTopic(nativeEvent: Event): void {
    this.topic.set((nativeEvent.target as HTMLInputElement).value);
  }

  protected toggle(person: GroupCandidate): void {
    this.selected.update((selected) => {
      const next = new Set(selected);
      if (!next.delete(person.profileId)) next.add(person.profileId);
      return next;
    });
  }

  protected selectAll(): void {
    this.selected.set(
      new Set(this.candidates().map((person) => person.profileId)),
    );
  }

  protected selectNone(): void {
    this.selected.set(new Set());
  }

  /**
   * Creates the group and goes to it.
   *
   * Straight into the thread, because a group starts empty: the next thing an
   * organizer does is write the first line, and a list row that says "nothing
   * written yet" is not where that happens.
   */
  protected async create(): Promise<void> {
    if (!this.ready()) return;

    this.busy.set(true);
    this.error.set(null);
    try {
      const group = await this.conversations.createGroup({
        eventId: this.eventId(),
        topic: this.topic().trim(),
        profileIds: [...this.selected()],
      });
      this.created.emit();
      await this.router.navigate(['/messages', group.id]);
    } catch (error: unknown) {
      this.error.set(problemOf(error, 'admin.messages.group.failed'));
    } finally {
      this.busy.set(false);
    }
  }
}

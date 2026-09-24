import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import type { PersonalProgramItem } from '@trefaro/shared-models';
import { NotSignedInError } from '@trefaro/shared-plugin-kit';
import { PersonalProgramApi } from './personal-program-api';
import { clock, day, word } from './plugin-words';

/** One day of the programme, in the reader's own clock. */
interface ProgrammeDay {
  readonly label: string;
  readonly items: readonly PersonalProgramItem[];
}

/**
 * The personal programme as a web component (FR 3.17).
 *
 * Exported through Angular Elements as `<trefaro-plugin-personal-program>` and
 * mounted by the participant client at the `event-detail` hook point. **The
 * only bundle of the five that is not a switch**: this plug-in declares one
 * hook point, so a `mountPoint` input would be a value nothing reads (E21) —
 * F202's usefulness is in the bundles that draw two different things.
 *
 * Mounted for everybody and behind a session for everything: without one it
 * shows an invitation to log in, because a section that appeared only to those
 * already logged in would be a feature nobody hears about (E58).
 *
 * **It asks again when the language changes** (E56): the titles are translated
 * on the server, so `locale` is part of the request and a switch is a new read.
 * And it **keeps the answer it asked for last** — two reads are in flight the
 * moment somebody switches before the first has landed, and the network does
 * not answer in order.
 *
 * **The times are the venue's clock, and so is the grouping** (E8, E69). Every
 * session carries the event's zone since plug-in API 1.3.0, so a plan says the
 * hours the programme says — and the day headings are cut where the *event's*
 * day ends, which is where an evening session belongs. Both were the reader's
 * own clock before, which agreed with the programme only for somebody standing
 * at the venue.
 *
 * Its styling uses only the `--trefaro-*` custom properties the host document
 * defines, never a colour or font of its own.
 */
@Component({
  selector: 'trefaro-personal-program-plugin',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel">
      <h2 class="panel__title">{{ text().title }}</h2>

      @if (message(); as sentence) {
        <p class="note" role="status">{{ sentence }}</p>
      } @else if (loading()) {
        <p class="note">{{ text().loading }}</p>
      } @else {
        <p class="note">{{ text().intro }}</p>

        @if (failed()) {
          <p class="note note--error" role="alert">{{ text().error }}</p>
        }

        @if (items().length === 0) {
          <p class="note">{{ text().emptyProgram }}</p>
        } @else {
          <!-- A filter, not a second list: the plan is a mark on the
               programme, so "only mine" hides rows rather than asking again. -->
          <button
            type="button"
            class="filter"
            [attr.aria-pressed]="onlyMine()"
            (click)="toggleFilter()"
          >
            {{ onlyMine() ? text().whole : text().onlyMine }}
          </button>

          @if (days().length === 0) {
            <p class="note">{{ text().emptyPlan }}</p>
          }

          @for (group of days(); track group.label) {
            <h3 class="day">{{ group.label }}</h3>
            <ul class="sessions">
              @for (item of group.items; track item.programItemId) {
                <li class="session" [class.session--mine]="item.inPlan">
                  <p class="session__when">{{ slot(item) }}</p>
                  <p class="session__title">{{ item.title }}</p>

                  @if (item.registrationEnabled) {
                    <!-- Where a seat is actually booked (E55). The number of
                         seats stays out: without how many are taken it reads
                         as "still free", which is a promise this plug-in
                         cannot keep. -->
                    <p class="session__seats">
                      {{ text().signupNote }}
                      @if (item.capacity !== null) {
                        · {{ text().limited }}
                      }
                    </p>
                  }

                  <button
                    type="button"
                    class="session__toggle"
                    [disabled]="busy().has(item.programItemId)"
                    (click)="toggle(item)"
                  >
                    {{ item.inPlan ? text().remove : text().add }}
                  </button>

                  @if (item.inPlan) {
                    <p class="session__mark">{{ text().inPlan }}</p>
                  }
                </li>
              }
            </ul>
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

    .panel__title {
      margin: 0 0 0.8rem;
      font-size: 1.05rem;
    }

    .note {
      margin: 0 0 0.6rem;
      font-size: 0.9rem;
      color: color-mix(in oklab, currentColor 70%, transparent);
    }

    .note--error {
      color: inherit;
      font-weight: 600;
    }

    .filter {
      font: inherit;
      font-size: 0.85rem;
      padding: 0.35rem 0.7rem;
      border-radius: 999px;
      border: 1px solid color-mix(in oklab, currentColor 25%, transparent);
      background: transparent;
      color: inherit;
      cursor: pointer;
    }

    .filter[aria-pressed='true'] {
      border-color: var(--trefaro-color-primary, #1f6f5c);
      color: var(--trefaro-color-primary, #1f6f5c);
    }

    .day {
      margin: 1rem 0 0.4rem;
      font-size: 0.9rem;
      letter-spacing: 0.02em;
      color: color-mix(in oklab, currentColor 70%, transparent);
    }

    .sessions {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    /* Mobile first: one column, the button under the title where a thumb
       reaches it. The two-column form is the exception, not the base. */
    .session {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 0.15rem;
      padding: 0.6rem 0.7rem;
      border: 1px solid color-mix(in oklab, currentColor 12%, transparent);
      border-radius: 0.5rem;
    }

    .session--mine {
      border-color: var(--trefaro-color-primary, #1f6f5c);
    }

    .session p {
      margin: 0;
    }

    .session__when {
      font-size: 0.85rem;
      font-variant-numeric: tabular-nums;
      color: var(--trefaro-color-primary, #1f6f5c);
    }

    .session__title {
      font-weight: 600;
    }

    .session__seats,
    .session__mark {
      font-size: 0.8rem;
      color: color-mix(in oklab, currentColor 70%, transparent);
    }

    .session__toggle {
      justify-self: start;
      margin-block-start: 0.35rem;
      font: inherit;
      font-size: 0.85rem;
      padding: 0.35rem 0.8rem;
      border-radius: 0.4rem;
      border: 1px solid var(--trefaro-color-primary, #1f6f5c);
      background: transparent;
      color: var(--trefaro-color-primary, #1f6f5c);
      cursor: pointer;
    }

    .session__toggle:disabled {
      cursor: progress;
      opacity: 0.6;
    }

    @media (min-width: 34rem) {
      .session {
        grid-template-columns: minmax(0, auto) minmax(0, 1fr) auto;
        align-items: baseline;
        column-gap: 0.8rem;
      }

      .session__seats,
      .session__mark {
        grid-column: 2;
      }

      .session__toggle {
        grid-row: 1 / span 3;
        grid-column: 3;
        margin-block-start: 0;
        align-self: center;
      }
    }
  `,
})
export class PersonalProgramPlugin {
  /**
   * The event this hook point is about, as an element property.
   *
   * Angular Elements exposes an input as a DOM property, so a client written
   * without Angular sets `element.eventId = '…'` just the same.
   */
  readonly eventId = input<string | null>(null);

  /** Active locale, so the plug-in follows the instance's language (E48). */
  readonly locale = input<string>('en');

  /**
   * This plug-in's words, keyed without the `plugins.personalProgram.` prefix.
   *
   * Reassigned by the host on a language switch rather than the element being
   * replaced, so the filter a reader set survives one.
   */
  readonly strings = input<Readonly<Record<string, string>>>({});

  private readonly api = inject(PersonalProgramApi);

  protected readonly items = signal<readonly PersonalProgramItem[]>([]);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly onlyMine = signal(false);
  /** Sessions with a write in flight, so a row cannot be pressed twice. */
  protected readonly busy = signal<ReadonlySet<string>>(new Set());
  /** A catalogue key to show instead of the programme, or the empty string. */
  private readonly problem = signal('');
  /** Counts the reads, so a late answer to an earlier one is dropped. */
  private loadSequence = 0;

  protected readonly text = computed(() => {
    const strings = this.strings();
    const say = (key: string): string => word(strings, key);
    return {
      title: say('title'),
      intro: say('intro'),
      loading: say('loading'),
      error: say('error'),
      emptyProgram: say('emptyProgram'),
      emptyPlan: say('emptyPlan'),
      add: say('add'),
      remove: say('remove'),
      inPlan: say('inPlan'),
      signupNote: say('signupNote'),
      limited: say('limited'),
      onlyMine: say('onlyMine'),
      whole: say('whole'),
    };
  });

  /** The sentence in place of the programme, resolved after a switch. */
  protected readonly message = computed(() => {
    const key = this.problem();
    return key ? word(this.strings(), key) : '';
  });

  /**
   * The rows, grouped by the day they fall on **at the venue**.
   *
   * Grouped on the rendered day rather than on the ISO date: a session late in
   * the evening falls on a different date in UTC than on the event's clock,
   * and a heading that disagreed with the rows under it would be worse than no
   * heading at all. The zone comes from the session (E69); before it did, an
   * evening session read from the west landed under the day before.
   */
  protected readonly days = computed<readonly ProgrammeDay[]>(() => {
    const locale = this.locale();
    const groups: { label: string; items: PersonalProgramItem[] }[] = [];
    for (const item of this.visible()) {
      const label = day(locale, item.startsAt, item.timezone);
      const last = groups.at(-1);
      if (last?.label === label) last.items.push(item);
      else groups.push({ label, items: [item] });
    }
    return groups;
  });

  private readonly visible = computed(() =>
    this.onlyMine() ? this.items().filter((item) => item.inPlan) : this.items(),
  );

  constructor() {
    effect(() => {
      const eventId = this.eventId();
      // Read here so the effect runs again on a switch: the titles are the
      // server's translations, and a redraw alone would keep the old ones.
      const locale = this.locale();
      if (!eventId) return;
      void this.load(eventId, locale);
    });
  }

  protected slot(item: PersonalProgramItem): string {
    const locale = this.locale();
    return (
      `${clock(locale, item.startsAt, item.timezone)}` +
      `–${clock(locale, item.endsAt, item.timezone)}`
    );
  }

  protected toggleFilter(): void {
    this.onlyMine.update((only) => !only);
  }

  /**
   * In or out, whichever this session is not.
   *
   * The row is written in place rather than the programme being read again: a
   * 204 says the state is what was asked for, and re-reading would move the
   * page under a thumb that is about to press the next row.
   */
  protected async toggle(item: PersonalProgramItem): Promise<void> {
    const id = item.programItemId;
    if (this.busy().has(id)) return;
    this.busy.update((busy) => new Set(busy).add(id));
    this.failed.set(false);

    try {
      if (item.inPlan) await this.api.remove(id);
      else await this.api.add(id);
      this.items.update((rows) =>
        rows.map((row) =>
          row.programItemId === id ? { ...row, inPlan: !item.inPlan } : row,
        ),
      );
    } catch (error: unknown) {
      // A session that vanished, a session that expired, a network that did
      // not answer: the row stays as it was, and the sentence says so.
      if (error instanceof NotSignedInError) this.problem.set('signIn');
      else this.failed.set(true);
    } finally {
      this.busy.update((busy) => {
        const next = new Set(busy);
        next.delete(id);
        return next;
      });
    }
  }

  private async load(eventId: string, locale: string): Promise<void> {
    const run = ++this.loadSequence;
    this.loading.set(true);
    this.problem.set('');
    try {
      const items = await this.api.plan(eventId, locale);
      if (run !== this.loadSequence) return;
      this.items.set(items);
      this.failed.set(false);
    } catch (error: unknown) {
      if (run !== this.loadSequence) return;
      this.items.set([]);
      // Not a failure but a state (E58): the element is mounted for everybody,
      // and somebody without a session is invited to get one.
      if (error instanceof NotSignedInError) this.problem.set('signIn');
      else this.failed.set(true);
    } finally {
      if (run === this.loadSequence) this.loading.set(false);
    }
  }
}
